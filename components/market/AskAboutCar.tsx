'use client';
/**
 * ASKING ABOUT A CAR, OR ASKING TO SEE IT.
 *
 * One layer, two shapes — the difference is a date, so two components would be
 * two copies of the same form. The old app had exactly that: an `inquiry` modal
 * and a `viewing` modal sharing every field.
 *
 * SIGNED OUT IS THE NORMAL CASE. Most people who open a listing have no
 * account, so this asks for a name and a number and nothing else. If they do
 * happen to be signed in, the token travels and the studio can see the enquiry
 * and the customer are the same person.
 */
import { useState } from 'react';
import { idToken } from '@/lib/clientSession';
import { color, space, radius, HAIRLINE } from '@/design';
import { Modal, Heading, Text, Button } from '@/components/system';

type Kind = 'inquiry' | 'viewing';

const COPY: Record<Kind, { title: string; line: string; send: string }> = {
  inquiry: {
    title: 'Ask about this car',
    line: 'Leave us a number and we will call you back about it.',
    send: 'Send the question',
  },
  viewing: {
    title: 'Come and see it',
    line: 'Tell us when suits you. We will confirm before you travel.',
    send: 'Ask for this time',
  },
};

export function AskAboutCar(
  { listingId, title, kind, onClose }:
  { listingId: string; title: string; kind: Kind | null; onClose: () => void },
) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [when, setWhen] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = kind ? COPY[kind] : COPY.inquiry;

  const send = async () => {
    setError(null);
    if (!name.trim()) return setError('We need a name to call you back.');
    if (phone.replace(/\D/g, '').length < 10) return setError('That number looks short.');

    setSending(true);
    try {
      /* The token is used if there is one and never required — the route
         accepts an anonymous enquiry deliberately. */
      /* `idToken()` waits for the SDK to decide and answers null rather than
         throwing, so the anonymous case needs no try/catch of its own. */
      const token = (await idToken()) ?? undefined;

      const res = await fetch('/api/cars/lead', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          listingId,
          type: kind ?? 'inquiry',
          name, phone,
          message: message || undefined,
          preferredDate: kind === 'viewing' ? when : undefined,
        }),
      });
      if (!res.ok) {
        const { error: code } = await res.json().catch(() => ({ error: 'failed' }));
        throw new Error(code);
      }
      setSent(true);
    } catch (e) {
      const code = e instanceof Error ? e.message : 'failed';
      setError(code === 'listing-unavailable'
        ? 'This car has just gone. Have a look at what else is in.'
        : 'That didn’t send. Try again, or call the studio.');
    } finally {
      setSending(false);
    }
  };

  const close = () => {
    onClose();
    /* Reset only after it has closed, so the confirmation is not wiped out
       from under the customer as the layer animates away. */
    setTimeout(() => {
      setSent(false); setError(null); setName(''); setPhone('');
      setMessage(''); setWhen('');
    }, 300);
  };

  return (
    <Modal open={kind !== null} onClose={close} label={copy.title}>
      <div style={{ padding: space.gap }}>
        {sent ? (
          /* §19 — the confirmation names what will happen next, not "success". */
          <>
            <Heading level="title">We have it</Heading>
            <Text role="body" tone="ink2" style={{ marginTop: space.line }}>
              {kind === 'viewing'
                ? `We will confirm a time to see the ${title} before you travel.`
                : `We will call you back about the ${title}.`}
            </Text>
            <div style={{ marginTop: space.gap }}>
              <Button tier="forward" onClick={close}>Done</Button>
            </div>
          </>
        ) : (
          <>
            <Heading level="title">{copy.title}</Heading>
            <Text role="body" tone="ink2" style={{ marginTop: space.line }}>
              {copy.line}
            </Text>

            <Field label="Your name" value={name} onChange={setName}
              autoComplete="name" />
            <Field label="Phone" value={phone} onChange={setPhone}
              type="tel" inputMode="numeric" autoComplete="tel" />
            {kind === 'viewing' ? (
              <Field label="When suits you" value={when} onChange={setWhen} type="date" />
            ) : null}
            <Field label="Anything you want to ask" value={message}
              onChange={setMessage} multiline />

            {error ? (
              <Text role="body" tone="ink" style={{ marginTop: space.line }}>{error}</Text>
            ) : null}

            <div style={{ marginTop: space.gap, display: 'flex', gap: space.line }}>
              <Button tier="forward" onClick={send} disabled={sending}>
                {sending ? 'Sending…' : copy.send}
              </Button>
              <Button tier="quiet" onClick={close}>Not now</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

/**
 * One field. Local to this layer on purpose: the Garage's `CarForm` has its own
 * and they are styled from the same tokens, but neither is exported as a
 * primitive yet — promoting one is a design-system decision, not a marketplace
 * one, and inventing a third here would be the duplicate this file avoids.
 */
function Field(
  { label, value, onChange, type = 'text', multiline, ...rest }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    type?: string;
    multiline?: boolean;
    inputMode?: 'numeric';
    autoComplete?: string;
  },
) {
  const style = {
    width: '100%',
    minHeight: 48,
    marginTop: space.hair,
    padding: space.breath,
    borderRadius: radius.chip,
    border: `${HAIRLINE}px solid ${color.edge}`,
    background: 'transparent',
    color: color.ink,
    /* 16px or larger, or iOS zooms the page when the field takes focus. */
    fontSize: 17,
    outline: 'none',
  } as const;

  return (
    <label style={{ display: 'block', marginTop: space.gap }}>
      <Text role="whisper" tone="ink3" as="span">{label}</Text>
      {multiline ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={3}
          style={{ ...style, resize: 'vertical' }} {...rest} />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)}
          style={style} {...rest} />
      )}
    </label>
  );
}
