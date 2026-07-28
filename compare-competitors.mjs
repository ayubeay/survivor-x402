/**
 * Buy one response from each discoverable Solana risk service and compare.
 * Requires CONFIRM_SPEND=yes. Caps: MAX_PER_CALL (default 0.05 USDC) and
 * MAX_TOTAL (default 0.30 USDC). Skips anything priced above the per-call cap.
 */
import { createX402Client } from "x402-solana/client";
import { Keypair } from "@solana/web3.js";
import fs from "fs";

const CATALOG = "https://facilitator.payai.network/discovery/resources?limit=1000";
const NEED = /risk|screen|token safety|rug/i;
const MAX_PER_CALL = BigInt(process.env.MAX_PER_CALL || 50000);   // 0.05 USDC
const MAX_TOTAL    = BigInt(process.env.MAX_TOTAL    || 300000);  // 0.30 USDC
const TEST_MINT = "So11111111111111111111111111111111111111112";  // wrapped SOL — known-good, non-controversial

const cat = await (await fetch(CATALOG)).json();
const services = (cat.items || []).filter(i => {
  if (/survivor-x402-production/.test(i.resource || "")) return false;  // do not buy from ourselves
  const blob = JSON.stringify(i);
  if (!/solana:/.test(blob)) return false;
  const desc = i.accepts?.[0]?.extra?.description || "";
  return NEED.test(desc) || NEED.test(i.resource || "");
});

console.log(`Found ${services.length} Solana risk services\n`);
let planned = 0n;
const plan = [];
for (const s of services) {
  const a = s.accepts[0];
  const amt = BigInt(a.amount || 0);
  const usdc = a.asset === "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
  const skip = !usdc ? "non-USDC" : amt > MAX_PER_CALL ? "over per-call cap" : planned + amt > MAX_TOTAL ? "would exceed total cap" : null;
  if (!skip) { planned += amt; plan.push(s); }
  console.log(`${skip ? "SKIP" : "BUY "} ${(Number(amt)/1e6).toFixed(4).padStart(8)} USDC  ${s.resource}${skip ? "  (" + skip + ")" : ""}`);
}
console.log(`\nplanned spend: ${(Number(planned)/1e6).toFixed(4)} USDC across ${plan.length} services`);

if (process.env.CONFIRM_SPEND !== "yes") {
  console.log("\nDRY RUN — re-run with CONFIRM_SPEND=yes to purchase.");
  process.exit(0);
}

const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(
  fs.readFileSync(process.env.HOME + "/.config/solana/new-payer.json", "utf8"))));

const results = [];
for (const s of plan) {
  const a = s.accepts[0];
  const body = {};
  for (const [k, v] of Object.entries(s.inputSchema?.body || {})) {
    // fill mint-like fields with our test mint, keep other declared examples
    body[k] = /mint|token|address|contract/i.test(k) ? TEST_MINT : v;
  }
  const client = createX402Client({
    wallet: { publicKey: kp.publicKey, signTransaction: async (tx) => { tx.sign([kp]); return tx; } },
    network: "solana",
    amount: BigInt(a.amount) * 2n,
  });
  const method = (s.method || "POST").toUpperCase();
  const isBodyless = method === "GET" || method === "HEAD";
  let url = s.resource;
  if (isBodyless) {
    const qp = { ...(s.inputSchema?.queryParams || {}), ...body };
    const qs = new URLSearchParams(Object.entries(qp).map(([k, v]) => [k, String(v)])).toString();
    if (qs) url += (url.includes("?") ? "&" : "?") + qs;
  }
  const t0 = Date.now();
  let entry = { resource: s.resource, price_usdc: Number(a.amount) / 1e6, method: (s.method || "POST").toUpperCase(), sent: body };
  try {
    const res = await client.fetch(url, isBodyless
      ? { method }
      : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    entry.status = res.status;
    entry.latency_ms = Date.now() - t0;
    const text = await res.text();
    entry.bytes = text.length;
    try { entry.body = JSON.parse(text); } catch { entry.body = text.slice(0, 500); }
    const blob = JSON.stringify(entry.body).toLowerCase();
    entry.signed = /"signature"\s*:\s*"[A-Za-z0-9+/=]{40,}|"signer|ed25519|"attestation"\s*:\s*\{/.test(JSON.stringify(entry.body));
    entry.fields = entry.body && typeof entry.body === "object" ? Object.keys(entry.body) : [];
  } catch (e) {
    entry.status = "ERROR";
    entry.error = e.message;
  }
  console.log(`\n${entry.status}  ${entry.resource}`);
  console.log(`  ${entry.latency_ms ?? "-"}ms  ${entry.bytes ?? 0} bytes  signed=${entry.signed ?? false}`);
  console.log(`  fields: ${(entry.fields || []).join(", ").slice(0, 160)}`);
  results.push(entry);
}

fs.writeFileSync("/tmp/competitor-comparison.json", JSON.stringify(results, null, 2));
console.log("\n--- SUMMARY ---");
console.log("service".padEnd(58), "price".padStart(8), "ms".padStart(6), "bytes".padStart(7), "signed");
for (const r of results)
  console.log(String(r.resource).slice(-56).padEnd(58), String(r.price_usdc).padStart(8), String(r.latency_ms ?? "-").padStart(6), String(r.bytes ?? "-").padStart(7), r.signed ? "yes" : "no");
console.log("\nfull responses: /tmp/competitor-comparison.json");
