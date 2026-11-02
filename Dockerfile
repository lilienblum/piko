# syntax=docker/dockerfile:1
FROM rust:1-bookworm AS api-build
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY apps/api ./apps/api
COPY sdk/rust ./sdk/rust
RUN cargo build --locked --release -p piko

FROM debian:bookworm-slim AS api
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libstdc++6 curl && rm -rf /var/lib/apt/lists/* && useradd -u 10001 -m piko && mkdir /data && chown piko /data
COPY --from=api-build /app/target/release/piko /usr/local/bin/piko
USER piko
ENV PIKO_BIND=0.0.0.0:3001 PIKO_DATA_DIR=/data
VOLUME /data
EXPOSE 3001
CMD ["piko"]

FROM oven/bun:1.4.4 AS dashboard-build
WORKDIR /app
COPY package.json bun.lock tsconfig.json ./
COPY apps/dashboard/package.json ./apps/dashboard/package.json
COPY sdk/typescript/package.json ./sdk/typescript/package.json
RUN bun install --frozen-lockfile
COPY apps/dashboard ./apps/dashboard
COPY sdk ./sdk
RUN cd apps/dashboard && bun run build

FROM oven/bun:1.4.4-slim AS dashboard
WORKDIR /app
COPY --from=dashboard-build --chown=bun:bun /app/node_modules ./node_modules
COPY --from=dashboard-build --chown=bun:bun /app/apps/dashboard ./apps/dashboard
USER bun
ENV HOST=0.0.0.0 PORT=3000
EXPOSE 3000
WORKDIR /app/apps/dashboard
CMD ["bun", "server.ts"]
