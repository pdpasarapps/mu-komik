## mu-komik

mu-komik is being rebuilt around Next.js, Supabase Auth/Postgres, and Cloudflare R2. The current screen is the reader discovery shell; backend features are added against the schema in `supabase/schema.sql`.

For existing Supabase projects, run `supabase/comic-contributors.sql` once before editing comic contributor details.
For comic publishing and admin curation, run `supabase/comic-curation.sql` once on existing Supabase projects.
For the admin dashboard, run `supabase/creator-request.sql` first, then `supabase/admin-management.sql` to grant admin access to profile management.

## Getting Started

Copy `.env.example` to `.env.local` and fill in the values from Supabase and Cloudflare R2. Keep `.env.local` private and never commit it. Rotate any server credentials that have been shared outside your trusted environment.

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

For direct browser uploads to R2, apply `r2-cors.json` in Cloudflare R2 bucket `mu-komik-assets` under Settings -> CORS policy. Add the final frontend domain to `AllowedOrigins` before production deployment.

For production uploads, configure these variables for the deployed Cloudflare Worker and redeploy:

- `R2_ACCOUNT_ID` and `R2_BUCKET_NAME`
- `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` (store these as secrets)
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

The local `.env.local` file does not configure the production Worker.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
