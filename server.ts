import express from "express";
import * as dotenv from "dotenv";
import { runRiskScreen } from "./risk-engine";
import { signReceiptV2, signerPubkey, verifyReceipt, canonical, sha256, RECEIPT_SCHEMA, POLICY_VERSION } from "./receipt";
import { X402PaymentHandler } from "x402-solana/server";
import { mapSignals } from "./signals";
dotenv.config();

const app = express();
app.use(express.json());

const PRICE_USDC = 0.01;
const AGENT_USDC_WALLET = "4aet1MhW5gbf46dqzrQB1qxGjM3Q3hN7ndKPRrntW5vg";
const USDC = { address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 };
const FACILITATOR = process.env.FACILITATOR_URL || "https://facilitator.payai.network";
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "";
const PRICE_BASE_UNITS = String(Math.round(PRICE_USDC * 10 ** USDC.decimals));

const x402 = new X402PaymentHandler({
  network: "solana",
  treasuryAddress: AGENT_USDC_WALLET,
  facilitatorUrl: FACILITATOR,
  rpcUrl: process.env.RPC_URL,
  defaultToken: USDC,
  defaultDescription: "SURVIVOR risk screen (signed receipt)",
});

/** v2 clients look for PAYMENT-REQUIRED (base64 JSON). The server lib is
 *  framework-agnostic and only returns a body, so we set the header here. */
/** Bazaar discovery declaration — facilitator catalogs this at settle time.
 *  Shape mirrors @x402/extensions buildBazaarExtensionFromDiscoveryInfo(). */
const BAZAAR_EXTENSION = {
  info: {
    input: {
      type: "http",
      method: "POST",
      bodyType: "json",
      body: { mint: "So11111111111111111111111111111111111111112" },
      pathParams: {},
    },
    output: {
      type: "json",
      example: {
        mint: "So11111111111111111111111111111111111111112",
        risk_score: 85,
        risk_level: "LOW",
        gate_decision: "ALLOW",
        warnings: ["MEGACAP_TOKEN"],
        token_name: "Wrapped SOL",
        token_symbol: "SOL",
        ai_summary: "",
        receipt: { payload: {}, signature: "" },
      },
    },
  },
  schema: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    properties: { input: { type: "object" }, output: { type: "object" } },
    required: ["input"],
  },
};

function send402(res: any, body: any, ext: any = BAZAAR_EXTENSION) {
  const withDiscovery = {
    ...body,
    extensions: { ...(body.extensions || {}), bazaar: ext },
  };
  res.setHeader("PAYMENT-REQUIRED", Buffer.from(JSON.stringify(withDiscovery), "utf8").toString("base64"));
  return res.status(402).json(withDiscovery);
}

const PRICE_REPORT_USDC = 0.03;
const PRICE_REPORT_BASE_UNITS = String(Math.round(PRICE_REPORT_USDC * 10 ** USDC.decimals));

const ROUTE_REPORT = {
  amount: PRICE_REPORT_BASE_UNITS,
  asset: USDC,
  description: "SURVIVOR forensic report",
  mimeType: "application/json",
  maxTimeoutSeconds: 120,
};

const BAZAAR_EXTENSION_REPORT = {
  info: {
    input: { type: "http", method: "POST", bodyType: "json", body: { mint: "So11111111111111111111111111111111111111112" }, pathParams: {} },
    output: {
      type: "json",
      example: {
        mint: "So11111111111111111111111111111111111111112",
        decision: { risk_score: 85, risk_level: "LOW", gate_decision: "ALLOW", confidence: 0.9, scoring_version: "0.4.1" },
        reasons: [{ code: "MEGACAP_TOKEN", severity: "low", signal: "onchain", detail: "", contribution: 0.3 }],
        signals: {
          mint_authority: { status: "known", value: { revoked: true } },
          freeze_authority: { status: "known", value: { revoked: true } },
          lp: { status: "known", value: { locked: true, percent_locked: 100, lock_duration_days: 30 } },
          holder_concentration: { status: "unknown", value: null, note: "HOLDER_QUERY_FAILED" },
          dev_activity: { status: "unknown", value: null, note: "DEV_ACTIVITY_UNAVAILABLE" },
          token_age: { status: "known", value: { hours: 31464 } },
          liquidity: { status: "known", value: { usd: 122651.76 } },
        },
        token: { name: "Wrapped SOL", symbol: "SOL" },
        ai_summary: "",
        receipt: { payload: {}, signature: "" },
      },
    },
  },
  schema: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    properties: { input: { type: "object" }, output: { type: "object" } },
    required: ["input"],
  },
};

