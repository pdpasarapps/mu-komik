## mu-komik

mu-komik is being rebuilt around Next.js, Supabase Auth/Postgres, and Cloudflare R2. The current screen is the reader discovery shell; backend features are added against the schema in `supabase/schema.sql`.

For existing Supabase projects, run `supabase/comic-contributors.sql` once before editing comic contributor details.
For comic publishing and admin curation, run `supabase/comic-curation.sql` once on existing Supabase projects.
For the admin dashboard, run `supabase/creator-request.sql` first, then `supabase/admin-management.sql` to grant admin access to profile management.
For comic-level bookmarks on an existing database, run `supabase/comic-bookmarks.sql` once.
For creator-selected comic device targeting on an existing database, run `supabase/comic-target-device.sql` once before deploying.
For static comic share previews on an existing database, run `supabase/comic-share-previews.sql` once before deploying. Admins can then generate previews for published comics from `/admin/share-previews`; new covers create their share preview in the browser and upload it directly to R2.
For admin reading analytics on an existing database, run `supabase/comic-analytics.sql` once in the Supabase SQL Editor after `supabase/creator-request.sql`, then configure `SUPABASE_SERVICE_ROLE_KEY` as a server-only secret in the production Worker and `.env.local`. The analytics route needs it to record anonymous views; never expose it in client-side code. Counts start after this migration is installed. A browser opening the same episode is counted at most once per 30-minute interval; unique readers use a random first-party cookie, not an IP address or user-agent.
For per-comic ad visibility controls, run `supabase/comic-ad-settings.sql` once in the Supabase SQL Editor. Admins can toggle internal and Adsterra ads from each comic's details in `/admin/comics`; comics without a custom setting inherit the enabled defaults and global placement settings.
For Google Analytics 4 reports in `/admin/analytics`, enable the Google Analytics Data API in Google Cloud, create a service account, and grant its email Viewer access to the GA4 property. Configure `GA4_PROPERTY_ID` (the numeric property ID, not the `G-...` measurement ID), `GA4_SERVICE_ACCOUNT_EMAIL`, and `GA4_SERVICE_ACCOUNT_PRIVATE_KEY` as server-only secrets in `.env.local` and the production Worker. Store private-key line breaks as `\n`; never expose or commit the key. Reports are fetched on demand and are available only to admins and staff with analytics access.
For reader Free/Premium/VIP memberships on an existing database, run `supabase/reader-memberships.sql` once in the Supabase SQL Editor after `supabase/creator-request.sql`. Admins assign tiers from user management; Premium removes ads and VIP also unlocks direct access to every published episode.
In Kids Mode, episodes in approved comics can be opened in any order; each episode still shows its own read status based on saved page progress.
For reader-interest quiz and genre-based sponsor targeting on an existing database, run `supabase/reader-profiling.sql` once in the Supabase SQL Editor after `supabase/ads-management.sql`. The signup quiz is optional, ad-personalization consent is separate and off by default, and readers can change or clear their interests in account settings. Genre campaigns can match the comic currently being read without using a reader profile; profile-based matching requires explicit consent.
For episode MP3 audio and page-synchronized subtitles on an existing database, run `supabase/chapter-audio.sql` once in the Supabase SQL Editor before deploying. See [Audio and Episode Subtitles](docs/audio-episode.md) for the SRT sidecar format and reader behavior.
To enable Google login, enable Google under Supabase Authentication -> Sign In / Providers and add the Google OAuth Client ID and secret. In Google Cloud, add `https://<project-ref>.supabase.co/auth/v1/callback` as an authorized redirect URI. In Supabase Authentication -> URL Configuration, allow the app callback URL (`https://mu-komik.com/auth/callback`) and local development URL (`http://localhost:3000/auth/callback`); add any other deployed app origins that will use Google login.
For restricted episode-audio uploads, run `supabase/chapter-audio-permissions.sql` after `supabase/creator-request.sql` and `supabase/admin-management.sql`. Admins can grant the separate audio-creator permission from `/admin/users`; it is disabled by default and enforced by the upload API.
For the article CMS, run `supabase/article-cms.sql` once in the Supabase SQL Editor before deploying. Admins can write Markdown articles at `/admin/articles`; only published articles are public at `/artikel` and included in the sitemap.
For the public contact form and account inbox, run `supabase/staff-access.sql` and then `supabase/contact-messages.sql` in the Supabase SQL Editor. These migrations add contact categories, per-category staff access, account links, read-status fields, and private/system message tables for existing installations. Configure `SUPABASE_SERVICE_ROLE_KEY` as a server-only secret; admins can manage all categories, while staff need the `contact-messages` menu permission and one or more assigned categories to read and reply to those messages at `/admin/contact-messages`.

## Getting Started

Copy `.env.example` to `.env.local` and fill in the values from Supabase and Cloudflare R2. Keep `.env.local` private and never commit it. Rotate any server credentials that have been shared outside your trusted environment.

Untuk panduan menyiapkan gambar komik dan iklan, lihat [Panduan Ukuran Gambar](docs/panduan-ukuran-gambar.md).

Then run:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Before deploying, run `npm run build` to verify the production build locally.

For direct browser uploads, share-preview generation, and Premium offline episode downloads from R2, apply `r2-cors.json` in Cloudflare R2 bucket `mu-komik-assets` under Settings -> CORS policy. The local production preview at `http://localhost:3030` is included; add other local ports or the final frontend domain to `AllowedOrigins` when needed.
Comic cover file sharing fetches images through the same-origin `/api/share-cover` route, so it does not depend on browser CORS access to the R2 public host.

For production uploads, configure these variables for the deployed Cloudflare Worker and redeploy:

- `R2_ACCOUNT_ID` and `R2_BUCKET_NAME`
- `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` (store these as secrets)
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

The local `.env.local` file does not configure the production Worker.

For search indexing, set `NEXT_PUBLIC_SITE_URL` to the canonical public origin (`https://mu-komik.com`) in both local and production environments. The app exposes `robots.txt` and a sitemap containing published articles, comics, and episodes; submit `https://mu-komik.com/sitemap.xml` to Google Search Console and Bing Webmaster Tools after deployment.

The home page renders its published comic catalog on the server and includes visible Indonesian platform information. The global layout emits `Organization` and `WebSite` JSON-LD; published comic pages emit `CreativeWorkSeries` and `BreadcrumbList` data. Keep structured data accurate and consistent with visible page content. After deploying SEO changes, inspect the canonical home page and sitemap in Google Search Console; indexing and search snippets are determined by search engines and are not guaranteed.

The Facebook App ID is configured in the global metadata and is emitted as the `fb:app_id` tag.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
