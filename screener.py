#!/usr/bin/env python3
"""
Weekly small/mid-cap value + quality + dividend-growth stock screener.

Data sources (all free, no API key required):
  - SEC bulk ticker/exchange list  (stage 0: build the market universe)
  - SEC XBRL "companyfacts" API   (stage 2: 5Y revenue/margin/EPS/dividend history)
  - Yahoo Finance "chart" endpoint (stage 2: current + historical price, splits)

SEC's Fair Access policy requires a descriptive User-Agent with contact
information for all requests to sec.gov / data.sec.gov, hence --contact-email.

Screening criteria:
  Stage 1 (cheap, universe-wide filter):
    - Listed on Nasdaq or NYSE, one ticker per company (drops preferred
      shares / warrants / notes that share a CIK with their common stock --
      their price isn't tied 1:1 to per-common-share EPS)
  Stage 2 (final, per-candidate; requires >= 5 years of 10-K history):
    - Market cap                 $300M - $2B (small/mid cap)
    - Gross margin (5Y average)  >= 40% (>= 50% flagged as premium)
    - Gross margin decline       <= 15% relative, oldest vs. most recent of the 5Y window
    - Dividend yield             >= 2%
    - P/E (KGV)                  < 25 (< 15 flagged as premium)
                                  OR current P/E <= 1.15x its own 5Y-average P/E
    - Payout ratio               <= 50% (dividends per share / EPS)
    - Dividend growth            >= 5%/year (CAGR) over the last 5 years
    - EPS growth                 >= 25% over the last 3 years
"""
import argparse
import json
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta, timezone

SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers_exchange.json"
SEC_FACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json"
YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"

STAGE1_EXCHANGES = {"Nasdaq", "NYSE"}

HISTORY_YEARS = 5

MIN_MARKET_CAP = 300_000_000
MAX_MARKET_CAP = 2_000_000_000

MIN_GROSS_MARGIN = 0.40
PREMIUM_GROSS_MARGIN = 0.50
MAX_GROSS_MARGIN_DECLINE = 0.15

MIN_DIVIDEND_YIELD = 0.02

MAX_PE = 25.0
PREMIUM_PE = 15.0
MAX_PE_VS_5Y_AVG = 0.15

MAX_PAYOUT_RATIO = 0.50
MIN_DIVIDEND_CAGR_5Y = 0.05
MIN_EPS_GROWTH_3Y = 0.25

SEC_MAX_REQ_PER_SEC = 8
YAHOO_MAX_REQ_PER_SEC = 5
MAX_WORKERS = 8
REQUEST_TIMEOUT = 25
MAX_RETRIES = 2

WATCHLIST_PATH = "watchlist.json"

REVENUE_CONCEPTS = [
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "Revenues",
    "SalesRevenueNet",
]
COST_OF_REVENUE_CONCEPTS = [
    "CostOfGoodsAndServicesSold",
    "CostOfRevenue",
    "CostOfGoodsSold",
]
GROSS_PROFIT_CONCEPTS = ["GrossProfit"]
EPS_CONCEPTS = ["EarningsPerShareDiluted", "EarningsPerShareBasic"]
DPS_CONCEPTS = [
    "CommonStockDividendsPerShareDeclared",
    "CommonStockDividendsPerShareCashPaid",
]


class RateLimiter:
    """Simple thread-safe sliding-window rate limiter."""

    def __init__(self, max_per_sec):
        self.max_per_sec = max_per_sec
        self.lock = threading.Lock()
        self.timestamps = []

    def acquire(self):
        while True:
            with self.lock:
                now = time.monotonic()
                self.timestamps = [t for t in self.timestamps if now - t < 1.0]
                if len(self.timestamps) < self.max_per_sec:
                    self.timestamps.append(now)
                    return
                sleep_for = 1.0 - (now - self.timestamps[0])
            time.sleep(max(sleep_for, 0.01))


class ApiCallCounter:
    def __init__(self):
        self.lock = threading.Lock()
        self.count = 0

    def increment(self):
        with self.lock:
            self.count += 1
            return self.count


def http_get_json(url, headers, limiter, counter):
    last_error = None
    for attempt in range(MAX_RETRIES + 1):
        limiter.acquire()
        counter.increment()
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError) as exc:
            last_error = exc
            if attempt < MAX_RETRIES:
                time.sleep(0.5 * (attempt + 1))
    print(f"  [skip] {url} -> {last_error}", file=sys.stderr)
    return None


