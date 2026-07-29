/**
 * Maps oracle signals into a stable three-state contract.
 * status: "known" | "unknown" | "not_applicable"
 * Absence is reported explicitly, never omitted.
 */
export type SignalStatus = "known" | "unknown" | "not_applicable";

export interface Signal {
  status: SignalStatus;
  value: any;
  note?: string;
  measurement?: string;
  limitations?: string[];
  impact?: { weight: number; direction: "positive" | "negative"; reason: string };
}

const NA = (note: string): Signal => ({ status: "not_applicable", value: null, note });
const UNK = (note?: string): Signal =>
  note ? { status: "unknown", value: null, note } : { status: "unknown", value: null };
const OK = (value: any): Signal => ({ status: "known", value });

export function mapSignals(raw: any): Record<string, Signal> {
  const s = raw?.signals;
  const megacap = !!raw?.signals_note;
  const mnote = megacap ? "MEGACAP_MODE" : undefined;

  if (!s) {
    // oracle returned no signals block at all
    const u = UNK("SIGNALS_UNAVAILABLE");
    return {
      mint_authority: u, freeze_authority: u, lp: u,
      holder_concentration: u, dev_activity: u, market_history: u, liquidity: u,
    };
  }

  const bool = (v: any, key: string): Signal =>
    megacap ? NA(mnote!) : (v === true || v === false ? OK({ revoked: v }) : UNK());

  return {
    mint_authority: bool(s.mint_authority_revoked, "mint"),
    freeze_authority: bool(s.freeze_authority_revoked, "freeze"),

    lp: megacap ? NA(mnote!) : (s.lp
      ? OK({ locked: s.lp.locked, percent_locked: s.lp.percent_locked, lock_duration_days: s.lp.lock_duration_days })
      : UNK("LP_DATA_UNAVAILABLE")),

    holder_concentration: megacap ? NA(mnote!) : (
      typeof s.top10_holder_percent === "number"
        ? {
            status: "known",
            value: {
              top10_percent: s.top10_holder_percent,
              denominator: s.concentration_basis?.denominator ?? "total_supply",
              accounts_sampled: s.concentration_basis?.accounts_sampled ?? s.total_holders ?? null,
            },
            measurement: "top_10_token_accounts_over_total_supply",
            limitations: [
              "counts token accounts, not beneficial owners",
              "program-owned pools, staking vaults and exchange custody are included",
              "denominator is total supply, which includes burned and locked tokens",
            ],
          }
        : UNK(s.holder_note || "HOLDER_DATA_UNAVAILABLE")),

    dev_activity: megacap ? NA(mnote!) : (s.dev_activity
      ? OK({
          recent_sells: s.dev_activity.recent_sells,
          percent_sold: s.dev_activity.percent_sold,
          wallet_age_days: s.dev_activity.wallet_age_days,
        })
      : UNK("DEV_ACTIVITY_UNAVAILABLE")),

    market_history: megacap ? NA(mnote!) : (typeof s.age_hours === "number"
      ? OK({
          earliest_observed_pair_age_hours: s.age_hours,
          source: s.market_data_source ?? "DexScreener",
          pairs_observed: s.pair_count ?? null,
        })
      : UNK()),

    liquidity: megacap ? NA(mnote!) : (typeof s.liquidity_usd === "number"
      ? OK({
          usd: s.liquidity_usd,
          pool: s.liquidity_pool ?? null,
          observed_total_usd_across_pools: s.observed_total_liquidity_usd ?? null,
          pools_observed: s.pair_count ?? null,
        })
      : UNK()),
  };
}
