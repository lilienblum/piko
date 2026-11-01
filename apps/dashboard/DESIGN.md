---

name: "Piko"
description: "A small measurement workbench for websites and developer tools."
colors:
background: "#f7f8f4"
foreground: "#25382e"
card: "#ffffff"
primary: "#286449"
primary-foreground: "#ffffff"
secondary: "#e9eee4"
muted: "#edf0e9"
muted-foreground: "#59685f"
accent: "#e2ebd8"
destructive: "#ad353e"
destructive-foreground: "#ffffff"
border: "#d6ddd2"
input: "#859283"
success: "#286449"
subtle: "#f1f4ed"
sidebar: "#edf0df"
sidebar-foreground: "#344331"
sidebar-accent: "#dbe5c6"
sidebar-accent-foreground: "#244c33"
sidebar-border: "#d5ddc8"
dark-background: "#171e19"
dark-foreground: "#e5ebe1"
dark-card: "#1e2821"
dark-primary: "#c1d791"
dark-primary-foreground: "#20321f"
dark-secondary: "#2c392d"
dark-muted: "#28342a"
dark-muted-foreground: "#aab7a6"
dark-accent: "#344432"
dark-destructive: "#f19b9c"
dark-destructive-foreground: "#3b2024"
dark-border: "#3c4a3d"
dark-input: "#73826e"
dark-success: "#afd1a4"
dark-subtle: "#1b251e"
dark-sidebar: "#222d23"
dark-sidebar-foreground: "#dce6d6"
dark-sidebar-accent: "#354831"
dark-sidebar-accent-foreground: "#e0ecc5"
dark-sidebar-border: "#3c4a36"
typography:
display:
fontFamily: "Public Sans Variable, sans-serif"
fontSize: "32px"
fontWeight: 620
lineHeight: 1.2
letterSpacing: "-0.025em"
headline:
fontFamily: "Public Sans Variable, sans-serif"
fontSize: "25px"
fontWeight: 680
lineHeight: 1.3
letterSpacing: "-0.025em"
title:
fontFamily: "Public Sans Variable, sans-serif"
fontSize: "15px"
fontWeight: 650
lineHeight: 1.5
letterSpacing: "-0.01em"
body:
fontFamily: "Public Sans Variable, sans-serif"
fontSize: "14px"
fontWeight: 400
lineHeight: 1.5
control:
fontFamily: "Public Sans Variable, sans-serif"
fontSize: "14px"
fontWeight: 500
lineHeight: 1.5
supporting:
fontFamily: "Public Sans Variable, sans-serif"
fontSize: "13px"
fontWeight: 400
lineHeight: 1.55
label:
fontFamily: "Public Sans Variable, sans-serif"
fontSize: "12px"
fontWeight: 500
lineHeight: 1.5
rounded:
sm: "5px"
md: "7px"
lg: "12px"
xl: "16px"
pill: "9999px"
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
backgroundColor: "{colors.sidebar-accent}"
textColor: "{colors.sidebar-accent-foreground}"
rounded: "{rounded.md}"
padding: "8px"
height: "48px"
badge-outline:
backgroundColor: "transparent"
textColor: "{colors.foreground}"
typography: "{typography.label}"
rounded: "{rounded.pill}"
padding: "2px 8px"
card-contained:
backgroundColor: "{colors.card}"
textColor: "{colors.foreground}"
rounded: "{rounded.xl}"
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
tabs-line:
backgroundColor: "transparent"
textColor: "{colors.foreground}"
rounded: "0px"
height: "36px"
---

# Design System: Piko

## Overview

**Creative North Star: "The Field-Station Workbench"**

Piko is a small measurement workbench: calm, readable, and precise enough for daily investigation. Cool stone working surfaces, pine action and data marks, and a pale citron navigation rail establish an observational character. Public Sans and the existing three-stroke Piko mark keep the identity clear without ornamental botanical imagery.

Analytical regions share a continuous ground with fine seams, aligned labels, and tabular values. Editing and inspection use contained surfaces where boundaries clarify the task. Density serves reading: supporting context remains visible, and loading states preserve the geometry of the result they will replace. Light, Dark, and Auto belong to the same visual world.

