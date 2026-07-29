# TWZRD - adjacent buyer-side gate (landscape note)

**Found:** 2026-07-29, via PR #39 on PayAINetwork/x402-solana
**Package:** twzrd-x402-gate (npm, 0.8.6) · https://intel.twzrd.xyz
**Repo:** github.com/twzrd-sol/twzrd-trust

## What they do
Buyer-side x402 trust gate. Free TWZRD preflight (ReadinessCard) before signing USDC to
any merchant, with an optional $0.001 paid escalation on warn. Also ships
createTwzrdSettleGuard for resource servers and installTwzrdAutoGate for agents.

## Complementary, not competing
TWZRD screens the counterparty being paid. SURVIVOR screens the asset being acquired.
A trustworthy merchant can still sell a dangerous token; a sound token can be offered
through a questionable endpoint. Both checks can sit before signing:

    trade proposal -> merchant screening (TWZRD) -> asset screening (SURVIVOR)
      -> user confirmation -> deterministic execution checks -> sign -> receipts

## Where they are ahead
Distribution and packaging. They have an npm install path, a one-line agent installer,
a partnership proposal to PayAI (#37), and a catalog offer (agentic-payments#19).
SURVIVOR has a live endpoint and Bazaar listings but no install path.

Possible direction, deferred: an agent-side helper that calls SURVIVOR before a token
purchase, e.g. installSurvivorAssetGate({ client, minimumScore, onHighRisk }). Not a
current workstream.

## Pricing observation, deliberately not copied
Their model is free preflight, pay only on warn. Good for adoption. SURVIVOR charges a
flat 0.01 with a free /quote preview, which fits better here: a signed, provenance-backed
report has value on a clean token too - "checked, and here is the proof" is what a
receipt is for. Charging only on warnings would undercut that.

## PR #39 note
twzrd-sol's beforePayment hook is a veto seat, not a payload-enrichment seat - it passes a
detached snapshot precisely so policy cannot mutate what gets built and signed. It does
not address our extensions-propagation issue, and we should not claim it does.

## Related external signal
substreambc, an independent production Solana seller, publicly asked for settle-time
"screen -> allow/refuse -> receipt" on issue #36 - the same thread carrying our discovery
problem. That is the clearest stated demand for this category from a real seller so far.
