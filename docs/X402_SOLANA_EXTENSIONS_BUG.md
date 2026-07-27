# x402-solana: extensions not propagated into PaymentPayload

**Package:** x402-solana 2.0.4
**Observed impact:** resource not catalogued in the PayAI Bazaar
**Date:** 2026-07-27

## Observed behavior
Per the x402 v2 discovery flow, the bazaar declaration travels from the server's
PaymentRequired, through the client into the PaymentPayload, to the facilitator,
which catalogs the resource at settle time.

In this client, `createPaymentPayload(transaction, paymentRequirements, resourceUrl)`
(dist/utils) constructs:

    { x402Version, resource, accepted, payload }

`extensions` is not read or forwarded. The string "extensions" does not appear
in the package.

## Controlled experiment
Server, facilitator, payer wallet, endpoint, amount and asset held constant.
Single variable: whether extensions were present in the payment payload.

| Client | Payment settles | extensions in payload | Appears in catalog |
|---|---|---|---|
| Unmodified x402-solana | yes | no | no (4 settlements, absent from 1100+ entries) |
| Same + manual injection | yes | yes | yes, within 90 seconds |

Settlement, not catalogued: 2KnGR6j4mneA4cSmhGV116TsfxMfnyfnjcgDcSKHvybjvPXts7keHF6yyxjFn6DcpVxaw92PHcw4ddM683mDQQXn
Settlement, catalogued:     2FxrHVhxi6FgKd2tdHz7hXpDAcmTDYwwau1AD3wS91rbp771CBy53DEAKJypm7aQ9VpRS8Ay4EmqsjU8kyHvNHfP

Server-side declaration confirmed independently: GET the 402 body shows
extensions.bazaar with keys [info, schema].

## Question for maintainers
Is extension propagation intended in this client, or is the seller expected to
supply discovery metadata another way? If intended, carrying PaymentRequired's
extensions into the payload would close the gap; today only paymentRequirements
and resourceUrl are passed to createPaymentPayload.

## Workaround used here
Wrap fetch, decode the PAYMENT-SIGNATURE header, attach extensions read from the
402 body, re-encode. See test-bazaar.mjs in this repo.
