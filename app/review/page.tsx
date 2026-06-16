'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppHeader } from '@/components/AppHeader';
import { loadReview, clearReview, type ReviewPayload } from '@/lib/reviewStore';
import { LEAD_STATUSES, STATUS_LABELS, STATUS_BADGE_CLASSES } from '@/lib/leadStatus';
import type {
  PreparedLead,
  DuplicateAction,
  DuplicateMatch,
  LeadDTO,
  LeadStatus,
  SaveSummary,
} from '@/lib/types';

const SOURCE_LABEL: Record<string, string> = {
  inbox_screenshot: 'from inbox',
  chat_screenshot: 'from chat',
  manual: 'manual',
};

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none';

export default function ReviewPage() {
  const [phase, setPhase] = useState<'loading' | 'empty' | 'review' | 'success'>('loading');
  const [payload, setPayload] = useState<ReviewPayload | null>(null);
  const [newLeads, setNewLeads] = useState<PreparedLead[]>([]);
  const [actions, setActions] = useState<Record<string, DuplicateAction>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SaveSummary | null>(null);

  useEffect(() => {
    // One-time load of client-only data (sessionStorage) on mount. This must run
    // after mount rather than in a lazy initializer to stay hydration-safe.
    /* eslint-disable react-hooks/set-state-in-effect */
    const p = loadReview();
    if (!p || !p.result) {
      setPhase('empty');
      return;
    }
    setPayload(p);
    setNewLeads(p.result.newLeads);
    const initial: Record<string, DuplicateAction> = {};
    for (const d of p.result.duplicates) {
      initial[d.incoming.tempId] = d.ambiguous ? 'skip' : 'update';
    }
    setActions(initial);
    setPhase('review');
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const updateNew = (tempId: string, patch: Partial<PreparedLead>) =>
    setNewLeads((prev) => prev.map((l) => (l.tempId === tempId ? { ...l, ...patch } : l)));
  const removeNew = (tempId: string) =>
    setNewLeads((prev) => prev.filter((l) => l.tempId !== tempId));

  async function save() {
    if (!payload) return;
    setSaving(true);
    setError(null);
    const decisions = payload.result.duplicates.map((d) => ({
      incoming: d.incoming,
      existingId: d.existing.id,
      action: actions[d.incoming.tempId] ?? 'skip',
    }));
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newLeads, decisions }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Could not save the leads.');
        setSaving(false);
        return;
      }
      setSummary(data.summary as SaveSummary);
      clearReview();
      setPhase('success');
    } catch {
      setError('Could not reach the server. Your review is still here — try again.');
      setSaving(false);
    }
  }

  if (phase === 'loading') {
    return (
      <div className="flex flex-col min-h-full">
        <AppHeader />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 text-sm text-slate-500">
          Loading…
        </main>
      </div>
    );
  }

  if (phase === 'empty') {
    return (
      <div className="flex flex-col min-h-full">
        <AppHeader />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
          <p className="text-slate-700">There&apos;s nothing to review.</p>
          <Link href="/" className="mt-3 inline-block font-medium text-blue-600 underline">
            Upload screenshots
          </Link>
        </main>
      </div>
    );
  }

  if (phase === 'success' && summary) {
    return (
      <div className="flex flex-col min-h-full">
        <AppHeader subtitle="Saved to the CRM" />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
          <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
            <p className="text-2xl">✅</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">Saved!</h2>
            <p className="mt-1 text-sm text-slate-600">
              {summary.created} added · {summary.updated} updated · {summary.skipped} skipped
            </p>
          </div>
          <div className="mt-6">
            <Link
              href="/"
              className="flex h-12 items-center justify-center rounded-xl bg-blue-600 font-semibold text-white"
            >
              Upload more screenshots
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (!payload) return null;
  const { duplicates, couldNotExtract } = payload.result;
  const willSave =
    newLeads.length + duplicates.filter((d) => (actions[d.incoming.tempId] ?? 'skip') !== 'skip').length;

  return (
    <div className="flex flex-col min-h-full">
      <AppHeader subtitle="Review before saving" back={{ href: '/', label: 'Cancel' }} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <p className="text-sm text-slate-500">
          {newLeads.length} new · {duplicates.length} duplicate
          {duplicates.length === 1 ? '' : 's'} · {couldNotExtract.length} unreadable
        </p>

        {/* New leads */}
        {newLeads.length > 0 && (
          <section className="mt-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              New leads
            </h2>
            <div className="mt-3 space-y-4">
              {newLeads.map((lead) => (
                <NewLeadCard
                  key={lead.tempId}
                  lead={lead}
                  onChange={(patch) => updateNew(lead.tempId, patch)}
                  onRemove={() => removeNew(lead.tempId)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Duplicates */}
        {duplicates.length > 0 && (
          <section className="mt-7">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Duplicates found
            </h2>
            <div className="mt-3 space-y-4">
              {duplicates.map((dup) => (
                <DuplicateCard
                  key={dup.incoming.tempId}
                  dup={dup}
                  action={actions[dup.incoming.tempId] ?? 'skip'}
                  onAction={(a) =>
                    setActions((prev) => ({ ...prev, [dup.incoming.tempId]: a }))
                  }
                />
              ))}
            </div>
          </section>
        )}

        {/* Could not extract */}
        {couldNotExtract.length > 0 && (
          <section className="mt-7">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Could not extract
            </h2>
            <div className="mt-3 space-y-3">
              {couldNotExtract.map((lead) => (
                <div
                  key={lead.tempId}
                  className="rounded-xl border border-amber-300 bg-amber-50/50 p-4"
                >
                  <p className="text-sm text-slate-700">
                    {lead.notes || 'This screenshot could not be read.'}
                  </p>
                  <p className="mt-2 text-xs font-medium text-amber-700">
                    Not saved — re-upload a clearer screenshot to try again.
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {newLeads.length === 0 && duplicates.length === 0 && couldNotExtract.length === 0 && (
          <p className="mt-6 text-sm text-slate-500">No leads were found in these screenshots.</p>
        )}

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="mt-6">
          <button
            type="button"
            onClick={save}
            disabled={saving || willSave === 0}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-4 text-base font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {saving ? 'Saving…' : `Confirm & Save${willSave > 0 ? ` (${willSave})` : ''}`}
          </button>
        </div>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASSES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function NewLeadCard({
  lead,
  onChange,
  onRemove,
}: {
  lead: PreparedLead;
  onChange: (patch: Partial<PreparedLead>) => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={`rounded-xl border bg-white p-4 ${
        lead.confidence === 'low' ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200'
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
              lead.confidence === 'low'
                ? 'border-amber-300 bg-amber-100 text-amber-800'
                : 'border-slate-200 bg-slate-50 text-slate-500'
            }`}
          >
            {lead.confidence} confidence
          </span>
          <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500">
            {SOURCE_LABEL[lead.source] ?? lead.source}
          </span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 text-sm text-slate-400 underline hover:text-red-500"
        >
          Don&apos;t save
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">Name</span>
          <input
            className={inputClass}
            value={lead.displayName ?? ''}
            placeholder="Name"
            onChange={(e) => onChange({ displayName: e.target.value || null })}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">Phone</span>
          <input
            className={inputClass}
            inputMode="tel"
            value={lead.phoneNumber ?? ''}
            placeholder="Phone number"
            onChange={(e) => onChange({ phoneNumber: e.target.value || null })}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">Child</span>
          <input
            className={inputClass}
            value={lead.childName ?? ''}
            placeholder="Child's name"
            onChange={(e) => onChange({ childName: e.target.value || null })}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">Age / Grade</span>
          <input
            className={inputClass}
            value={lead.childAge ?? ''}
            placeholder="Age or grade"
            onChange={(e) => onChange({ childAge: e.target.value || null })}
          />
        </label>
      </div>

      <label className="mt-3 block">
        <span className="mb-1 block text-xs text-slate-500">Status</span>
        <select
          className={inputClass}
          value={lead.status}
          onChange={(e) => onChange({ status: e.target.value as LeadStatus })}
        >
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-3 block">
        <span className="mb-1 block text-xs text-slate-500">Notes</span>
        <textarea
          className={`${inputClass} min-h-20 resize-y`}
          value={lead.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
        />
      </label>
    </div>
  );
}

function MiniLead({ lead }: { lead: Pick<LeadDTO, 'displayName' | 'phoneNumber' | 'status' | 'notes'> }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-900">
          {lead.displayName || lead.phoneNumber || 'Unknown'}
        </span>
        <StatusBadge status={lead.status} />
      </div>
      {lead.phoneNumber && lead.displayName && (
        <p className="mt-0.5 text-xs text-slate-500">{lead.phoneNumber}</p>
      )}
      {lead.notes && <p className="mt-1 text-sm text-slate-600">{lead.notes}</p>}
    </div>
  );
}

function DuplicateCard({
  dup,
  action,
  onAction,
}: {
  dup: DuplicateMatch;
  action: DuplicateAction;
  onAction: (a: DuplicateAction) => void;
}) {
  const options: { value: DuplicateAction; label: string }[] = [
    { value: 'skip', label: 'Skip' },
    { value: 'update', label: 'Update' },
    { value: 'new', label: 'Save as new' },
  ];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium text-slate-500">
        Matches an existing lead by {dup.matchedOn === 'phone' ? 'phone number' : 'name'}
      </p>
      {dup.ambiguous && (
        <p className="mt-1 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800">
          ⚠ Matches more than one existing lead — review carefully.
        </p>
      )}

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Existing
          </p>
          <MiniLead lead={dup.existing} />
        </div>
        <div className="rounded-lg bg-blue-50/50 p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            New extraction
          </p>
          <MiniLead lead={dup.incoming} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onAction(opt.value)}
            className={`h-10 rounded-lg border text-sm font-medium transition-colors ${
              action === opt.value
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
