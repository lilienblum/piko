# Piko

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Developers and small product teams measuring websites, CLIs, and developer tools they operate. They check usage, investigate individual events, and manage collection. These answers are derived from the user's product brief; the user explicitly delegated the setup interview.

## Product Purpose

Provide a clear, minimal, self-hosted view of product usage. Success means moving from a product-level trend to a useful event breakdown or an individual event without losing context.

## Positioning

Projects group named sources from websites, mobile apps, and developer tools under one typed event model and project-scoped storage. Sources have separate ingestion keys, combined or filtered analytics, and shared project retention. All sources use the same analytics UI; source types are removed. Optional Hugeicons are visual metadata only, inferred from the name when not explicitly selected. Collection does not require a URL or infer identity from IP/user-agent information. An optional project website supplies a server-cached favicon; optional per-key origin restrictions filter browser ingestion without constraining native sources.

## Operating Context

Overview for regular checks, Explore for server-side queries and event inspection, Settings for product metadata, retention, ingestion keys, and integration snippets. Retention is configured per project in Settings, with a 365-day default for new projects; existing values are preserved. The sidebar does not display retention. Persistent project/source/date selection; automatic updates through Tako ephemeral channels, with visible-tab reconciliation when notifications are missed or unavailable. No routine refresh action is required. Desktop is the main work surface; mobile supports inspection and management. Daily use by developers is an inference from the brief, not user research.

## Capabilities and Constraints

Two Tako applications: Rust API and TanStack Start dashboard. Per-product DuckDB analytics; SQLite application state. Preserve bounded ingestion, durable acknowledgments, typed queries, deduplication, and external authentication through Cloudflare Access. No new backend scope for this redesign. Bun tooling only; MIT license.

One fixed Kanagawa Wave theme, Hugeicons, accessible shadcn Base UI primitives, TanStack Charts, and server-paginated tables remain. Theme selection and saved/system appearance preferences are removed. Existing privacy controls and stable refresh behavior must survive. No log search, funnels, session replay, dashboard builders, or multi-user administration in v1.

## Brand Commitments

Piko is the working name. The user selected Kanagawa colors and one theme without an appearance selector. Use Wave's sumi-ink surfaces and warm text, with Surimi Orange for primary actions, Carp Yellow highlights, violet/aqua chart categories, and green outcomes; avoid making the interface uniformly blue. The user requested a rebuild of the shared shadcn theme: compact softly squared controls, inset fields, single-frame segmented choices, warm selections, and restrained overlay elevation. Preserve Geist typography, the straight three-bar mark and matching favicon, flat analytical surfaces, and the six-widget Overview. Accessible shadcn Base UI primitives remain. Use straightforward product language and accurate analytics terminology.

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
