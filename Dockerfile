# Base stage with pnpm setup
FROM node:23.11.1-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# Production dependencies stage
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
# Install only production dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile --ignore-scripts

# Build stage - install all dependencies and build
FROM base AS build
COPY package.json pnpm-lock.yaml ./
# Install all dependencies (including dev dependencies)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --ignore-scripts
COPY . .
RUN pnpm run build

# Final stage - combine production dependencies and build output
FROM node:23.11.1-alpine AS runner
WORKDIR /app

# Install pnpm in the final image for migration capability
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Set NODE_ENV to production
ENV NODE_ENV=production

# Copy production dependencies
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules

# Copy built application
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/src/views ./src/views

# Copy files needed for migrations
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=build --chown=node:node /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --from=build --chown=node:node /app/src/db ./src/db
COPY --from=build --chown=node:node /app/src/public ./src/public
COPY --from=build --chown=node:node /app/src/common/utils/envConfig.ts ./src/common/utils/envConfig.ts

# Install drizzle-kit for migrations (it's a dev dependency)
RUN pnpm add -D drizzle-kit@0.31.4 && \
    pnpm store prune

# Use the node user from the image
USER node

# Expose port 8080
EXPOSE 8080

# Start the server (can be overridden with docker run command)
CMD ["node", "dist/index.js"]
