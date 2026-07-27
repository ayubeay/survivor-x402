/**
 * SURVIVOR x402 — gate 8-12 verification
 * Spends REAL USDC ($0.01) on Solana mainnet. Requires CONFIRM_SPEND=yes.
 *
 * Payer key:  PAYER_SECRET_KEY (base58 or JSON array) or PAYER_KEYPAIR_PATH
 * Never printed. Only public keys, signatures and results are logged.
 */
import { createX402Client } from "x402-solana/client";
import { Keypair, VersionedTransaction, Connection, PublicKey } from "@solana/web3.js";
import * as nacl from "tweetnacl";
import * as fs from "fs";
import { canonical } from "./receipt";

const BASE = process.env.TARGET_BASE || "https://survivor-x402-production.up.railway.app";
const MINT = "So11111111111111111111111111111111111111112";
const USDC = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const PAYEE = "4aet1MhW5gbf46dqzrQB1qxGjM3Q3hN7ndKPRrntW5vg";
const RPC = process.env.RPC_URL || "https://api.mainnet-beta.solana.com";

const A58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58decode(s: string): Uint8Array {
  const bytes: number[] = [0];
  for (const ch of s) {
    const v = A58.indexOf(ch);
    if (v < 0) throw new Error("invalid base58 in payer key");
    let carry = v;
    for (let j = 0; j < bytes.length; j++) { carry += bytes[j] * 58; bytes[j] = carry & 0xff; carry >>= 8; }
    while (carry > 0) { bytes.push(carry & 0xff); carry >>= 8; }
  }
  for (let i = 0; s[i] === "1" && i < s.length - 1; i++) bytes.push(0);
  return Uint8Array.from(bytes.reverse());
}

function loadPayer(): Keypair {
  const path = process.env.PAYER_KEYPAIR_PATH;
  if (path) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(path, "utf8"))));
  const sk = process.env.PAYER_SECRET_KEY;
  if (!sk) throw new Error("Set PAYER_SECRET_KEY or PAYER_KEYPAIR_PATH");
  const t = sk.trim();
  return Keypair.fromSecretKey(t.startsWith("[") ? Uint8Array.from(JSON.parse(t)) : b58decode(t));
}

async function usdcBalance(conn: Connection, owner: PublicKey): Promise<bigint> {
  const r = await conn.getParsedTokenAccountsByOwner(owner, { mint: USDC });
  if (!r.value.length) return 0n;
  return r.value.reduce((sum, a) =>
    sum + BigInt(a.account.data.parsed.info.tokenAmount.amount), 0n);
}