const ROUTE = {
  amount: PRICE_BASE_UNITS,
  asset: USDC,
  description: "Solana token risk screen with signed proof. Returns score 0-100, risk level, ALLOW/CHALLENGE/DENY gate decision, structured warnings, and an ed25519-signed receipt binding the payment settlement and result hash - independently verifiable at /verify without trusting us.",
  mimeType: "application/json",
  maxTimeoutSeconds: 120,
};

// Health check
// Service index — what an agent or developer sees on arrival
app.get("/", (req, res) => {
  const base = PUBLIC_BASE_URL || "https://" + req.get("host");
  res.json({
    service: "SURVIVOR Pay-Per-Call Risk Agent",
    description: "Solana token risk screening. Pay per call in USDC via x402 v2; receive a signed, independently verifiable receipt.",
    protocol: { standard: "x402", version: 2, header: "PAYMENT-SIGNATURE", facilitator: FACILITATOR },
    price: { amount_base_units: PRICE_BASE_UNITS, asset: USDC.address, decimals: USDC.decimals, human: PRICE_USDC + " USDC" },
    network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    gas: "sponsored by facilitator — payer needs USDC only, no SOL required",
    endpoints: {
      "GET /": "this index",
      "GET /health": "liveness",
      "GET /quote/:mint": "free preview — score only, no receipt, no payment",
      "POST /risk-screen": "paid — returns full report + signed receipt (x402 v2)",
      "POST /report": "paid (0.03 USDC) — decision plus three-state evidence signals + signed receipt",
      "GET /signer": "public signing identity for receipt verification",
      "POST /verify": "verify any survivor.receipt.v2 — no auth, no payment",
    },
    how_to_pay: [
      "POST /risk-screen with {mint} and no payment header",
      "receive 402 with PAYMENT-REQUIRED header (base64 JSON) and body",
      "sign the payment with any x402 v2 client (e.g. npm x402-solana)",
      "retry with the PAYMENT-SIGNATURE header",
    ],
    receipt_schema: RECEIPT_SCHEMA,
    agent_pda: "GTZNpoUacZrZU1PZfbzyyy34m1WizvUwE5aMfLXAf5hx",
    source: "https://github.com/ayubeay/survivor-x402",
  });
});

// Public receipt verification — anyone, no auth, no payment
app.post("/verify", (req, res) => {
  const receipt = req.body;
  const checks: Record<string, boolean | string> = {};
  const fail = (msg: string) => res.status(400).json({ valid: false, error: msg });

  if (!receipt || !receipt.payload || !receipt.signature) return fail("expected { payload, signature }");
  const p = receipt.payload;

  checks.schema_recognized = p.schema === RECEIPT_SCHEMA;
  let sigOk = false;
  try { sigOk = verifyReceipt(receipt); } catch (e) { sigOk = false; }
  checks.signature_valid = sigOk;

  let current = "";
  try { current = signerPubkey(); } catch (e) { current = ""; }
  checks.signer_is_current = !!current && p.issuer?.signer_pubkey === current;

  const now = Date.now();
  checks.not_expired = !!p.expires_at && Date.parse(p.expires_at) > now;
  checks.issued_in_past = !!p.issued_at && Date.parse(p.issued_at) <= now + 60000;

  checks.payment_verified = p.evidence?.payment_verified === true;
  checks.settlement_tx_present = typeof p.evidence?.settlement_tx === "string" && p.evidence.settlement_tx.length > 0;
  checks.decision_present = typeof p.decision?.gate_decision === "string" && typeof p.decision?.risk_score === "number";
  checks.result_hash_present = typeof p.decision?.risk_result_hash === "string";

  // optional: caller supplies the report to prove it was not altered
  if (req.query.report_json) {
    try {
      const recomputed = sha256(canonical(JSON.parse(String(req.query.report_json))));
      checks.report_matches_hash = recomputed === p.decision?.risk_result_hash;
    } catch (e) { checks.report_matches_hash = "unparseable report_json"; }
  }

  const valid = Object.values(checks).every(v => v === true);
  res.json({
    valid,
    checks,
    receipt_id: p.receipt_id,
    settlement_tx: p.evidence?.settlement_tx ?? null,
    verify_settlement_at: p.evidence?.settlement_tx ? "https://solscan.io/tx/" + p.evidence.settlement_tx : null,
    note: "signature_valid proves the payload is unaltered and signed by the published key. Settlement should also be confirmed independently on-chain via the link above.",
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "live", service: "SURVIVOR Pay-Per-Call Risk Agent", version: "1.0.0" });
});

