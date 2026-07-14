# AutoModz - Firebase & Free Setup Guide

Everything the app uses is free. This guide takes ~45 minutes, once, and you never touch it again.

## Why Firebase?

Your app needs four things a plain website doesn't have:

| Need | Firebase piece | Free limit (Spark plan) | Your realistic usage |
|---|---|---|---|
| Login (Google for customers, email for you) | **Authentication** | Unlimited sign-ins | ✅ Always free |
| A database (bookings, jobs, employees, inventory…) | **Firestore** | 50k reads + 20k writes **per day**, 1 GB stored | A busy day at the studio is a few thousand reads - ~5% of the limit |
| "Car is ready" phone notifications | **Cloud Messaging (FCM)** | Unlimited | ✅ Always free |
| Server-side security (invoice links, referrals, push fan-out) | **Admin SDK** (runs inside Vercel) | Free | ✅ Always free |

Photos are the one thing we do NOT put in Firebase: new Firebase projects require a credit card on file for Storage. Instead the app uploads photos to **Cloudinary** (free forever, no card, 25 GB-equivalent monthly credits - hundreds of car photos). Firebase Storage still works as an option if you ever prefer it.

Hosting is **Vercel** (free Hobby plan) - the app deploys there, Firebase is just the backend.

---

## Step 1 - Create the Firebase project (5 min)

1. Go to **console.firebase.google.com** and sign in with **hello.automodz@gmail.com** (important - this account owns everything).
2. **Add project** → name it `automodz` → disable Google Analytics (not needed) → Create.
3. When it opens, click the **web icon `</>`** ("Add app") → nickname `automodz-web` → **Register**.
4. It shows a `firebaseConfig` block. Copy each value into `.env.local` (the `NEXT_PUBLIC_FIREBASE_*` lines). You can see this again anytime under ⚙️ **Project settings → General → Your apps**.

## Step 2 - Turn on Authentication (3 min)

1. Left sidebar → **Build → Authentication → Get started**.
2. Enable **Google** (pick hello.automodz@gmail.com as support email) → Save.
3. Enable **Email/Password** → Save.
4. **Create your admin login**: Users tab → **Add user** → email `hello.automodz@gmail.com` + a strong password. This is what you'll type on the Admin tab of the login page. (The Google button also works for you - the app auto-grants admin to this email either way.)
5. **Settings → Authorized domains** → add your Vercel domain (e.g. `automodz.vercel.app`) after Step 7.

## Step 3 - Turn on Firestore (2 min)

1. **Build → Firestore Database → Create database**.
2. Location: **asia-south1 (Mumbai)** - closest to Ahmedabad. This cannot be changed later.
3. Start in **production mode** (our own rules file replaces it in Step 5).

## Step 4 - Web push key (2 min)

1. ⚙️ **Project settings → Cloud Messaging** tab.
2. Under **Web Push certificates** → **Generate key pair**.
3. Copy the key into `.env.local` as `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.

## Step 5 - Deploy the security rules (5 min, from this folder)

```bash
npm install -g firebase-tools     # once
firebase login                    # sign in as hello.automodz@gmail.com
firebase use --add               # pick the automodz project, alias "default"
firebase deploy --only firestore:rules,firestore:indexes
```

This uploads `firestore.rules` (who can read/write what - customers only see their own data, only the admin account can touch employees/payroll/inventory) and the query indexes. Re-run the deploy command any time these files change.

## Step 6 - Service account for the server (3 min)

The invoice share links, push sending, and referral rewards run on the server and need admin credentials:

1. ⚙️ **Project settings → Service accounts → Generate new private key** → a JSON file downloads.
2. From that JSON copy into `.env.local` (and later into Vercel):
   - `project_id` → `FIREBASE_ADMIN_PROJECT_ID`
   - `client_email` → `FIREBASE_ADMIN_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_ADMIN_PRIVATE_KEY` (paste the whole thing, quotes and `\n`s included)
3. **Delete the downloaded JSON** afterwards - treat it like a bank password.

## Step 7 - Cloudinary for photos (5 min, no card)

1. **cloudinary.com** → Sign up free (use the same Google account).
2. The Dashboard shows your **Cloud name** → `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`.
3. ⚙️ Settings → **Upload** → **Upload presets** → **Add upload preset** →
   Signing mode: **Unsigned** → Save. Copy the preset name → `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`.
4. Done - car photos, gallery, job before/afters, and sell-request photos all now upload there automatically.

## Step 8 - Deploy to Vercel (10 min)

1. Push this folder to a GitHub repo (private is fine).
2. **vercel.com** → sign up free with GitHub → **Add New Project** → import the repo → Root Directory = `Website`.
3. In the project's **Settings → Environment Variables**, paste every line from your `.env.local`.
4. Deploy. Your app is live at `automodz.vercel.app` (custom domain like `automodz.in` can be added later - the domain itself is the only thing that costs money, ~₹800/yr).
5. Go back to Firebase **Authentication → Settings → Authorized domains** and add the Vercel domain.

## Step 9 - First-run checklist (10 min, on the live site)

1. Log in with Google as hello.automodz@gmail.com → you land in **Admin**.
2. **Services** → tap **SEED SERVICES** (loads the 15-service catalogue).
3. **Employees** → add your team with their PINs and salary setup.
4. **Inventory** → add consumables, then **Recipes** → map what each service uses.
5. **Gallery** → upload 6–8 of your best before/after shots (they appear on the public landing page).
6. **Cars** → list any cars you have for sale.
7. On the shop **iPad**: open the site in Safari → log in as admin → Share → **Add to Home Screen** → open the icon → navigate to **Store Mode**. That's your kiosk.
8. On your **phone**: open the site → install prompt → enable notifications from the bell page.

---

## What stays free vs. what could ever cost money

**Free forever at your scale:** logins, database, push notifications, Cloudinary photos, Vercel hosting, invoice links, referrals, reports, wa.me WhatsApp links (they just open WhatsApp pre-typed - zero cost, works today).

**Only two things ever cost money, both optional:**
1. **WhatsApp Cloud API** (auto-send instead of tap-to-send): free-form replies inside a 24-hour customer window are free, but proactive template messages cost ~₹0.12–0.80 each and need Meta business verification. The app is pre-wired - add `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` whenever you're ready.
2. **Firebase Storage** instead of Cloudinary: needs a card on the account (Blaze plan) though usage stays ₹0 within quotas.

**Guard-rail tip:** in Firebase console → ⚙️ → Usage and billing → you can watch daily reads/writes. On the Spark plan you *cannot* be charged - Firebase simply pauses over-limit usage until midnight, so there is no billing risk at all.
