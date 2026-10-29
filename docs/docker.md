# Run Mash Allah Cafe POS with Docker

This Docker image runs the existing **Next.js 16 + Prisma 7** application.
It uses the configured **external Supabase PostgreSQL/Auth/Storage** services; it
does not create a PostgreSQL container and does not replace Supabase.

## Requirements

- Docker Desktop or Docker Engine with Linux container support
- A reachable Supabase project and an app environment file
- A separate development/staging database when testing (never point a test
  container at the live restaurant database)

## 1. Prepare application environment

Create a local `.env` file from `.env.example` and fill in the same
settings used by the application in your non-production environment.

Required to start the app:

- `DATABASE_URL`: PostgreSQL connection string reachable from **inside** the
  container; use Supabase's appropriate pooler connection string when applicable
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase publishable/anon key

Other server-only keys (for example, supplier integrations, storage, and webhook
secrets) must be supplied in `.env` for those features to work. Never pass
`DATABASE_URL`, `DIRECT_URL`, `SUPABASE_SERVICE_ROLE_KEY`, or any other secret
as a `docker build --build-arg`, or commit them to the repo.

## 2. Build the image

Run these commands from the repository root. Use **your own public** Supabase
project URL and anon/publishable key:

```bash
docker build -t mashallah-pos:local \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="https://YOUR_PROJECT.supabase.co" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY" \
  .
```

The two values are compiled into browser-side Next.js code at build time.
They **must match** the corresponding settings in the runtime `.env`.

Optional PostHog public settings can be supplied as
`--build-arg NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=...` and
`--build-arg NEXT_PUBLIC_POSTHOG_HOST=...`.

The build generates Prisma Client and builds a standalone Next.js server.
The placeholder `DATABASE_URL` used **only during build** is not a working
database connection. Build-time code must not rely on querying a real database.

## 3. Run the image

```bash
docker run --detach \
  --name mashallah-pos \
  --publish 3000:3000 \
  --env-file .env \
  --restart unless-stopped \
  mashallah-pos:local
```

Open **http://localhost:3000/menu**.

Use these commands to inspect or stop the container:

```bash
docker ps
docker logs -f mashallah-pos
docker stop mashallah-pos
docker rm mashallah-pos
```

To run a rebuilt image with the same container name, remove the old container
before starting another one.

## Database migrations

**The Docker build and container startup intentionally do not run migrations,
seed data, or change your database schema.** Review and apply migrations
separately, using a trusted development/staging environment and the Prisma CLI,
only when you explicitly intend to:

```bash
npx prisma migrate status
# After review, only on the chosen database:
# npx prisma migrate deploy
```

Use `DIRECT_URL` as appropriate for Prisma migration commands, with
`DATABASE_URL` pointing to the intended database. Do not perform these steps
against production for a Docker test.

## Notes and limitations

- The container is a **production-build server**, not Next.js hot-reload mode.
  Rebuild the image after changing source code or build-time public variables.
- Supabase needs to be network-reachable from Docker. A local PostgreSQL server
  would require a Docker-accessible hostname, not a host-only `localhost`.
- Uploaded files should use the existing Supabase Storage integration. Files
  written only to the container filesystem are not persistent across recreations;
  legacy `public/uploads` files are intentionally excluded from builds.
- Existing `vercel.json` scheduled routes are **not scheduled by Docker**.
  Configure an external scheduler if running exclusively outside Vercel.
- This Docker setup does **not** alter the app's default Vercel build; standalone
  output is enabled only when building the Docker image.
