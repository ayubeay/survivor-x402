import * as nacl from "tweetnacl";
import * as fs from "fs";
import * as crypto from "crypto";
import * as dotenv from "dotenv";
dotenv.config();

export interface Receipt {
  receipt_id: string;
  mint: string;
  risk_score: number;
  gate_decision: string;
  timestamp: number;
  agent_pda: string;
  signature: string;
  settlement_tx: string | null;
}

function loadKeypair() {
  const keypairEnv = process.env.AGENT_WALLET_KEYPAIR;
  if (keypairEnv && keypairEnv.trim().startsWith('[')) {
    return nacl.sign.keyPair.fromSecretKey(Uint8Array.from(JSON.parse(keypairEnv)));
  }
  const raw = JSON.parse(fs.readFileSync(keypairEnv || `${process.env.HOME}/.config/solana/oobe-agent.json`, "utf8"));
  return nacl.sign.keyPair.fromSecretKey(Uint8Array.from(raw));
}

export function signReceipt(
  mint: string,
  risk_score: number,
  gate_decision: string,
  settlement_tx: string | null
): Receipt {
  const keypair = loadKeypair();
  const timestamp = Date.now();
  const receipt_id = crypto.randomUUID();
  const payload = Buffer.from(
    JSON.stringify({ mint, risk_score, gate_decision, timestamp, receipt_id }),
    "utf8"
  );
  const sig = nacl.sign.detached(payload, keypair.secretKey);
  const signature = Buffer.from(sig).toString("base64");
  return {
    receipt_id,
    mint,
    risk_score,
    gate_decision,
    timestamp,
    agent_pda: "GTZNpoUacZrZU1PZfbzyyy34m1WizvUwE5aMfLXAf5hx",
    signature,
    settlement_tx,
  };
}
