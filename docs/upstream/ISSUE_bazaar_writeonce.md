# Issue draft: PayAI Bazaar catalog behaviour

**File at:** PayAI repo or facilitator support channel
**Title:** Catalog entries appear write-once per resource URL

## Observed
A resource is catalogued on first settlement carrying the bazaar extension. Subsequent
settlements for the same resource URL did not refresh the entry, including after the
server's declared description changed.

Timeline (UTC, 2026-07-27/28):
- 23:32:03 /risk-screen catalogued, description "SURVIVOR risk screen"
- ~00:05 server redeployed with a fuller description, verified live via curl
- 00:0x and 00:2x two further settlements on /risk-screen carrying the new description
- 00:30 catalog entry unchanged, lastUpdated still 23:32:03
- 01:55 still unchanged after ~2.4 hours
- 00:42 the same payload on a NEW path /screen catalogued immediately with the new text

## Consequence
The description shipped at first cataloging is what agents see permanently. A seller who
launches with placeholder copy cannot correct it on that URL.

## Question
Is write-once intended, or should a later settlement refresh an existing entry? If
intended, is there a seller-facing way to update or remove a stale listing?

## Related observation
In the same catalog query, one listed service returned no HTTP response to a direct
probe, and two others required parameters for a different chain than their payment
network. Whether the catalog performs liveness checking was not inspected.

Writeup: https://github.com/ayubeay/survivor-x402/blob/main/docs/BAZAAR_WRITE_ONCE_FINDING.md
