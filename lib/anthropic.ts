import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic();

// Claude Opus 4.8 – höchste verfügbare Qualität für die Analyse.
// Bei Bedarf (Kosten/Latenz) hier auf ein günstigeres Modell wechseln.
export const ANALYSIS_MODEL = "claude-opus-4-8";
