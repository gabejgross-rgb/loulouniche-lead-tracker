# LoulouNiche Lead Tracker

A phone-first lead capture app for Hala Gross / LoulouNiche (loulouniche.com), built from the generic lead-tracker template below. No build step, no backend server — static HTML/JS + Firebase Firestore + one Netlify Function.

## Status

Branding and fields are already customized in `index.html` for LoulouNiche's business (home design, organization, staging — not the generic conference-sales template this was built from):

- **Company**: LoulouNiche
- **Service tags**: the actual named packages from loulouniche.com/designservices — Initial Consultation, The Refresh, The Roadmap, Reset + Roadmap, Reimagine + Roadmap, Signature Transformation, Staging, Virtual Services
- **Fields**: Company/Role are now optional and meant for referral partners (agents, stagers) whose business cards get scanned; added a **Neighborhood** field (useful for routing NYC jobs); added a fixed multi-select **Lead Source** (Referral, Website, Networking, Blog, Instagram — she doesn't work conferences/events, so this replaced the original "Tech Stack" field); renamed "LinkedIn" to **Instagram / Website** since that's her primary channel.
- **Visual design**: rebuilt to match her actual site palette, sampled live from loulouniche.com — cream background (`#F2F1EC`), charcoal text (`#2E2D2A`), and her exact olive/taupe accent (`#746B58`) from the "Book Consult" button, instead of the template's dark theme and default orange. The header wordmark uses a boxed serif small-caps treatment echoing her real logo.

**Still needed before this is live** (these require creating accounts, which is a step only Hala/Gabe can do):
1. Create a Firebase project (Firestore, Native mode) and paste its config into `index.html` — see "Create a Firebase project" below.
2. Create/connect a Netlify site pointed at this repo and add the `ANTHROPIC_API_KEY` environment variable so business-card scanning works — see "Deploy to Netlify" below.

---

**Below this point is the original template documentation**, kept for reference — e.g. if you ever want to spin up a second tracker (a different business, a sub-brand) from the same base.

**Features:** rep sign-in with a shared name picker, lead capture with voice dictation, business-card photo scanning (Claude vision), inline edit, delete confirmation, duplicate merging with per-rep attribution on CSV export, a digital-business-card QR code (My Card), save-a-lead-to-contacts (.vcf), and support for multiple events from one app (with data kept separate per event).

## Starting a new build from this template

Each new business/use case should be its own GitHub repo (generated from this one as a template) with its **own Firebase project** — don't share a Firebase backend across unrelated businesses.

### 1. Customize branding

Open `index.html`, find the block near the top of the `<script>` tag marked:

```js
// CUSTOMIZE FOR YOUR BUSINESS — this is the only block you should
// need to touch to re-brand this app for a new company/use case.
const APP_CONFIG = {
  companyName: 'Your Company',
  emailDomain: '@yourcompany.com',
  productOptions: ['Category A', 'Category B', 'Category C', 'Category D'],
  notesDefault: ''
};
```

Edit those four values. `productOptions` becomes the multi-select tags on the capture form and the filter in "All Leads" — rename to whatever categories make sense (or leave as one generic option if you don't need them).

### 2. Create a Firebase project

- [console.firebase.google.com](https://console.firebase.google.com) → Add project → skip Analytics if you don't want it.
- Build → Firestore Database → Create database → **Native mode**, any region. No auth setup needed — the app writes with an open ruleset by default; if you want to lock that down later, restrict Firestore security rules to your Netlify domain.
- Project Settings → General → Your apps → Add app → Web. Copy the resulting config object into the `firebaseConfig` block in `index.html` (a bit further down from `APP_CONFIG`).

### 3. Deploy to Netlify

- Create a new GitHub repo from this template ("Use this template" button on GitHub), or just fork it.
- In Netlify: New site → Import an existing project → pick your repo.
- Build settings: **no build command**, publish directory `/` (root), functions directory `Functions`.
- Site settings → Environment variables → add `ANTHROPIC_API_KEY` (from [console.anthropic.com](https://console.anthropic.com/settings/keys)) so the business-card scanner works. Trigger a redeploy after adding it — Netlify only injects env vars into a function at build time, not into an already-running deployment.
- **Known gotcha:** Netlify's secret scanner may flag the Firebase `apiKey` in `index.html` as a leaked credential and fail the build. It isn't one — Firebase web API keys are meant to be public; real access control lives in Firestore security rules. Fix: add two site environment variables — `SECRETS_SCAN_OMIT_VALUES` set to your Firebase `apiKey` value, and `SECRETS_SCAN_OMIT_PATHS` set to `index.html`.

### 4. First run

Open the deployed site, pick a name, pick (or add) an event, and start capturing leads. Every subsequent event just needs "+ Add new event" from the same app — no redeploy required.

## Local testing

There's no build tooling, so any static file server works. On Windows without Node/Python installed, paste this into PowerShell from the project folder:

```powershell
$root = (Get-Location).Path
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:8080/")
$listener.Start()
Write-Host "Open http://127.0.0.1:8080"
$mime = @{ ".html"="text/html"; ".js"="application/javascript"; ".css"="text/css"; ".json"="application/json" }
while ($listener.IsListening) {
  try { $ctx = $listener.GetContext() } catch { break }
  try {
    $req = $ctx.Request; $res = $ctx.Response
    $path = $req.Url.LocalPath
    if ($path -eq "/") { $path = "/index.html" }
    $file = Join-Path $root $path.TrimStart("/")
    if (Test-Path $file -PathType Leaf) {
      $bytes = [System.IO.File]::ReadAllBytes($file)
      $ext = [System.IO.Path]::GetExtension($file)
      $ct = $mime[$ext]; if (-not $ct) { $ct = "application/octet-stream" }
      $res.ContentType = $ct; $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else { $res.StatusCode = 404 }
  } catch {} finally { try { $ctx.Response.OutputStream.Close() } catch {} }
}
```

This talks to your real Firebase project (there's no local emulator wired up), so use an obviously-fake name while testing and delete it from "All Leads" afterward.

Business-card scanning won't work against a plain static server — that needs the Netlify Function, so test it on a deployed preview.
