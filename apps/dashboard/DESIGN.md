---

name: "Piko"
description: "Yuzu: a compact measurement tool with soft stone, deep charcoal, and restrained yellow accents."
colors:
  background: "#e7e8e4"
  foreground: "#2e302c"
  card: "#eff0eb"
  primary: "#33362e"
  primary-foreground: "#eee4a5"
  secondary: "#dedfd5"
  muted: "#dddfd8"
  muted-foreground: "#5d6158"
  accent: "#dddcc1"
  destructive: "#a33c37"
  destructive-foreground: "#ffffff"
  border: "#c9ccc2"
  input: "#7a8073"
  success: "#50632d"
  subtle: "#e1e3dc"
  data: "#7c691c"
  sidebar: "#ded9ad"
  sidebar-foreground: "#34362a"
  sidebar-accent: "#d2cca0"
  sidebar-accent-foreground: "#34362a"
  sidebar-border: "#c5c197"
  dark-background: "#121416"
  dark-foreground: "#e2e4de"
  dark-card: "#1b1d1f"
  dark-primary: "#d9ca62"
  dark-primary-foreground: "#272a20"
  dark-secondary: "#292c2b"
  dark-muted: "#242728"
  dark-muted-foreground: "#a5aaa4"
  dark-accent: "#30322b"
  dark-destructive: "#f2a195"
  dark-destructive-foreground: "#3b211d"
  dark-border: "#353a38"
  dark-input: "#737b74"
  dark-success: "#adbf85"
  dark-subtle: "#17191b"
  dark-data: "#d1c360"
  dark-sidebar: "#17191b"
  dark-sidebar-foreground: "#d4d8d0"
  dark-sidebar-accent: "#272b29"
  dark-sidebar-accent-foreground: "#e2e4de"
  dark-sidebar-border: "#313632"
typography:
  display:
    fontFamily: "Geist Variable, sans-serif"
    fontSize: "32px"
    fontWeight: 650
    lineHeight: 1.2
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
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
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
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "36px"
  navigation-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.sm}"
    padding: "8px"
    height: "48px"
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

**Creative North Star: "Yuzu"**

Piko is a compact measurement tool with a graphic identity. Muted yellow navigation in Light, charcoal surfaces in Dark, and ochre plots give the workspace its user-selected Yuzu character. Self-hosted Geist, squared controls, solid ink selections, and the straight three-bar mark make the identity visible beyond its palette.

Analytical regions share a continuous ground with fine seams, aligned labels, and tabular values. Editing and inspection use contained surfaces where boundaries clarify the task. Density serves reading: supporting context remains visible, and loading states preserve the geometry of the result they will replace. Light, Dark, and Auto belong to the same visual world.

**Key Characteristics:**

- Soft stone in Light, deep charcoal in Dark, ink actions, and restrained Yuzu measurements.
- Geist typography with restrained headings and prominent measurements.
- Flat analytical fields; contained forms and inspection.
- Squared controls, explicit focus, and stable loading geometry.

## Colors

The palette uses soft stone working surfaces in Light and deep, nearly neutral charcoal in Dark. Yellow is reserved for navigation tint in Light, dark-mode actions, the mark, and plotted data; it must not wash over dark surfaces or body text. Frontmatter values are normative; unprefixed tokens are Light, and matching `dark-` tokens are Dark overrides from the stylesheet. Auto follows the system preference. Components use semantic CSS variables rather than choosing theme values directly.

### Primary

- **Warm action ink** (`primary`): filled actions, active navigation, and focus outlines. In Dark, this becomes a yellow accent with dark text for readable filled controls.
- **Primary foreground** (`primary-foreground`): text on filled primary controls.
- **Success** (`success`): small healthy-state indicators, with a separate green in each theme.
- **Chart ochre** (`data`): plotted measurements and legend marks; it becomes a lighter yellow in Dark.

### Secondary

- **Navigation ground** (`sidebar`): muted yellow in Light and deep charcoal in Dark.
- **Rail hover** (`sidebar-accent`, `sidebar-accent-foreground`): hovered navigation. Active navigation instead uses the solid primary action pair.
- **Quiet field** (`secondary`, `accent`): low-chroma badges, hover fields, and quantitative breakdown fills. The two roles stay subordinate to primary actions.
- **Error red** (`destructive`, `destructive-foreground`): invalid fields, error text, and destructive status. It communicates a state rather than introducing another decorative accent.

### Neutral

