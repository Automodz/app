'use client';
/**
 * Phase 0 gate: every Studio component renders here from tokens alone.
 * Dev-facing; reachable by direct URL only (role-visibility law: no links
 * to this route exist anywhere).
 */
import { useState } from 'react';
import { DisplayLarge, Display, Title, Emphasis, Body, Data, Whisper } from '@/components/os/text';
import Action from '@/components/os/Action';
import Field from '@/components/os/Field';
import Layer from '@/components/os/Layer';
import TruthLine from '@/components/os/TruthLine';
import Capsule from '@/components/os/Capsule';
import Portrait from '@/components/os/Portrait';
import PhotoBand from '@/components/os/PhotoBand';
import MomentEntry from '@/components/os/MomentEntry';
import { ACT_ORDER, ACT_TITLE } from '@/lib/os/visit';
import StageRail from '@/components/os/StageRail';
import MemberCard from '@/components/os/MemberCard';
import Desk from '@/components/os/Desk';
import StudioSheet from '@/components/os/StudioSheet';
import EmptyState from '@/components/os/EmptyState';
import Skeleton from '@/components/os/Skeleton';
import Spinner from '@/components/os/Spinner';
import StateCard, { StateChips } from '@/components/os/StateCard';
import { liveProtection, sortByUrgency } from '@/lib/os/protection';
import type { Protection } from '@/lib/types';

/** Ten kinds across every term shape and health, so the one card is provable. */
const days = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
};
const state = (p: Partial<Protection> & Pick<Protection, 'id' | 'kind' | 'term'>): Protection =>
  ({ vehicleId: 'demo', termsSource: 'captured', ...p } as Protection);

const DEMO_STATES = sortByUrgency([
  // physical - ours, created by a sealed visit
  state({ id: '1', kind: 'ppf', term: { kind: 'perpetual' }, provider: 'Garware Platinum', plan: 'Lifetime warranty', coverage: 'Full body', since: days(-380), visitId: 'v1' }),
  state({ id: '2', kind: 'ceramic', term: { kind: 'dated', expiresOn: days(640) }, provider: 'Kovalent', plan: '3 Year', visitId: 'v2' }),
  state({ id: '3', kind: 'glass', term: { kind: 'dated', expiresOn: days(24) }, provider: 'AutoModz', plan: '6 Month', visitId: 'v3' }),
  state({ id: '4', kind: 'interior', term: { kind: 'dated', expiresOn: days(-12) }, plan: '1 Year', visitId: 'v4' }),
  // financial + legal - the owner's world, declared not captured
  state({ id: '5', kind: 'insurance', term: { kind: 'dated', expiresOn: days(47) }, provider: 'ICICI Lombard', plan: 'Comprehensive', termsSource: 'declared', document: { url: '#', label: 'Policy' } }),
  state({ id: '6', kind: 'puc', term: { kind: 'dated', expiresOn: days(5) }, termsSource: 'declared', document: { url: '#', label: 'Certificate' } }),
  state({ id: '7', kind: 'rc', term: { kind: 'perpetual' }, termsSource: 'declared', document: { url: '#', label: 'RC book' } }),
  state({ id: '8', kind: 'fastag', term: { kind: 'balance', value: 180, low: 200 }, provider: 'HDFC', termsSource: 'declared' }),
  state({ id: '9', kind: 'warranty', term: { kind: 'dated', expiresOn: days(900) }, provider: 'BMW India', plan: 'Extended', termsSource: 'declared' }),
  // relational
  state({ id: '10', kind: 'membership', term: { kind: 'dated', expiresOn: days(-2), grace: true }, plan: 'Gold' }),
].map(p => liveProtection(p)));

