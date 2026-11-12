# syntax=docker/dockerfile:1

# Build Next.js and generate the Prisma Client.
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Prisma and TLS connections require system certificates/OpenSSL.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Only PUBLIC browser variables belong in Docker build arguments.
# Server-side secrets must be provided when the container runs.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
ARG NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY} \
    NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=${NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN} \
    NEXT_PUBLIC_POSTHOG_HOST=${NEXT_PUBLIC_POSTHOG_HOST} \
    DOCKER_BUILD=1

RUN test -n "$NEXT_PUBLIC_SUPABASE_URL" \
    && test -n "$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
    || (echo "Supply NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY as build args." >&2; exit 1)

# This URL only lets Next.js initialize DB-dependent modules during build.
# It is NOT used at runtime and no migrations are executed.
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build npm run build

# The standalone output includes the runtime files traced by Next.js.
FROM node:22-bookworm-slim AS runner

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

# Ensure the generated Prisma Client is present even if output file tracing
# omits part of its dynamically loaded files.
COPY --from=builder --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma

USER node

EXPOSE 3000

CMD ["node", "server.js"]
