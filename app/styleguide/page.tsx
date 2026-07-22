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
import MomentStage from '@/components/os/MomentStage';
import MemberCard from '@/components/os/MemberCard';
import Desk from '@/components/os/Desk';
import StudioSheet from '@/components/os/StudioSheet';
import EmptyState from '@/components/os/EmptyState';
import Skeleton from '@/components/os/Skeleton';
import Spinner from '@/components/os/Spinner';

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
        <Emphasis>Emphasis 19 — the working voice.</Emphasis>
        <Body>Body 16 — sentences, not labels.</Body>
        <Data>MH 12 AB 1234 · ₹1,200 · 14 June 2026</Data>
        <Whisper>Whisper 12 — offline, hints, silence.</Whisper>
        <div style={{ marginTop: 16 }}>
          <TruthLine text="Ceramic coat — 212 days of protection left." />
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
          <MomentEntry caption="Full detail · 14 June 2026" whisper="12 photos · Deepak" onTap={() => setSheet(true)} />
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
          proposal={{ reason: 'The ceramic coat has 24 days of protection left — time to renew it.', onAccept: () => setSheet(true) }}
          visits={[
            { id: 'a', line: 'Thursday, 10 July · 10:00 · confirmed', onTap: () => setSheet(true) },
            { id: 'b', line: 'Full detail · 14 June 2026', sub: '₹8,400', onTap: () => setSheet(true) },
          ]}
          searchItems={[
            { label: 'Care record — 14 June 2026', group: 'Records', onTap: () => setSheet(true) },
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
          <Whisper>The one spinner — inside a pressed action only.</Whisper>
        </div>
        <div style={{ marginTop: 24, display: 'grid', gap: 12 }}>
          <Skeleton style={{ height: 96 }} />
          <Skeleton radius="var(--st-r-pill)" style={{ height: 20, width: 160 }} />
        </div>
      </Layer>

      <Layer title="The stay">
        <div style={{ borderRadius: 24, overflow: 'hidden' }}>
          <MomentStage
            act="in_care"
            narration="Deepak is hand-finishing the hood."
            timing="Ready around 4:30"
          />
        </div>
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