**Key Characteristics:**

- Stone ground, pine emphasis, citron orientation.
- Humanist typography with restrained headings and prominent measurements.
- Flat analytical fields; contained forms and inspection.
- Compact controls, explicit focus, and stable loading geometry.

## Colors

The palette combines cool stone and pine with a quiet citron orientation field. Frontmatter values are normative; unprefixed tokens are Light, and matching `dark-` tokens are Dark overrides from the stylesheet. Auto follows the system preference. Components use semantic CSS variables rather than choosing theme values directly.

### Primary

- **Pine** (`primary`): the main action, plotted line, focus outline, brand mark, and live indicator. In Dark, this becomes a light citron-green with dark text for readable filled controls.
- **Primary foreground** (`primary-foreground`): text on filled primary controls.
- **Success** (`success`): small healthy-state indicators; it shares pine in Light and has its own subdued green in Dark.

### Secondary

- **Citron ground** (`sidebar`): the persistent navigation region.
- **Citron selection** (`sidebar-accent`, `sidebar-accent-foreground`): flat selected and hovered navigation items, separate from the main action color.
- **Soft foliage** (`secondary`, `accent`): quiet badges, hover fields, and quantitative breakdown fills. The two roles stay subordinate to primary actions.
- **Error red** (`destructive`, `destructive-foreground`): invalid fields, error text, and destructive status. It communicates a state rather than introducing another decorative accent.

### Neutral

- **Cool stone** (`background`): the continuous workspace ground.
- **White working surface** (`card`): fields, editing cards, popovers, and local messages; a darker green-neutral surface in Dark.
- **Pine ink** (`foreground`): headings, body text, and values.
- **Quiet ink** (`muted-foreground`): explanatory text, metadata, axes, and labels.
- **Muted ground** (`muted`, `subtle`): code/context regions and table headers.
- **Fine seam** (`border`, `sidebar-border`): analytical divisions and container boundaries.
- **Field stroke** (`input`): stronger boundaries for interactive fields and outlined buttons.
- **Navigation ink** (`sidebar-foreground`): labels on the citron ground.

**The Measured Color Rule.** Use primary color for actions, focus, status, and the plotted measurement; use neutral surfaces and muted text for the surrounding evidence.

## Typography

**Display and Body Font:** Public Sans Variable, with sans-serif fallback.
**Code Font:** the platform monospace stack for identifiers, properties, snippets, and raw values.

**Character:** one humanist family gives the interface an approachable, precise voice. Weight and alignment carry hierarchy; oversized display typography does not compete with the data.

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

The persistent shell places a citron rail beside a continuous workspace. The expanded rail is (13rem), the collapsed rail (3.5rem), and the context toolbar has a minimum height of (64px). Content centers within a maximum width of (1480px), with the observed desktop gutter (32px). Small gaps group labels and actions; the repeated spacing scale in frontmatter governs fields, sections, and container padding.

Product and date context precede page-level actions. Overview places related measurements on shared rows; Settings uses enclosed editing regions. Explore is one implemented expression: a shallow query region, a result count, a two-thirds plot and one-third categorical breakdown, then the event stream. Its desktop plot and compact rows support the first viewport; those dimensions are surface-specific and remain in the surface brief rather than becoming universal chart or table tokens.

At (1150px) and below, Explore's results stack and query controls wrap. At (800px) and below, metric rows become two columns and Settings/breakdown regions stack. Below (768px), navigation becomes a sheet. At (640px) and below, toolbar controls wrap, page gutters become (16px), and buttons, selects, and inputs have a minimum height of (40px). The compact event view retains event/context columns and inline time; inspection exposes full metadata. Loading layouts retain the content's regions instead of replacing the whole page with an unrelated spinner.

## Elevation & Depth