const results: Array<[string, boolean, string]> = [];
const gate = (n: string, ok: boolean, detail = "") => {
  results.push([n, ok, detail]);
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${detail ? "  — " + detail : ""}`);
};

async function main() {
  if (process.env.CONFIRM_SPEND !== "yes") {
    console.log("This spends real USDC. Re-run with CONFIRM_SPEND=yes");
    process.exit(1);
  }

  const payer = loadPayer();
  const payerPk = payer.publicKey.toBase58();
  console.log("payer :", payerPk);
  console.log("payee :", PAYEE);
  if (payerPk === PAYEE) { console.error("ABORT: payer must not be the payee wallet"); process.exit(1); }

  // Pre-flight balances
  const conn = new Connection(RPC, "confirmed");
  const sol = await conn.getBalance(payer.publicKey);
  console.log("SOL   :", (sol / 1e9).toFixed(6));
  let usdcBefore = 0n;
  try {
    usdcBefore = await usdcBalance(conn, payer.publicKey);
    console.log("USDC  :", (Number(usdcBefore) / 1e6).toFixed(6));
  } catch (e: any) { console.log("USDC  : balance read failed —", e.message); }
  if (usdcBefore < 10000n) { console.error("ABORT: need at least 0.01 USDC"); process.exit(1); }

  // Expected signer identity
  const signerDoc = await (await fetch(`${BASE}/signer`)).json() as any;
  console.log("signer:", signerDoc.signer_pubkey, "\n");

  // Capture the outgoing payment header for the replay test
  let capturedPayment: string | null = null;
  const captureFetch: typeof fetch = async (input: any, init?: any) => {
    const h = new Headers(init?.headers || {});
    const p = h.get("PAYMENT-SIGNATURE");
    if (p) capturedPayment = p;
    return globalThis.fetch(input, init);
  };

  const client = createX402Client({
    wallet: {
      publicKey: payer.publicKey,
      signTransaction: async (tx: VersionedTransaction) => { tx.sign([payer]); return tx; },
    },
    network: "solana",
    rpcUrl: RPC,
    amount: 20000n,          // hard cap: never spend more than $0.02
    customFetch: captureFetch,
    verbose: true,
  });

  // ---- GATE 8: real payment ----
  const res = await client.fetch(`${BASE}/risk-screen`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mint: MINT }),
  });
  const body = await res.json() as any;
  gate("8  payment completes, 200 returned", res.status === 200, `status=${res.status}`);
  if (res.status !== 200) { console.log(JSON.stringify(body, null, 2).slice(0, 800)); return summary(); }

  // ---- GATE 9: settlement exactly once ----
  const ev = body?.receipt?.payload?.evidence;
  gate("9  settlement evidence present", !!ev?.settlement_tx, ev?.settlement_tx || "missing");
  gate("9b payment_verified true", ev?.payment_verified === true);

  // ---- GATE 10: receipt verifies against /signer ----
  const payload = body?.receipt?.payload;
  const sig = body?.receipt?.signature;
  let verified = false;
  try {
    verified = nacl.sign.detached.verify(
      Buffer.from(canonical(payload), "utf8"),
      Buffer.from(sig, "base64"),
      b58decode(signerDoc.signer_pubkey)
    );
  } catch (e: any) { console.log("verify error:", e.message); }
  gate("10 receipt verifies vs /signer pubkey", verified);
  gate("10b payload signer matches /signer", payload?.issuer?.signer_pubkey === signerDoc.signer_pubkey);

  // ---- GATE 11: evidence completeness ----
  const need = ["settlement_tx", "payer", "amount_base_units", "asset", "network", "facilitator"];
  const missing = need.filter(k => ev?.[k] === undefined || ev?.[k] === null);
  gate("11 evidence complete", missing.length === 0, missing.length ? "missing: " + missing.join(",") : "all fields");
  gate("11b risk_result_hash present", !!payload?.decision?.risk_result_hash);

  // ---- GATE 12: replay resistance ----
  if (!capturedPayment) {
    gate("12 replay rejected", false, "could not capture payment header");
  } else {
    const replay = await fetch(`${BASE}/risk-screen`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "PAYMENT-SIGNATURE": capturedPayment },
      body: JSON.stringify({ mint: MINT }),
    });
    const rbody = await replay.json().catch(() => ({})) as any;
    gate("12 replay rejected", replay.status !== 200, `status=${replay.status} reason=${rbody?.invalidReason || rbody?.error || "-"}`);
    gate("12b replay issued no receipt", !rbody?.receipt);
  }

  // Balance delta — charged exactly once?
  try {
    const after = await usdcBalance(conn, payer.publicKey);
    const spent = Number(usdcBefore - after) / 1e6;
    console.log(`\nUSDC spent: ${spent.toFixed(6)} (expected 0.010000)`);
    gate("12c charged exactly once", Math.abs(spent - 0.01) < 0.000001, `${spent.toFixed(6)} USDC`);
  } catch { console.log("could not read post-balance"); }

  fs.writeFileSync("/tmp/receipt.json", JSON.stringify(body.receipt, null, 2));
  console.log("\nreceipt written to /tmp/receipt.json");
  console.log(JSON.stringify(body.receipt, null, 2));
  summary();
}

function summary() {
  const pass = results.filter(r => r[1]).length;
  console.log(`\n===== ${pass}/${results.length} gates passed =====`);
  results.filter(r => !r[1]).forEach(r => console.log("  FAILED:", r[0], r[2]));
}

main().catch(e => { console.error("FATAL:", e.message); summary(); process.exit(1); });
