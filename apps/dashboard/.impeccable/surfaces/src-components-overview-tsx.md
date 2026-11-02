---

version: 1
slug: "src-components-overview-tsx"
primary_target: "src/components/overview.tsx"
related_targets: ["src/components/overview-widgets.tsx"]
---

# Piko Overview widgets

Scope: Overview and its widget primitives. Mode: Operate within the existing Kanagawa Wave world.
Audience: developers checking combined project activity or one source before investigating events.
Authority: the user explicitly requested a collection of square widgets with graphs, pie diagrams, and the important measurements. This supersedes the earlier Overview metric row, full-width chart, and paired breakdown composition; it does not redesign Explore, Settings, or the shell.

## Direction contract

THESIS: six equally weighted questions make a compact project snapshot: activity, sources, event dimensions, identified actors, outcomes, and duration.
OWN-WORLD: one Kanagawa Wave palette: sumi-ink surfaces, warm text, orange actions, yellow/violet/aqua charts, and green outcomes. Retain Geist, softly squared shared controls, Hugeicons, and shadcn Base UI behavior. Widgets have fine borders and no resting shadow.
STORY: choose project/source in the persistent sidebar and dates in the report heading, scan the widgets, switch a measure or dimension locally, and follow a real source or breakdown into scoped Explore results.
FIRST VIEWPORT: a shared interval button group sits above three square widgets across. The second row completes the six-question snapshot. No duplicated Explore action, hero chart, or full-page loading replacement.
FORM: user-specified equal-square composition in an established world; no new-world seed or concept roll applies. Three columns become two at a container width of 870px and one at 550px. Below 300px, the square constraint yields to a 310px minimum height and smaller padding so content remains usable.

## Built hierarchy

1. **Activity over time:** selected whole-range measure, metric selector, native TanStack line/area chart, UTC bucket and partial-period note. The selected measure changes the headline and plot, not unrelated widgets.
2. **Sources:** native TanStack donut, compact center total, exact total in the footer, and exact count/share legends. Show the top three sources plus Other sources calculated from the whole event total, including groups omitted by the API's top-group limit. Only actual source rows drill down.
3. **Breakdown:** dimension selector, scrollable ranked bars, count/share columns, and exact range total. Event names are the default; pages, commands, referrers, campaigns, screens, versions, OS, and architecture remain available.
4. **Identified actors:** distinct identities for the whole range, website sessions when present, and separate visitor/installation/other identity bars. Optional IDs and missing identity are explicit; daily distinct counts are never added to invent a whole-period count.
5. **Success rate:** succeeded/failed donut and labeled percentages among events with a boolean success property. Missing outcomes show an explanation, never a fabricated success rate.
6. **Duration:** Average/p95 button group, whole-range numeric duration, its native time series, and the other duration statistic in the footer. Non-numeric values are excluded; missing values remain gaps.

## Geometry and color

Widgets use a 1:1 aspect ratio, 20px padding, a 12px corner, the card surface, and a fine semantic border. Grid spacing is 16px. Headers, flexible bodies, and reserved footers prevent results or local messages from changing the outer geometry. Widget headings are 14px/600; headline values are 32px/600 with tabular numerals and compact line height. These are Overview treatments, not a new mandatory layout for every screen.

Time series retain Carp Yellow strokes, subtle area fills, sparse axes, and linear interpolation. Sources use Carp Yellow, Oni Violet, and Wave Aqua for the first three categories, with muted ink for Other; category labels carry meaning independently of color. Outcome colors retain their success/destructive semantics. The source donut's compact 18px center avoids ring collisions while its footer and legends retain exact counts.

## States and interaction

Keep all six sections and the shell mounted during loading. Use the installed Skullet measured text and local box placeholders only for pending content. New scope/measure selections must not relabel old results. Refreshing an unchanged scope retains values, plots, and geometry; errors remain visible within the affected widget with a Retry action.

One Hourly/Daily/Weekly/Monthly group controls both time series. The server performs each aggregation; hours are unavailable beyond 31 days, weeks start Monday, and calendar labels stay UTC. Project/source/date scope applies consistently to every widget and drilldown. Native chart keyboard inspection and Escape dismissal, touch scrolling, labeled legends, visible focus, and reduced-motion behavior remain supported.

No new backend, collection, dashboard-builder, or identity features are implied. Explore and Settings retain their established compositions.
