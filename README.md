# Alpha House Real Estate — Website + Admin

موقع عقاري Premium + لوحة تحكم (Admin) لشركة **ALPHA HOUSE REAL ESTATE** في مدينة العبور – مصر.

## Stack
- Frontend: HTML / CSS / JavaScript (RTL Arabic + English toggle)
- Backend-as-a-Service: Supabase (PostgreSQL + Auth + Storage)
- Hosting: static hosting (GitHub Pages / Vercel / Netlify) — DB on Supabase (free tier)

## Project structure
```
alpha-house-website/
  index.html, about.html, properties.html, property.html, projects.html, services.html, contact.html
  admin/
    login.html
    index.html
  css/  (variables.css, base.css, components.css, admin.css)
  js/   (config.js, supabase.js, data.js, i18n.js, main.js, properties.js, property.js, admin.js)
  sql/  (schema.sql)
  assets/img/
  .env.example
  .gitignore
  .nojekyll
  README.md
```

## 1. Supabase setup (database)
1. Create a free project at https://supabase.com
2. Open SQL Editor → paste & run `sql/schema.sql`
3. Create Storage bucket `property-images` (public) — schema.sql also attempts this.
4. (Optional) run seed data manually if needed; no fake data is shipped.

## 2. Configure frontend
Edit `js/config.js`:
```js
window.AH_CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR-ANON-PUBLIC-KEY"
};
```
The anon key is public-safe (protected by RLS). Never add the service_role key.

## 3. Create admin account (secure)
1. In Supabase Dashboard → Authentication → Users → "Add user" (email + password). Or use signup if enabled.
2. Copy the user's UUID.
3. In SQL Editor run:
   ```sql
   update public.profiles set role = 'admin' where id = '<USER_UUID>';
   ```
4. Login at `/admin/login.html`.

## 4. Run locally
```bash
cd alpha-house-website
python3 -m http.server 8080
# open http://localhost:8080
# admin: http://localhost:8080/admin/login.html
```

## 5. Admin panel
URL path: `/admin` (i.e. `/admin/index.html`). Login at `/admin/login.html`.

Features:
- Properties: create / edit / delete / publish (show/hide) / feature
- Image upload to Supabase Storage
- Edit price, size, title (AR/EN), description, features, status
- Projects CRUD + publish/feature
- Areas CRUD
- Inquiries: list, status update, delete
- Settings: company info (fixed)

All changes reflect immediately on the public site (no localStorage used as DB).

## 6. Push to GitHub
```bash
cd alpha-house-website
git init
git add .
git commit -m "Alpha House Real Estate website + admin"
git branch -M main
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

## 7. Deploy (free)
- **Site:** GitHub Pages (enable in repo settings → Pages → main branch) or Vercel/Netlify. `.nojekyll` included.
- **DB:** Supabase (already hosted). Set `js/config.js` values before deploy (or inject via build). Keep secrets out of repo.

## 8. External things still needed from you
- Supabase project URL + anon key (fill `js/config.js`)
- Admin account creation + role promotion (SQL)
- Storage bucket `property-images` (created by schema.sql, verify in dashboard)
- Real property/project/area data (add via admin panel; no fake data shipped)
- Custom domain (optional)

## Company info (fixed)
- Name: ALPHA HOUSE REAL ESTATE
- Phone/WhatsApp: 01557222799
- Area: Obour City, Egypt (مدينة العبور، مصر)