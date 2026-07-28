# /report — Forensic Tier (design, not yet built)

**Status:** DESIGN · **Drafted:** 2026-07-28
**Price:** 0.03 USDC (30000 base units) · `/screen` stays at 0.01

## Why two endpoints
/screen answers "can I act?" — called repeatedly by autonomous systems gating execution.
/report answers "why should I act?" — called when a human or agent needs to understand.
Different call frequency, different value, different consumer. One endpoint serving both
becomes bloated and prices badly for the high-frequency case.

## Response shape (proposed)
{
  "mint": "...",
  "decision": {
    "risk_score": 85,
    "risk_level": "LOW",
    "gate_decision": "ALLOW",
    "confidence": 0.9,
    "scoring_version": "0.4.1"
  },
  "reasons": [ { code, severity, signal, detail, contribution } ],
  "signals": {
    "mint_authority": "revoked" | "active" | null,
    "freeze_authority": "revoked" | "active" | null,
    "lp_locked": true | false | null,
    "holder_concentration": <number> | null,
    "liquidity_usd": <number> | null,
    "age_hours": <number> | null
  },
  "token": { "name": "...", "symbol": "..." },
  "ai_summary": "...",
  "receipt": { payload, signature }
}

## Open questions to settle before building
1. Does `signals` come from oracle `breakdown` (scores 0-N) or raw tokenData (booleans/values)?
   The breakdown holds weighted contributions; tokenData holds the underlying facts.
   Callers almost certainly want the facts, not the weights.
2. Null handling: when the oracle lacks a signal, return null explicitly rather than
   omitting the key — a missing key reads as "safe" to a naive consumer.
3. Does /report need the paid oracle path (valid API key) or does quick mode already
   carry breakdown on a cache miss? Determines whether this needs the key fixed first.
4. Should receipt.decision include a signals hash, or does risk_result_hash over the
   whole payload suffice? (It does — the hash covers everything returned.)

## Constraints carried from tonight
- Bazaar cataloging is write-once per resource URL. The outputSchema shipped with
  /report is permanent for that path. Settle the shape before the first settlement.
- Do not expose _tokenData or scoring weights. Weights are proprietary; the oracle
  already gates them behind a Pro tier and a debug flag.
- risk_result_hash must cover the full returned payload, as it does for /screen.

## Not doing
Raw feature dumps, scoring weights, or anything that turns the execution API into a
diagnostics console. Signals are evidence behind a decision, not a forensics product.
