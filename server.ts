import express from "express";
import * as dotenv from "dotenv";
import { runRiskScreen } from "./risk-engine";
import { signReceiptV2, signerPubkey, RECEIPT_SCHEMA, POLICY_VERSION } from "./receipt";
import { X402PaymentHandler } from "x402-solana/server";
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

const ROUTE = {
  amount: PRICE_BASE_UNITS,
  asset: USDC,
  description: "SURVIVOR risk screen",
  mimeType: "application/json",
  maxTimeoutSeconds: 120,
};

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "live", service: "SURVIVOR Pay-Per-Call Risk Agent", version: "1.0.0" });
});

// Main risk screen endpoint
app.post("/risk-screen", async (req, res) => {
  const { mint } = req.body || {};
  if (!mint) return res.status(400).json({ error: "mint is required" });

  const resourceUrl = `${PUBLIC_BASE_URL || "https://" + req.get("host")}/risk-screen`;
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
    return res.status(r.status).json(r.body);
  }

  // 1. VERIFY (no funds move yet)
  const verified = await x402.verifyPayment(paymentHeader, requirements);
  if (!verified.isValid) {
    console.log(`[risk-screen] payment invalid: ${verified.invalidReason}`);
    const r = x402.create402Response(requirements, resourceUrl);
    return res.status(402).json({ ...r.body, invalidReason: verified.invalidReason });
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
      settled_at: new Date().toISOString(),
      facilitator: FACILITATOR,
    },
  });

  console.log(`[risk-screen] SETTLED mint=${mint} receipt=${receipt.payload.receipt_id}`);
  return res.json({ ...risk, receipt, powered_by: ["SURVIVOR Oracle", "Ace Data Cloud"] });
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
