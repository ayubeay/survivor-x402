# Issue draft: x402-solana

**File at:** PayAI's x402-solana repository
**Title:** Client does not propagate `extensions` from PaymentRequired into PaymentPayload

## Summary
Using x402-solana 2.0.4 as a seller, our resource was never catalogued in the PayAI
Bazaar despite four successful settlements. The bazaar discovery extension we declared
in our 402 response is not forwarded by the client into the payment payload, so the
facilitator has no discovery metadata to index at settle time.

## Where
createPaymentPayload(transaction, paymentRequirements, resourceUrl) in dist/utils builds
{ x402Version, resource, accepted, payload }. The string "extensions" does not appear
anywhere in the package.

## Controlled experiment
Server, facilitator, payer wallet, endpoint, amount and asset held constant. Single
variable: whether extensions was present in the payment payload.

| Client | Settles | extensions in payload | Catalogued |
|---|---|---|---|
| unmodified x402-solana | yes | no | no (4 settlements, absent from 1100+ entries) |
| same + manual injection | yes | yes | yes, within 90 seconds |

Settlement not catalogued: 2KnGR6j4mneA4cSmhGV116TsfxMfnyfnjcgDcSKHvybjvPXts7keHF6yyxjFn6DcpVxaw92PHcw4ddM683mDQQXn
Settlement catalogued: 2FxrHVhxi6FgKd2tdHz7hXpDAcmTDYwwau1AD3wS91rbp771CBy53DEAKJypm7aQ9VpRS8Ay4EmqsjU8kyHvNHfP

Server-side declaration verified independently: our 402 body contains extensions.bazaar
with keys [info, schema].

## Question
Is extension propagation intended in this client? If so, carrying PaymentRequired's
extensions into the payload would close the gap - today only paymentRequirements and
resourceUrl are passed to createPaymentPayload.

## Workaround
Wrap fetch, decode the PAYMENT-SIGNATURE header, attach extensions from the 402 body,
re-encode. Reproduction: https://github.com/ayubeay/survivor-x402/blob/main/test-bazaar.mjs
Writeup: https://github.com/ayubeay/survivor-x402/blob/main/docs/X402_SOLANA_EXTENSIONS_BUG.md
