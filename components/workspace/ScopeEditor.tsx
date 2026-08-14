'use client';
/**
 * DEFINING WHAT THE STUDIO SELLS - the admin counterpart to design screen 07.
 *
 * A customer cannot choose a coverage the studio has never described, and the
 * audit's PHASE 7 is explicit that every customer capability needs an admin
 * operation that exists. This is that operation.
 *
 * ── IT WRITES THE CATALOGUE, NOT A PRICE A CUSTOMER SEES ─────────────────
 * Everything saved here is authoritative for the NEXT quote and reaches no
 * estimate or booking already given: those carry their own snapshot. So an
 * edit is safe by construction - there is no version of this control that can
 * reprice work somebody has already agreed to.
 *
 * ── A CUSTOM COVERAGE HAS NO PRICE, AND THAT IS THE POINT ────────────────
 * `custom` is priced by the panels the customer picks. The price field is
 * therefore hidden for it rather than left blank, because a blank field in a
 * price column invites somebody to type a zero - and a zero would mean the
 * studio wraps a car for nothing.
 */
import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import type { Service, ServiceAddOn, ServicePanel, ServiceScope, ScopeKind } from '@/lib/types';

const KINDS: ScopeKind[] = ['front', 'full', 'custom'];

/** A stable id from a label, so a coverage keeps its identity across renames. */
const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
  || `id-${Math.random().toString(36).slice(2, 8)}`;

