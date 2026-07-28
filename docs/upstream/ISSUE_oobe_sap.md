# Issue draft: OOBE Protocol SAP

**Send to:** Solking2 / OOBE maintainers
**Title:** Legacy agent cannot be updated - AgentPricingMenu never initialized

## Summary
An agent registered ~2026-05-18 (version 1) cannot be updated, closed, or have escrows
created against it, because update_agent, close_agent and create_escrow_v2 all require an
AgentPricingMenu account that only register_agent creates.

Agent PDA: GTZNpoUacZrZU1PZfbzyyy34m1WizvUwE5aMfLXAf5hx
Wallet: 4aet1MhW5gbf46dqzrQB1qxGjM3Q3hN7ndKPRrntW5vg
Program: SAPpUhsWLJG1FfkGRcXagEDMrMsWGjbky7AyhGpFETZ
SDK: @oobe-protocol-labs/synapse-sap-sdk 1.0.2

## Error
    AnchorError caused by account: pricing_menu.
    Error Code: AccountNotInitialized. Error Number: 3012.
    consumed 26988 of 200000 CU; custom program error: 0xbc4

Derived PricingMenu PDA (seeds ["sap_pricing", agent_pda]):
EutwE3vU8BtyHn1gybfNPDra1JugDwCo2KCZ4vi1dxBo - getAccountInfo returns null.

## Tooling disagreement observed
Three sources describe update_agent differently:
- on-chain published IDL (anchor idl fetch): 85 instructions; update_agent accounts are
  wallet, agent, system_program - no pricing_menu; still contains v1 escrow instructions
- SDK-bundled IDL: 78 instructions; update_agent includes pricing_menu
- deployed runtime: rejects on pricing_menu, so the bytecode requires it

Present on-chain but absent from the SDK bundle: report_calls, update_reputation,
create_escrow, deposit_escrow, withdraw_escrow, close_escrow, settle_calls, settle_batch,
resolve_dispute, report_tool_invocations, migrate_escrow_v1_to_v2.

## Questions
1. Is there an initialization or migration path for agents registered before
   AgentPricingMenu was introduced, or is re-registration the intended upgrade path?
2. If re-registration is intended, is the 0.1 SOL stake recoverable given that
   close_agent also requires pricing_menu?
3. Is the on-chain IDL expected to be republished after program upgrades?

Writeup: https://github.com/ayubeay/survivor-x402/blob/main/docs/SAP_PRICING_MENU_ISSUE.md
