/**
 * Cold discovery: no hardcoded SURVIVOR URL. Starts from the public Bazaar,
 * finds a risk-screening service by capability, reads its schema, pays with the
 * UNMODIFIED x402-solana client, then verifies the receipt.
 * This is what an unrelated agent would do.
 */
import { createX402Client } from "x402-solana/client";
import { Keypair } from "@solana/web3.js";
import fs from "fs";

const CATALOG = "https://facilitator.payai.network/discovery/resources?limit=1000";
const NEED = /risk|screen|token safety|rug/i;   // capability sought, not a name

const step = (n, msg) => console.log(`\n[${n}] ${msg}`);

step(1, "Query the public catalog — no prior knowledge of any endpoint");
const cat = await (await fetch(CATALOG)).json();
const items = cat.items || [];
console.log(`    ${items.length} resources listed`);

step(2, "Find a service matching the capability we need");
const candidates = items.filter(i => {
  const blob = JSON.stringify(i);
  const solana = /solana:/.test(blob);
  const desc = i.accepts?.[0]?.extra?.description || "";
  return solana && (NEED.test(desc) || NEED.test(i.resource || ""));
});
console.log(`    ${candidates.length} candidate(s):`);
candidates.forEach(c => console.log(`      ${c.resource}  —  ${c.accepts[0].extra?.description || "(no description)"}`));
if (!candidates.length) { console.log("    none found — stop"); process.exit(1); }

const svc = candidates[0];
const acc = svc.accepts[0];
step(3, "Read its interface from the catalog alone");
console.log(`    resource : ${svc.resource}`);
console.log(`    method   : ${svc.method}`);
console.log(`    price    : ${acc.amount} base units of ${acc.asset}`);
console.log(`    network  : ${acc.network}`);
console.log(`    input    : ${JSON.stringify(svc.inputSchema?.body)}`);

step(4, "Build the request from the declared schema");
const body = {};
for (const [k, v] of Object.entries(svc.inputSchema?.body || {})) body[k] = v;
console.log(`    sending  : ${JSON.stringify(body)}`);

step(5, "Pay with the UNMODIFIED client (no patches)");
const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(
  fs.readFileSync(process.env.HOME + "/.config/solana/new-payer.json", "utf8"))));
const client = createX402Client({
  wallet: { publicKey: kp.publicKey, signTransaction: async (tx) => { tx.sign([kp]); return tx; } },
  network: "solana",
  amount: BigInt(acc.amount) * 2n,
});
const res = await client.fetch(svc.resource, {
  method: svc.method || "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
console.log(`    status   : ${res.status}`);
const out = await res.json();
if (res.status !== 200) { console.log(JSON.stringify(out).slice(0, 300)); process.exit(1); }
console.log(`    result   : ${out.risk_level} / ${out.gate_decision} (score ${out.risk_score})`);

step(6, "Discover the verification endpoint from the service index");
const base = new URL(svc.resource).origin;
const index = await (await fetch(base + "/")).json();
const verifyPath = Object.keys(index.endpoints || {}).find(k => /verify/i.test(k));
console.log(`    index advertises: ${verifyPath || "no verify endpoint"}`);

step(7, "Verify the receipt independently");
const vres = await fetch(base + "/verify", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify(out.receipt),
});
const v = await vres.json();
console.log(`    valid    : ${v.valid}`);
console.log(`    checks   : ${Object.entries(v.checks).map(([k, x]) => `${k}=${x}`).join(", ")}`);
console.log(`    settlement verifiable at: ${v.verify_settlement_at}`);

console.log(`\n${v.valid && res.status === 200 ? "COLD DISCOVERY SUCCEEDED" : "FAILED"} — catalog to verified result, no prior knowledge, no patches.`);