export default function StyleguidePage() {
  const [sheet, setSheet] = useState(false);
  const [field, setField] = useState('');

  return (
    <div className="studio" style={{ minHeight: '100vh', paddingBottom: 160 }}>
      <Portrait
        name="Mercedes-AMG C 43"
        plate="MH 12 AB 1234"
        truth="All quiet. Protected."
      />

      <Layer title="Text">
        <DisplayLarge>Display 44</DisplayLarge>
        <Display>Display 32</Display>
        <Title>Title 24</Title>
        <Emphasis>Emphasis 19 - the working voice.</Emphasis>
        <Body>Body 16 - sentences, not labels.</Body>
        <Data>MH 12 AB 1234 · ₹1,200 · 14 June 2026</Data>
        <Whisper>Whisper 12 - offline, hints, silence.</Whisper>
        <div style={{ marginTop: 16 }}>
          <TruthLine text="Ceramic coat - 212 days of protection left." />
        </div>
      </Layer>

      {/* THE STATE CARD - one card, ten kinds, three term shapes. The gate for
          "never show documents, show living states": every row below is a
          different KIND of promise rendering through the same component. */}
      <Layer title="Living states">
        <StateChips protections={DEMO_STATES} />
        <div style={{ display: 'grid', gap: 'var(--st-line)', marginTop: 'var(--st-gap)' }}>
          {DEMO_STATES.map(p => (
            <StateCard
              key={p.id}
              protection={p}
              onRenew={p.health === 'healthy' ? undefined : () => {}}
              onOpenChapter={p.visitId ? () => {} : undefined}
              onViewOriginal={p.document ? () => {} : undefined}
            />
          ))}
        </div>
      </Layer>

      <Layer title="Action & Field">
        <Action variant="primary" onClick={() => setSheet(true)}>Confirm Thursday 10:00</Action>
        <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
          <Action variant="quiet" onClick={() => setSheet(true)}>Change</Action>
          <Action variant="destructive" onClick={() => setSheet(true)}>Cancel it</Action>
          <Action variant="quiet" loading>Working</Action>
        </div>
        <div style={{ marginTop: 24 }}>
          <Field label="Phone" kind="phone" value={field} onChange={setField} placeholder="98765 43210" />
        </div>
      </Layer>

      <Layer title="Protection">
        <PhotoBand
          ratio="band" alt="Ceramic coat"
          overTitle="Ceramic coat"
          overCaption="Applied March 2026 · 212 days left"
        />
      </Layer>

      <Layer title="The story">
        <div style={{ display: 'grid', gap: 48 }}>
          <MomentEntry caption="Full detail · 14 June 2026" whisper="12 photos" onTap={() => setSheet(true)} />
          <MomentEntry milestone caption="One year with AutoModz." date="12 March 2027" />
        </div>
      </Layer>

      <Layer title="The Club">
        <MemberCard name="N. Sharma" tier="Club" since="since March 2026" />
      </Layer>

      <Layer title="The desk">
        <Desk
          rows={[
            { label: "The C 43's care", onTap: () => setSheet(true) },
            { label: 'Protection', detail: '2 live', onTap: () => setSheet(true) },
            { label: 'Papers & records', onTap: () => setSheet(true) },
            { label: 'The Club', onTap: () => setSheet(true) },
          ]}
          proposal={{ reason: 'The ceramic coat has 24 days of protection left - time to renew it.', onAccept: () => setSheet(true) }}
          visits={[
            { id: 'a', line: 'Thursday, 10 July · 10:00 · confirmed', onTap: () => setSheet(true) },
            { id: 'b', line: 'Full detail · 14 June 2026', sub: '₹8,400', onTap: () => setSheet(true) },
          ]}
          searchItems={[
            { label: 'Care record - 14 June 2026', group: 'Records', onTap: () => setSheet(true) },
            { label: 'Ceramic coat', group: 'Protection', onTap: () => setSheet(true) },
          ]}
          onMessage={() => setSheet(true)}
        />
      </Layer>

      <Layer title="Empty, loading, skeleton">
        <EmptyState
          line="The C 43’s story starts with its first visit."
          actionLabel="Arrange one"
          onAction={() => setSheet(true)}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 24, color: 'var(--st-ink)' }}>
          <Spinner />
          <Whisper>The one spinner - inside a pressed action only.</Whisper>
        </div>
        <div style={{ marginTop: 24, display: 'grid', gap: 12 }}>
          <Skeleton style={{ height: 96 }} />
          <Skeleton radius="var(--st-r-pill)" style={{ height: 20, width: 160 }} />
        </div>
      </Layer>

      {/* the rail every surface reads the work with - live Visit, sealed
          Chapter, the Journey. Copy is in the studio's voice: AutoModz is the
          actor and no individual is ever named (Constitution Art. 8). */}
      <Layer title="Stage rail">
        <StageRail
          tone="ink"
          steps={ACT_ORDER.map((a, i) => ({
            key: a, title: ACT_TITLE[a],
            state: i < 2 ? 'done' : i === 2 ? 'current' : 'coming',
          }))}
        />
        <Body tone="ink-2" style={{ marginTop: 16 }}>Paint correction has begun.</Body>
        <Whisper style={{ marginTop: 4 }}>Planned finish around 4:30 pm.</Whisper>
      </Layer>

      <StudioSheet open={sheet} onOpenChange={setSheet} label="Example sheet">
        <Title>Thursday, 10 July</Title>
        <Body tone="ink-2" style={{ marginTop: 12 }}>
          Ceramic maintenance wash · ₹1,200 · pay at the studio
        </Body>
        <div style={{ marginTop: 24 }}>
          <Action variant="primary" onClick={() => setSheet(false)}>Confirm Thursday 10:00</Action>
        </div>
      </StudioSheet>

      <Capsule line="Ceramic maintenance is due · Thu 10:00 free" actionWord="Yes"
        onTap={() => setSheet(true)} onActionTap={() => setSheet(true)} />
    </div>
  );
}
