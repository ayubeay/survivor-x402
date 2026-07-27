import { createSapClient, KeypairWallet } from "@oobe-protocol-labs/synapse-sap-sdk";
import { TokenType, SettlementMode } from "@oobe-protocol-labs/synapse-sap-sdk/types";
import { Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import fs from "fs";

const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const ENDPOINT = "https://survivor-x402-production.up.railway.app/risk-screen";
const DESCRIPTION = "Pay-per-call Solana token risk screening via x402 v2. USDC settlement with facilitator-sponsored gas; returns a signed survivor.receipt.v2 containing verified settlement evidence, policy decision, and risk-result hash.";

if (Buffer.byteLength(DESCRIPTION, "utf8") > 256) { console.error("description exceeds MAX_DESC_LEN 256"); process.exit(1); }

const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(
  fs.readFileSync(process.env.HOME + "/.config/solana/oobe-agent.json", "utf8"))));
const sap = createSapClient(process.env.RPC_URL || "https://api.mainnet-beta.solana.com", new KeypairWallet(kp));

const norm = (o) => JSON.parse(JSON.stringify(o, (_, v) =>
  typeof v === "bigint" ? v.toString() : v?.toBase58?.() ?? (v?.words ? v.toString() : v)));

const before = norm(await sap.agent.fetch(kp.publicKey));

const pricing = [{
  tierId: "standard",
  pricePerCall: new BN(10000),        // 0.01 USDC in base units
  minPricePerCall: null,
  maxPricePerCall: null,
  rateLimit: 100,                     // PRESERVED — unenforced either way; set when a limiter exists
  maxCallsPerSession: 0,
  burstLimit: null,
  tokenType: TokenType.Usdc,
  tokenMint: USDC_MINT,
  tokenDecimals: 6,
  settlementMode: SettlementMode.X402,
  minEscrowDeposit: null,
  batchIntervalSec: null,
  volumeCurve: null,
}];

console.log("BEFORE");
console.log("  x402Endpoint :", before.x402Endpoint);
console.log("  pricing      :", JSON.stringify(before.pricing[0]?.tokenType), before.pricing[0]?.pricePerCall, JSON.stringify(before.pricing[0]?.settlementMode));
console.log("\nPROPOSED");
console.log("  x402Endpoint :", ENDPOINT);
console.log("  pricing      : usdc 10000 base units, settlementMode x402, decimals 6, rateLimit 100 (preserved)");
console.log("  description  :", Buffer.byteLength(DESCRIPTION, "utf8"), "bytes");
console.log("  omitted      : name, agentId, agentUri, capabilities, protocols → preserved\n");

if (process.env.CONFIRM_UPDATE !== "yes") {
  console.log("DRY RUN — nothing sent. Re-run with CONFIRM_UPDATE=yes to execute.");
  process.exit(0);
}

const sig = await sap.agent.update({ x402Endpoint: ENDPOINT, description: DESCRIPTION, pricing });
console.log("tx:", sig);
console.log("solscan: https://solscan.io/tx/" + sig);

await new Promise(r => setTimeout(r, 8000));
const after = norm(await sap.agent.fetch(kp.publicKey));

console.log("\n--- INVARIANTS (must be unchanged) ---");
let bad = 0;
for (const f of ["wallet", "name", "agentId", "agentUri", "protocols", "capabilities", "isActive"]) {
  const same = JSON.stringify(before[f]) === JSON.stringify(after[f]);
  if (!same) bad++;
  console.log(`${same ? "OK  " : "DRIFT"} ${f}`);
}
console.log("\n--- INTENDED CHANGES ---");
console.log("x402Endpoint  :", after.x402Endpoint, after.x402Endpoint === ENDPOINT ? "OK" : "MISMATCH");
console.log("pricePerCall  :", after.pricing[0]?.pricePerCall);
console.log("tokenType     :", JSON.stringify(after.pricing[0]?.tokenType));
console.log("tokenMint     :", after.pricing[0]?.tokenMint);
console.log("tokenDecimals :", after.pricing[0]?.tokenDecimals);
console.log("settlementMode:", JSON.stringify(after.pricing[0]?.settlementMode));
console.log("description   :", after.description === DESCRIPTION ? "OK" : "MISMATCH");
console.log(bad ? `\n${bad} UNRELATED FIELD(S) DRIFTED — investigate` : "\nAll identity, capability and protocol fields preserved.");
