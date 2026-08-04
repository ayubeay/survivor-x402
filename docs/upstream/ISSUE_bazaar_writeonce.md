# Issue draft: PayAI Bazaar catalog behaviour

**File at:** PayAI repo or facilitator support channel
**Title:** Catalog entry refresh latency - description updates took over 15 hours to propagate

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

## Correction (2026-07-28 21:xx UTC)
The entry DID eventually refresh. /risk-screen updated at 15:06:49 and now carries the
new description. So this is refresh latency, not write-once behaviour: the entry did not
update across two settlements over ~2.4 hours, but had updated by ~15 hours later.

## Consequence
A seller who corrects a description cannot tell whether the change took effect, and may
create duplicate resources (as we did with /screen) working around a delay rather than a
permanent constraint.

## Question
Is there a way for a seller to confirm that a metadata update has been picked up for
processing, before it becomes visible in the catalog? Even a known refresh interval would
not tell us whether a particular change had entered the pipeline.

Secondary: is refresh driven by settlements, a background job, or something else?

Writeup: https://github.com/ayubeay/survivor-x402/blob/main/docs/BAZAAR_WRITE_ONCE_FINDING.md