export function ScopeEditor({ service, onSaved }: {
  service: Service;
  onSaved: (next: Partial<Service>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [scopes, setScopes] = useState<ServiceScope[]>(service.scopes ?? []);
  const [addOns, setAddOns] = useState<ServiceAddOn[]>(service.addOns ?? []);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    /* REFUSED RATHER THAN SAVED HALF-RIGHT. A coverage with no label is a row
       nobody can choose; a priced coverage at zero is work given away. */
    for (const s of scopes) {
      if (!s.label.trim()) return toast.error('Every coverage needs a name');
      if (s.kind !== 'custom' && !(Number(s.price) > 0)) {
        return toast.error(`"${s.label}" needs a price`);
      }
      if (s.kind === 'custom' && (s.panels ?? []).length === 0) {
        return toast.error(`"${s.label}" needs at least one panel to price`);
      }
    }
    for (const a of addOns) {
      if (!a.label.trim()) return toast.error('Every extra needs a name');
      if (!(Number(a.price) >= 0)) return toast.error(`"${a.label}" needs a price`);
    }

    setSaving(true);
    try {
      const clean = {
        scopes: scopes.map((s, i) => ({
          ...s,
          order: i,
          id: s.id || slug(s.label),
          price: s.kind === 'custom' ? undefined : Number(s.price),
          durationMinutes: Number(s.durationMinutes) || service.duration,
          panels: s.kind === 'custom'
            ? (s.panels ?? []).map(p => ({ ...p, id: p.id || slug(p.label), price: Number(p.price), durationMinutes: Number(p.durationMinutes) || 60 }))
            : undefined,
        })).map(s => JSON.parse(JSON.stringify(s)) as ServiceScope),
        addOns: addOns.map((a, i) => ({
          ...a, order: i, id: a.id || slug(a.label),
          price: Number(a.price),
          durationMinutes: Number(a.durationMinutes) || 0,
        })),
      };
      await updateDoc(doc(db, 'services', service.id), clean);
      onSaved(clean);
      toast.success('Coverages saved - the next quote uses them');
    } catch {
      toast.error('Could not save');
    } finally {
      setSaving(false);
    }
  };

  const setScope = (i: number, patch: Partial<ServiceScope>) =>
    setScopes(list => list.map((s, n) => (n === i ? { ...s, ...patch } : s)));

  const setPanel = (si: number, pi: number, patch: Partial<ServicePanel>) =>
    setScopes(list => list.map((s, n) => (n === si
      ? { ...s, panels: (s.panels ?? []).map((p, m) => (m === pi ? { ...p, ...patch } : p)) }
      : s)));

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-muted text-xs font-body underline underline-offset-4"
      >
        {scopes.length || addOns.length
          ? `Coverages · ${scopes.length} · extras · ${addOns.length}`
          : 'Add coverages'}
      </button>
    );
  }

  return (
    <div className="w-full mt-3 p-3 rounded-xl space-y-4" style={{ background: 'var(--background-3, rgba(255,255,255,0.03))' }}>
      <Section
        title="Coverages"
        hint="What a customer chooses on the quote screen. A custom coverage is priced by its panels."
        onAdd={() => setScopes(l => [...l, {
          id: '', kind: 'front', label: '', detail: '',
          price: service.price, durationMinutes: service.duration,
        }])}
      >
        {scopes.map((s, i) => (
          <div key={i} className="p-2 rounded-lg space-y-2" style={{ background: 'var(--background-2)' }}>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={s.kind}
                onChange={e => setScope(i, { kind: e.target.value as ScopeKind })}
                aria-label="Coverage kind"
                className="input-dark text-xs py-1.5 px-2"
              >
                {KINDS.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <input
                value={s.label}
                onChange={e => setScope(i, { label: e.target.value })}
                placeholder="Full body"
                aria-label="Coverage name"
                className="input-dark text-sm py-1.5 px-2 flex-1 min-w-[8rem]"
              />
              {s.kind !== 'custom' ? (
                <>
                  <span className="text-muted text-sm">₹</span>
                  <input
                    type="number" value={s.price ?? ''}
                    onChange={e => setScope(i, { price: Number(e.target.value) })}
                    aria-label="Coverage price"
                    className="input-dark text-sm py-1.5 px-2 w-24 text-right"
                  />
                </>
              ) : (
                <span className="text-muted text-xs font-body">priced by panels</span>
              )}
              <input
                type="number" value={s.durationMinutes ?? ''}
                onChange={e => setScope(i, { durationMinutes: Number(e.target.value) })}
                title="Minutes of work - this is what holds the bay"
                aria-label="Coverage duration in minutes"
                className="input-dark text-sm py-1.5 px-2 w-20 text-right"
              />
              <span className="text-muted text-xs">min</span>
              <Remove onClick={() => setScopes(l => l.filter((_, n) => n !== i))} />
            </div>
            <input
              value={s.detail}
              onChange={e => setScope(i, { detail: e.target.value })}
              placeholder="Bonnet, bumper, mirrors, headlights."
              aria-label="Coverage detail"
              className="input-dark text-xs py-1.5 px-2 w-full"
            />

            {s.kind === 'custom' ? (
              <div className="pl-3 border-l border-white/10 space-y-2">
                {(s.panels ?? []).map((p, pi) => (
                  <div key={pi} className="flex items-center gap-2 flex-wrap">
                    <input
                      value={p.label}
                      onChange={e => setPanel(i, pi, { label: e.target.value })}
                      placeholder="Rear quarter"
                      aria-label="Panel name"
                      className="input-dark text-xs py-1 px-2 flex-1 min-w-[6rem]"
                    />
                    <span className="text-muted text-xs">₹</span>
                    <input
                      type="number" value={p.price}
                      onChange={e => setPanel(i, pi, { price: Number(e.target.value) })}
                      aria-label="Panel price"
                      className="input-dark text-xs py-1 px-2 w-20 text-right"
                    />
                    <input
                      type="number" value={p.durationMinutes}
                      onChange={e => setPanel(i, pi, { durationMinutes: Number(e.target.value) })}
                      aria-label="Panel duration in minutes"
                      className="input-dark text-xs py-1 px-2 w-16 text-right"
                    />
                    <span className="text-muted text-xs">min</span>
                    <Remove onClick={() => setScope(i, {
                      panels: (s.panels ?? []).filter((_, m) => m !== pi),
                    })} />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setScope(i, {
                    panels: [...(s.panels ?? []), { id: '', label: '', price: 0, durationMinutes: 60 }],
                  })}
                  className="text-muted text-xs font-body flex items-center gap-1"
                >
                  <Plus size={12} /> panel
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </Section>

      <Section
        title="Extras"
        hint="Offered alongside a coverage. Each carries its own price and its own time."
        onAdd={() => setAddOns(l => [...l, {
          id: '', label: '', detail: '', price: 0, durationMinutes: 0,
        }])}
      >
        {addOns.map((a, i) => (
          <div key={i} className="p-2 rounded-lg space-y-2" style={{ background: 'var(--background-2)' }}>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                value={a.label}
                onChange={e => setAddOns(l => l.map((x, n) => (n === i ? { ...x, label: e.target.value } : x)))}
                placeholder="Two-stage correction"
                aria-label="Extra name"
                className="input-dark text-sm py-1.5 px-2 flex-1 min-w-[8rem]"
              />
              <span className="text-muted text-sm">₹</span>
              <input
                type="number" value={a.price}
                onChange={e => setAddOns(l => l.map((x, n) => (n === i ? { ...x, price: Number(e.target.value) } : x)))}
                aria-label="Extra price"
                className="input-dark text-sm py-1.5 px-2 w-24 text-right"
              />
              <input
                type="number" value={a.durationMinutes}
                onChange={e => setAddOns(l => l.map((x, n) => (n === i ? { ...x, durationMinutes: Number(e.target.value) } : x)))}
                aria-label="Extra duration in minutes"
                className="input-dark text-sm py-1.5 px-2 w-20 text-right"
              />
              <span className="text-muted text-xs">min</span>
              <Remove onClick={() => setAddOns(l => l.filter((_, n) => n !== i))} />
            </div>
            <input
              value={a.detail}
              onChange={e => setAddOns(l => l.map((x, n) => (n === i ? { ...x, detail: e.target.value } : x)))}
              placeholder="Recommended before film."
              aria-label="Extra detail"
              className="input-dark text-xs py-1.5 px-2 w-full"
            />
          </div>
        ))}
      </Section>

      <div className="flex items-center gap-2">
        <button onClick={save} disabled={saving}
          className="btn-primary text-xs py-2 px-4 font-display font-800 tracking-widest flex items-center gap-2">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          SAVE COVERAGES
        </button>
        <button onClick={() => setOpen(false)} className="text-muted text-xs font-body">Close</button>
      </div>
    </div>
  );
}

function Section(
  { title, hint, onAdd, children }:
  { title: string; hint: string; onAdd: () => void; children: React.ReactNode },
) {
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-display font-800 text-xs text-foreground tracking-widest uppercase">{title}</div>
          <div className="text-muted text-[11px] font-body">{hint}</div>
        </div>
        <button type="button" onClick={onAdd} className="text-muted text-xs font-body flex items-center gap-1 shrink-0">
          <Plus size={12} /> add
        </button>
      </div>
      {children}
    </div>
  );
}

function Remove({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="Remove"
      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-white/5">
      <Trash2 size={12} className="text-muted" />
    </button>
  );
}
