# Multi-stage build for the self-hosted (adapter-node) deployment.
# The upstream Dockerfile ran `vite dev` — this produces a real production server.
#
# PUBLIC_* are SvelteKit `$env/static/public` values, inlined at build time, so they
# arrive as build ARGs. All private values (S3 creds, DB URLs, API_SECRET_KEY) are
# `$env/dynamic/private` and are injected at runtime via the container environment —
# nothing secret is baked into this (public) image.
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build
WORKDIR /app
# Install with the schema present so the postinstall `prisma generate` succeeds.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY . .

ARG PUBLIC_ENV
ARG PUBLIC_S3_REGION
ARG PUBLIC_S3_BUCKET
ENV PUBLIC_ENV=${PUBLIC_ENV} \
    PUBLIC_S3_REGION=${PUBLIC_S3_REGION} \
    PUBLIC_S3_BUCKET=${PUBLIC_S3_BUCKET}

RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000
# Full node_modules is shipped deliberately: the generated Prisma client and its
# native query engine live under node_modules/.prisma, and a --prod prune risks
# stripping them. Correctness over image size.
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma

EXPOSE 3000
USER node
CMD ["node", "build"]
