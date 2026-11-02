---

name: "Piko"
description: "Kanagawa Wave: sumi-ink analytics with warm text, orange actions, inset fields, and quiet shared controls."
colors:
  background: "#1f1f28"
  foreground: "#dcd7ba"
  heading: "#dcd7ba"
  card: "#2a2a37"
  card-foreground: "#dcd7ba"
  popover: "#363646"
  popover-foreground: "#dcd7ba"
  primary: "#ffa066"
  primary-foreground: "#16161d"
  primary-hover: "#ffb585"
  primary-active: "#ed925c"
  secondary: "#363646"
  secondary-foreground: "#dcd7ba"
  muted: "#363646"
  muted-foreground: "#c8c093"
  accent: "#49443c"
  accent-foreground: "#dcd7ba"
  selection: "#49443c"
  selection-foreground: "#e6c384"
  destructive: "#ff5d62"
  destructive-foreground: "#16161d"
  border: "#41414f"
  input: "#7a7888"
  ring: "#e6c384"
  surface-inset: "#1a1a22"
  surface-hover: "#363646"
  surface-pressed: "#41414f"
  success: "#98bb6c"
  subtle: "#1a1a22"
  data: "#e6c384"
  data-secondary: "#957fb8"
  data-tertiary: "#7aa89f"
  sidebar: "#16161d"
  sidebar-foreground: "#dcd7ba"
  sidebar-primary: "#ffa066"
  sidebar-primary-foreground: "#16161d"
  sidebar-accent: "#2a2a37"
  sidebar-accent-foreground: "#dcd7ba"
  sidebar-border: "#41414f"
  sidebar-ring: "#e6c384"
typography:
  display:
    fontFamily: "Geist Variable, sans-serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Geist Variable, sans-serif"
    fontSize: "28px"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Geist Variable, sans-serif"
    fontSize: "15px"
    fontWeight: 650
    lineHeight: 1.5
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Geist Variable, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  control:
    fontFamily: "Geist Variable, sans-serif"
    fontSize: "14px"
    fontWeight: 550
    lineHeight: 1.5
    letterSpacing: "normal"
  supporting:
    fontFamily: "Geist Variable, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Geist Variable, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.5
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
spacing:
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
  8: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-primary-active:
    backgroundColor: "{colors.primary-active}"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.destructive-foreground}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted-foreground}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-link:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  input:
    backgroundColor: "{colors.surface-inset}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "36px"
  select:
    backgroundColor: "{colors.surface-inset}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "36px"
  navigation-active:
    backgroundColor: "color-mix(in oklab, var(--primary) 12%, var(--sidebar))"
    textColor: "{colors.sidebar-primary}"
    rounded: "{rounded.md}"
    padding: "8px"
    height: "36px"
  badge-outline:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  card-contained:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.xl}"
    padding: "20px 24px"
  overview-widget:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    padding: "20px"
  measurement-field:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "0px"
    padding: "20px 0"
  breakdown-row:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    padding: "0 10px"
    height: "36px"
    rounded: "0px"
  segmented-group:
    backgroundColor: "{colors.surface-inset}"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.lg}"
    padding: "3px"
  segmented-selected:
    backgroundColor: "{colors.selection}"
    textColor: "{colors.selection-foreground}"
    rounded: "{rounded.sm}"
    padding: "0 10px"
    height: "28px"
  tabs-line:
    backgroundColor: "transparent"
    textColor: "{colors.muted-foreground}"
    rounded: "0px"
    height: "36px"
  tabs-line-active:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    rounded: "0px"
    height: "36px"
---

# Design System: Piko

## Overview

**Creative North Star: "Kanagawa Wave"**

Piko is a compact measurement tool using the user-selected Kanagawa palette. Sumi-ink surfaces and warm Fuji text frame Surimi Orange actions, Carp Yellow measurements, violet/aqua source categories, and green outcomes. Self-hosted Geist, softly squared controls, inset fields, single-frame segmented choices, and the upright three-bar mark give the interface its precise, quiet character. Accessible shadcn Base UI primitives and Hugeicons provide the shared component language.

