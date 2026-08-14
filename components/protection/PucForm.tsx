'use client';
/**
 * SENDING A POLLUTION CERTIFICATE TO THE STUDIO.
 *
 * Source: docs/AUTOMODZ-OS.md §10.5, §18.4, §19.1, §20.2, §21.3, §21.6
 *
 * ── WHY IT IS AN ISLAND ──────────────────────────────────────────────────
 * The certificate room renders on the server and stays there; only this needs
 * a browser session, so only this carries one. That is the same reasoning that
 * put `CarForm` in `components/garage/` rather than in `components/screens/`:
 * it is not a renderer of a projection, it is an act.
 *
 * ── AND WHY IT DECIDES NOTHING ───────────────────────────────────────────
 * Every rule this form appears to hold is a copy for the CUSTOMER's benefit
 * only - so a mistake is answered in the field rather than by a round trip.
 * The server validates the same input with the same function
 * (`lib/os/puc.ts#validateDeclaration`) and its answer is the one that counts;
 * this form cannot make a certificate acceptable by not checking it.
 *
 * ── THE PHOTOGRAPH GOES THROUGH THE ONE PIPELINE ─────────────────────────
 * `lib/services/storage.ts#uploadImage` → `/api/media/sign` → Cloudinary,
 * with the path built by `evidencePathFor` so the server can prove the
 * photograph was uploaded for THIS car by THIS customer. There is no second
 * image system here and there will not be one.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authedFetch, currentUid } from '@/lib/clientSession';
import { uploadImage, tooLargeToUpload } from '@/lib/services/storage';
import { evidencePathFor, studioToday, validateDeclaration } from '@/lib/os/puc';
import { Pane, Label, Action } from '@/components/os';
import {
  color, space, MEASURE, HAIRLINE, TARGET_MIN, radius, type as typeScale,
} from '@/design';

/**
 * EVERY WAY THIS CAN BE REFUSED, IN THE CUSTOMER'S WORDS.
 *
 * Keyed by the SAME codes the engine and the route return, so a refusal
 * invented on the server still arrives as a sentence rather than as a slug.
 * An unlisted code falls through to a plain apology and a way to try again -
 * §20.2, always recoverable.
 */
const REFUSAL: Record<string, string> = {
  'vehicle-required': 'We could not tell which car this is for.',
  'reference-invalid': 'The certificate number, as it reads on the paper - letters and digits.',
  'issued-on-invalid': 'The day it was issued.',
  'expires-on-invalid': 'The day it runs to.',
  'expiry-not-after-issue': 'A certificate cannot run out before the day it was issued.',
  'issued-in-the-future': 'That issue date has not happened yet.',
  'already-expired': 'That certificate has already run out. Have the car tested, then send us the new one.',
  'term-too-long': 'No pollution certificate runs that long - check the year.',
  'note-too-long': 'A little shorter, please.',
  'evidence-invalid': 'That photograph could not be matched to this car. Attach it again.',
  'vehicle-not-yours': 'That car is not in your garage.',
  'not-later-than-current': 'The certificate we already hold runs longer than this one.',
  'already-rejected': 'We have already answered that certificate.',
  'already-superseded': 'A later certificate has taken its place.',
  'already-withdrawn': 'That one was replaced. Send the current certificate.',
  'not-configured': 'The studio cannot be reached just now. Try again shortly.',
};

const SIGNED_OUT = 'Your session has expired. Sign in again and we’ll keep this.';
const UNKNOWN = 'That didn’t send. Your connection, most likely - try again.';

