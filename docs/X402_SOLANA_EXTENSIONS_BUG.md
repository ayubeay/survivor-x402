# x402-solana: extensions not propagated into PaymentPayload — RESOLVED

**Status:** FIXED upstream in x402-solana 2.0.5 (2026-07-30). Verified on 2.1.0.
**Reported:** 2026-07-29 · PayAINetwork/x402-solana#40 · fixed in #41

## What was wrong
createPaymentPayload(transaction, paymentRequirements, resourceUrl) in src/utils/helpers.ts
built { x402Version, resource, accepted, payload } with no extensions key, and had no access
to the 402 body's extensions even if it wanted to forward them. The facilitator's discovery
path calls isDiscoverable(paymentPayload, paymentRequirements), which for v2 resolves to
"does paymentPayload.extensions.bazaar exist" — so nothing was ever indexed, regardless of
how many settlements succeeded or how well-formed the seller's declaration was.

## Controlled experiment that pinned it down
Server, facilitator, payer wallet, endpoint, amount and asset held constant. Single variable:
whether extensions was present in the payment payload.

| client | settles | extensions in payload | catalogued |
|---|---|---|---|
| unmodified x402-solana 2.0.4 | yes | no | no — 4 settlements, absent from 1100+ entries |
| same + manual injection | yes | yes | yes, within 90 seconds |

Not catalogued: 2KnGR6j4mneA4cSmhGV116TsfxMfnyfnjcgDcSKHvybjvPXts7keHF6yyxjFn6DcpVxaw92PHcw4ddM683mDQQXn
Catalogued: 2FxrHVhxi6FgKd2tdHz7hXpDAcmTDYwwau1AD3wS91rbp771CBy53DEAKJypm7aQ9VpRS8Ay4EmqsjU8kyHvNHfP

## Resolution
A PayAI collaborator confirmed the bug in their source, stated that propagation is intended
per the v2 spec (the client echoes the server's extensions; it may append but must not drop
or overwrite), and shipped the fix the same day. Our controlled experiment became a permanent
regression test in the repo: tests/extensions-echo.test.ts.

The same mechanism explained issue #36, a month-old report of a Solana resource settling
successfully but never appearing in the catalog.

## Also added upstream as a result
The facilitator now returns an EXTENSION-RESPONSES header on /verify and /settle, base64 JSON
keyed by extension:
  {"bazaar":{"status":"processing"}}                    declaration accepted, queued
  {"bazaar":{"status":"rejected","rejectedReason":...}} seen but failed validation
  no header at all                                      no bazaar extension in the payload
That last state was this bug's signature. Before the header existed there was no signal, which
is why it took a controlled experiment rather than reading one response header.

## Verified fixed on our side
2026-07-31 21:34 UTC — payment made with an unmodified x402-solana 2.1.0 client, no fetch
wrapper. Settlement 2CZ37fr3vHpQKCiU2PEucarKRQGmH8d8vRpbPBLatqan3DZ7cU9pMyG26gV999qkiv5iimRj2SFFFBNhR8BAuixS
refreshed our /risk-screen catalog entry within three minutes.

test-bazaar.mjs (the injection workaround) is retained for historical reference only.