def fetch_universe(sec_headers, limiter, counter):
    data = http_get_json(SEC_TICKERS_URL, sec_headers, limiter, counter)
    if data is None:
        print("FATAL: could not load SEC ticker universe.", file=sys.stderr)
        sys.exit(1)
    idx = {name: i for i, name in enumerate(data["fields"])}
    universe = []
    for row in data["data"]:
        universe.append({
            "cik": row[idx["cik"]],
            "name": row[idx["name"]],
            "ticker": row[idx["ticker"]],
            "exchange": row[idx["exchange"]],
        })
    return universe


def _ticker_rank(ticker):
    """Lower rank = more likely to be the primary common-stock ticker.
    Preferred shares, warrants, notes etc. share their parent's CIK but use
    a longer/hyphenated ticker (e.g. JPM vs JPM-PM, HBAN vs HBANP, NE vs
    NE-WT) -- prefer the shortest, non-hyphenated ticker per CIK."""
    return ("-" in ticker, len(ticker), ticker)


def stage1_filter(universe):
    """Nasdaq/NYSE listed, one ticker per company (drop preferred shares,
    warrants, and notes that share a CIK with their common-stock parent --
    their price isn't tied 1:1 to the company's per-common-share EPS, so
    computing P/E or dividend yield against them produces nonsense)."""
    listed = [c for c in universe if c["exchange"] in STAGE1_EXCHANGES]
    best_by_cik = {}
    for c in listed:
        current = best_by_cik.get(c["cik"])
        if current is None or _ticker_rank(c["ticker"]) < _ticker_rank(current["ticker"]):
            best_by_cik[c["cik"]] = c
    return list(best_by_cik.values())


def annual_series(facts_taxonomy, concept_names, max_years=HISTORY_YEARS + 2):
    """Merge one or more XBRL concepts (in priority order, to handle
    companies that switched tagging conventions, e.g. ASC 606 adoption)
    into a single (period_end_date, value) series, one point per fiscal
    year, using each concept's most-recently-*filed* value for a given
    period (later 10-Ks sometimes restate prior-year comparatives)."""
    combined = {}
    for concept in concept_names:
        concept_data = facts_taxonomy.get(concept)
        if not concept_data:
            continue
        for unit_values in concept_data.get("units", {}).values():
            annual = [
                v for v in unit_values
                if v.get("form") == "10-K" and v.get("fp") == "FY"
            ]
            if not annual:
                continue
            annual.sort(key=lambda v: v.get("filed", ""))
            per_concept = {}
            for v in annual:
                per_concept[v["end"]] = v["val"]
            for end, val in per_concept.items():
                combined.setdefault(end, val)
    return sorted(combined.items())[-max_years:]


def most_recent_instant_value(facts_taxonomy, concept_names):
    """Return (value, as_of_date) for the most recent instant value, guarding
    against isolated XBRL mistagging outliers (a known issue in as-reported
    SEC data): walk backward from the latest entry until one falls within a
    reasonable band of the trailing values' median."""
    for concept in concept_names:
        concept_data = facts_taxonomy.get(concept)
        if not concept_data:
            continue
        for unit_values in concept_data.get("units", {}).values():
            if not unit_values:
                continue
            sorted_values = sorted(unit_values, key=lambda v: v.get("end", ""))
            recent = sorted_values[-8:]
            vals = sorted(v["val"] for v in recent if v["val"])
            if not vals:
                continue
            median = vals[len(vals) // 2]
            if median <= 0:
                return sorted_values[-1]["val"], sorted_values[-1]["end"]
            for v in reversed(recent):
                val = v["val"]
                if val and 0.5 * median <= val <= 2.0 * median:
                    return val, v["end"]
            return sorted_values[-1]["val"], sorted_values[-1]["end"]
    return None, None


def value_years_ago(series, ref_date_str, years, tolerance_days=60):
    """Closest series value to (ref_date - years), within tolerance."""
    ref_date = date.fromisoformat(ref_date_str)
    target = ref_date - timedelta(days=round(years * 365.25))
    best, best_diff = None, None
    for end, val in series:
        diff = abs((date.fromisoformat(end) - target).days)
        if diff <= tolerance_days and (best_diff is None or diff < best_diff):
            best, best_diff = val, diff
    return best


def fetch_price_history_and_splits(symbol, counter, limiter, years=HISTORY_YEARS + 1):
    """Fetch current price, a weekly close-price history, and any stock
    splits, all in a single request.

    SEC fundamentals (EPS, shares outstanding, dividends/share) reflect the
    share structure as of their last filing. If a stock split happened
    between that filing and today, mixing un-adjusted SEC figures with the
    current live price silently produces nonsense ratios. Splits reported
    here are used to adjust each SEC figure to today's share structure.
    Historical prices (matched to each fiscal year end for the historical
    P/E check) are used as-is against that period's as-reported EPS --
    both reflect the share structure of that time, so no split adjustment
    is needed there.
    """
    yahoo_symbol = symbol.replace(".", "-")
    url = (YAHOO_CHART_URL.format(symbol=yahoo_symbol)
           + f"?range={years}y&interval=1wk&events=splits")
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept": "application/json",
    }
    data = http_get_json(url, headers, limiter, counter)
    if not data:
        return None, [], []
    try:
        result = data["chart"]["result"][0]
        meta = result["meta"]
        price = meta.get("regularMarketPrice") or meta.get("previousClose")
        timestamps = result.get("timestamp", []) or []
        closes = result.get("indicators", {}).get("quote", [{}])[0].get("close", []) or []
        price_series = [
            (datetime.fromtimestamp(ts, tz=timezone.utc).date(), c)
            for ts, c in zip(timestamps, closes) if c is not None
        ]
        splits_raw = result.get("events", {}).get("splits", {})
        splits = []
        for split in splits_raw.values():
            ts = split.get("date")
            num = split.get("numerator")
            den = split.get("denominator")
            if ts and num and den:
                split_date = datetime.fromtimestamp(ts, tz=timezone.utc).date().isoformat()
                splits.append((split_date, num / den))
        return price, price_series, splits
    except (KeyError, IndexError, TypeError):
        return None, [], []