// Main risk screen endpoint
// Alias: catalogued as a separate Bazaar resource. The facilitator appears to
// record a listing once per resource URL and not refresh it, so a new path is
// currently the only way to publish corrected discovery metadata.
app.post("/screen", (req, res, next) => { (req as any).url = "/risk-screen"; next("route"); });

app.post("/risk-screen", async (req, res) => {
  const { mint } = req.body || {};
  if (!mint) return res.status(400).json({ error: "mint is required" });

  const reqPath = (req as any).originalUrl?.split("?")[0] || req.path || "/risk-screen";
  const resourceUrl = `${PUBLIC_BASE_URL || "https://" + req.get("host")}${reqPath}`;
  let requirements;
  try {
    requirements = await x402.createPaymentRequirements(ROUTE, resourceUrl);
  } catch (e: any) {
    console.error("[x402] requirements failed:", e.message);
    return res.status(503).json({ error: "PAYMENT_SETUP_UNAVAILABLE" });
  }

  // v2: payment arrives in the PAYMENT-SIGNATURE header
  const paymentHeader = x402.extractPayment(req.headers as any);
  if (!paymentHeader) {
    const r = x402.create402Response(requirements, resourceUrl);
    return send402(res, r.body);
  }

  // 1. VERIFY (no funds move yet)
  const verified = await x402.verifyPayment(paymentHeader, requirements);
  if (!verified.isValid) {
    console.log(`[risk-screen] payment invalid: ${verified.invalidReason}`);
    const r = x402.create402Response(requirements, resourceUrl);
    return send402(res, { ...r.body, invalidReason: verified.invalidReason });
  }

  // 2. DO THE WORK before charging — a failure here must not cost the caller
  let risk;
  try {
    risk = await runRiskScreen(mint);
  } catch (err: any) {
    console.error("[risk-screen] scoring failed, not settling:", err.message);
    return res.status(500).json({ error: "Risk analysis failed", detail: err.message, charged: false });
  }

  // 3. SETTLE only after the work succeeded
  const settled = await x402.settlePayment(paymentHeader, requirements);
  if (!settled.success) {
    console.error(`[risk-screen] settlement failed: ${settled.errorReason}`);
    return res.status(402).json({ error: "SETTLEMENT_FAILED", reason: settled.errorReason });
  }

  // 4. Sign only from verified settlement facts
  const receipt = signReceiptV2({
    mint,
    network: x402.getNetwork(),
    riskResult: risk,
    evidence: {
      settlement_tx: (settled as any).transaction ?? (settled as any).txHash ?? null,
      payer: (settled as any).payer ?? null,
      amount_base_units: PRICE_BASE_UNITS,
      asset: USDC.address,
      network: x402.getNetwork(),
      facilitator: FACILITATOR,
    },
  });

  console.log(`[risk-screen] SETTLED mint=${mint} receipt=${receipt.payload.receipt_id}`);
  return res.json({ ...risk, receipt, powered_by: ["SURVIVOR Oracle", "Ace Data Cloud"] });
});