- **Workspace ground** (`background`): soft stone in Light, deep charcoal in Dark.
- **Working surface** (`card`): slightly lighter stone or charcoal for fields, editing cards, popovers, and local messages. Avoid near-white glare in Light and olive tint in Dark.
- **Warm ink** (`foreground`): headings, body text, and values.
- **Quiet ink** (`muted-foreground`): explanatory text, metadata, axes, and labels.
- **Muted ground** (`muted`, `subtle`): code/context regions and table headers.
- **Fine seam** (`border`, `sidebar-border`): analytical divisions and container boundaries.
- **Field stroke** (`input`): stronger boundaries for interactive fields and outlined buttons.
- **Navigation ink** (`sidebar-foreground`): readable labels on each navigation ground.

**The Measured Color Rule.** Use ink primary for actions and navigation selection, data ochre for plotted measurements, and semantic success/destructive colors for status; keep surrounding evidence neutral.

## Typography

**Display and Body Font:** Geist Variable, with sans-serif fallback.
**Code Font:** the platform monospace stack for identifiers, properties, snippets, and raw values.

**Character:** one compact sans-serif family gives the interface an approachable, precise voice. Weight and alignment carry hierarchy; oversized display typography does not compete with the data.

### Hierarchy

- **Display:** the frontmatter display role is a metric value, not a marketing headline. Its size reduces at narrower widths while tabular numerals preserve alignment.
- **Headline:** page titles, compact and slightly tightened; the narrow layout uses a small size reduction.
- **Title:** chart, card, and section headings share a steady, moderately bold scale.
- **Body:** controls and general interface text.
- **Supporting:** page explanations, with a measured line length of up to (65ch).
- **Label:** field labels, metadata, legends, and table headers. Labels use sentence case; chart ticks and secondary table annotations can use the observed smaller (11px) treatment.

The logo is a distinct wordmark treatment, not an additional heading scale. Use monospace only where a literal identifier or code structure benefits from it.

**The Value Alignment Rule.** Use tabular numerals for measurements, percentages, durations, and times that readers compare across rows.

## Layout

The persistent shell places a muted yellow rail in Light, or charcoal rail in Dark, beside a continuous workspace. The expanded rail is (13rem), the collapsed rail (3.5rem), and the context toolbar has a minimum height of (64px). Content centers within a maximum width of (1480px), with the observed desktop gutter (32px). Small gaps group labels and actions; the repeated spacing scale in frontmatter governs fields, sections, and container padding.

Product and date context precede page-level actions. Overview places related measurements on shared rows; Settings uses enclosed editing regions. Explore is one implemented expression: a shallow query region, a result count, a two-thirds plot and one-third categorical breakdown, then the event stream. Its desktop plot and compact rows support the first viewport; those dimensions are surface-specific and remain in the surface brief rather than becoming universal chart or table tokens.

At (1150px) and below, Explore's results stack and query controls wrap. At (800px) and below, metric rows become two columns and Settings/breakdown regions stack. Below (768px), navigation becomes a sheet. At (640px) and below, toolbar controls wrap, page gutters become (16px), and buttons, selects, and inputs have a minimum height of (40px). The compact event view retains event/context columns and inline time; inspection exposes full metadata. Loading layouts retain the content's regions instead of replacing the whole page with an unrelated spinner.

## Elevation & Depth

The workspace is flat at rest. Analytical depth comes from tonal fields, thin borders, alignment, and shared seams; cards, inputs, and buttons have no resting shadow. Modal dialogs and sheets remain distinct overlays with a dimmed backdrop and the existing larger shadow. This is a scoped distinction, not a ban on elevation everywhere. The chart's faint ochre area fill is a data treatment, not a decorative surface gradient.

### Shadow Vocabulary

- **Overlay:** the dialog/sheet shadow is recorded exactly in the sidecar; it separates temporary inspection or editing from the underlying workspace.
- **Context menus:** select, dropdown, and popover surfaces use the soft context shadow recorded in the sidecar.
- **Flat controls and surfaces:** explicit `box-shadow: none` keeps the everyday work surface quiet.

**The Shared Ground Rule.** Keep analytical regions flat and aligned; reserve enclosed containers for editing, inspection, and genuinely separate context.

## Shapes

Corners are deliberately squared: ordinary buttons and fields use the medium radius, badges and navigation items the small radius, and contained cards and overlays the large radius. Analytical fields, proportional bars, and tab underlines remain square. Small circular status dots remain purposeful status marks. The upright three-bar logo and favicon are the same `/favicon.svg?v=4` asset; its fixed yellow tile and dark bars remain consistent across themes.

Thin borders define forms and seams. A stronger input stroke distinguishes editable fields from passive separators. Analytical chart, metric, and stream wrappers override the generic card silhouette with transparent backgrounds and square corners.

## Components

### Buttons

