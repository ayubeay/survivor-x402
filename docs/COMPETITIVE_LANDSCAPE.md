# Competitive Landscape — Solana risk services on x402 (2026-07-28)

Method: queried the PayAI Bazaar for Solana risk/screening services, purchased one
response from each with real USDC, built every request from the service's own
declared inputSchema. Spend: 0.185 USDC (two never settled).

## The catalog listed 6. Actual direct competitors: 1.

| Service | Price | Status | Notes |
|---|---|---|---|
| api.finnputerdex.com/scan | $0.02 | live | DIRECT COMPETITOR. rugcheck aggregation: token name/symbol, rugcheck_risk, rugcheck_level, mint_authority, freeze_authority, is_mutable, lp_locked, lp_burned. Returns a base58 signature. 122s cold, 2.5s warm (cached, exposes cacheAgeSeconds). |
| api.x402node.dev/chain/allowance-risk | $0.005 | live | EVM. Rejects with "invalid or missing param: token". Pays in Solana USDC, analyzes another chain. |
| api.x402node.dev/wallet/risk-profile | $0.20 | live | EVM. Requires "address (0x...40 hex chars)". Not a competitor. |
| api.nansen.ai/.../market-screener | $0.01 | live (402) | Prediction-market screener, not token risk. Matched only on the word "screener". |
| solidus-x402.fly.dev/v1/loop/risk/lite | $0.12 | DEAD | curl returns 000, host does not answer. Still listed in the catalog. |

## Findings

**Catalog presence did not imply availability in this observation.** One listed
service (Solidus) returned no HTTP response to a direct probe, and two others
analyze a different chain than their payment network. Whether the catalog performs
any liveness checking was not inspected. Consumers may benefit from a lightweight
availability probe before relying on catalog presence alone.

**FINNPUTER signs but the signature is unverifiable.** Present: a 64-byte base58
signature. Absent: any signer pubkey, declared algorithm, or verification endpoint.
Our differentiation is therefore not "we sign" — it is that our signature can be
checked by a third party via GET /signer and POST /verify.

**Their token forensics are deeper than ours.** They surface mint authority, freeze
authority, LP locked/burned, mutability. We return score, level, gate decision and
warnings. Worth auditing which of those inputs our scorer consumes internally but
does not expose, and which we do not collect at all.

**Latency is a real axis.** Their cold path is 122 seconds; ours is sub-second.
For an agent gating a swap before execution, cold latency is disqualifying.

## Position
Cheaper, faster, independently verifiable, shallower analysis.
The gap to close is analysis depth, not trust machinery.
