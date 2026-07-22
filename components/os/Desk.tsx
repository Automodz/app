'use client';
/**
 * The Conversation (design system §7.4 · IA D · Constitution Art. 8) — one
 * surface: search · the thread (a real-object projection: the open proposal,
 * then visit cards, then the composer) · the adaptive object shelf. There is
 * no message store; every line here cites a real object. Free-form talk hands
 * off to the studio's launch channel (WhatsApp) via `onMessage`.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { press } from '@/lib/os/motion';
import { Title, Body, Whisper } from './text';
import Action from './Action';

export interface ShelfRow {
  label: string;            // "The C 43's care"
  detail?: string;          // whisper alongside ("2 records")
  onTap: () => void;
}

export interface ThreadVisit {
  id: string;
  line: string;             // state-worded ("Thursday 10:00 · reserved")
  sub?: string;
  onTap: () => void;
}

export interface DeskProposal {
  reason: string;           // full sentence, cites the source object
  onAccept: () => void;
}

export interface SearchItem {
  label: string;
  group: string;            // "Records" | "Protection" | "Visits" | …
  onTap: () => void;
}

export interface DeskProps {
  rows: ShelfRow[];
  visits: ThreadVisit[];
  proposal?: DeskProposal;
  searchItems: SearchItem[];
  onMessage: () => void;    // composer → studio (WhatsApp at launch)
}

const CARD: React.CSSProperties = {
  background: 'var(--st-gallery)', borderRadius: 'var(--st-r-card)', padding: 16,
  width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
};

export default function Desk({ rows, visits, proposal, searchItems, onMessage }: DeskProps) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const results = query
    ? searchItems.filter(i => i.label.toLowerCase().includes(query))
    : [];
  const groups = [...new Set(results.map(r => r.group))];

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <Title>The studio</Title>

      {/* search — the one allowed desk hairline (§1.3) */}
      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Find anything — ‘march ceramic’, ‘invoice’…"
        aria-label="Search your car’s history"
        style={{
          width: '100%', padding: '8px 0', border: 'none',
          borderBottom: '1px solid var(--st-hairline)', background: 'transparent',
          fontFamily: 'var(--st-text)', fontSize: 16, color: 'var(--st-ink)', outline: 'none',
        }}
      />

      {query ? (
        results.length ? (
          <div style={{ display: 'grid', gap: 16 }}>
            {groups.map(g => (
              <div key={g} style={{ display: 'grid', gap: 8 }}>
                <Whisper>{g}</Whisper>
                {results.filter(r => r.group === g).map((r, i) => (
                  <button key={i} onClick={r.onTap} className="st-tap"
                    style={{ background: 'transparent', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}>
                    <Body>{r.label}</Body>
                  </button>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            <Body tone="ink-2">Nothing for that — try the service or the month. Or just ask.</Body>
            <Action variant="quiet" onClick={onMessage}>Message the studio</Action>
          </div>
        )
      ) : (
        <>
          {/* the open proposal — care proposed, not requested */}
          {proposal && (
            <div style={{ ...CARD, cursor: 'default' }}>
              <Body tone="ink-2">{proposal.reason}</Body>
              <div style={{ marginTop: 12 }}>
                <Action variant="quiet" onClick={proposal.onAccept}>Arrange it</Action>
              </div>
            </div>
          )}

          {/* the adaptive object shelf */}
          <nav aria-label="Your car and the studio">
            {rows.map(row => (
              <motion.button
                key={row.label}
                onClick={row.onTap}
                {...press}
                style={{
                  display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                  width: '100%', minHeight: 52, padding: '12px 0',
                  background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <Body as="span" style={{ fontSize: 19 }}>{row.label}</Body>
                {row.detail && <Whisper as="span">{row.detail}</Whisper>}
              </motion.button>
            ))}
          </nav>

          {/* the thread — real visits, newest last */}
          {visits.length > 0 && (
            <div style={{ display: 'grid', gap: 8 }}>
              {visits.map(v => (
                <button key={v.id} onClick={v.onTap} className="st-card st-tap" style={CARD}>
                  <Body>{v.line}</Body>
                  {v.sub && <Whisper style={{ marginTop: 4 }}>{v.sub}</Whisper>}
                </button>
              ))}
            </div>
          )}

          {/* the composer — free-form hands off to the studio */}
          <Action variant="quiet" onClick={onMessage}>Message the studio</Action>
        </>
      )}
    </div>
  );
}
