# Piko

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Developers and small product teams measuring websites, CLIs, and developer tools they operate. They check usage, investigate individual events, and manage collection. These answers are derived from the user's product brief; the user explicitly delegated the setup interview.

## Product Purpose

Provide a clear, minimal, self-hosted view of product usage. Success means moving from a product-level trend to a useful event breakdown or an individual event without losing context.

## Positioning

Websites and developer tools are equal first-class products, with one typed event model and product-scoped storage. Collection does not require a URL or infer identity from IP/user-agent information.

## Operating Context

Overview for regular checks, Explore for server-side queries and event inspection, Settings for product metadata, retention, ingestion keys, and integration snippets. Persistent product/date selection; optional live refresh through Tako durable channels. Desktop is the main work surface; mobile supports inspection and management. Daily use by developers is an inference from the brief, not user research.

## Capabilities and Constraints

Two Tako applications: Rust API and TanStack Start dashboard. Per-product DuckDB analytics; SQLite application state. Preserve bounded ingestion, durable acknowledgments, typed queries, deduplication, and external authentication through Cloudflare Access. No new backend scope for this redesign. Bun tooling only; MIT license.

Light, Dark, and Auto themes, Hugeicons, accessible shadcn primitives, Recharts, and server-paginated tables remain. Existing privacy controls and stable refresh behavior must survive. No log search, funnels, session replay, dashboard builders, or multi-user administration in v1.

## Brand Commitments

Piko is the working name. Retain its three-stroke mark and matching favicon. The user rejects the current corporate blue visual style and asks for something fresh that does not look like a stock shadcn interface. Use straightforward product language and keep analytics terminology accurate.

## Evidence on Hand

Working sample website and CLI datasets; functional ingestion/query examples; automated verification in tests/ and docs/verification.md. Demo values are sample data, not customer claims. No testimonials, paying-customer claims, or new performance claims should be invented.

## Product Principles

- Minimize collection and make identity an explicit choice.
- Put product context and useful data before decorative framing.
- Give websites and tools equally capable workflows.
- Keep state stable during refresh and make pending/error states truthful.
- Prefer a small, comprehensible tool over expanding feature scope.

## Accessibility & Inclusion

Preserve keyboard access, semantic controls, visible focus, reduced-motion support, readable contrast, and narrow-screen layouts. These are implementation commitments inferred from the existing product requirements.
