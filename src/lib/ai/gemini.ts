import "server-only";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-3.5-flash-lite";

export class GeminiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function aiExtractionEnabled(): boolean {
  return Boolean(process.env["GEMINI_API_KEY"]);
}

type GenerateOptions = {
  system: string;
  prompt: string;
  schema: unknown;
  model?: string;
  maxOutputTokens?: number;
};

/**
 * Ask Gemini for a JSON object constrained by `schema`.
 *
 * The API key stays server-side and is passed in the query string exactly as
 * Google documents. Nothing is logged here except a status code on failure.
 */
export async function generateJson<T>({
  system,
  prompt,
  schema,
  model = process.env["GEMINI_MODEL"] ?? DEFAULT_MODEL,
  maxOutputTokens = 4096,
}: GenerateOptions): Promise<T> {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) throw new GeminiError(0, "GEMINI_API_KEY is not configured");

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens,
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (error) {
    throw new GeminiError(0, error instanceof Error ? error.message : "request failed");
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new GeminiError(response.status, `Gemini returned ${response.status}: ${detail.slice(0, 300)}`);
  }

  const data: unknown = await response.json();
  const candidates = (data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates;
  const text = candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (!text.trim()) throw new GeminiError(0, "empty response");

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new GeminiError(0, "response was not valid JSON");
  }
}
