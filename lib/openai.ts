import OpenAI from 'openai';
import { EXTRACTION_SYSTEM_PROMPT } from './prompt';
import { coerceStatus } from './leadStatus';
import type { ExtractedLead, ScreenshotType, Confidence } from './types';

export const EXTRACT_MODEL = 'gpt-4o';
export const EXTRACT_MAX_TOKENS = 2000;

// Image formats accepted by the OpenAI vision API. HEIC must be converted upstream.
export type SupportedMediaType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/gif'
  | 'image/webp';

export interface ImageInput {
  mediaType: SupportedMediaType;
  base64: string;
}

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY is not set. Add it to .env.local and restart the dev server.',
    );
  }
  return new OpenAI({ apiKey });
}

/**
 * Send all screenshots to GPT-4o in a single multi-image call and return the
 * raw text response. JSON parsing is handled separately so the caller can
 * surface the raw output on failure.
 */
export async function extractLeadsFromImages(images: ImageInput[]): Promise<string> {
  const client = getClient();

  const content: OpenAI.Chat.ChatCompletionContentPart[] = [
    ...images.map(
      (img): OpenAI.Chat.ChatCompletionContentPartImage => ({
        type: 'image_url',
        image_url: { url: `data:${img.mediaType};base64,${img.base64}` },
      }),
    ),
    {
      type: 'text',
      text: 'Extract all leads from the attached WhatsApp screenshot(s) and return JSON only.',
    },
  ];

  const response = await client.chat.completions.create({
    model: EXTRACT_MODEL,
    max_tokens: EXTRACT_MAX_TOKENS,
    messages: [
      { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
      { role: 'user', content },
    ],
  });

  return (response.choices[0]?.message?.content ?? '').trim();
}

/**
 * Strictly parse GPT-4o's response into leads. Tolerates accidental markdown
 * fences but otherwise requires valid JSON with a `leads` array. Throws on
 * failure so the route can return the raw output for debugging.
 */
export function parseExtractionResponse(raw: string): ExtractedLead[] {
  const cleaned = stripCodeFences(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('The AI did not return valid JSON.');
  }

  const leadsValue = (parsed as { leads?: unknown })?.leads;
  if (!Array.isArray(leadsValue)) {
    throw new Error('AI response did not contain a "leads" array.');
  }

  return leadsValue.map((item) => normalizeExtractedLead(item));
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('```')) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
  }
  return trimmed;
}

function asNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeExtractedLead(item: unknown): ExtractedLead {
  const obj = (item ?? {}) as Record<string, unknown>;
  const screenshotType: ScreenshotType =
    obj.screenshotType === 'inbox' ? 'inbox' : 'chat';
  const confidence: Confidence =
    obj.confidence === 'high' || obj.confidence === 'medium' ? obj.confidence : 'low';

  return {
    phoneNumber: asNullableString(obj.phoneNumber),
    displayName: asNullableString(obj.displayName),
    childName: asNullableString(obj.childName),
    childAge: asNullableString(obj.childAge),
    notes: typeof obj.notes === 'string' ? obj.notes : '',
    status: coerceStatus(obj.status),
    screenshotType,
    confidence,
  };
}