def price_near_date(price_series, target_date_str, tolerance_days=25):
    target = date.fromisoformat(target_date_str)
    best, best_diff = None, None
    for d, price in price_series:
        diff = abs((d - target).days)
        if diff <= tolerance_days and (best_diff is None or diff < best_diff):
            best, best_diff = price, diff
    return best


def split_adjustment_factor(as_of_date, splits):
    """Cumulative split ratio for all splits that occurred after as_of_date.
    Multiply share counts, divide per-share amounts, by this factor to bring
    a stale (pre-split) SEC figure in line with today's share structure."""
    if not as_of_date:
        return 1.0
    factor = 1.0
    for split_date, ratio in splits:
        if split_date > as_of_date:
            factor *= ratio
    return factor


def gross_margin_series(gaap):
    """5Y (period_end, gross_margin) series, deriving gross profit from
    revenue - cost_of_revenue when a company doesn't tag GrossProfit
    directly (common among retailers/industrials)."""
    revenue = annual_series(gaap, REVENUE_CONCEPTS)
    gp = annual_series(gaap, GROSS_PROFIT_CONCEPTS)
    cost = annual_series(gaap, COST_OF_REVENUE_CONCEPTS)

    rev_by_end = dict(revenue)
    gp_by_end = dict(gp)
    cost_by_end = dict(cost)

    derived = {
        end: rev_by_end[end] - cost_by_end[end]
        for end in rev_by_end if end in cost_by_end
    }
    if len(derived) > len(gp_by_end):
        gp_by_end = derived

    common_ends = sorted(set(rev_by_end) & set(gp_by_end))[-HISTORY_YEARS:]
    margins = []
    for end in common_ends:
        rev = rev_by_end[end]
        if not rev or rev <= 0:
            return []
        margins.append((end, gp_by_end[end] / rev))
    return margins


