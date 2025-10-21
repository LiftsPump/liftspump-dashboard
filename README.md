This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## MiniMe Persona Builder

The **MiniMe** page now lets you feed in a YouTube link, grab the transcript, send it to Gemini for persona analysis, and store the results (plus a 10 second mp3 clip) in Supabase.

### Environment and setup

- Install new dependencies: `npm install @google/generative-ai youtube-transcript ytdl-core fluent-ffmpeg ffmpeg-static @types/fluent-ffmpeg`.
- Provide a Gemini API key via `GOOGLE_GENERATIVE_AI_API_KEY`.
- Ensure the Supabase service role key (`SUPABASE_SERVICE_ROLE_KEY`) is present so the API route can insert records and upload to storage.
- Create a Supabase storage bucket named `minime-clips` (public read recommended) and a table `minime_personas` with columns matching:
  - `id` (uuid, default gen_random_uuid, primary key)
  - `created_at` (timestamptz, default now)
  - `video_url` (text)
  - `video_id` (text)
  - `persona_summary` (text)
  - `transcript` (text)
  - `clip_storage_path` (text, nullable)
  - `clip_public_url` (text, nullable)

### Runtime notes

- The API endpoint lives at `/api/minime/process` and expects `{ "videoUrl": "https://..." }`.
- It relies on `ffmpeg-static`; no external binary install is required, but keep an eye on cold-start time in serverless environments.
- Audio capture may occasionally fail for videos without audio-only streams; the persona summary still persists in that case.

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
