import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getAccount } from "@solana/spl-token";
import fs from "fs";

const USDC = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const conn = new Connection(process.env.RPC_URL || "https://api.mainnet-beta.solana.com", "confirmed");
const owner = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(process.env.HOME + "/.config/solana/oobe-agent.json", "utf8")))
);

const ata = await getAssociatedTokenAddress(USDC, owner.publicKey);
console.log("owner:", owner.publicKey.toBase58());
console.log("ata  :", ata.toBase58());
console.log("SOL  :", (await conn.getBalance(owner.publicKey)) / 1e9);

try {
  const acc = await getAccount(conn, ata);
  console.log("ATA already exists — balance", Number(acc.amount) / 1e6, "USDC");
  process.exit(0);
} catch { console.log("ATA missing — creating..."); }

const tx = new Transaction().add(
  createAssociatedTokenAccountInstruction(owner.publicKey, ata, owner.publicKey, USDC)
);
const sig = await sendAndConfirmTransaction(conn, tx, [owner]);
console.log("created:", sig);
console.log("solscan: https://solscan.io/tx/" + sig);
