# Receipt Verification — Adversarial Test

**Date:** 2026-07-27 · **Commit:** ee79152
**Endpoint:** POST https://survivor-x402-production.up.railway.app/verify (public, no auth, no payment)

## Valid receipt
receipt_id 0371867e-a9bb-47b9-bf33-6869f4cfd253
settlement 43RKp4pw8N6dqp6jdVCFcJp6gEgsb2q3XEiTNC3gZDtHrbDkGwiNsUPLzvhMr2PjM9qLJQqcSR8hjvRmEbCWhdEV
Result: valid=true, all 9 checks pass.

## Tamper tests — all correctly rejected
| Attack | Field altered | Result |
|---|---|---|
| Inflate the score | decision.risk_score 85 -> 99 | valid=false, signature_valid=false |
| Forge the payment | evidence.settlement_tx -> fake string | valid=false, signature_valid=false |
| Impersonate issuer | issuer.signer_pubkey -> other key | valid=false, signer_is_current=false |

## Why the second test matters
In receipt v1 the signed payload was {mint, risk_score, gate_decision, timestamp, receipt_id}.
settlement_tx and agent_pda were returned alongside but NOT signed, so either could be
swapped while the signature still verified. Receipt v2 binds every field a verifier relies
on, including settlement evidence and issuer identity. The forged-payment attack that v1
could not detect now fails signature verification.

## Verification a third party can perform without us
1. GET /signer for the public key
2. Canonically re-serialize payload (sorted keys, UTF-8), verify ed25519
3. Check expires_at
4. Confirm evidence.settlement_tx independently on Solscan
5. Recompute decision.risk_result_hash against the delivered report
Step 4 is the important one: our signature proves what we said, the chain proves the payment.
