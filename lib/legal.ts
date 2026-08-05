/**
 * WHAT THE STUDIO COLLECTS, AND WHAT IT PROMISES.
 *
 * The content lives here rather than inside two page components so the privacy
 * policy and the terms cannot drift apart, and so the same words can be quoted
 * in an App Store submission without being retyped.
 *
 * IT DESCRIBES WHAT THE CODE ACTUALLY DOES. Every claim below is one this
 * repository can be checked against — the collections named are the ones that
 * exist, the deletion described is `lib/server/deleteAccount.ts`, and the
 * payment sentence is true because there is no gateway in the product.
 */
import { COMPANY } from './company';

export const LEGAL_UPDATED = '5 August 2026';

export interface LegalSection {
  heading: string;
  body: string[];
}

export const PRIVACY: LegalSection[] = [
  {
    heading: 'What we hold',
    body: [
      'Your name, email address and phone number, so we can reach you about your car.',
      'The cars you add — their name and registration — and the photographs we take of them during a visit.',
      'Your visits, what was done, what it cost, and any warranty it carries.',
      'Your membership, if you hold one, and how many washes remain in the cycle.',
      'Your notification preferences, and the device tokens needed to send a push notification if you turn them on.',
    ],
  },
  {
    heading: 'What we do not hold',
    body: [
      'We do not take card or bank details. Payment is settled at the studio by UPI or cash, so there is nothing of that kind to store.',
      'We do not track you across other apps or websites, and we do not sell or share your information with advertisers.',
    ],
  },
  {
    heading: 'Why we hold it',
    body: [
      'To arrange and carry out your visits, and to show you what was done.',
      'To honour a warranty, which means keeping the record of the work that created it.',
      'To keep the studio’s own accounts, which the law requires us to retain.',
      'To send you reminders you have asked for. You can turn each kind off in Profile → Notifications, and we respect that setting.',
    ],
  },
  {
    heading: 'Deleting your account',
    body: [
      'You can delete your account from Profile at any time. Nothing needs to be requested from us.',
      'Your profile, your cars, your photographs, your notifications and your push tokens are erased.',
      'Records the studio is required to keep — invoices, completed visits and memberships that were paid for — are kept, with your name, email and phone removed from them. They no longer identify you.',
      'Deleting your account also signs you out everywhere and cannot be undone.',
    ],
  },
  {
    heading: 'Who can see it',
    body: [
      'You, and the studio’s own staff.',
      'A visit record can be shared by you, using a link you choose to send. That link shows the work and the photographs, and never shows amounts or your contact details.',
      'We use Google Firebase to store data and Cloudinary to store photographs. Both process it on our behalf and under our instruction.',
    ],
  },
  {
    heading: 'Getting in touch',
    body: [
      `Come and see us at ${COMPANY.address}, or call ${COMPANY.phone}.`,
      'You can also message the studio from Profile → Support.',
    ],
  },
];

export const TERMS: LegalSection[] = [
  {
    heading: 'What this is',
    body: [
      `${COMPANY.name} is a car detailing studio in ${COMPANY.city}. This application lets you arrange visits, follow work on your car, keep its record, and hold a membership.`,
    ],
  },
  {
    heading: 'Arranging a visit',
    body: [
      'A visit you arrange is a request. It is confirmed once the studio has seen it, and you will see the status change.',
      'You can change or cancel a visit until we start work on it. After that, please call and we will sort it out.',
      'A slot held for a visit you do not attend is treated as used.',
    ],
  },
  {
    heading: 'Paying',
    body: [
      'Prices are shown before you confirm, and are settled at the studio by UPI or cash.',
      'The price you are shown when arranging is what the studio charges. We do not add fees afterwards.',
    ],
  },
  {
    heading: 'Membership',
    body: [
      'A membership runs for thirty days and includes the washes stated for the plan.',
      'It begins once the studio has taken payment and confirmed it, not when you request it.',
      'Washes belong to their cycle and do not carry over.',
      'You can cancel at any time from Profile. Your washes stand until the end of the cycle you have paid for.',
    ],
  },
  {
    heading: 'Warranties',
    body: [
      'A warranty is recorded against the visit that created it, with the terms as they stood on that day.',
      'Those terms do not change afterwards, whatever we may later charge or offer for the same work.',
    ],
  },
  {
    heading: 'Your car and your photographs',
    body: [
      'We photograph a car during a visit so you can see the work. Those photographs are part of your record.',
      'We will not use a photograph of your car publicly without asking you first.',
    ],
  },
  {
    heading: 'Ending it',
    body: [
      'You can delete your account at any time from Profile. See the privacy policy for exactly what is erased and what the studio must keep.',
    ],
  },
];
