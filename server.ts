import express from "express";
import * as dotenv from "dotenv";
import { runRiskScreen } from "./risk-engine";
import { signReceipt } from "./receipt";
dotenv.config();

const app = express();
app.use(express.json());

const PRICE_USDC = 0.01;
const AGENT_USDC_WALLET = "4aet1MhW5gbf46dqzrQB1qxGjM3Q3hN7ndKPRrntW5vg";

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "live", service: "SURVIVOR Pay-Per-Call Risk Agent", version: "1.0.0" });
});

// Main risk screen endpoint
app.post("/risk-screen", async (req, res) => {
  const { mint, payment_tx } = req.body;

  if (!mint) {
    return res.status(400).json({ error: "mint is required" });
  }

  // x402 payment gate
  // In production: verify payment_tx is a real confirmed USDC transfer to AGENT_USDC_WALLET
  // For now: if no payment_tx provided, return 402 with payment instructions
  if (!payment_tx) {
    return res.status(402).json({
      error: "Payment required",
      price_usdc: PRICE_USDC,
      pay_to: AGENT_USDC_WALLET,
      instructions: [
        `1. Send ${PRICE_USDC} USDC to ${AGENT_USDC_WALLET} on Solana mainnet`,
        "2. Include this mint in transaction memo: " + mint,
        "3. Resubmit with payment_tx: <your_tx_signature>"
      ],
      x402: {
        scheme: "exact",
        network: "solana-mainnet",
        token: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        amount: (PRICE_USDC * 1_000_000).toString(),
        payTo: AGENT_USDC_WALLET,
      }
    });
  }

  try {
    console.log(`[risk-screen] mint=${mint} payment_tx=${payment_tx}`);

    // Run risk analysis
    const risk = await runRiskScreen(mint);

    // Sign receipt
    const receipt = signReceipt(mint, risk.risk_score, risk.gate_decision, payment_tx);

    return res.json({
      ...risk,
      receipt,
      payment_confirmed: payment_tx,
      powered_by: ["SURVIVOR Oracle", "Ace Data Cloud"],
    });
  } catch (err: any) {
    console.error("[risk-screen] error:", err.message);
    return res.status(500).json({ error: "Risk analysis failed", detail: err.message });
  }
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
