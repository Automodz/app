# AutoModz App

Next.js + Firebase car detailing booking application.

## Features

- Google sign-in for customers, email/password for admin
- Booking workflow with vehicle selection, service catalogue, scheduling
- Admin panel for bookings, schedule, customers, pricing, subscriptions
- Demo mode with sample data
- Dark/light theme, mobile-first design, PWA manifest
- Firestore rules ensure security, membership system, notifications

## Getting Started

Follow steps in [`SETUP.md`](./SETUP.md). Key points:

1. Copy `.env.local.example` to `.env.local` and fill values.
2. Never commit `.env.local` to git (secrets!).
3. `npm install` → `npm run dev` for local development.

## Scripts

- `npm run dev` – start development server
- `npm run lint` – lint code
- `npm run build` – build for production
- `npm run start` – start production build
- `npm run test` – run unit tests

## Deployment

Connect repository to Vercel for automatic deployments on push.

## Notes

- Payment integration is manual (UPI transaction ID).
- For enhanced reliability add real-time listeners & push notifications.
- Update dependencies regularly (Next.js 14.3 or newer recommended).

