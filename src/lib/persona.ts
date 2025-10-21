import { GoogleGenerativeAI } from "@google/generative-ai";

const DEFAULT_MODEL = process.env.MINIME_PERSONA_MODEL || "gemini-2.5-pro";

export type PersonaShape = {
  name: string;
  style: string;
  specialties: string[];
  catchphrases: string[];
  constraints: string[];
};

export async function buildPersonaJson(
  transcript: string,
  customPersona: string | undefined
): Promise<string> {
  const trimmedCustom = customPersona?.trim();
  if (trimmedCustom) {
    ensureValidPersona(trimmedCustom);
    return trimmedCustom;
  }

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not configured");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: DEFAULT_MODEL });

  const safeTranscript = transcript.length > 15000 ? transcript.slice(0, 15000) : transcript;
  const prompt = [
    "Task: Derive an actionable trainer persona from the provided YouTube transcript.",
    "",
    "If a custom trainer persona is provided AFTER this line, adopt it exactly:",
    "---",
    "",
    "---",
    "",
    "Otherwise, infer these fields:",
    "- name",
    "- style (≤15 words)",
    "- specialties (3–6 tags)",
    "- catchphrases (3–8 short lines)",
    "- constraints (3–6 guardrails: safety, scope, tone)",
    "",
    "Rules:",
    "- Output JSON only. No commentary.",
    "",
    safeTranscript,
  ].join("\n");

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
  });

  const raw = result.response.text()?.trim();
  if (!raw) {
    throw new Error("Persona model returned an empty response");
  }

  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  ensureValidPersona(cleaned);
  return cleaned;
}

function ensureValidPersona(candidate: string) {
  let parsed: PersonaShape;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    throw new Error("Persona output is not valid JSON");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Persona JSON must be an object");
  }
  const { name, style, specialties, catchphrases, constraints } = parsed;
  if (!name || typeof name !== "string") {
    throw new Error("Persona JSON missing 'name'");
  }
  if (!style || typeof style !== "string") {
    throw new Error("Persona JSON missing 'style'");
  }
  if (!Array.isArray(specialties) || !specialties.length) {
    throw new Error("Persona JSON missing 'specialties'");
  }
  if (!Array.isArray(catchphrases) || !catchphrases.length) {
    throw new Error("Persona JSON missing 'catchphrases'");
  }
  if (!Array.isArray(constraints) || !constraints.length) {
    throw new Error("Persona JSON missing 'constraints'");
  }
}

export function buildPersonaPromptSuffix(persona: PersonaShape | null): string {
  if (!persona) {
    return "Stay in character as Liftspump's coach. Prioritize safe form cues and progressive overload.";
  }
  const specialties = persona.specialties?.join(", ") || "";
  const phrases = persona.catchphrases?.join(" | ") || "";
  const constraints = persona.constraints?.join("; ") || "";
  return `You are ${persona.name}. Style: ${persona.style}.
Specialties: ${specialties}.
Use catchphrases: ${phrases}.
Constraints: ${constraints}.
Stay in character. Be concise. Prioritize safe form and progressive overload.`;
}

