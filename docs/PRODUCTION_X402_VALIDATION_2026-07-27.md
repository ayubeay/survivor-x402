# SURVIVOR x402 — Production Validation

**Date:** 2026-07-27 20:58 UTC
**Commit:** dac0386
**Endpoint:** https://survivor-x402-production.up.railway.app/risk-screen
**Result: 10/10 gates passed — first real paid call, settled and independently verified.**

## What was validated
A complete x402 v2 flow: 402 challenge > v2 client negotiation via PAYMENT-REQUIRED header >
gas-sponsored USDC payment > facilitator verification > settlement > risk screening >
signed receipt > independent signature verification > replay rejection.

## Artifacts (public data only — no secrets)
| Field | Value |
|---|---|
| Payer | BNeP1Fu5xrzikNo6iehN4cdrfZ3LyZsU3gF39Xos3EpD |
| Payee (treasury) | 4aet1MhW5gbf46dqzrQB1qxGjM3Q3hN7ndKPRrntW5vg |
| Payee USDC ATA | DcU47yh2qwE9zTm7entrPJKryHy14xC2nNDo54C6sfqn (created 2026-07-27) |
| Settlement tx | 4fcXNjMysnDPk6Re2sD1TJaw91CfWJsUCDMYvxGHiYGmtrBjzAU67jcpKYmjHgBTctEEMoShMBYJwHKKqjSACBdQ |
| Receipt ID | b579ca1f-5b8c-499b-b757-1820dc4445dd |
| Receipt signer | 47Y21b1CpfNTggEkty1CwXqh55ZmvkTJHdbx9UHCVWtm |
| Agent PDA | GTZNpoUacZrZU1PZfbzyyy34m1WizvUwE5aMfLXAf5hx |
| Price | 10000 base units = 0.01 USDC |
| Asset | EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v (USDC) |
| Network | solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp (CAIP-2 mainnet) |
| Facilitator | https://facilitator.payai.network |
| Schema | survivor.receipt.v2 |

## Gates
1. /health 200 — PASS
2. /signer 200 — PASS
3. signer pubkey matches keypair — PASS
4. bare POST returns 402 with payment requirements — PASS
5. resource URL advertises https — PASS
6. junk PAYMENT-SIGNATURE returns 402 (invalidReason: unexpected_verify_error) — PASS
7. no receipt issued for invalid payment — PASS
8. real payment completes, 200 returned — PASS
9. settlement evidence present, payment_verified true — PASS
10. receipt verifies against /signer pubkey; payload signer matches — PASS
11. evidence complete (settlement_tx, amount, asset, network, settled_at, facilitator); risk_result_hash present — PASS
12. replay of captured authorization rejected (402, transaction_simulation_failed), no second receipt, charged exactly 0.010000 USDC once — PASS

## Notable finding
The payer held **zero SOL**. Payment still settled, confirming the facilitator sponsors
transaction fees via `extra.feePayer`. An agent needs only USDC to call this endpoint.

## Defects found and fixed during validation
- SAP registry advertised /x402 on the oracle host; no such route exists on either service.
- /risk-screen accepted any caller-supplied `payment_tx` string and signed a receipt for it.
- Receipt v1 signed only {mint, risk_score, gate_decision, timestamp, receipt_id} — settlement_tx and agent_pda were returned but unsigned, therefore forgeable.
- Signing key and agent wallet key were the same key.
- resource URL advertised http:// behind Railway TLS termination.
- Server omitted the PAYMENT-REQUIRED header, causing v2 clients to downgrade to v1.
- Payee wallet had no USDC associated token account and could not receive the payment it advertised.

## Scope of this claim
This is production, protocol, settlement, and receipt validation. It is NOT demand validation:
the payer was a controlled test wallet. External adoption remains unmeasured. First independent
external call is the next milestone.

## Reproduce
`PAYER_KEYPAIR_PATH=<funded wallet> CONFIRM_SPEND=yes npx ts-node test-payment.ts`
Requires >= 0.02 USDC. Aborts if payer equals payee. Spend capped at 0.02 USDC.
