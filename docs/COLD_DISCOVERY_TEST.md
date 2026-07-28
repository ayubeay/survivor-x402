# Cold Discovery Test — catalog to verified result, no prior knowledge

**Date:** 2026-07-27 · **Commit:** 14df2ed
**Script:** test-cold-discovery.mjs

## What was tested
Whether an agent with no prior knowledge of SURVIVOR can find it, understand its
interface, pay it, and verify the result — using only the public Bazaar catalog
and the standard x402 client with no patches.

## Result: SUCCEEDED
1. Queried https://facilitator.payai.network/discovery/resources — 1000 resources
2. Filtered by capability (/risk|screen|token safety|rug/) on Solana — 6 candidates
3. Read interface from catalog alone: POST, price 10000 base units USDC, input {mint}
4. Built the request from inputSchema — no documentation consulted
5. Paid with UNMODIFIED x402-solana client — status 200
6. Result: LOW / ALLOW (score 85)
7. Found the verify endpoint from the service index at GET /
8. Verified the receipt: valid=true, all 9 checks pass
Settlement: 3D3zbFR5qDAWQZmATNpbL5FNp7eJushHQWdbVMBdMekEisZ7JqnmPPTHK6H8yLfFzGcUu7QBTEZeTT169eEw8JHe

## Competitive context observed
Six Solana risk/screening services discoverable via the same query:
- survivor-x402-production.up.railway.app/risk-screen — "SURVIVOR risk screen"
- solidus-x402.fly.dev/v1/loop/risk/lite — no description
- api.nansen.ai/api/v1/prediction-market/market-screener — no description
- api.finnputerdex.com/scan — "FINNPUTER deep token safety scan (clusters + forwarded supply)"
- api.x402node.dev/chain/allowance-risk — no description
- api.x402node.dev/wallet/risk-profile — no description

Four of six carry no description. SURVIVOR is currently the only one in this set
publishing a receipt-verification endpoint.

## What this does and does not prove
PROVES: the service is discoverable, self-describing, and usable by any client
following the standard flow, with independently verifiable output.
DOES NOT PROVE: external demand. The payer wallet was ours. The remaining
milestone is an unrelated party doing this without our involvement.
