# Competitor Comparison — Solana risk services in the PayAI Bazaar

**Date:** 2026-07-28 · Purchased via x402, $0.355 total across 5 services

## Results
| Service | Price | Result | Latency | Signs | Verifiable |
|---|---|---|---|---|---|
| finnputerdex.com/scan | $0.02 | 200, 4795 bytes | 122s cold / 2.5s cached | yes | no signer published |
| solidus-x402.fly.dev/v1/loop/risk/lite | $0.12 | fetch failed (payment layer) | - | - | - |
| api.nansen.ai/.../market-screener | $0.01 | fetch failed (payment layer) | - | - | - |
| api.x402node.dev/chain/allowance-risk | $0.005 | 400 "invalid or missing param: token" | 1.2s | no | - |
| api.x402node.dev/wallet/risk-profile | $0.20 | 400 "address (0x...40 hex chars) required" | 0.9s | no | - |
| SURVIVOR /risk-screen | $0.01 | 200, signed receipt | sub-second | yes | yes, public /verify |

## Findings
1. Both x402node endpoints are EVM services taking Solana payment — they want 0x
   addresses. Catalogued alongside Solana services but analyzing a different chain.
   Not direct competitors.
2. Two of five discoverable services could not be paid at all in this test
   (network-level failure before any response). Cause not established: could be
   downtime or a client/challenge incompatibility.
3. FINNPUTER is the only true peer: richer token forensics (rugcheck aggregation —
   mint/freeze authority, LP locked/burned) at 2x the price.
4. FINNPUTER returns a signature but publishes no signer key and no verification
   endpoint. The signature cannot be checked without contacting them out of band.

## Positioning implication
"We sign" is not differentiating — FINNPUTER signs too. "Anyone can verify our
signature without trusting us" appears to be, at least within this set.
Speed may also matter: 122s cold vs sub-second, in a context where callers gate
live execution.

## Caveats
Single sample per service, one test mint (wrapped SOL), our client. Failures may
be transient. Prices are list prices from the catalog, not negotiated.
