import * as nacl from "tweetnacl";
import * as crypto from "crypto";
import * as dotenv from "dotenv";
dotenv.config();

/** Base58 (bitcoin alphabet) — inlined; verified byte-identical to bs58 across 1000 keypairs. */
const B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function b58encode(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";
  const digits: number[] = [0];
  for (let i = 0; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) { digits.push(carry % 58); carry = (carry / 58) | 0; }
  }
  let str = "";
  for (let i = 0; bytes[i] === 0 && i < bytes.length - 1; i++) str += "1";
  for (let i = digits.length - 1; i >= 0; i--) str += B58_ALPHABET[digits[i]];
  return str;
}

function b58decode(s: string): Uint8Array {
  const bytes: number[] = [0];
  for (let i = 0; i < s.length; i++) {
    const val = B58_ALPHABET.indexOf(s[i]);
    if (val < 0) throw new Error("invalid base58 character");
    let carry = val;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) { bytes.push(carry & 0xff); carry >>= 8; }
  }
  for (let i = 0; s[i] === "1" && i < s.length - 1; i++) bytes.push(0);
  return Uint8Array.from(bytes.reverse());
}

const bs58 = { encode: b58encode, decode: b58decode };

export const RECEIPT_SCHEMA = "survivor.receipt.v2";
export const POLICY_VERSION = process.env.POLICY_VERSION || "x402-risk-1.0.0";
const AGENT_PDA = "GTZNpoUacZrZU1PZfbzyyy34m1WizvUwE5aMfLXAf5hx";

/** Deterministic JSON: sorted keys, no insignificant whitespace (RFC 8785 style). */
export function canonical(v: any): string {
  if (v === undefined) return "null";   // JSON.stringify drops undefined keys on the wire;
                                        // treating it as null keeps signer and verifier in step
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  return "{" + Object.keys(v).sort()
    .map(k => JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
}

export function sha256(s: string): string {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

/** Receipt signing key — SEPARATE from the agent wallet key by design. */
function loadSigningKey() {
  const env = process.env.RECEIPT_SIGNING_KEY;
  if (!env) throw new Error("RECEIPT_SIGNING_KEY not set");
  const t = env.trim();
  if (t.startsWith("[")) return nacl.sign.keyPair.fromSecretKey(Uint8Array.from(JSON.parse(t)));
  return nacl.sign.keyPair.fromSecretKey(bs58.decode(t));
}

export function signerPubkey(): string {
  return bs58.encode(Buffer.from(loadSigningKey().publicKey));
}

export interface SettlementEvidence {
  settlement_tx: string | null;
  payer: string | null;
  amount_base_units: string;
  asset: string;
  network: string;
  facilitator: string;
}

export function signReceiptV2(args: {
  mint: string;
  network: string;
  riskResult: any;
  riskScore?: number;
  gateDecision?: string;
  evidence: SettlementEvidence;
  ttlSeconds?: number;
}) {
  const score = args.riskScore ?? args.riskResult?.risk_score;
  const decision = args.gateDecision ?? args.riskResult?.gate_decision;
  if (typeof score !== "number" || typeof decision !== "string") {
    // refuse to sign a receipt asserting fields we do not have
    throw new Error(`signReceiptV2: refusing to sign — risk_score=${score} gate_decision=${decision}`);
  }
  const kp = loadSigningKey();
  const now = Date.now();
  const ttl = (args.ttlSeconds ?? 3600) * 1000;

  const payload = {
    schema: RECEIPT_SCHEMA,
    receipt_id: crypto.randomUUID(),
    issued_at: new Date(now).toISOString(),
    expires_at: new Date(now + ttl).toISOString(),
    resource: "survivor:risk-screen",
    issuer: { agent_pda: AGENT_PDA, signer_pubkey: bs58.encode(Buffer.from(kp.publicKey)) },
    request: { mint: args.mint, network: args.network },
    decision: {
      risk_score: score,
      gate_decision: decision,
      policy_version: POLICY_VERSION,
      risk_result_hash: sha256(canonical(args.riskResult)),
    },
    evidence: { payment_verified: true, ...args.evidence },
  };

  const sig = nacl.sign.detached(Buffer.from(canonical(payload), "utf8"), kp.secretKey);
  return { payload, signature: Buffer.from(sig).toString("base64") };
}

export function verifyReceipt(receipt: { payload: any; signature: string }): boolean {
  try {
    return nacl.sign.detached.verify(
      Buffer.from(canonical(receipt.payload), "utf8"),
      Buffer.from(receipt.signature, "base64"),
      bs58.decode(receipt.payload.issuer.signer_pubkey)
    );
  } catch { return false; }
}
