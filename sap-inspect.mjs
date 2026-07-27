import { createSapClient, KeypairWallet } from "@oobe-protocol-labs/synapse-sap-sdk";
import { Keypair } from "@solana/web3.js";
import fs from "fs";

const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(
  fs.readFileSync(process.env.HOME + "/.config/solana/oobe-agent.json", "utf8"))));
const rpcUrl = process.env.RPC_URL || "https://api.mainnet-beta.solana.com";

const sap = createSapClient(rpcUrl, new KeypairWallet(kp));
const [pda] = sap.agent.deriveAgent(kp.publicKey);

const show = (o) => JSON.stringify(o, (_, v) =>
  typeof v === "bigint" ? v.toString() :
  v?.toBase58?.() ?? (v?.toString && v?.words ? v.toString() : v), 2);

console.log("wallet  :", kp.publicKey.toBase58());
console.log("pda     :", pda.toBase58());
console.log("program :", sap.programId?.toBase58?.() ?? "n/a");

console.log("\n--- CURRENT AGENT RECORD ---");
console.log(show(await sap.agent.fetchNullable(kp.publicKey)));

console.log("\n--- STATS ---");
console.log(show(await sap.agent.fetchStatsNullable(pda)));
