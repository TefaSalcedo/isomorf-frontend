This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

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

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font) font.

## Docker development

Run the complete development stack from the repository root:

```bash
docker compose up --watch
```

Compose Watch synchronizes frontend source changes from the host into the container at `/app`. The container keeps `node_modules` inside the Linux image and keeps the Next.js `.next` cache in a Docker volume, so normal edits do not traverse the Windows filesystem as a large bind mount.

Changes to `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `Dockerfile`, or `.dockerignore` rebuild the frontend image. Dependencies are installed during that build and are not reinstalled every time the container starts.

Polling is disabled by default. If the host environment does not deliver file events correctly, set `WATCHPACK_POLLING=true` in the root `.env` and restart the frontend service.

For the fastest bind-mount workflow on Windows, keep the repository inside the Linux filesystem of a WSL2 distribution, for example under `~/projects`. A path under `/mnt/c` still uses the Windows filesystem and does not provide the same file-event and I/O performance.

The existing `frontend_node_modules` volume is not removed by this setup. It remains available for rollback; do not use `docker compose down -v` when preserving local development data.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features.
- [Learn Next.js](https://nextjs.org/learn) - Learn Next.js through an interactive tutorial.

You can also check out the [Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy on Vercel is via the [Vercel Platform](https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app).

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