// Forensic tier: decision plus the evidence behind it, three-state signals
app.post("/report", async (req, res) => {
  const { mint } = req.body || {};
  if (!mint) return res.status(400).json({ error: "mint is required" });

  const reqPath = (req as any).originalUrl?.split("?")[0] || req.path || "/report";
  const resourceUrl = `${PUBLIC_BASE_URL || "https://" + req.get("host")}${reqPath}`;

  let requirements;
  try {
    requirements = await x402.createPaymentRequirements(ROUTE_REPORT, resourceUrl);
  } catch (e: any) {
    console.error("[x402] report requirements failed:", e.message);
    return res.status(503).json({ error: "PAYMENT_SETUP_UNAVAILABLE" });
  }

  const paymentHeader = x402.extractPayment(req.headers as any);
  if (!paymentHeader) {
    const r = x402.create402Response(requirements, resourceUrl);
    return send402(res, r.body, BAZAAR_EXTENSION_REPORT);
  }

  const verified = await x402.verifyPayment(paymentHeader, requirements);
  if (!verified.isValid) {
    const r = x402.create402Response(requirements, resourceUrl);
    return send402(res, { ...r.body, invalidReason: verified.invalidReason }, BAZAAR_EXTENSION_REPORT);
  }

  let risk;
  try {
    risk = await runRiskScreen(mint);
  } catch (err: any) {
    console.error("[report] scoring failed, not settling:", err.message);
    return res.status(500).json({ error: "Risk analysis failed", detail: err.message, charged: false });
  }

  const settled = await x402.settlePayment(paymentHeader, requirements);
  if (!settled.success) {
    console.error(`[report] settlement failed: ${settled.errorReason}`);
    return res.status(402).json({ error: "SETTLEMENT_FAILED", reason: settled.errorReason });
  }

  // normalized report payload — this is what risk_result_hash covers
  const report = {
    mint,
    decision: {
      risk_score: risk.risk_score,
      risk_level: risk.risk_level,
      gate_decision: risk.gate_decision,
      confidence: risk.confidence,
      scoring_version: risk.scoring_version ?? null,
    },
    reasons: risk.reasons,
    signals: mapSignals(risk.raw_score_data),
    token: { name: risk.token_name ?? null, symbol: risk.token_symbol ?? null },
    ai_summary: risk.ai_summary,
  };

  const receipt = signReceiptV2({
    mint,
    network: x402.getNetwork(),
    riskResult: report,
    riskScore: report.decision.risk_score,
    gateDecision: report.decision.gate_decision,
    evidence: {
      settlement_tx: (settled as any).transaction ?? null,
      payer: (settled as any).payer ?? null,
      amount_base_units: PRICE_REPORT_BASE_UNITS,
      asset: USDC.address,
      network: x402.getNetwork(),
      facilitator: FACILITATOR,
    },
  });

  console.log(`[report] SETTLED mint=${mint} receipt=${receipt.payload.receipt_id}`);
  return res.json({ ...report, receipt, powered_by: ["SURVIVOR Oracle", "Ace Data Cloud"] });
});

// Public signer identity so receipts verify without out-of-band key exchange
app.get("/signer", (_req, res) => {
  res.json({
    signer_pubkey: signerPubkey(),
    agent_pda: "GTZNpoUacZrZU1PZfbzyyy34m1WizvUwE5aMfLXAf5hx",
    schema: RECEIPT_SCHEMA,
    policy_version: POLICY_VERSION,
    canonicalization: "sorted-keys JSON (RFC8785 style), UTF-8",
    algorithm: "ed25519-detached",
  });
});

// Free quote endpoint (no payment required)
app.get("/quote/:mint", async (req, res) => {
  try {
    const { mint } = req.params;
    const risk = await runRiskScreen(mint);
    return res.json({
      mint,
      risk_score: risk.risk_score,
      risk_level: risk.risk_level,
      gate_decision: risk.gate_decision,
      price_usdc: PRICE_USDC,
      note: "Free preview. POST /risk-screen with payment for full report + signed receipt."
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SURVIVOR Pay-Per-Call Risk Agent running on port ${PORT}`);
  console.log(`  POST /risk-screen  — paid, returns signed receipt`);
  console.log(`  GET  /quote/:mint  — free preview`);
  console.log(`  GET  /health       — status`);
});
