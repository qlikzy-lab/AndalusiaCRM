'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { saveReview } from '@/lib/reviewStore';

const MAX_IMAGES = 20;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif'];
const ACCEPTED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
];
const PROGRESS_STEPS = [
  'Reading screenshots…',
  'Extracting contacts…',
  'Checking for duplicates…',
];

interface UploadItem {
  id: string;
  file: File;
  url: string | null; // object URL for preview, null for HEIC (not renderable)
  isHeic: boolean;
}

type Phase = 'idle' | 'processing' | 'error';

function isHeicFile(file: File): boolean {
  const t = file.type.toLowerCase();
  const n = file.name.toLowerCase();
  return t.includes('heic') || t.includes('heif') || n.endsWith('.heic') || n.endsWith('.heif');
}

function isAcceptedFile(file: File): boolean {
  const t = file.type.toLowerCase();
  const n = file.name.toLowerCase();
  return ACCEPTED_MIME.includes(t) || ACCEPTED_EXTENSIONS.some((ext) => n.endsWith(ext));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function UploadPage() {
  const router = useRouter();
  const [items, setItems] = useState<UploadItem[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [rawError, setRawError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Revoke object URLs on unmount.
  useEffect(() => {
    return () => {
      items.forEach((it) => it.url && URL.revokeObjectURL(it.url));
      if (stepTimer.current) clearInterval(stepTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      const incoming = Array.from(fileList);
      const rejected: string[] = [];
      const candidates: UploadItem[] = [];

      for (const file of incoming) {
        if (!isAcceptedFile(file)) {
          rejected.push(`${file.name} (unsupported type)`);
          continue;
        }
        if (file.size > MAX_FILE_BYTES) {
          rejected.push(`${file.name} (larger than 10MB)`);
          continue;
        }
        const heic = isHeicFile(file);
        candidates.push({
          id: crypto.randomUUID(),
          file,
          url: heic ? null : URL.createObjectURL(file),
          isHeic: heic,
        });
      }

      const room = Math.max(0, MAX_IMAGES - items.length);
      const kept = candidates.slice(0, room);
      // Drop and clean up anything over the limit.
      candidates.slice(room).forEach((it) => it.url && URL.revokeObjectURL(it.url));
      if (candidates.length > room) {
        rejected.push(`${candidates.length - room} more (limit of ${MAX_IMAGES} reached)`);
      }

      if (kept.length > 0) setItems((prev) => [...prev, ...kept]);
      setNotice(rejected.length > 0 ? `Skipped: ${rejected.join(', ')}.` : null);
    },
    [items.length],
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const target = prev.find((it) => it.id === id);
      if (target?.url) URL.revokeObjectURL(target.url);
      return prev.filter((it) => it.id !== id);
    });
  }, []);

  const reset = useCallback(() => {
    setItems((prev) => {
      prev.forEach((it) => it.url && URL.revokeObjectURL(it.url));
      return [];
    });
    setError(null);
    setRawError(null);
    setNotice(null);
    setPhase('idle');
  }, []);

  const analyze = useCallback(async () => {
    if (items.length === 0) return;
    setPhase('processing');
    setError(null);
    setRawError(null);
    setStepIndex(0);

    // Advance the progress label so the user sees the steps.
    if (stepTimer.current) clearInterval(stepTimer.current);
    stepTimer.current = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, PROGRESS_STEPS.length - 1));
    }, 1000);

    const start = Date.now();
    const form = new FormData();
    items.forEach((it) => form.append('images', it.file, it.file.name));

    try {
      const res = await fetch('/api/extract', { method: 'POST', body: form });
      const data = await res.json();

      // Keep the multi-step animation visible for a beat even if the API is fast.
      const elapsed = Date.now() - start;
      if (elapsed < 2200) await sleep(2200 - elapsed);

      if (!res.ok) {
        setError(data?.error ?? 'Something went wrong while analyzing the screenshots.');
        setRawError(typeof data?.raw === 'string' ? data.raw : null);
        setPhase('error');
        return;
      }

      saveReview({
        result: data.result,
        filenames: data.filenames,
        raw: data.raw,
        mock: data.mock,
      });
      router.push('/review');
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
      setPhase('error');
    } finally {
      if (stepTimer.current) {
        clearInterval(stepTimer.current);
        stepTimer.current = null;
      }
    }
  }, [items, router]);

  return (
    <div className="flex flex-col min-h-full">
      <AppHeader back={{ href: '/crm', label: 'View leads' }} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <h2 className="text-base font-medium text-slate-800">
          Add screenshots of your WhatsApp messages
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Upload the inbox list or individual chats. JPG, PNG, or HEIC — up to {MAX_IMAGES} images,
          10MB each.
        </p>

        {/* Drop zone */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
          }}
          disabled={phase === 'processing'}
          className={`mt-4 flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition-colors disabled:opacity-60 ${
            dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-300 bg-white hover:border-slate-400'
          }`}
        >
          <span className="text-3xl" aria-hidden>
            📷
          </span>
          <span className="text-base font-medium text-slate-700">Tap to add screenshots</span>
          <span className="text-sm text-slate-400">or drag and drop them here</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={[...ACCEPTED_MIME, ...ACCEPTED_EXTENSIONS].join(',')}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = '';
          }}
        />

        {notice && <p className="mt-3 text-sm text-amber-700">{notice}</p>}

        {/* Thumbnails */}
        {items.length > 0 && (
          <div className="mt-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">
                {items.length} screenshot{items.length > 1 ? 's' : ''} ready
              </p>
              <button
                type="button"
                onClick={reset}
                disabled={phase === 'processing'}
                className="text-sm text-slate-500 underline disabled:opacity-50"
              >
                Clear all
              </button>
            </div>
            <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
              {items.map((it) => (
                <li
                  key={it.id}
                  className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                >
                  {it.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.url} alt={it.file.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center p-2 text-center">
                      <span className="text-xs font-semibold text-slate-500">HEIC</span>
                      <span className="mt-1 line-clamp-2 text-[10px] text-slate-400">
                        {it.file.name}
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeItem(it.id)}
                    disabled={phase === 'processing'}
                    aria-label={`Remove ${it.file.name}`}
                    className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-sm text-white disabled:opacity-50"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Error banner */}
        {phase === 'error' && error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">{error}</p>
            <p className="mt-1 text-sm text-red-600">
              Your screenshots are still here — you can try again.
            </p>
            {rawError && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-red-700">
                  Show raw AI response (debug)
                </summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-white p-3 text-xs text-slate-700">
                  {rawError}
                </pre>
              </details>
            )}
          </div>
        )}

        {/* Primary action */}
        <div className="mt-6">
          {phase === 'processing' ? (
            <div className="flex items-center justify-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-white">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              <span className="text-sm font-medium">{PROGRESS_STEPS[stepIndex]}</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={analyze}
              disabled={items.length === 0}
              className="flex h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-4 text-base font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {phase === 'error' ? 'Try again' : 'Analyze screenshots'}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
