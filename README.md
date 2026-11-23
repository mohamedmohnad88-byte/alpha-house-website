# Alpha House Real Estate — Website + Admin (Firebase)

موقع عقاري Premium + لوحة تحكم (Admin) لشركة **ALPHA HOUSE REAL ESTATE** في مدينة العبور – مصر.
Backend: **Firebase** (Firestore + Auth + Storage) — مزامنة فورية (real-time).

## Stack
- Frontend: HTML / CSS / JavaScript (RTL Arabic + English toggle)
- Backend: Firebase (Firestore + Firebase Auth + Firebase Storage)
- Hosting: static hosting (GitHub Pages / Vercel / Netlify) — DB on Firebase (free tier)

## Project structure
```
alpha-house-website/
  index.html, about.html, properties.html, property.html, projects.html, services.html, contact.html
  admin/
    login.html
    index.html
  css/
  js/ (config.js, firebase.js, data.js, i18n.js, main.js, properties.js, property.js, admin.js)
  firestore.rules
  storage.rules
  .env.example, .gitignore, .nojekyll, package.json, README.md
```

## 1. Firebase setup
1. Create a free project at https://console.firebase.google.com
2. Add a Web App → copy config (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId).
3. Fill `js/config.js` (`AH_FIREBASE_CONFIG`).
4. Enable **Authentication → Sign-in method → Email/Password**.
5. Create **Firestore Database** (production mode).
6. (Optional) Create **Storage** bucket — image upload works without it via compressed base64 (free, no billing).
7. Deploy rules:
   - Firestore rules: paste `firestore.rules` in Console → Firestore → Rules → Publish.
   - Storage rules: paste `storage.rules` in Console → Storage → Rules → Publish.

## 2. Create admin account (secure)
1. Firebase Console → Authentication → Users → **Add user** (email + password).
2. Copy the user's UID.
3. Firestore Console → collection `users` → document with ID = UID → fields:
   - `role: "admin"`
   (Create collection `users` if not exists.)
4. Login at `/admin/login.html`.

> Only users with `users/{uid}.role == 'admin'` can read/write admin data. Protected by Firestore Security Rules (not client-side).

## 3. Run locally
```bash
cd alpha-house-website
python3 -m http.server 8080
# http://localhost:8080
# admin: http://localhost:8080/admin/login.html
```

## 4. Real-time sync
- Public pages use Firestore `onSnapshot` where applicable; admin changes reflect instantly.
- All data (properties, projects, areas, inquiries, settings) stored in Firestore.

## 5. Push to GitHub
```bash
cd alpha-house-website
git add . && git commit -m "Alpha House Firebase migration"
git push origin main
```

## 6. Deploy (free)
- GitHub Pages / Vercel / Netlify (static). `.nojekyll` included.
- Firebase (Firestore/Auth/Storage) already hosted.

## 7. External things needed from you
- Firebase project + Web app config (`js/config.js`)
- Enable Auth (Email/Password), Firestore, Storage
- Deploy `firestore.rules` and `storage.rules`
- Create admin user + `users/{uid}` doc with role='admin'
- Real property/project/area data (add via admin; no fake data shipped)

## Company info (fixed)
- Name: ALPHA HOUSE REAL ESTATE
- Phone/WhatsApp: 01557222799
- Area: Obour City, Egypt (مدينة العبور، مصر)