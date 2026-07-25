#!/usr/bin/env python3
"""
Weekly value + dividend stock screener.

Data sources (all free, no API key required):
  - SEC bulk ticker/exchange list  (stage 0: build the market universe)
  - SEC XBRL "companyfacts" API   (stage 2: EPS, dividends, shares outstanding)
  - Yahoo Finance "chart" endpoint (stage 2: current market price)

SEC's Fair Access policy requires a descriptive User-Agent with contact
information for all requests to sec.gov / data.sec.gov, hence --contact-email.

Screening criteria (v1 defaults):
  Stage 1 (cheap, universe-wide filter):
    - Listed on Nasdaq or NYSE (excludes OTC / CBOE-only / unlisted)
  Stage 2 (final, per-candidate financial filter):
    - Market cap            >= $500,000,000
    - Share price           >= $5
    - P/E (KGV)             > 0 and <= 15
    - Dividend yield        >= 2.5%
    - Payout ratio          <= 80% (dividends per share / EPS)
"""
import argparse
import json
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timezone

SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers_exchange.json"
SEC_FACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json"
YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"

STAGE1_EXCHANGES = {"Nasdaq", "NYSE"}

MIN_MARKET_CAP = 500_000_000
MIN_PRICE = 5.0
MAX_PE = 15.0
MIN_DIVIDEND_YIELD = 0.025
MAX_PAYOUT_RATIO = 0.80

SEC_MAX_REQ_PER_SEC = 8
YAHOO_MAX_REQ_PER_SEC = 5
MAX_WORKERS = 8
REQUEST_TIMEOUT = 20
MAX_RETRIES = 2

WATCHLIST_PATH = "watchlist.json"


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


def most_recent_annual_value(facts_taxonomy, concept_names):
    """Return (value, period_end_date) for the most recent 10-K annual value
    of the first matching concept, guarding against isolated XBRL mistagging
    outliers the same way as most_recent_instant_value."""
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
            annual.sort(key=lambda v: v.get("end", ""))
            recent = annual[-6:]
            nonzero = sorted(v["val"] for v in recent if v["val"])
            if not nonzero:
                return annual[-1]["val"], annual[-1]["end"]
            median = nonzero[len(nonzero) // 2]
            if median <= 0:
                return annual[-1]["val"], annual[-1]["end"]
            for v in reversed(recent):
                val = v["val"]
                if val and 0.5 * median <= val <= 2.0 * median:
                    return val, v["end"]
            return annual[-1]["val"], annual[-1]["end"]
    return None, None


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


def fetch_price_and_splits(symbol, counter, limiter):
    """Fetch current price plus any stock-split events, in a single request.

    SEC fundamentals (EPS, shares outstanding, dividends/share) reflect the
    share structure as of their last filing. If a stock split happened
    between that filing and today, mixing un-adjusted SEC figures with the
    current live price silently produces nonsense ratios. Splits reported
    here are used to adjust each SEC figure to today's share structure.
    """
    yahoo_symbol = symbol.replace(".", "-")
    url = YAHOO_CHART_URL.format(symbol=yahoo_symbol) + "?range=5y&interval=1d&events=splits"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept": "application/json",
    }
    data = http_get_json(url, headers, limiter, counter)
    if not data:
        return None, []
    try:
        result = data["chart"]["result"][0]
        meta = result["meta"]
        price = meta.get("regularMarketPrice") or meta.get("previousClose")
        splits_raw = result.get("events", {}).get("splits", {})
        splits = []
        for split in splits_raw.values():
            ts = split.get("date")
            num = split.get("numerator")
            den = split.get("denominator")
            if ts and num and den:
                split_date = datetime.fromtimestamp(ts, tz=timezone.utc).date().isoformat()
                splits.append((split_date, num / den))
        return price, splits
    except (KeyError, IndexError, TypeError):
        return None, []


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


def evaluate_candidate(candidate, sec_headers, sec_limiter, yahoo_limiter, counter):
    facts = http_get_json(
        SEC_FACTS_URL.format(cik=candidate["cik"]), sec_headers, sec_limiter, counter
    )
    if not facts:
        return None
    gaap = facts.get("facts", {}).get("us-gaap", {})
    dei = facts.get("facts", {}).get("dei", {})

    eps, eps_date = most_recent_annual_value(gaap, ["EarningsPerShareDiluted", "EarningsPerShareBasic"])
    dps_raw, dps_date = most_recent_annual_value(
        gaap, ["CommonStockDividendsPerShareDeclared", "CommonStockDividendsPerShareCashPaid"]
    )
    dividend_per_share = dps_raw or 0.0
    shares_outstanding, shares_date = most_recent_instant_value(
        dei, ["EntityCommonStockSharesOutstanding"]
    )
    if eps is None or shares_outstanding is None:
        return None

    price, splits = fetch_price_and_splits(candidate["ticker"], counter, yahoo_limiter)
    if price is None or price <= 0:
        return None

    if splits:
        eps = eps / split_adjustment_factor(eps_date, splits)
        shares_outstanding = shares_outstanding * split_adjustment_factor(shares_date, splits)
        if dps_raw:
            dividend_per_share = dividend_per_share / split_adjustment_factor(dps_date, splits)

    market_cap = price * shares_outstanding
    pe_ratio = price / eps if eps > 0 else None
    dividend_yield = dividend_per_share / price
    payout_ratio = (dividend_per_share / eps) if eps > 0 else None

    passes = (
        market_cap >= MIN_MARKET_CAP
        and price >= MIN_PRICE
        and pe_ratio is not None and 0 < pe_ratio <= MAX_PE
        and dividend_yield >= MIN_DIVIDEND_YIELD
        and payout_ratio is not None and payout_ratio <= MAX_PAYOUT_RATIO
    )
    if not passes:
        return None

    return {
        "ticker": candidate["ticker"],
        "name": candidate["name"],
        "exchange": candidate["exchange"],
        "market_cap": round(market_cap, 2),
        "price": round(price, 2),
        "pe_ratio": round(pe_ratio, 2),
        "dividend_yield": round(dividend_yield, 4),
        "payout_ratio": round(payout_ratio, 4),
        "eps": round(eps, 4),
        "dividend_per_share": round(dividend_per_share, 4),
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
    parser = argparse.ArgumentParser(description="Weekly value + dividend stock screener")
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
                  f"P/E={e['pe_ratio']:.2f}  div_yield={e['dividend_yield']*100:.2f}%")

    if args.git_commit:
        message = (
            f"Weekly screening run {run_date}: {len(hits)} final hits, "
            f"{len(new_entries)} new watchlist entries ({counter.count} API calls)"
        )
        git_commit([WATCHLIST_PATH], message)


if __name__ == "__main__":
    main()