export function PucForm(
  { vehicleId, title, note, submit, canAttach = true }:
  {
    vehicleId: string; title: string; note: string; submit: string;
    /** Whether this deployment can accept a photograph. See the page. */
    canAttach?: boolean;
  },
) {
  const router = useRouter();

  const [reference, setReference] = useState('');
  const [issuedOn, setIssuedOn] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const [remark, setRemark] = useState('');

  const [file, setFile] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  /* The studio's own today, so a customer in another zone is not told their
     certificate was issued tomorrow. One implementation, from the engine. */
  const today = studioToday();

  const send = async () => {
    setError(null);
    setPhotoError(null);

    /* The SAME validator the server runs. A field answered here is a round
       trip nobody waits for; a field answered only here would be a second
       rulebook, which is why this is the identical call. */
    const checked = validateDeclaration({ vehicleId, reference, issuedOn, expiresOn, note: remark });
    if (!checked.ok) { setError(REFUSAL[checked.reason] ?? UNKNOWN); return; }

    setBusy(true);
    try {
      let evidence: { evidenceUrl: string; evidencePath: string } | undefined;

      if (file) {
        const uid = await currentUid();
        if (!uid) { setError(SIGNED_OUT); return; }
        if (tooLargeToUpload(file.size)) {
          setPhotoError('That photograph is too large. Send it without one, or take a smaller one.');
          return;
        }
        try {
          const up = await uploadImage(evidencePathFor(uid, vehicleId, Date.now()), file);
          evidence = { evidenceUrl: up.url, evidencePath: up.path };
        } catch {
          /* §19.1 - a photograph that would not upload is not a failed
             declaration. The certificate's facts are what the studio checks;
             the photograph only makes that easier. So the customer is told
             what happened and offered the send without it, rather than being
             stopped by the optional part. */
          setPhotoError('That photograph would not upload. Remove it and send the details on their own, or try again.');
          return;
        }
      }

      const res = await authedFetch('/api/protection/puc/declare', {
        method: 'POST',
        body: JSON.stringify({ vehicleId, reference, issuedOn, expiresOn, note: remark, ...evidence }),
      });

      if (res.status === 401) { setError(SIGNED_OUT); return; }
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: '' })) as { error?: string };
        setError(REFUSAL[body.error ?? ''] ?? UNKNOWN);
        return;
      }

      setSent(true);
      /* The room renders on the server, so what was sent only appears once the
         server has been asked again. */
      router.refresh();
    } catch {
      setError(UNKNOWN);
    } finally {
      setBusy(false);
    }
  };

  /* §19.1 - the moment after. The room's own panes redraw from the server a
     beat later; until they do, the screen says what happened rather than
     sitting on a form that looks unsent. */
  if (sent) {
    return (
      <Pane tone="warm" style={{ padding: `${space.gap + 2}px ${space.gap + 4}px` }}>
        <p
          aria-live="polite"
          style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: color.ink, maxWidth: MEASURE }}
        >
          Sent. The studio will check it against the certificate and it will
          stand on your car once they have.
        </p>
      </Pane>
    );
  }

  return (
    <Pane
      as="section"
      aria-labelledby="puc-declare"
      style={{
        padding: `${space.gap + 2}px ${space.gap + 4}px`,
        display: 'flex', flexDirection: 'column', gap: space.gap,
      }}
    >
      <h2 id="puc-declare" style={{ margin: 0 }}>
        <Label style={{ fontSize: 9.5, letterSpacing: '0.24em' }}>{title}</Label>
      </h2>

      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: color.ink2, maxWidth: MEASURE }}>
        {note}
      </p>

      <form
        onSubmit={e => { e.preventDefault(); void send(); }}
        style={{ display: 'grid', gap: space.gap }}
      >
        <Field
          label="Certificate number"
          value={reference}
          onChange={setReference}
          autoComplete="off"
        />
        <Field
          label="Issued on"
          value={issuedOn}
          onChange={setIssuedOn}
          type="date"
          max={today}
        />
        <Field
          label="Valid until"
          value={expiresOn}
          onChange={setExpiresOn}
          type="date"
          min={today}
        />

        {/* §21.6 - the label sits above and says it is optional, because an
            unlabelled optional field reads as a requirement nobody explained.

            THE INPUT ITSELF IS HIDDEN and the label is the control, which is
            the idiom `components/market/SellForm` already uses: a native file
            control paints its own "Choose File" button in the browser's chrome
            and reads as a grey box dropped into the room. §22.2 - one
            implementation of anything. */}
        {/* §10.5 - offered only where it can be sent. A deployment with no
            media keys answers 503 to every upload, so the field is absent
            rather than present and always failing. The certificate's FACTS
            are what the studio checks; the photograph only makes it easier. */}
        {canAttach ? (
        <div>
          <Label style={{ letterSpacing: '0.14em' }}>
            A photograph of it (optional)
          </Label>
          <label
            style={{
              marginTop: space.breath,
              minHeight: TARGET_MIN, display: 'inline-flex', alignItems: 'center',
              paddingInline: space.gap, borderRadius: radius.chip,
              border: `${HAIRLINE}px solid ${color.edge}`, cursor: 'pointer',
              color: color.ink2, fontSize: 14, maxWidth: '100%',
              overflowWrap: 'break-word',
            }}
          >
            {file ? file.name : 'Choose a photograph'}
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={e => { setFile(e.target.files?.[0] ?? null); setPhotoError(null); }}
            />
          </label>
          {photoError ? (
            <p
              aria-live="polite"
              style={{ margin: `${space.hair}px 0 0`, fontSize: 12.5, color: color.amber }}
            >
              {photoError}
            </p>
          ) : null}
        </div>
        ) : null}

        <Field
          label="Anything we should know (optional)"
          value={remark}
          onChange={setRemark}
          autoComplete="off"
        />

        {error ? (
          <p
            aria-live="polite"
            style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: color.urgent, maxWidth: MEASURE }}
          >
            {error}
          </p>
        ) : null}

        <Action onClick={() => { void send(); }} disabled={busy} style={{ fontSize: 15 }}>
          {busy ? 'Sending…' : submit}
        </Action>
      </form>
    </Pane>
  );
}

/** One field. The label sits above - a placeholder is not a label (§21.6). */
function Field({
  label, value, onChange, type = 'text', autoComplete, min, max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: 'text' | 'date';
  autoComplete?: string;
  min?: string;
  max?: string;
}) {
  return (
    <label style={{ display: 'block' }}>
      <Label style={{ letterSpacing: '0.14em' }}>{label}</Label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoComplete={autoComplete}
        min={min}
        max={max}
        style={{
          display: 'block',
          width: '100%',
          minHeight: TARGET_MIN,
          marginTop: space.hair,
          padding: `${space.breath}px 0`,
          background: 'transparent',
          border: 'none',
          borderBottom: `${HAIRLINE}px solid ${color.edge}`,
          borderRadius: radius.chip,
          fontFamily: typeScale.body.family,
          fontSize: typeScale.body.size,
          color: color.ink,
          outline: 'none',
          /* A native date control paints its own light glyph on WebKit;
             without this it is a black icon on a black field. */
          colorScheme: 'dark',
        }}
      />
    </label>
  );
}
