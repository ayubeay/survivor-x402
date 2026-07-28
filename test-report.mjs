import { createX402Client } from "x402-solana/client";
import { Keypair } from "@solana/web3.js";
import fs from "fs";

const BASE = "https://survivor-x402-production.up.railway.app";
const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(
  fs.readFileSync(process.env.HOME + "/.config/solana/new-payer.json", "utf8"))));

let declared = null;
const patchFetch = async (input, init) => {
  const h = new Headers(init?.headers || {});
  const pay = h.get("PAYMENT-SIGNATURE");
  if (pay) {
    const payload = JSON.parse(Buffer.from(pay, "base64").toString("utf8"));
    if (declared) payload.extensions = declared;
    h.set("PAYMENT-SIGNATURE", Buffer.from(JSON.stringify(payload)).toString("base64"));
    return globalThis.fetch(input, { ...init, headers: h });
  }
  const res = await globalThis.fetch(input, init);
  if (res.status === 402) {
    try { declared = (await res.clone().json()).extensions || null; } catch {}
  }
  return res;
};

const client = createX402Client({
  wallet: { publicKey: kp.publicKey, signTransaction: async (tx) => { tx.sign([kp]); return tx; } },
  network: "solana", amount: 60000n, customFetch: patchFetch,
});

const mint = process.argv[2] || "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
const res = await client.fetch(`${BASE}/report`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mint }),
});
console.log("status:", res.status);
const body = await res.json();
if (res.status !== 200) { console.log(JSON.stringify(body).slice(0, 400)); process.exit(1); }

fs.writeFileSync("/tmp/report.json", JSON.stringify(body, null, 2));
console.log("\ndecision:", JSON.stringify(body.decision));
console.log("\nsignals:");
for (const [k, v] of Object.entries(body.signals))
  console.log(`  ${k.padEnd(22)} ${v.status.padEnd(15)} ${JSON.stringify(v.value ?? null)}${v.note ? "  (" + v.note + ")" : ""}`);
console.log("\nsettlement:", body.receipt?.payload?.evidence?.settlement_tx);
console.log("amount    :", body.receipt?.payload?.evidence?.amount_base_units, "(expect 30000)");

const v = await (await fetch(`${BASE}/verify`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body.receipt),
})).json();
console.log("receipt valid:", v.valid);
