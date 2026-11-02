---

name: "Piko"
description: "Kanagawa Wave: a single sumi-ink theme with warm text, orange actions, yellow highlights, and seasonal chart accents."
colors:
  background: "#1f1f28"
  foreground: "#dcd7ba"
  heading: "#dcd7ba"
  card: "#2a2a37"
  primary: "#ffa066"
  primary-foreground: "#16161d"
  secondary: "#363646"
  muted: "#363646"
  muted-foreground: "#c8c093"
  accent: "#49443c"
  destructive: "#ff5d62"
  destructive-foreground: "#16161d"
  border: "#54546d"
  input: "#938aa9"
  success: "#98bb6c"
  subtle: "#1a1a22"
  data: "#e6c384"
  data-secondary: "#957fb8"
  data-tertiary: "#7aa89f"
  control-highlight: "#54546d"
  control-edge: "color-mix(in oklab, var(--input) 65%, var(--background))"
  sidebar: "#16161d"
  sidebar-foreground: "#dcd7ba"
  sidebar-primary: "#ffa066"
  sidebar-primary-foreground: "#16161d"
  sidebar-accent: "#2a2a37"
  sidebar-accent-foreground: "#dcd7ba"
  sidebar-border: "#54546d"
  sidebar-ring: "#ffa066"
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
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "-0.01em"
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
  sm: "3px"
  md: "4px"
  lg: "6px"
  xl: "6px"
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
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    height: "36px"
  button-outline:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    height: "36px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.sm}"
    padding: "4px 12px"
    height: "36px"
  navigation-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.sm}"
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
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "20px 24px"
  overview-widget:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
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
  tabs-line:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "0px"
    height: "36px"
---

# Design System: Piko

## Overview

**Creative North Star: "Kanagawa Wave"**

Piko is a compact measurement tool using the user-selected Kanagawa palette. Sumi-ink surfaces and warm Fuji text frame Surimi Orange actions, Carp Yellow measurements, violet/aqua source categories, and green outcomes. Self-hosted Geist, shallow raised controls, framed tabs, and the straight three-bar mark preserve the existing interface character. The request changes colors and removes theme selection; it does not replace typography or page composition.

Analytical regions use flat surfaces, fine seams, aligned labels, and tabular values. Overview groups related evidence into square widgets; Explore retains its open analytical field. Editing and inspection use contained surfaces where boundaries clarify the task. Density serves reading: supporting context remains visible, and loading states preserve the geometry of the result they will replace. One palette is present in server-rendered HTML and CSS. There is no appearance selector, theme preference, or system-theme listener.

**Key Characteristics:**

- Sumi-ink surfaces, warm text, orange actions, and yellow/violet/aqua data accents.
- Geist typography with restrained headings and prominent measurements.
- Flat analytical fields and square Overview widgets; contained forms and inspection.
- Tactile squared controls, explicit focus, and stable loading geometry.

## Colors