Compact and direct. Primary buttons use warm ink with the theme's primary foreground; outline and ghost buttons carry secondary actions. Standard controls use the frontmatter height and medium radius; small and icon variants remain available for dense toolbars. Primary hover reduces the fill to (90%) opacity; outline and ghost hover use the accent field. Buttons use a brief (160ms) transition. Disabled controls reduce opacity to (50%) and stop pointer interaction. Keyboard focus uses a primary outline (2px) with an offset (3px), without a shadow glow.

### Chips

Small field labels. Source, type, and filter badges use a compact squared badge with the outline or secondary treatment. Status badges can use semantic success/destructive treatments. Keep real source and identity language visible; badge shape does not imply that every label is an action.

### Cards / Containers

Contained editing cards use the card surface, a fine border, the large corner, vertical padding (20px), and horizontal content padding (24px). Settings, sources, and integration cards add a stronger top border in the input color. Their headers size to their actual content. Analytical variants remove the surrounding card shell and align headings and content on the same field. Use the flat surface and overlay distinction from Elevation & Depth.

### Inputs / Fields

Clear, compact instruments. Text inputs and select triggers use the card surface, stronger field stroke, medium radius, and standard control height. Toolbar selectors use a quieter full border, card surface, large radius (6px), and comfortable inline padding (10px). Muted leading icons and a subtle hover/open fill make the whole control readable as a button. Keep their widths stable across selections. Checked menu items use the accent field. Labels remain visible above form fields; helper and error text sits nearby. Keyboard focus uses the same explicit outline as buttons. Invalid fields use the destructive stroke, and disabled fields reduce opacity. Text inputs increase their text size below the desktop breakpoint; narrow-screen minimum control height remains (40px).

### Navigation

The three destinations sit on the muted yellow Light rail or charcoal Dark rail. Active links use the solid primary fill and primary foreground with a stronger weight (650). Inactive hover uses the sidebar accent; active hover preserves the solid selection. The rail can collapse to icons with labels available accessibly; on mobile it opens as a sheet. Use the shared straight three-bar logo asset alongside the Geist wordmark. The context toolbar retains product/date scope across destinations.

### Tabs

The line variant uses transparent ground and an ink underline for the active tab. Active text strengthens from muted to foreground; focus remains explicit. Use this quiet local navigation within analytical breakdowns and inspection, preserving the existing segmented variant where already used.

### Shared measurements and event inspection

Charts use an angular single-series line with linear interpolation, the data ochre stroke, light horizontal grid marks, muted axes, and a faint ochre area fill. Breakdown rows place the proportional accent fill behind the label and align values and shares on the right. Event tables use a subtle header field, fine row divisions, and clear event, context, identity, and time hierarchy. The inspector contains full properties and metadata without changing the surrounding analytical identity.

### Charts

Use the official Bklit UI area chart components for Overview and Explore. Chart colors derive from the existing semantic theme; the chart registry must not introduce another palette. Preserve linear plots, subtle fills, zero baselines, missing-value gaps, UTC labels, metric units, keyboard inspection, and touch scrolling. Keep the plot mounted during refresh and preserve its region height while measuring. Reveal and scale animations are disabled so changing results stays immediate; reduced-motion also suppresses tooltip/axis transitions.

### Motion and loading

Transitions clarify state rather than introducing spectacle. The rail uses a short linear size/position transition; dialogs and sheets use the existing short entry/exit treatment. Reduced-motion preference disables animations and transitions. Skeletons, chart placeholders, and pending tables preserve region dimensions; error messages and live/reconnecting/paused states remain explicit. The navigation rail and context toolbar render on the server and retain their geometry through hydration, including a saved collapsed rail. The footer also renders immediately. Only data regions use placeholders; the workspace catalog uses a quiet loading status. Retain existing results during refresh. A 150 ms visual delay prevents fast responses from flashing skeletons, following the component-level approach in [Skullet](https://skullet.lochie.me/docs#reveals); reduced-motion remains static. Controls that require JavaScript become enabled after hydration.

## Do's and Don'ts

### Do:

- **Do** reuse semantic theme variables so Light, Dark, and Auto retain the same hierarchy.
- **Do** preserve the shared upright three-bar logo/favicon, Geist, and the Yuzu ink/yellow/ochre relationship.
- **Do** align measurements and use fine dividers to connect analytical regions.
- **Do** keep visible labels, focus outlines, readable metadata, and touch-sized controls on narrow screens.
- **Do** preserve chart and table geometry while data loads or refreshes.
- **Do** use the existing line chart, actual event identity kinds, and truthful empty or error states.

### Don't:

- **Don't** return to a corporate blue card grid or a black neon terminal identity.
- **Don't** wrap every measurement in a raised, rounded card.
- **Don't** add decorative botanical imagery, faux paper textures, or ornamental glow.
- **Don't** replace useful event context with decoration or hide an actual loading failure behind a skeleton.
- **Don't** turn the Explore composition into a mandatory layout for every page.