The workspace is flat at rest. Analytical depth comes from tonal fields, thin borders, alignment, and shared seams; cards, inputs, and buttons have no resting shadow. Modal dialogs and sheets remain distinct overlays with a dimmed backdrop and the existing larger shadow. This is a scoped distinction, not a ban on elevation everywhere. The chart's faint primary-color area fill is a data treatment, not a decorative surface gradient.

### Shadow Vocabulary

- **Overlay:** the dialog/sheet shadow is recorded exactly in the sidecar; it separates temporary inspection or editing from the underlying workspace.
- **Flat controls and surfaces:** explicit `box-shadow: none` keeps the everyday work surface quiet.

**The Shared Ground Rule.** Keep analytical regions flat and aligned; reserve enclosed containers for editing, inspection, and genuinely separate context.

## Shapes

Modest rounded corners soften interactive controls, while analytical fields remain square and open. Use the medium radius for ordinary buttons and fields, the extra-large radius for contained cards, and the existing large radius for contextual/inspection regions. Pills are reserved for compact badges. The three-stroke mark and small circular status dots remain part of the vocabulary; do not generalize the pill shape to every control.

Thin borders define forms and seams. A stronger input stroke distinguishes editable fields from passive separators. Analytical chart, metric, and stream wrappers override the generic card silhouette with transparent backgrounds and square corners.

## Components

### Buttons

Compact and direct. Primary buttons use pine with the theme's primary foreground; outline and ghost buttons carry secondary actions. Standard controls use the frontmatter height and medium radius; small and icon variants remain available for dense toolbars. Primary hover reduces the fill to (90%) opacity; outline and ghost hover use the accent field. Buttons use a brief (160ms) transition. Disabled controls reduce opacity to (50%) and stop pointer interaction. Keyboard focus uses a primary outline (2px) with an offset (3px), without a shadow glow.

### Chips

Small field labels. Source, type, and filter badges use a compact pill with the outline or secondary treatment. Status badges can use semantic success/destructive treatments. Keep real source and identity language visible; badge shape does not imply that every label is an action.

### Cards / Containers

Contained editing cards use the card surface, a fine border, the extra-large corner, vertical padding (20px), and horizontal content padding (24px). Their headers size to their actual content. Analytical variants remove the surrounding card shell and align headings and content on the same field. Use the flat surface and overlay distinction from Elevation & Depth.

### Inputs / Fields

Clear, compact instruments. Text inputs and select triggers use the card surface, stronger field stroke, medium radius, and standard control height. Labels remain visible above fields; helper and error text sits nearby. Keyboard focus uses the same explicit outline as buttons. Invalid fields use the destructive stroke, and disabled fields reduce opacity. Text inputs increase their text size below the desktop breakpoint; narrow-screen minimum control height remains (40px).

### Navigation

The three destinations sit on the citron rail. Active links use the citron selection field and a stronger weight (650), without a raised capsule shadow. Hover uses the same tonal family. The rail can collapse to icons with labels available accessibly; on mobile it opens as a sheet. Keep the real Piko mark. The context toolbar retains product/date scope across destinations.

### Tabs

The line variant uses transparent ground and an ink underline for the active tab. Active text strengthens from muted to foreground; focus remains explicit. Use this quiet local navigation within analytical breakdowns and inspection, preserving the existing segmented variant where already used.

### Shared measurements and event inspection

Charts use a primary single-series line, light horizontal grid marks, muted axes, and a faint primary area fill. Breakdown rows place the proportional accent fill behind the label and align values and shares on the right. Event tables use a subtle header field, fine row divisions, and clear event, context, identity, and time hierarchy. The inspector contains full properties and metadata without changing the surrounding analytical identity.

### Motion and loading

Transitions clarify state rather than introducing spectacle. The rail uses a short linear size/position transition; dialogs and sheets use the existing short entry/exit treatment. Reduced-motion preference disables animations and transitions. Skeletons, chart placeholders, and pending tables preserve region dimensions; error messages and live/reconnecting/paused states remain explicit.

## Do's and Don'ts

### Do:

- **Do** reuse semantic theme variables so Light, Dark, and Auto retain the same hierarchy.
- **Do** preserve the three-stroke mark, Public Sans, and pine/citron relationship.
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
