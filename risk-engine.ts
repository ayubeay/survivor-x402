import axios from "axios";
import * as dotenv from "dotenv";
dotenv.config();

export interface RiskResult {
  mint: string;
  risk_score: number;
  risk_level: string;
  gate_decision: string;
  warnings: string[];
  token_name?: string;
  token_symbol?: string;
  ai_summary: string;
  raw_score_data: any;
}

export async function runRiskScreen(mint: string): Promise<RiskResult> {
  // Step 1: SURVIVOR score
  const scoreRes = await axios.get(
    `${process.env.SURVIVOR_API_URL}/score/${mint}?quick=true`,
    
  );
  const score = scoreRes.data;

  // Step 2: Ace Data GPT-4o-mini summary
  const riskLevel = score.risk_tier || score.riskLevel || 'UNKNOWN';
  const gateDecision = score.score >= 65 ? "ALLOW" : score.score >= 40 ? "CHALLENGE" : "DENY";
  const reasonCodes = (score.reasons || []).map((r: any) => r.code || r).join(', ') || 'none';
  const prompt = `You are a Solana token risk analyst. Write a 2-3 sentence plain-English summary for a trader. Use only the data provided below. Do not say anything is undefined.

Token: ${score.name || mint} (${score.symbol || 'UNKNOWN'})
Risk score: ${score.score}/100 (higher = safer)
Risk level: ${riskLevel}
Gate decision: ${gateDecision}
Risk signals: ${reasonCodes}

Start with the token name, score, and classification. End with a direct trading observation. Respond with only the summary.`;

  let ai_summary = "AI analysis unavailable.";
  try {
    const aceRes = await axios.post(
      "https://api.acedata.cloud/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 150,
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.ACE_DATA_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    ai_summary = aceRes.data.choices?.[0]?.message?.content?.trim() || ai_summary;
  } catch (e: any) {
    console.error("Ace Data error:", e?.response?.data || e.message);
  }

  return {
    mint,
    risk_score: score.score,
    risk_level: score.risk_tier || score.riskLevel,
    gate_decision: score.score >= 65 ? "ALLOW" : score.score >= 40 ? "CHALLENGE" : "DENY",
    warnings: (score.reasons || []).map((r: any) => r.code || r),
    token_name: score.name,
    token_symbol: score.symbol,
    ai_summary,
    raw_score_data: score,
  };
}