def evaluate_candidate(candidate, sec_headers, sec_limiter, yahoo_limiter, counter):
    facts = http_get_json(
        SEC_FACTS_URL.format(cik=candidate["cik"]), sec_headers, sec_limiter, counter
    )
    if not facts:
        return None
    gaap = facts.get("facts", {}).get("us-gaap", {})
    dei = facts.get("facts", {}).get("dei", {})

    margins = gross_margin_series(gaap)
    eps_series = annual_series(gaap, EPS_CONCEPTS)
    dps_series = annual_series(gaap, DPS_CONCEPTS)
    shares_outstanding, shares_date = most_recent_instant_value(
        dei, ["EntityCommonStockSharesOutstanding"]
    )

    if (shares_outstanding is None or len(margins) < HISTORY_YEARS
            or len(eps_series) < HISTORY_YEARS or len(dps_series) < HISTORY_YEARS):
        return None  # not enough 10-K history to judge the 5Y criteria

    margin_values = [m for _, m in margins]
    avg_margin = sum(margin_values) / len(margin_values)
    oldest_margin, current_margin = margin_values[0], margin_values[-1]
    if avg_margin < MIN_GROSS_MARGIN:
        return None
    margin_decline = (oldest_margin - current_margin) / oldest_margin if oldest_margin > 0 else 1.0
    if margin_decline > MAX_GROSS_MARGIN_DECLINE:
        return None

    eps_now_date, eps_now = eps_series[-1]
    if eps_now <= 0:
        return None
    eps_3y_ago = value_years_ago(eps_series, eps_now_date, 3)
    if eps_3y_ago is None:
        return None
    if eps_3y_ago > 0:
        eps_growth_3y = (eps_now - eps_3y_ago) / eps_3y_ago
    else:
        eps_growth_3y = 1.0  # turned profitable within the window -- treat as strong growth
    if eps_growth_3y < MIN_EPS_GROWTH_3Y:
        return None

    dps_5y_ago_date, dps_5y_ago = dps_series[-HISTORY_YEARS]
    dps_now_date, dps_now = dps_series[-1]
    if dps_now <= 0:
        return None
    if dps_5y_ago <= 0:
        dividend_cagr = 1.0  # initiated a dividend within the window -- treat as strong growth
    else:
        years_span = max(
            (date.fromisoformat(dps_now_date) - date.fromisoformat(dps_5y_ago_date)).days / 365.25,
            0.5,
        )
        dividend_cagr = (dps_now / dps_5y_ago) ** (1 / years_span) - 1
    if dividend_cagr < MIN_DIVIDEND_CAGR_5Y:
        return None

    payout_ratio = dps_now / eps_now  # split factor cancels out of this ratio, no adjustment needed
    if not (0 < payout_ratio <= MAX_PAYOUT_RATIO):
        return None

    price, price_series, splits = fetch_price_history_and_splits(candidate["ticker"], counter, yahoo_limiter)
    if price is None or price <= 0:
        return None

    adj_eps_now = eps_now / split_adjustment_factor(eps_now_date, splits)
    adj_shares = shares_outstanding * split_adjustment_factor(shares_date, splits)
    adj_dps_now = dps_now / split_adjustment_factor(dps_now_date, splits)

    market_cap = price * adj_shares
    if not (MIN_MARKET_CAP <= market_cap <= MAX_MARKET_CAP):
        return None

    current_pe = price / adj_eps_now
    dividend_yield = adj_dps_now / price
    if dividend_yield < MIN_DIVIDEND_YIELD:
        return None

    eps_by_end = dict(eps_series)
    hist_pes = []
    for end, _ in margins:
        e = eps_by_end.get(end)
        p = price_near_date(price_series, end)
        if e and e > 0 and p:
            hist_pes.append(p / e)

    valuation_ok = current_pe <= MAX_PE
    avg_5y_pe = (sum(hist_pes) / len(hist_pes)) if hist_pes else None
    if not valuation_ok and avg_5y_pe and len(hist_pes) >= 3:
        valuation_ok = current_pe <= avg_5y_pe * (1 + MAX_PE_VS_5Y_AVG)
    if not valuation_ok:
        return None

    return {
        "ticker": candidate["ticker"],
        "name": candidate["name"],
        "exchange": candidate["exchange"],
        "market_cap": round(market_cap, 2),
        "price": round(price, 2),
        "pe_ratio": round(current_pe, 2),
        "pe_premium": current_pe <= PREMIUM_PE,
        "avg_5y_pe": round(avg_5y_pe, 2) if avg_5y_pe else None,
        "dividend_yield": round(dividend_yield, 4),
        "payout_ratio": round(payout_ratio, 4),
        "dividend_cagr_5y": round(dividend_cagr, 4),
        "eps_growth_3y": round(eps_growth_3y, 4),
        "gross_margin_avg_5y": round(avg_margin, 4),
        "gross_margin_premium": avg_margin >= PREMIUM_GROSS_MARGIN,
        "gross_margin_decline_5y": round(margin_decline, 4),
        "eps": round(eps_now, 4),
        "dividend_per_share": round(dps_now, 4),
    }


