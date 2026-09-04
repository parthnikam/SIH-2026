This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

The app reads its saved government-data snapshot from `data/generated/` and does
not contact government portals during `dev`, `build`, or `start`. There is no
seed fallback: run `npm run data:refresh` before starting a clean clone. Missing,
empty, or invalid generated catalog files stop startup with a refresh instruction.

Catalog API responses and AI catalog-tool results include a `catalogSource`
object. Its `loadedFrom`, `isPrimarySearchFile`, `file`, record count, and snapshot
timestamp show exactly which primary JSON file was searched.

## Runtime profile storage

When `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_PASSWORD` are configured, starting
a counselling call creates a Supabase record owned by a private, HTTP-only
visitor cookie. No Google or Supabase Auth login is required. Without those
variables, local development falls back to `data/runtime-user-profiles.json`
and `data/runtime-interviews.json`.

The live counsellor merges newly learned or corrected facts into that record
after every caller answer. Each record has a stable profile ID, location fields
suitable for later geographic aggregation, and machine-readable completion
metadata.

Course, job, pathway, and training-centre searches are rejected until all
required profile facts have been collected. Once complete, searches use the
saved state, district, education, work preference, and skills instead of relying
only on transient model arguments. The runtime profile file is intentionally
gitignored because it can contain personal data; replace `lib/profiles/store.ts`
with a database adapter for deployment.

Refresh all available public PM-AJAY courses and NCS job postings manually:

```bash
npm run data:refresh
```

The refresh saves four data files:

- `courses.raw.json`: every PM-AJAY table row and column.
- `jobs.raw.json`: every field returned for every available NCS posting. This
  private local archive can contain public recruiter contact details; do not
  commit or redistribute it.
- `courses.json`: cleaned, deduplicated courses used by recommendation search.
- `jobs.json`: cleaned, location-searchable jobs used by recommendation search.

The previous complete snapshot remains usable if a portal is temporarily
unavailable. To rebuild cleaned jobs from the stored raw archive without
contacting either portal:

```bash
npm run data:refresh:offline
```

NCS is downloaded in pages of 100 with four concurrent requests. Concurrency can
be adjusted with `GOV_DATA_NCS_CONCURRENCY` (1–8). Set `GOV_DATA_STRICT=1` when a
refresh should fail instead of falling back.

PM-AJAY currently uses Let’s Encrypt's new YR certificate hierarchy. The
refresh script includes Let’s Encrypt's official YR-by-X1 compatibility
certificate and applies it only to the PM-AJAY host; TLS verification is not
disabled.

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
