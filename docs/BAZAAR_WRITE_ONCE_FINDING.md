# PayAI Bazaar: catalog entries appear to be write-once per resource URL

**Date:** 2026-07-28
**Facilitator:** https://facilitator.payai.network

## Observed
A resource is catalogued on first settlement carrying the bazaar extension.
Subsequent settlements for the same resource URL do not refresh the entry, even
when the server's declared description has changed.

Timeline:
- 23:32:03 — /risk-screen catalogued, description "SURVIVOR risk screen"
- ~00:05  — server redeployed with a fuller description (verified live via curl)
- 00:0x, 00:2x — two further settlements on /risk-screen with the new description
- 00:30   — catalog entry unchanged; lastUpdated still 23:32:03
- 00:42   — same payload on a NEW path /screen catalogued immediately with the new text

## Consequence for sellers
The description shipped at first cataloging is what agents see permanently.
A seller who launches with placeholder copy cannot correct it on that URL.

## Workaround
Expose an alias path (here /screen) and catalog it separately. Requires the
resource URL in payment requirements to derive from the actual request path
rather than a hardcoded suffix.

## Question for maintainers
Is write-once intended, or should a later settlement refresh an existing entry?
If intended, is there a seller-facing way to update or remove a stale listing?

## Not established
Whether entries refresh on a longer cycle than ~70 minutes, and whether other
facilitators behave the same way.