Analytical regions use flat surfaces, fine seams, aligned labels, and tabular values. Overview groups related evidence into six square widgets; Explore retains its open analytical field. Editing and inspection use contained surfaces where boundaries clarify the task. Density serves reading: supporting context remains visible, and loading states preserve the geometry of the result they will replace. One palette is present in server-rendered HTML and CSS. There is no appearance selector, theme preference, or system-theme listener.

**Key Characteristics:**

- Sumi-ink surfaces, warm text, orange actions, and yellow/violet/aqua data accents.
- Geist typography with restrained headings and prominent measurements.
- Flat analytical fields and square Overview widgets; contained forms and inspection.
- Softly squared controls, inset fields, warm selection, one focus outline, and stable geometry.

## Colors

The palette is drawn from the [official Kanagawa colors](https://github.com/rebelot/kanagawa.nvim/blob/master/lua/kanagawa/colors.lua), with semantic interaction states derived for the built interface. Frontmatter values are normative. Piko uses one dark Wave palette, with warm primary accents and bounded data colors. All components use semantic CSS variables; foreground aliases resolve to their actual values in the frontmatter.

### Primary

- **Surimi Orange** (`primary`): filled primary actions, active navigation text, active tab underlines, and the shared logo/favicon. Sumi-ink text (`primary-foreground`) keeps filled controls readable. Explicit `primary-hover` and `primary-active` tokens provide brighter hover and deeper pressed states.
- **Carp Yellow** (`data`, `ring`, `selection-foreground`): time-series strokes, the first source category, a visible keyboard outline, and warm selected-choice text.

### Secondary

- **Seasonal categories** (`data-secondary`, `data-tertiary`): Oni Violet and Wave Aqua for additional sources. Exact labels and values remain available independently of color.
- **Winter Yellow field** (`accent`, `selection`): muted warm emphasis, selected choices, and proportional breakdown fills. `accent-foreground` retains warm body text while `selection-foreground` emphasizes the chosen value.
- **Spring Green** (`success`): successful outcomes and healthy-state indicators.
- **Peach Red** (`destructive`): errors and destructive actions, with dark foreground on filled destructive controls.

### Neutral

- **Sumi-ink workspace** (`background`, `sidebar`, `subtle`): layered dark surfaces, with a deeper sidebar.
- **Working surface** (`card`, `card-foreground`): contained widgets and editing regions with warm text.
- **Floating surface** (`popover`, `popover-foreground`): brighter sumi ink for select menus, with its own readable foreground.
- **Quiet controls** (`secondary`, `muted`, `surface-hover`): subordinate actions and neutral hover fields. `surface-pressed` is the stronger pressed neutral; `surface-inset` gives fields and grouped choices a recessed ground.
- **Fuji White** (`foreground`, `heading`): warm primary text and measurements.
- **Old White** (`muted-foreground`): readable supporting text, axes, and metadata.
- **Fine seam** (`border`, `sidebar-border`): passive divisions and container boundaries.
- **Field stroke** (`input`): stronger boundaries on editable controls; hover moves to supporting-text color.

**The Measured Color Rule.** Orange marks actions and destination selection; yellow, violet, and aqua distinguish measurements; green and red label outcomes. Selected choices and keyboard focus use warm yellow within the same palette.

## Typography

**Display and Body Font:** Geist Variable, with sans-serif fallback.
**Code Font:** the platform monospace stack for identifiers, properties, snippets, and raw values.

**Character:** one compact sans-serif family gives the interface an approachable, precise voice. Weight and alignment carry hierarchy; oversized display typography does not compete with the data.

### Hierarchy

- **Display:** the frontmatter display role is a metric value, not a marketing headline. Its size reduces at narrower widths while tabular numerals preserve alignment.
- **Headline:** page titles, compact and slightly tightened; the narrow layout uses a small size reduction.
- **Title:** chart, card, and section headings share a steady, moderately bold scale; Overview uses a smaller widget-title treatment recorded in its surface brief.
- **Body:** controls and general interface text.
- **Supporting:** page explanations, with a measured line length of up to (65ch).
- **Label:** field labels, metadata, legends, and table headers. Labels use sentence case; chart ticks and secondary table annotations can use the observed smaller (11px) treatment.

The logo is a distinct wordmark treatment, not an additional heading scale. Use monospace only where a literal identifier or code structure benefits from it.

**The Value Alignment Rule.** Use tabular numerals for measurements, percentages, durations, and times that readers compare across rows.

## Layout

The persistent shell places a deeper sumi-ink rail beside a continuous workspace. The expanded rail is (15rem), the collapsed rail (3.5rem), and controls share the report heading’s content grid rather than a separate top bar. Content centers within a maximum width of (1480px), with the observed desktop gutter (32px). Small gaps group labels and actions; the repeated spacing scale in frontmatter governs fields, sections, and container padding.

The sidebar owns project selection, destination navigation, and a visible source list. All sources and individual source rows are mutually exclusive scope controls; their active treatment is quieter than active destination navigation. Source lists scroll independently, long names truncate with accessible full labels, and real retention information anchors the footer. Desktop navigation rows are (36px), collapsed rows (32px), and mobile drawer rows at least (40px). The sidebar supplies project/source context; report headings sit beside dates and refresh. At (1150px) and below, controls move to their own row inside the same content layout. Settings omits dates and refresh. Mobile moves source selection into the drawer. Connection status and version/license text are not product chrome.

Overview is a collection of six equally sized square widgets: activity, sources, breakdowns, identified actors, outcomes, and duration. A shared Hourly/Daily/Weekly/Monthly button group controls its two time series; metric and dimension choices live in the corresponding widgets. The three-column grid becomes two columns at an available container width of (870px), then one at (550px), with a readable minimum-height fallback below (300px). Weekly/monthly queries aggregate raw events on the server, with UTC calendar labels and partial-boundary notes. Empty ranges retain the six sections and their controls. This is the user-requested Overview composition, not a universal page layout; its detailed hierarchy and geometry belong in the Overview surface brief. Settings uses enclosed editing regions. Explore is one implemented expression: a shallow query region, a result count, a two-thirds plot and one-third categorical breakdown, then the event stream. Its desktop plot and compact rows support the first viewport; those dimensions are surface-specific and remain in the surface brief rather than becoming universal chart or table tokens.

At (1150px) and below, Explore's results stack and query controls wrap. At (800px) and below, Settings regions stack. Overview responds to its available container width as described above. Below (768px), navigation becomes a sheet. At (640px) and below, toolbar controls wrap, page gutters become (16px), and buttons, selects, and inputs have a minimum height of (40px). The compact event view retains event/context columns and inline time; inspection exposes full metadata. Loading layouts retain the content's regions instead of replacing the whole page with an unrelated spinner.

## Elevation & Depth

Analytical regions and cards stay flat. Primary and destructive actions have a soft, shallow shadow; fields read as inset through their darker surface, without a bevel. Menus and dialogs use progressively wider soft shadows. Depth communicates temporary overlay hierarchy, while container seams organize persistent content. The chart's faint yellow area fill remains a data treatment.

### Shadow Vocabulary

- **Control** (`elevation-control`): `0 1px 2px rgb(0 0 0 / 16%)`, used by filled primary and destructive actions.
- **Menu** (`elevation-menu`): `0 8px 24px rgb(0 0 0 / 28%)`, used by select menu surfaces.
- **Dialog** (`elevation-dialog`): `0 20px 60px rgb(0 0 0 / 40%)`, used by modal dialogs and sheets.
- **Flat surfaces:** cards, analytical fields, navigation, grouped choices, outline/secondary/ghost actions, and metadata have no resting shadow.

**The Shared Ground Rule.** Keep analytical regions flat and aligned. Fine boundaries group related measurements; reserve soft elevation for filled actions and temporary overlays.

## Shapes

Controls and navigation use softly squared medium corners; small badges and choices nested inside a group use the small corner. Menus and grouped-choice frames use the large corner, while contained cards, dialogs, and Overview widgets use the extra-large corner. The frontmatter radius scale is normative. Open analytical fields, proportional bars, and line-tab underlines remain square. Small circular status dots remain purposeful status marks. The upright three-bar logo and favicon are the same `/favicon.svg?v=7` asset, with a Surimi Orange tile and dark sumi-ink bars.

Thin borders define forms and seams. A stronger input stroke distinguishes editable fields from passive separators. Select triggers are one continuous field with an inline arrow. Segmented choices have one outer frame, internal spacing, and a selected fill; individual options do not acquire independent frames. Overview widgets retain their square aspect ratio without a resting shadow.

## Components

### Buttons

Compact actions with stable geometry. Primary buttons use Surimi Orange and the dark primary foreground; destructive actions use their own semantic pair. Both use the control shadow. Outline actions have a transparent face and field stroke, secondary actions use the neutral secondary surface, ghost actions start with supporting text, and links use primary-colored text with a hover underline. All share the medium corner and a label weight of (550).

Primary hover and press use their dedicated state tokens. Outline and ghost variants use hover/pressed surfaces; secondary controls move from secondary to pressed, then inset. State changes affect color rather than position. The default height is (36px), with (24px), (32px), and (40px) size variants and matching icon-only sizes. Disabled controls reduce opacity to (50%) and stop pointer interaction. Keyboard focus uses the shared ring outline (2px) with an offset (3px), without a second shadow ring. Color transitions run for (160ms) with ease-out timing and honor reduced motion.

### Chips

Small field labels. Source, type, and filter badges use a compact squared badge with the outline or secondary treatment. Status badges can use semantic success/destructive treatments. Keep real source and identity language visible; badge shape does not imply that every label is an action.

### Cards / Containers

Contained editing cards use the card and card-foreground pair, a fine border, the extra-large corner, vertical padding (20px), and horizontal content padding (24px). Their headers size to their actual content. Open analytical variants remove the surrounding card shell and align headings and content on the same field. Overview uses a dedicated square container with the card surface, a fine border, the same extra-large corner, and equal padding from the frontmatter; the body flexes between a steady header and footer. Cards remain flat; menus and dialogs own the larger soft shadows.

### Inputs / Fields

Clear, compact instruments. Inputs and select triggers share the inset surface, field stroke, and medium corner. Input text uses (14px) at desktop widths and (16px) below the medium breakpoint. Selects place a small arrow inline after their label; no separate arrow compartment or divider appears. Labels retain leading icons, truncate safely, and keep existing widths and nonmodal behavior. Hover strengthens the border; an open select uses the hover surface and ring-colored border without moving its anchor or removing the page scrollbar.

Selected menu items use the selection field and warm selection foreground; highlighted items use the accent field, and the selected indicator is orange. Select menus use the popover pair, large corner, and menu shadow. Form labels, nearby helper/error text, destructive invalid boundaries, visible focus, and the (40px) narrow-screen minimum remain. Disabled fields reduce opacity and stop interaction.

### Navigation

The three destinations sit on the deeper sumi-ink rail. Active links use an orange tint mixed into the sidebar ground (12%), orange text, and the built stronger weight (650); hover raises the tint to (17%). Inactive hover uses the sidebar accent. Navigation remains flat with the medium corner. The rail can collapse to icons with labels available accessibly; on mobile it opens as a sheet. Use the shared straight three-bar logo asset alongside the Geist wordmark.

The sidebar retains project/source scope across destinations; report controls retain the date range within the content layout. The date range is a connected 7d / 30d / 90d group using the chart interval treatment, with one selected choice and arrow-key navigation. Drilldowns show a selected Fixed dates segment until a rolling range is chosen. The footer contains retention context and Documentation; no theme selector appears in expanded, collapsed, or mobile navigation.

### Tabs

Line tabs sit on a shared bottom seam with transparent faces. The selected tab uses orange text and a (2px) underline; inactive tabs use supporting text and brighten on hover. There is no active-tab frame or top highlight. The default tab variant uses an inset group surface and a warm selected fill. Preserve keyboard navigation, explicit focus, and existing dimensions.

Connected toggle groups use one large-corner frame on the inset surface, padding (3px), and a gap (2px). Their borderless options have small corners and a desktop height of (28px). Warm selected text and a selection fill indicate the active interval or date range. Chart groups expand their options to the existing (40px) minimum on narrow screens.

### Shared measurements and event inspection

Time series use an angular single-series line with linear interpolation, the Carp Yellow stroke, light horizontal grid marks, muted axes, and a faint yellow area fill. Overview adds source and outcome donuts paired with labeled values; their center labels summarize rather than replacing the exact legend and footer values. Breakdown rows place the proportional accent fill behind the label and align values and shares on the right. Event tables use a subtle header field, fine row divisions, and clear event, context, identity, and time hierarchy. The inspector contains full properties and metadata without changing the surrounding analytical identity.

### Charts

Use TanStack Charts for Overview and Explore. Line and donut colors derive from the semantic theme and its bounded source-category palette. Preserve linear plots, subtle fills, zero baselines, missing-value gaps, UTC labels, metric units, keyboard inspection, and touch scrolling. Keep plots and donuts mounted during refresh and preserve their region height while measuring. Source donuts show a compact center count and retain the exact total in the footer; source and outcome legends expose values without requiring hover. Reveal and scale animations are disabled so changing results stays immediate; reduced-motion also suppresses tooltip/axis transitions.

### Motion and loading

Transitions clarify state rather than introducing spectacle. The rail uses a short linear size/position transition; dialogs and sheets use the existing short entry/exit treatment. Reduced-motion preference disables animations and transitions. Loading uses the official Skullet package, with measured text and fixed-size SkeletonBox elements mapped to the same regions as real content. Skeleton base/highlight colors derive from foreground at (10%)/(8%), with (3px) corners and a slow shared shimmer. Skullet holds fast loads for (150ms), reveals together over (120ms), and respects reduced motion. The server-rendered rail and report controls keep their geometry through hydration, including a saved collapsed rail. No full-page skeleton, connection-state label, or version/license footer. Existing data stays visible during refresh. Only incoming data regions receive placeholders. Overview retains all six section containers while Skullet fills pending values or bodies locally; failures surface within the affected widget with a retry action. Event timezone is a browser preference in Settings; it changes table and inspector timestamps, while chart/calendar buckets and raw JSON stay UTC. Controls that require JavaScript become enabled after hydration.

## Do's and Don'ts

### Do:

- **Do** reuse semantic theme variables to preserve one consistent palette from the first server paint.
- **Do** preserve the shared upright three-bar logo/favicon, Geist, and the Kanagawa sumi-ink/orange/yellow relationship.
- **Do** align measurements and use fine dividers to connect analytical regions.
- **Do** use inset fields, single-frame segmented choices, and semantic hover/pressed/selection states.
- **Do** keep visible labels, one ring-colored focus outline, readable metadata, and touch-sized controls on narrow screens.
- **Do** preserve chart and table geometry while data loads or refreshes.
- **Do** use TanStack line and donut charts, actual event identity kinds, and truthful empty or error states.
- **Do** keep Overview widgets square and flat while preserving their exact measures, local loading, and responsive reading order.

### Don't:

- **Don't** return to a corporate blue card grid or a black neon terminal identity.
- **Don't** wrap every measurement in a raised, rounded card.
- **Don't** reintroduce beveled button faces, split-arrow compartments, individual segment frames, or filled orange destination navigation.
- **Don't** add decorative botanical imagery, faux paper textures, or ornamental glow.
- **Don't** replace useful event context with decoration or hide an actual loading failure behind a skeleton.
- **Don't** turn either the Explore composition or the Overview widget grid into a mandatory layout for every page.
