# AutoModz — Setup & Deployment Guide

## 🔥 Step 1: Firebase Setup

### 1.1 Create a Firebase Project
1. Go to https://console.firebase.google.com
2. Click **"Add project"** → Name it `automodz`
3. Disable Google Analytics (optional) → Click **"Create project"**

### 1.2 Enable Authentication

**Customer Auth — Google Sign-In (required):**
1. Authentication → Get started → Click Google → Enable → Set support email → Save
2. Customers sign in with "Continue with Google" — no passwords

**Admin Auth — Email/Password (required):**
1. Authentication → Sign-in method → Email/Password → Enable → Save
2. Authentication → Users → Add user: email=hello.automodz@gmail.com, pass=111111
3. In Firestore, find that user's UID → create /users/{uid} doc with role="admin"

⚠️ Add Authorized Domains: Authentication → Settings → Authorized domains → add localhost + Vercel URL

### 1.3 Create Firestore Database
1. Go to **Firestore Database** → **Create database**
2. Select **"Start in test mode"** (we'll add rules after)
3. Choose region: `asia-south1 (Mumbai)` → **Enable**

### 1.5 Get Your Firebase Config
1. Go to **Project Settings** (⚙️ icon) → **Your apps**
2. Click the **`</>`** (Web) icon → Name it `automodz-web`
3. **DO NOT** enable Firebase Hosting (we use Vercel)
4. Copy the config object — you'll need these values:

```
apiKey: "AIzaSy..."
authDomain: "automodz-xxxxx.firebaseapp.com"
projectId: "automodz-xxxxx"
storageBucket: "automodz-xxxxx.appspot.com"
messagingSenderId: "123456789"
appId: "1:123456789:web:abcdef"
```

### 1.6 Firestore Security Rules
Go to Firestore → **Rules** tab and paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // Vehicles subcollection
      match /vehicles/{vehicleId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
    
    // Bookings - users see their own, admins see all
    match /bookings/{bookingId} {
      allow read: if request.auth != null && 
        (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if request.auth != null;
      allow update: if request.auth != null && isAdmin();
    }
    
    // Services - anyone authenticated can read, only admin writes
    match /services/{serviceId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && isAdmin();
    }
    
    // Subscriptions
    match /subscriptions/{subId} {
      allow read: if request.auth != null && 
        (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if request.auth != null;
      allow update: if request.auth != null && isAdmin();
    }
    
    // Gallery - read for all auth, write for admin
    match /gallery/{imageId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && isAdmin();
    }
    
    // Notifications
    match /notifications/{notifId} {
      allow read, update: if request.auth != null && 
        resource.data.userId == request.auth.uid;
      allow write: if request.auth != null && isAdmin();
    }
    
    // Referrals
    match /referrals/{refId} {
      allow read, write: if request.auth != null;
    }
    
    function isAdmin() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

### 1.7 Storage Rules
Go to Storage → **Rules** and paste:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /payments/{userId}/{file} {
      allow read, write: if request.auth != null;
    }
    match /gallery/{file} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /vehicles/{file} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## 🔑 Step 2: Create Admin Account

1. First, update your `.env.local` with your admin email:
   ```
   NEXT_PUBLIC_ADMIN_EMAIL=your-email@domain.com
   ```
2. Run the app locally and register with that exact email
3. Your account will automatically get `role: 'admin'` in Firestore
4. Go to `/admin` to access the admin panel

---

## 💻 Step 3: Local Development

```bash
# 1. Clone or extract the project
cd automodz-app

# 2. Install dependencies
npm install

# 3. Create your environment file from the example
cp .env.local.example .env.local

#    ⚠️ ensure you never commit `.env.local` to git, it is already listed in
#    `.gitignore` and contains secrets (Firebase keys, admin email, etc.)

# 4. Fill in your Firebase values and other settings in `.env.local` using
#    the placeholders in the example as a guide. Edit with VS Code if you like:
#    code .env.local

# 5. Run the development server
npm run dev

# 6. Open http://localhost:3000
```

---

## 📦 Step 4: Initialize Services in Database

1. Login as admin → Go to `/admin/settings`
2. Click **"SEED DEFAULT SERVICES"**
3. All 14 services from the PRD will be added to Firestore
4. You can then edit prices directly from the admin panel

---

## 🚀 Step 5: Deploy to Vercel

### Option A: Via Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow prompts:
# - Link to your Vercel account
# - Project name: automodz
# - Root directory: ./
```

### Option B: Via GitHub (Recommended)
1. Push your code to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial AutoModz app"
   git remote add origin https://github.com/yourusername/automodz.git
   git push -u origin main
   ```
2. Go to https://vercel.com → **Import Project**
3. Import your GitHub repo
4. Add all environment variables from `.env.local`
5. Click **Deploy**

### Environment Variables in Vercel
Go to your Vercel project → **Settings** → **Environment Variables**
Add all variables from your `.env.local` file.

---

## 📱 Step 6: PWA Icons

Create proper PWA icons:
1. Place your AutoModz logo at `public/icons/icon-192.png` (192×192px)
2. Place `public/icons/icon-512.png` (512×512px)
3. Use a tool like https://realfavicongenerator.net to generate all sizes

---

## 🔧 Step 7: Configure WhatsApp & UPI

In your `.env.local`:
```
NEXT_PUBLIC_WHATSAPP_NUMBER=919876543210   # Add 91 prefix for India
NEXT_PUBLIC_UPI_ID=automodz@paytm          # Your UPI ID
```

For the UPI QR code image:
- Save your UPI QR code image as `public/upi-qr.png`
- The booking page will display this automatically

---

## 📊 Firestore Indexes Required

### ⚠️ CRITICAL — Create This Index First
The slot conflict check queries `scheduledDate` + `serviceCategory` together. Without this index the booking page will throw a runtime error in production.

**Create it manually in Firebase Console:**
1. Go to Firestore → **Indexes** → **Composite** → **Add Index**
2. Collection: `bookings`
3. Fields: `scheduledDate` (Ascending) + `serviceCategory` (Ascending)
4. Click **Create**

Or click the auto-generated link that appears in your browser console the first time a booking is attempted — Firebase will give you a direct link.

### All Required Indexes

| Collection | Fields | Order |
|-----------|--------|-------|
| bookings | **scheduledDate + serviceCategory** | ASC + ASC ← **critical** |
| bookings | userId + createdAt | ASC + DESC |
| subscriptions | userId + status + createdAt | ASC + ASC + DESC |
| notifications | userId + createdAt | ASC + DESC |
| gallery | category + createdAt | ASC + DESC |

---

## 🎯 App URLs After Deployment

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/auth/login` | Customer login |
| `/auth/register` | Customer registration |
| `/dashboard` | Customer dashboard |
| `/dashboard/booking` | Book a service |
| `/dashboard/vehicles` | Manage vehicles |
| `/dashboard/history` | Service history |
| `/dashboard/profile` | Profile + referrals |
| `/dashboard/subscriptions` | Membership plans |
| `/admin` | Admin dashboard |
| `/admin/bookings` | Manage bookings |
| `/admin/customers` | Customer database |
| `/admin/gallery` | Before/after gallery |
| `/admin/subscriptions` | Membership management |
| `/admin/settings` | Pricing manager |

---

## 🛡️ Security Checklist

- [ ] Firestore rules applied (Step 1.6)
- [ ] Storage rules applied (Step 1.7)
- [ ] Admin email set in `.env.local`
- [ ] Never commit `.env.local` to git
- [ ] `.gitignore` includes `.env.local`

---

## 🆘 Troubleshooting

**"Firebase: Error (auth/...)"**
→ Check your API key in `.env.local` is correct

**Booking page shows no services**
→ Go to Admin → Settings → Click "SEED DEFAULT SERVICES"

**Admin panel redirects to dashboard**
→ Ensure your email matches `NEXT_PUBLIC_ADMIN_EMAIL` exactly

**Hydration error on theme**
→ Clear localStorage and refresh. This resolves on its own after first load.

---

Need help? The project is production-ready on Vercel with this setup. 🚗✨
