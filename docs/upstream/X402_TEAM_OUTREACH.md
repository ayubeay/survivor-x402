# x402 team outreach - draft

**Context:** They commented on our Colosseum hackathon submission ~3 months ago
suggesting a conversation afterward. It never happened. We kept building.

**Sequencing:** file the three issues first, let them be publicly visible a day or two,
then send this. Lead with the working integration, not the bug list.

---

Hi - we spoke briefly around the Colosseum hackathon and you mentioned having a
conversation afterward. We ended up continuing the project rather than stopping at
the submission, and it's grown into something worth showing you.

We've built a production Solana x402 v2 integration for SURVIVOR, an execution-
governance service that scores token risk before an agent acts. The full loop works
end to end: an agent with no prior knowledge of us queries the Bazaar, finds the
service by capability, reads its input and output schemas from the catalog, pays 0.01
USDC through a standard x402 client, gets a decision, and independently verifies the
signed receipt - all without documentation or any patched tooling.

A few things we did along the way that might be interesting to you:

- Receipts are ed25519-signed over canonical JSON and bind the settlement transaction,
  payer, amount, asset, network, policy decision and a hash of the full result. We
  publish the signer at /signer and a public /verify endpoint, so a third party can
  check a receipt without trusting us. Tampering with the score, the settlement tx or
  the issuer identity all fail verification.
- The facilitator sponsors gas, so we verified a payment from a wallet holding zero
  SOL and only USDC. That's a meaningful property for agent wallets.
- We verify payment before doing the work and settle only after it succeeds, so a
  failure on our side doesn't charge the caller.

During the integration we hit a few reproducible behaviors in the tooling that we've
documented with minimal reproductions. We've filed them as issues rather than sending
them here, and they're written as questions rather than complaints - we may well be
holding something wrong:

[links to the three issues]

What we'd most like to talk about is where x402 is heading, particularly around
discovery and verifiable execution. We think the interesting thing isn't payment
itself, it's that a payment can now carry proof of what was bought - and we'd like to
know whether that's a direction you're thinking about too.

Happy to demo the whole flow live, or share the repo:
https://github.com/ayubeay/survivor-x402

- Seun (@youngs_modulus)

---

## Notes before sending
- Replace [links to the three issues] with real URLs after filing.
- Keep observational language: "appeared write-once in our testing", not "is write-once".
- Do not lead with the bug count. The working integration is the stronger opening.
- If they respond, the meeting is for architecture and direction, not support.