The palette is drawn from the [official Kanagawa colors](https://github.com/rebelot/kanagawa.nvim/blob/master/lua/kanagawa/colors.lua). Frontmatter values are normative. Piko uses one dark Wave palette; the user's later feedback selects warm primary/accents instead of blue controls. All components use semantic CSS variables.

### Primary

- **Surimi Orange** (`primary`): filled actions, active navigation, focus rings, and the shared logo/favicon. Sumi-ink text (`primary-foreground`) keeps filled controls readable.
- **Carp Yellow** (`data`): time-series strokes and the first source category.
- **Seasonal categories** (`data-secondary`, `data-tertiary`): Oni Violet and Wave Aqua for additional sources. Exact labels and values remain available independently of color.
- **Spring Green** (`success`): successful outcomes and healthy-state indicators.

### Secondary

- **Winter Yellow field** (`accent`): a muted warm selection field and proportional breakdown fill.
- **Quiet controls** (`secondary`, `muted`): raised sumi-ink surfaces; outlined actions remain subordinate to filled orange actions.
- **Peach Red** (`destructive`): errors and destructive actions, with dark foreground on filled destructive controls.

### Neutral

- **Sumi-ink workspace** (`background`, `sidebar`, `subtle`): layered dark surfaces, with a deeper sidebar.
- **Working surface** (`card`): lighter sumi ink for fields, widgets, popovers, and editing regions.
- **Fuji White** (`foreground`, `heading`): warm primary text and measurements.
- **Old White** (`muted-foreground`): readable supporting text, axes, and metadata. Do not use the palette's darker comment gray for small interface labels.
- **Fine seam** (`border`, `sidebar-border`): passive divisions and container boundaries.
- **Spring Violet stroke** (`input`): visible boundaries on interactive controls.

**The Measured Color Rule.** Orange marks actions and selection; yellow, violet, and aqua distinguish measurements; green and red label outcomes. Keep surrounding surfaces in sumi ink and do not make every control or chart blue.

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

Analytical regions stay flat. Interactive controls use shallow, crisp depth inspired by the buttons and framed elements on [turbopuffer](https://turbopuffer.com/): a fine top highlight, squared face, and short lower edge. This distinction makes actions visible without raising every data region. Modal dialogs and sheets retain their existing larger shadow; the chart's faint yellow area fill remains a data treatment.

### Shadow Vocabulary

- **Control face:** an inset top highlight and a (2px) solid lower edge. Primary and destructive highlights mix their respective foreground at (18%); neutral controls use `control-highlight`. `control-edge` mixes input stroke (65%) with the workspace ground.
- **Pressed:** the lower edge reduces to (1px) and the face becomes inset. Enabled action buttons move down (1px) only when reduced motion is not requested. Selects change depth without moving their popup anchor.
- **Overlay:** dialogs and sheets retain the overlay shadow recorded in the sidecar.
- **Context menus:** squared select, dropdown, and popover surfaces use a crisp (3px by 3px) offset edge, recorded in the sidecar.
- **Flat surfaces:** analytical fields, cards, and metadata remain without a resting shadow. Text inputs have a faint inset upper edge.

**The Shared Ground Rule.** Keep analytical regions flat and aligned. Fine boundaries may group related measurements in Overview widgets; reserve raised depth for controls and overlays.

## Shapes

Corners are deliberately squared: raised buttons and fields use the small radius, badges and navigation items the small radius, and contained cards and overlays the large radius. Open analytical fields, proportional bars, and tab underlines remain square; Overview widgets use the medium corner without raised depth. Small circular status dots remain purposeful status marks. The upright three-bar logo and favicon are the same `/favicon.svg?v=7` asset, with a Surimi Orange tile and dark sumi-ink bars.

The select arrow compartment uses a (2px) inner corner to nest inside its (3px) outer corner and (1px) border; it is not another standalone radius token.

Thin borders define forms and seams. A stronger input stroke distinguishes editable fields from passive separators. Open chart and stream regions use transparent backgrounds and square corners. Overview widgets use the card surface and medium corner to bound each separate question without a resting shadow.

## Components

### Buttons

Compact, tactile actions. Primary buttons use warm ink with the theme's primary foreground; outline buttons use the card surface, and ghost actions remain flat. Raised variants use a (3px) corner, fine border, top highlight, and (2px) lower edge. The outline hover strengthens its boundary and uses the muted field. Pressing reduces the edge and briefly depresses enabled actions; motion runs for (120–160ms) and honors reduced motion. Disabled controls lose their raised edge, reduce opacity to (50%), and stop pointer interaction. Keyboard focus remains a primary outline (2px) with an offset (3px). Standard dimensions and small/icon variants remain unchanged.

### Chips

Small field labels. Source, type, and filter badges use a compact squared badge with the outline or secondary treatment. Status badges can use semantic success/destructive treatments. Keep real source and identity language visible; badge shape does not imply that every label is an action.

### Cards / Containers

Contained editing cards use the card surface, a fine border, the large corner, vertical padding (20px), and horizontal content padding (24px). Settings, sources, and integration cards add a stronger top border in the input color. Their headers size to their actual content. Open analytical variants remove the surrounding card shell and align headings and content on the same field. Overview uses its dedicated square container, with the card surface, a fine border, the medium corner, and equal padding from the frontmatter; the body flexes between a steady header and footer. Use the flat surface and overlay distinction from Elevation & Depth.

### Inputs / Fields

Clear, compact instruments. Inputs use a card surface, field stroke, small (3px) radius, and faint inset top edge. Selects share the raised button face and a distinct (28px) arrow compartment with a fine separator; the entire control is one trigger, not a split action. Labels have (10px) leading padding and (36px) trailing clearance, retain their leading icons, and truncate safely. Toolbar selectors use the same anatomy with medium-weight text; below (640px), their arrow compartment reduces to (24px), with (8px) leading padding and (32px) trailing clearance so common labels remain visible. Keep existing widths, heights, and nonmodal behavior stable. Opening a select insets the face and turns its arrow without shifting the trigger or removing the page scrollbar. Selected menu items use an accent fill and fine inset outline. Form labels, nearby helper/error text, invalid boundaries, explicit keyboard focus, and the (40px) narrow-screen minimum remain.

### Navigation

The three destinations sit on the deeper sumi-ink rail. Active links use the solid primary fill and primary foreground with a stronger weight (650), a fine top highlight, and the same shallow lower edge as action buttons. Inactive hover uses the sidebar accent; active hover preserves the solid selection. The rail can collapse to icons with labels available accessibly; on mobile it opens as a sheet. Use the shared straight three-bar logo asset alongside the Geist wordmark. The sidebar retains project/source scope across destinations; report controls retain the date range within the content layout. The date range is a connected 7d / 30d / 90d button group using the chart interval control treatment, with one selected choice and arrow-key navigation. Drilldowns show a selected Fixed dates segment until a rolling range is chosen. The footer contains retention context and Documentation; no theme selector appears in expanded, collapsed, or mobile navigation.

### Tabs

The line variant now uses a shared bottom rule and a framed active tab, like a small index divider. Its selected face uses the card surface, fine field border, squared top corners, and a top highlight; inactive labels stay flat. Preserve keyboard navigation, explicit focus, and existing dimensions. The segmented variant keeps its existing treatment.

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
- **Do** keep visible labels, focus outlines, readable metadata, and touch-sized controls on narrow screens.
- **Do** preserve chart and table geometry while data loads or refreshes.
- **Do** use TanStack line and donut charts, actual event identity kinds, and truthful empty or error states.
- **Do** keep Overview widgets square and flat while preserving their exact measures, local loading, and responsive reading order.

### Don't:

- **Don't** return to a corporate blue card grid or a black neon terminal identity.
- **Don't** wrap every measurement in a raised, rounded card.
- **Don't** add decorative botanical imagery, faux paper textures, or ornamental glow.
- **Don't** replace useful event context with decoration or hide an actual loading failure behind a skeleton.
- **Don't** turn either the Explore composition or the Overview widget grid into a mandatory layout for every page.
