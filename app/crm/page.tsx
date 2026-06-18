'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { LEAD_STATUSES, STATUS_LABELS, getStatusLabel, getStatusBadgeClass } from '@/lib/leadStatus';
import type { LeadDTO, LeadStatus, PreparedLead } from '@/lib/types';
import type { CustomStatusDTO } from '@/lib/customStatusRepo';

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none';

type SortKey = 'newest' | 'oldest' | 'updated' | 'name';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function whatsappUrl(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : null;
}

interface DraftLead {
  displayName: string;
  phoneNumber: string;
  childName: string;
  childAge: string;
  status: LeadStatus;
  notes: string;
}

function leadToDraft(lead: LeadDTO): DraftLead {
  return {
    displayName: lead.displayName ?? '',
    phoneNumber: lead.phoneNumber ?? '',
    childName: lead.childName ?? '',
    childAge: lead.childAge ?? '',
    status: lead.status,
    notes: lead.notes ?? '',
  };
}

const EMPTY_DRAFT: DraftLead = {
  displayName: '',
  phoneNumber: '',
  childName: '',
  childAge: '',
  status: 'new',
  notes: '',
};

function csvEscape(value: string | null): string {
  const s = value ?? '';
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function leadsToCsv(leads: LeadDTO[]): string {
  const headers = ['Name', 'Phone', 'Child', 'Age/Grade', 'Status', 'Source', 'Notes', 'First seen', 'Last updated'];
  const rows = leads.map((l) =>
    [l.displayName, l.phoneNumber, l.childName, l.childAge, getStatusLabel(l.status), l.source, l.notes, l.firstSeenAt, l.lastUpdatedAt]
      .map((v) => csvEscape(v == null ? '' : String(v)))
      .join(','),
  );
  return [headers.join(','), ...rows].join('\n');
}

export default function CrmPage() {
  const [leads, setLeads] = useState<LeadDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'table'>('list');
  const [sortKey, setSortKey] = useState<SortKey>('newest');
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<DraftLead>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);

  // Custom statuses
  const [customStatuses, setCustomStatuses] = useState<CustomStatusDTO[]>([]);
  const [showManage, setShowManage] = useState(false);
  const [newStatusLabel, setNewStatusLabel] = useState('');
  const [manageError, setManageError] = useState<string | null>(null);
  const [manageSaving, setManageSaving] = useState(false);

  const allStatuses = useMemo(
    () => [...LEAD_STATUSES, ...customStatuses.map((s) => s.label)],
    [customStatuses],
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [leadsRes, statusesRes] = await Promise.all([
        fetch('/api/leads'),
        fetch('/api/statuses'),
      ]);
      const leadsData = await leadsRes.json();
      const statusesData = await statusesRes.json();
      if (!leadsRes.ok) throw new Error(leadsData?.error ?? 'Failed to load leads.');
      setLeads(leadsData.leads as LeadDTO[]);
      setCustomStatuses(statusesData.statuses ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load leads.');
    } finally {
      setLoading(false);
    }
  }

  async function loadStatuses() {
    const res = await fetch('/api/statuses');
    const data = await res.json();
    setCustomStatuses(data.statuses ?? []);
  }

  useEffect(() => {
    // Fetch leads and custom statuses once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = leads.filter((l) => {
      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (l.displayName ?? '').toLowerCase().includes(q) ||
        (l.phoneNumber ?? '').toLowerCase().includes(q) ||
        (l.phoneNumberNormalized ?? '').toLowerCase().includes(q) ||
        (l.childName ?? '').toLowerCase().includes(q)
      );
    });
    return result.sort((a, b) => {
      switch (sortKey) {
        case 'newest': return new Date(b.firstSeenAt).getTime() - new Date(a.firstSeenAt).getTime();
        case 'oldest': return new Date(a.firstSeenAt).getTime() - new Date(b.firstSeenAt).getTime();
        case 'updated': return new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime();
        case 'name': return (a.displayName ?? a.phoneNumber ?? '').localeCompare(b.displayName ?? b.phoneNumber ?? '');
      }
    });
  }, [leads, search, statusFilter, sortKey]);

  function openAdd() {
    setDraft(EMPTY_DRAFT);
    setEditorError(null);
    setEditing('new');
  }
  function openEdit(lead: LeadDTO) {
    setDraft(leadToDraft(lead));
    setEditorError(null);
    setEditing(lead.id);
  }
  function closeEditor() { setEditing(null); }

  async function saveDraft() {
    if (!draft.displayName.trim() && !draft.phoneNumber.trim()) {
      setEditorError('Add a name or a phone number.');
      return;
    }
    setSaving(true);
    setEditorError(null);
    try {
      if (editing === 'new') {
        const prepared: PreparedLead = {
          tempId: crypto.randomUUID(),
          phoneNumber: draft.phoneNumber.trim() || null,
          phoneNumberNormalized: null,
          displayName: draft.displayName.trim() || null,
          childName: draft.childName.trim() || null,
          childAge: draft.childAge.trim() || null,
          notes: draft.notes,
          status: draft.status,
          source: 'manual',
          confidence: 'high',
          screenshotFilenames: [],
          rawExtraction: '',
        };
        const res = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newLeads: [prepared], decisions: [] }),
        });
        if (!res.ok) throw new Error('Could not add the lead.');
      } else if (editing) {
        const res = await fetch(`/api/leads/${editing}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phoneNumber: draft.phoneNumber.trim() || null,
            displayName: draft.displayName.trim() || null,
            childName: draft.childName.trim() || null,
            childAge: draft.childAge.trim() || null,
            notes: draft.notes,
            status: draft.status,
          }),
        });
        if (!res.ok) throw new Error('Could not save the lead.');
      }
      setEditing(null);
      await load();
    } catch (e) {
      setEditorError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this lead? This cannot be undone.')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not delete the lead.');
      setEditing(null);
      await load();
    } catch (e) {
      setEditorError(e instanceof Error ? e.message : 'Delete failed.');
    } finally {
      setSaving(false);
    }
  }

  async function addCustomStatus() {
    const label = newStatusLabel.trim();
    if (!label) return;
    setManageSaving(true);
    setManageError(null);
    try {
      const res = await fetch('/api/statuses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Could not add status.');
      setNewStatusLabel('');
      await loadStatuses();
    } catch (e) {
      setManageError(e instanceof Error ? e.message : 'Failed to add status.');
    } finally {
      setManageSaving(false);
    }
  }

  async function removeCustomStatus(id: string) {
    setManageSaving(true);
    try {
      await fetch(`/api/statuses/${id}`, { method: 'DELETE' });
      await loadStatuses();
    } finally {
      setManageSaving(false);
    }
  }

  function exportCsv() {
    const blob = new Blob([leadsToCsv(filtered)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'andalusia-leads.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col min-h-full">
      <AppHeader subtitle="Leads" back={{ href: '/', label: 'Upload' }} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {/* Controls */}
        <div className="flex flex-col gap-3">
          <input
            className={inputClass}
            placeholder="Search by name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <FilterChip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
              All
            </FilterChip>
            {allStatuses.map((s) => (
              <FilterChip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
                {getStatusLabel(s)}
              </FilterChip>
            ))}
            <button
              type="button"
              onClick={() => { setShowManage(true); setManageError(null); setNewStatusLabel(''); }}
              title="Manage statuses"
              className="rounded-full border border-dashed border-slate-400 px-3 py-1 text-sm text-slate-500 hover:border-slate-600 hover:text-slate-700"
            >
              + Status
            </button>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">
              {filtered.length} {filtered.length === 1 ? 'lead' : 'leads'}
              {filtered.length !== leads.length && <span className="font-normal text-slate-400"> of {leads.length}</span>}
            </p>
            <select
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 focus:outline-none"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="updated">Recently updated</option>
              <option value="name">Name A–Z</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={openAdd}
              className="flex h-11 flex-1 items-center justify-center rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700"
            >
              + Add lead
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={filtered.length === 0}
              className="flex h-11 flex-1 items-center justify-center rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              Export CSV
            </button>
            <div className="flex h-11 overflow-hidden rounded-xl border border-slate-300 bg-white">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                title="List view"
                className={`flex w-11 items-center justify-center text-base transition-colors ${viewMode === 'list' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                ☰
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                title="Table view"
                className={`flex w-11 items-center justify-center text-base transition-colors ${viewMode === 'table' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                ⊞
              </button>
            </div>
          </div>
        </div>

        {/* Leads */}
        <div className="mt-5">
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}
              <button type="button" onClick={load} className="ml-2 underline">Retry</button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-slate-500">
              {leads.length === 0 ? 'No leads yet.' : 'No leads match your search.'}
            </p>
          ) : viewMode === 'list' ? (
            <ul className="space-y-2">
              {filtered.map((lead) => (
                <li key={lead.id}>
                  <button
                    type="button"
                    onClick={() => openEdit(lead)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-slate-300"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">
                        {lead.displayName || lead.phoneNumber || 'Unknown contact'}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {(() => {
                          const phone = lead.phoneNumber || lead.phoneNumberNormalized;
                          const url = whatsappUrl(phone ?? null);
                          return url ? (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-green-600 underline hover:text-green-700"
                            >
                              {phone}
                            </a>
                          ) : 'No phone';
                        })()}
                        {lead.childName ? ` · ${lead.childName}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusBadgeClass(lead.status)}`}>
                        {getStatusLabel(lead.status)}
                      </span>
                      <span className="text-xs text-slate-400">{formatDate(lead.firstSeenAt)}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Child</th>
                    <th className="px-4 py-3">Age / Grade</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Added</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((lead) => (
                    <tr
                      key={lead.id}
                      onClick={() => openEdit(lead)}
                      className="cursor-pointer bg-white transition-colors hover:bg-slate-50"
                    >
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {lead.displayName || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {(() => {
                          const url = whatsappUrl(lead.phoneNumber ?? null);
                          return url ? (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-green-600 underline hover:text-green-700"
                            >
                              {lead.phoneNumber}
                            </a>
                          ) : <span className="text-slate-400">—</span>;
                        })()}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {lead.childName || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {lead.childAge || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusBadgeClass(lead.status)}`}>
                          {getStatusLabel(lead.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(lead.firstSeenAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Manage statuses modal */}
      {showManage && (
        <div
          className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => setShowManage(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Manage statuses</h2>
              <button type="button" onClick={() => setShowManage(false)} className="text-sm text-slate-500">Close</button>
            </div>

            <p className="mb-3 text-xs text-slate-500">Built-in statuses cannot be removed.</p>

            {/* Built-in */}
            <div className="mb-4 space-y-1">
              {LEAD_STATUSES.map((s) => (
                <div key={s} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusBadgeClass(s)}`}>
                    {STATUS_LABELS[s]}
                  </span>
                  <span className="text-xs text-slate-400">built-in</span>
                </div>
              ))}
            </div>

            {/* Custom */}
            {customStatuses.length > 0 && (
              <div className="mb-4 space-y-1">
                {customStatuses.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                    <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {s.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeCustomStatus(s.id)}
                      disabled={manageSaving}
                      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new */}
            <div className="flex gap-2">
              <input
                className={inputClass}
                placeholder="New status name…"
                value={newStatusLabel}
                onChange={(e) => setNewStatusLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomStatus()}
              />
              <button
                type="button"
                onClick={addCustomStatus}
                disabled={manageSaving || !newStatusLabel.trim()}
                className="flex h-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                Add
              </button>
            </div>
            {manageError && <p className="mt-2 text-sm text-red-600">{manageError}</p>}
          </div>
        </div>
      )}

      {/* Lead editor modal */}
      {editing !== null && (
        <div
          className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center"
          onClick={closeEditor}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                {editing === 'new' ? 'Add a lead' : 'Edit lead'}
              </h2>
              <button type="button" onClick={closeEditor} className="text-sm text-slate-500">Close</button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Name">
                <input className={inputClass} value={draft.displayName} onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} />
              </Field>
              <Field label="Phone">
                <input className={inputClass} inputMode="tel" value={draft.phoneNumber} onChange={(e) => setDraft({ ...draft, phoneNumber: e.target.value })} />
              </Field>
              <Field label="Child">
                <input className={inputClass} value={draft.childName} onChange={(e) => setDraft({ ...draft, childName: e.target.value })} />
              </Field>
              <Field label="Age / Grade">
                <input className={inputClass} value={draft.childAge} onChange={(e) => setDraft({ ...draft, childAge: e.target.value })} />
              </Field>
            </div>

            <div className="mt-3">
              <Field label="Status">
                <select
                  className={inputClass}
                  value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                >
                  {allStatuses.map((s) => (
                    <option key={s} value={s}>{getStatusLabel(s)}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="mt-3">
              <Field label="Notes">
                <textarea className={`${inputClass} min-h-24 resize-y`} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
              </Field>
            </div>

            {editorError && <p className="mt-3 text-sm text-red-600">{editorError}</p>}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={saveDraft}
                disabled={saving}
                className="flex h-12 flex-1 items-center justify-center rounded-xl bg-blue-600 font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              {editing !== 'new' && (
                <button
                  type="button"
                  onClick={() => remove(editing)}
                  disabled={saving}
                  className="flex h-12 items-center justify-center rounded-xl border border-red-300 px-4 font-semibold text-red-600 disabled:opacity-50"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${active ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'}`}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-500">{label}</span>
      {children}
    </label>
  );
}
