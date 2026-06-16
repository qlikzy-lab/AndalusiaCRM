import { NextRequest, NextResponse } from 'next/server';
import convert from 'heic-convert';
import {
  extractLeadsFromImages,
  parseExtractionResponse,
  type ImageInput,
  type SupportedMediaType,
} from '@/lib/anthropic';
import { deduplicate } from '@/lib/deduplicate';
import { listLeads } from '@/lib/leadRepo';
import type { ExtractedLead } from '@/lib/types';

// heic-convert and Buffer require the Node.js runtime (not Edge).
export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_IMAGES = 20;

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Could not read the uploaded files.' }, { status: 400 });
  }

  const files = formData.getAll('images').filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: 'No screenshots were uploaded.' }, { status: 400 });
  }
  if (files.length > MAX_IMAGES) {
    return NextResponse.json(
      { error: `You can analyze at most ${MAX_IMAGES} screenshots at a time.` },
      { status: 400 },
    );
  }

  const filenames: string[] = [];
  const images: ImageInput[] = [];

  try {
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json(
          { error: `"${file.name || 'A file'}" is larger than 10MB.` },
          { status: 400 },
        );
      }
      images.push(await toSupportedImage(file));
      filenames.push(file.name || 'screenshot');
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'A file could not be processed.' },
      { status: 400 },
    );
  }

  // Obtain leads + raw response, either from Claude or the dev fixture.
  let leads: ExtractedLead[];
  let raw: string;
  const mock = process.env.MOCK_EXTRACTION === '1';

  if (mock) {
    leads = mockLeads();
    raw = JSON.stringify({ leads }, null, 2);
  } else {
    try {
      raw = await extractLeadsFromImages(images);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'The AI request failed. Please try again.' },
        { status: 502 },
      );
    }
    // Strict JSON parse — on failure, surface the raw output for debugging.
    try {
      leads = parseExtractionResponse(raw);
    } catch {
      return NextResponse.json(
        { error: "Could not read the AI's response as valid JSON.", raw },
        { status: 422 },
      );
    }
  }

  // Deduplicate against the existing database and within this batch.
  let result;
  try {
    const existing = await listLeads();
    result = deduplicate(leads, existing, filenames, raw);
  } catch {
    return NextResponse.json(
      { error: 'Leads were read, but checking for duplicates failed.', raw },
      { status: 500 },
    );
  }

  return NextResponse.json({ result, filenames, raw, mock });
}

/** Convert an uploaded file into a Claude-supported base64 image (HEIC→JPEG). */
async function toSupportedImage(file: File): Promise<ImageInput> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();

  const isHeic =
    type.includes('heic') ||
    type.includes('heif') ||
    name.endsWith('.heic') ||
    name.endsWith('.heif');

  if (isHeic) {
    const out = await convert({ buffer, format: 'JPEG', quality: 0.9 });
    return { mediaType: 'image/jpeg', base64: Buffer.from(out).toString('base64') };
  }

  let mediaType: SupportedMediaType | null = null;
  if (type === 'image/jpeg' || type === 'image/jpg' || name.endsWith('.jpg') || name.endsWith('.jpeg')) {
    mediaType = 'image/jpeg';
  } else if (type === 'image/png' || name.endsWith('.png')) {
    mediaType = 'image/png';
  } else if (type === 'image/webp' || name.endsWith('.webp')) {
    mediaType = 'image/webp';
  } else if (type === 'image/gif' || name.endsWith('.gif')) {
    mediaType = 'image/gif';
  }

  if (!mediaType) {
    throw new Error(`"${file.name || 'A file'}" is not a supported image (use JPG, PNG, HEIC, WebP, or GIF).`);
  }

  return { mediaType, base64: buffer.toString('base64') };
}

function mockLeads(): ExtractedLead[] {
  return [
    {
      phoneNumber: '+216 20 123 456',
      displayName: 'Sana Ben Ali',
      childName: 'Yassine',
      childAge: '6 (Grade 1)',
      notes:
        'Parent asking about the enrollment process and fees for next September. Very engaged and explicitly requested a school visit.',
      status: 'hot',
      screenshotType: 'chat',
      confidence: 'high',
    },
    {
      phoneNumber: null,
      displayName: 'Maman de Lina',
      childName: null,
      childAge: null,
      notes:
        'Inbox preview only: "Bonjour, avez-vous des places disponibles ?" — looks like a first enquiry, no real exchange yet.',
      status: 'new',
      screenshotType: 'inbox',
      confidence: 'medium',
    },
    {
      phoneNumber: null,
      displayName: null,
      childName: null,
      childAge: null,
      notes: 'This screenshot is too blurry to read any contact details or message content.',
      status: 'unknown',
      screenshotType: 'chat',
      confidence: 'low',
    },
  ];
}
