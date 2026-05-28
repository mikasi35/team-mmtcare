# MMT Care Team Portal — v3

Team profile submission portal for `team.mmtcare.com.au`, feeding dynamically into `mmtcare.com.au/about` via Netlify serverless functions.

## Architecture

```
mmtcare.com.au/about
       ↓
/.netlify/functions/team   (public, cached)
       ↓
Supabase (team_members table)

Admin panel writes:
/.netlify/functions/admin  (password-hash protected, uses service key)
       ↓
Supabase (team_members table)
```

---

## Files

```
mmt-capture/
├── index.html
├── app.js
├── assets/css/style.css
├── assets/js/config.js
├── netlify/functions/team.js       # Public GET — approved members
├── netlify/functions/admin.js      # Protected POST — approve/delete/sort/feature
├── api/about-page-snippet.html     # Drop-in for mmtcare.com.au/about
├── netlify.toml
├── package.json
└── README.md
```

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Set Netlify environment variables

In Netlify → Site → Environment variables:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | `https://xxxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | your anon/public key |
| `SUPABASE_SERVICE_KEY` | your service role key (admin writes) |
| `ADMIN_PASS_HASH` | SHA-256 hash of your admin password |

Generate ADMIN_PASS_HASH in any browser console:

```js
async function sha(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2,'0')).join('');
}
sha('your-admin-password').then(console.log);
```

### 3. Run database migrations in Supabase SQL editor

```sql
CREATE TABLE IF NOT EXISTS team_members (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  first_name text, last_name text, role text, description text,
  image_url text, approved boolean DEFAULT false,
  featured boolean DEFAULT false, sort_order int DEFAULT 0,
  slug text, linkedin_url text, department text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE team_members ADD COLUMN IF NOT EXISTS approved boolean DEFAULT false;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS featured boolean DEFAULT false;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS sort_order int DEFAULT 0;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS linkedin_url text;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS department text;

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_select" ON team_members FOR SELECT USING (true);
-- Writes go through SUPABASE_SERVICE_KEY in admin.js — no anon write policy needed
```

### 4. Insert the config row

```sql
INSERT INTO team_capture_config (id, admin_pass_hash, bucket_name)
VALUES (1, 'YOUR_SHA256_HASH_HERE', 'team-photos');
```

### 5. Deploy

```bash
netlify deploy --prod
```

---

## Local development

```bash
npm install
netlify dev
```

Create `.env` (never commit):

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key
ADMIN_PASS_HASH=your_sha256_hash
```

On localhost the app bypasses the Netlify function and calls Supabase directly so local dev works without a function server.

---

## About Page

Add `api/about-page-snippet.html` to `mmtcare.com.au/about`.

Fetches from: `https://team.mmtcare.com.au/.netlify/functions/team`

Department filter: `?department=Leadership`

---

## Changelog

### v3
- Correct Netlify Functions structure (`netlify/functions/`)
- `netlify.toml` and `package.json`
- Admin writes go through `admin.js` using SUPABASE_SERVICE_KEY (never in browser)
- Password hash validated server-side in `admin.js`
- Green success toast on approve/feature actions
- Local dev fallback to direct Supabase REST

### v2
- Bio 300 → 800 chars; department, LinkedIn, slug fields
- Approve/Unapprove/Feature/Delete/Sort admin controls
- Public image URLs; CSV export; SEO + OpenGraph