def stage2_screen(candidates, sec_headers, counter, max_workers):
    from concurrent.futures import ThreadPoolExecutor, as_completed

    sec_limiter = RateLimiter(SEC_MAX_REQ_PER_SEC)
    yahoo_limiter = RateLimiter(YAHOO_MAX_REQ_PER_SEC)
    hits = []
    done = 0
    total = len(candidates)

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {
            pool.submit(
                evaluate_candidate, c, sec_headers, sec_limiter, yahoo_limiter, counter
            ): c
            for c in candidates
        }
        for future in as_completed(futures):
            done += 1
            if done % 250 == 0 or done == total:
                print(f"  stage 2 progress: {done}/{total} evaluated, "
                      f"{len(hits)} hits so far, {counter.count} API calls",
                      file=sys.stderr)
            try:
                result = future.result()
            except Exception as exc:
                print(f"  [error] {futures[future]['ticker']}: {exc}", file=sys.stderr)
                continue
            if result:
                hits.append(result)
    return hits


def load_watchlist(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}


def save_watchlist(path, watchlist):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(watchlist, f, indent=2, sort_keys=True, ensure_ascii=False)
        f.write("\n")


def update_watchlist(watchlist, hits, run_date):
    new_entries = []
    for hit in hits:
        ticker = hit["ticker"]
        entry = dict(hit)
        entry["last_seen"] = run_date
        if ticker in watchlist:
            entry["date_added"] = watchlist[ticker].get("date_added", run_date)
            watchlist[ticker] = entry
        else:
            entry["date_added"] = run_date
            watchlist[ticker] = entry
            new_entries.append(entry)
    return new_entries


def git_commit(paths, message):
    subprocess.run(["git", "add", *paths], check=True)
    result = subprocess.run(["git", "diff", "--cached", "--quiet"])
    if result.returncode == 0:
        print("No changes to commit.")
        return
    subprocess.run(["git", "commit", "-m", message], check=True)


def main():
    parser = argparse.ArgumentParser(description="Weekly small/mid-cap quality + dividend-growth stock screener")
    parser.add_argument("--contact-email", required=True,
                         help="Contact email for the SEC User-Agent (required by SEC fair access policy)")
    parser.add_argument("--git-commit", action="store_true",
                         help="Commit the updated watchlist.json to git after the run")
    parser.add_argument("--limit", type=int, default=None,
                         help="Limit the universe to the first N stage-1 candidates (for testing)")
    args = parser.parse_args()

    sec_headers = {"User-Agent": f"StockScreeningTool/1.0 ({args.contact_email})"}
    counter = ApiCallCounter()
    sec_bulk_limiter = RateLimiter(SEC_MAX_REQ_PER_SEC)

    run_date = datetime.now(timezone.utc).date().isoformat()

    print("Loading SEC ticker universe...")
    universe = fetch_universe(sec_headers, sec_bulk_limiter, counter)
    print(f"  universe size: {len(universe)}")

    stage1 = stage1_filter(universe)
    if args.limit:
        stage1 = stage1[: args.limit]
    print(f"Stage 1 candidates (Nasdaq/NYSE listed): {len(stage1)}")

    print("Stage 2: evaluating financial criteria (this may take a while)...")
    hits = stage2_screen(stage1, sec_headers, counter, MAX_WORKERS)
    hits.sort(key=lambda h: h["pe_ratio"])
    print(f"Final hits: {len(hits)}")

    watchlist = load_watchlist(WATCHLIST_PATH)
    new_entries = update_watchlist(watchlist, hits, run_date)
    save_watchlist(WATCHLIST_PATH, watchlist)

    print("\n=== Summary ===")
    print(f"Stage 1 candidates: {len(stage1)}")
    print(f"Final hits:         {len(hits)}")
    print(f"New watchlist entries: {len(new_entries)}")
    print(f"Total API calls:    {counter.count}")

    if new_entries:
        print("\nNew watchlist entries:")
        for e in sorted(new_entries, key=lambda x: x["pe_ratio"]):
            print(f"  {e['ticker']:6s} mktcap=${e['market_cap']:,.0f}  "
                  f"P/E={e['pe_ratio']:.2f}  div_yield={e['dividend_yield']*100:.2f}%  "
                  f"gross_margin={e['gross_margin_avg_5y']*100:.1f}%  "
                  f"payout={e['payout_ratio']*100:.1f}%  "
                  f"div_cagr={e['dividend_cagr_5y']*100:.1f}%  "
                  f"eps_growth_3y={e['eps_growth_3y']*100:.1f}%")

    if args.git_commit:
        message = (
            f"Weekly screening run {run_date}: {len(hits)} final hits, "
            f"{len(new_entries)} new watchlist entries ({counter.count} API calls)"
        )
        git_commit([WATCHLIST_PATH], message)


if __name__ == "__main__":
    main()
