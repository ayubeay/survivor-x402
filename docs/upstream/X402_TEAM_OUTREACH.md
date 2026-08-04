# x402 team outreach

**Rewritten 2026-08-04.** The original draft opened on a Colosseum hackathon comment from
three months ago. That is no longer the strongest opening: PayAINetwork/x402-solana#40 was
filed, confirmed by a collaborator in their own source, fixed the same day in #41, shipped
as 2.0.5, and our controlled experiment became a permanent regression test
(tests/extensions-echo.test.ts). It also explained #36, a month-old report from another
seller. Lead with that.

**Sequencing:** the extensions issue is closed and public. The Bazaar refresh-latency issue
should be filed before sending, so both links are live.

---

Hi - I'm the seller who filed the extensions propagation issue last week
(PayAINetwork/x402-solana#40). Thanks for turning that around so fast; seeing the
controlled experiment land as a regression test was a good outcome.

Some context on where it came from. I run SURVIVOR, a token risk service that agents
pay per call before executing a swap. The full x402 v2 loop works end to end on Solana:
an agent
with no prior knowledge of us queries the Bazaar, finds the service by capability, reads
its schemas from the catalog, pays 0.01 USDC through a standard client, gets a decision,
and independently verifies the signed receipt - no documentation, no patched tooling.
That cold-discovery path is what surfaced the extensions gap in the first place.

Two things from the build that might be worth comparing notes on:

- Receipts are ed25519-signed over canonical JSON and bind the settlement transaction,
  payer, amount, asset, network, policy decision and a hash of the result. The signer is
  published at /signer and there is a public /verify endpoint, so a third party can check
  a receipt without trusting us. Tampering with the score, the settlement tx or the issuer
  identity all fail verification.
- Payment is verified before the work runs and settled only after it succeeds, so a
  failure on our side does not charge the caller. And because the facilitator sponsors
  gas, we verified a payment from a wallet holding zero SOL and only USDC - a useful
  property for agent wallets.

One more observation filed separately, about catalog refresh latency for existing
entries: [BAZAAR ISSUE LINK]

What I would most like to talk about is where x402 is heading around discovery and
verifiable execution. The interesting property to me is not the payment - it is that a
payment can now carry proof of what was bought, and that proof can be checked by someone
who trusts neither party. Curious whether that is a direction you are thinking about.

Happy to walk through the flow live, or the repo is here:
https://github.com/ayubeay/survivor-x402

- Seun (@youngs_modulus)

---

## Notes before sending
- Replace [BAZAAR ISSUE LINK] with the real URL after filing.
- Do not re-litigate the extensions issue. It is closed; the mention is context, not a claim.
- Keep observational language throughout - "in our testing", not "the catalog is".
- If they respond, the conversation is architecture and direction, not support.

- Accuracy note: the end-to-end claim is Solana only. A Base rail exists in the codebase
  but its facilitator is unreachable and it does not currently emit a payable protocol
  challenge. Do not imply Base works.
