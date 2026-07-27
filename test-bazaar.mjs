// Inject extensions into the payment payload the client omits, then settle.
import { createX402Client } from "x402-solana/client";
import { Keypair, VersionedTransaction } from "@solana/web3.js";
import fs from "fs";

const BASE = "https://survivor-x402-production.up.railway.app";
const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(
  fs.readFileSync(process.env.HOME + "/.config/solana/new-payer.json", "utf8"))));

// capture the 402 body so we can read its extensions
let declared = null;
const patchFetch = async (input, init) => {
  const h = new Headers(init?.headers || {});
  const pay = h.get("PAYMENT-SIGNATURE");
  if (pay) {
    const payload = JSON.parse(Buffer.from(pay, "base64").toString("utf8"));
    if (declared) payload.extensions = declared;          // <-- the missing step
    h.set("PAYMENT-SIGNATURE", Buffer.from(JSON.stringify(payload)).toString("base64"));
    console.log("injected extensions into payment payload:", Object.keys(payload.extensions || {}));
    return globalThis.fetch(input, { ...init, headers: h });
  }
  const res = await globalThis.fetch(input, init);
  if (res.status === 402) {
    const clone = res.clone();
    try { declared = (await clone.json()).extensions || null; } catch {}
  }
  return res;
};

const client = createX402Client({
  wallet: { publicKey: kp.publicKey, signTransaction: async (tx) => { tx.sign([kp]); return tx; } },
  network: "solana",
  amount: 20000n,
  customFetch: patchFetch,
});

const res = await client.fetch(`${BASE}/risk-screen`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ mint: "So11111111111111111111111111111111111111112" }),
});
console.log("status:", res.status);
const body = await res.json();
console.log("settlement:", body?.receipt?.payload?.evidence?.settlement_tx || "none");
