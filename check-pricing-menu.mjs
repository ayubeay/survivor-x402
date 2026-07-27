import { createSapClient, KeypairWallet } from "@oobe-protocol-labs/synapse-sap-sdk";
import { Pda } from "@oobe-protocol-labs/synapse-sap-sdk";
import { Keypair, PublicKey, Connection } from "@solana/web3.js";
import fs from "fs";

const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(
  fs.readFileSync(process.env.HOME + "/.config/solana/oobe-agent.json", "utf8"))));
const conn = new Connection(process.env.RPC_URL || "https://api.mainnet-beta.solana.com", "confirmed");
const sap = createSapClient(process.env.RPC_URL || "https://api.mainnet-beta.solana.com", new KeypairWallet(kp));
const [agentPda] = sap.agent.deriveAgent(kp.publicKey);

const [menuPda] = Pda.derivePricingMenu(agentPda);
console.log("agent PDA       :", agentPda.toBase58());
console.log("pricing menu PDA:", menuPda.toBase58());
const info = await conn.getAccountInfo(menuPda);
console.log("menu exists     :", !!info, info ? `(${info.data.length} bytes, owner ${info.owner.toBase58()})` : "— NOT CREATED");

// what program-owned accounts reference this wallet?
const owned = await conn.getProgramAccounts(new PublicKey("SAPpUhsWLJG1FfkGRcXagEDMrMsWGjbky7AyhGpFETZ"), {
  filters: [{ memcmp: { offset: 8 + 1 + 1, bytes: kp.publicKey.toBase58() } }],
});
console.log("\nprogram accounts referencing this wallet:", owned.length);
owned.forEach(a => console.log("  ", a.pubkey.toBase58(), a.account.data.length, "bytes"));
