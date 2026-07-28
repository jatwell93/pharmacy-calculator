---
name: PharmIQ Opportunity Analysis Calculator
description: Infrastructure for Choice. Clarity for Growth.
colors:
  brand-teal: "#0F766E"
  brand-teal-light: "#14B8A6"
  brand-teal-dark: "#0D5D5A"
  brand-amber: "#D97706"
  brand-navy: "#0F172A"
  brand-sky: "#0EA5E9"
  success: "#10B981"
  warning: "#D97706"
  critical: "#EF4444"
  dead-stock: "#8B5CF6"
  surface-1: "#FFFFFF"
  surface-2: "#F8FAFC"
  surface-3: "#F1F5F9"
  surface-4: "#E2E8F0"
  border-light: "#E2E8F0"
  border-mid: "#CBD5E1"
  text-primary: "#0F172A"
  text-secondary: "#475569"
  text-muted: "#94A3B8"
typography:
  display:
    fontFamily: "Fraunces, Georgia, 'Times New Roman', serif"
    fontSize: "clamp(2.5rem, 5vw, 4rem)"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Outfit, 'DM Sans', system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Outfit, 'DM Sans', system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Outfit, 'DM Sans', system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.08em"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  2xl: "16px"
  3xl: "24px"
  full: "9999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
  8: "32px"
components:
  button-primary:
    backgroundColor: "{colors.brand-teal}"
    textColor: "{colors.surface-1}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "16px 24px"
  button-primary-hover:
    backgroundColor: "{colors.brand-teal-dark}"
    textColor: "{colors.surface-1}"
    rounded: "{rounded.lg}"
    padding: "16px 24px"
  button-secondary:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.brand-navy}"
    typography: "{typography.label}"
    rounded: "{rounded.xl}"
    padding: "16px 24px"
  card:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.3xl}"
    padding: "24px"
  total-card:
    backgroundColor: "{colors.brand-navy}"
    textColor: "{colors.surface-1}"
    rounded: "{rounded.2xl}"
    padding: "24px"
  input:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
---

# Design System: PharmIQ Opportunity Analysis Calculator

## Overview

**Creative North Star: "The Command Center"**

This surface is operational infrastructure, not a brochure. A pharmacist opens it to quantify missed professional-services revenue and leave with a plan, often between dispensing tasks. Every decision serves that job: dense-but-calm data tables, one unmistakable primary action per moment, and a single hero figure that reads as the instrument's output. The register is "Operate" — scanability, consistency, and trustworthy numbers outrank expression, and the brand lives in precise details rather than decoration.

The system pairs an editorial serif (Fraunces) reserved strictly for the headline moment with a geometric sans (Outfit) doing all the operational heavy lifting, over a restrained slate-neutral canvas. Teal is the one voice of action and focus; amber is scarce and means "attention/opportunity." Depth comes from an adjacent-surface ladder and hairline borders before any heavy shadow. It should never feel playful, sterile, over-decorated, or like an undifferentiated blue healthcare dashboard.

**Key Characteristics:**
- Operational density with a calm, uncluttered rhythm.
- One hero number, one primary action, one accent voice per viewport.
- Neutral slate surfaces; color earns its place by carrying status.
- Editorial serif for the headline moment only; geometric sans everywhere else.
- Depth via surface ladder + hairline borders, not shadow stacks.

## Colors

A restrained slate-neutral canvas carrying a single teal action voice, with status colors admitted only where they communicate state.

### Primary
- **PharmIQ Teal** (`#0F766E`): Primary actions, active navigation, focus, selection, links, accordion icons, and the first data series. The signal that means "act here." Hover deepens to **Teal Dark** (`#0D5D5A`).

### Secondary
- **Opportunity Amber** (`#D97706`): Opportunity highlights, warnings, pending states, and genuine urgency only. Scarce by doctrine.
- **Sky Blue** (`#0EA5E9`): Informational highlights and secondary data roles.

### Tertiary (status)
- **Success Green** (`#10B981`): Confirmation and positive deltas.
- **Critical Red** (`#EF4444`): Errors and destructive actions.
- **Dead-Stock Violet** (`#8B5CF6`): The domain-specific dead-stock category.

### Neutral
- **Brand Navy** (`#0F172A`): Core text, the total/hero card surface, modal overlays.
- **Surface ladder**: `#FFFFFF` (surface-1, cards), `#F8FAFC` (surface-2, page/base), `#F1F5F9` (surface-3, table headers / hover), `#E2E8F0` (surface-4 / border-light).
- **Text**: primary `#0F172A`, secondary `#475569`, muted `#94A3B8` (decorative/meta only — never informational body text).

### Named Rules
**The One Voice Rule.** Teal is the only action color. If two elements compete for "click me" in a viewport, one of them is wrong.
**The Scarce Amber Rule.** If more than one amber element appears at rest in a single viewport, reassess the hierarchy — amber means attention, and attention doesn't scale.

## Typography

**Display Font:** Fraunces (with Georgia, serif fallback)
**Heading/UI Font:** Outfit (with DM Sans, system-ui fallback)
**Body Font:** Inter (with system-ui fallback)
**Mono Font:** JetBrains Mono (for PBS codes, batch numbers, inline references)

**Character:** An editorial variable serif reserved for a single authoritative headline moment, paired with a clean geometric sans that does all operational work. The pairing signals "expert infrastructure" — warm authority up top, precise machinery underneath.

### Hierarchy
- **Display** (Fraunces 600, `clamp(2.5rem, 5vw, 4rem)`, 1.05, -0.02em): The hero opportunity figure and page-defining headline. One per view.
- **Headline** (Outfit 700, 40px, -0.01em): Page title.
- **Title** (Outfit 700, 24px): Section and card headings ("AI-Powered Implementation Plan").
- **Body** (Inter 400, 16px, 1.6): All descriptions, form values, table cells. 16px minimum to prevent iOS input zoom.
- **Label** (Outfit 600, 12px, uppercase, 0.08em): Table column headers, eyebrows, button labels, plan-preference labels.

### Named Rules
**The Serif-Once Rule.** Fraunces appears exactly once per view — the hero number or headline. Everywhere else is Outfit or Inter. The serif's rarity is what makes it read as authority instead of decoration.
**The Tabular Numbers Rule.** All currency and volume figures use tabular/lining numerals (`tabular-nums`) so columns align and totals don't jitter as values change.

## Layout

Single-column, centered document capped at `max-w-screen-xl` on a `#F8FAFC` base, with the working surface as a white `rounded-3xl` card (padding 24px mobile / 40px desktop). The four service categories are an accordion stack; each open panel holds a horizontally scrollable data table (`overflow-x-auto`) so dense fee/volume grids reflow on mobile instead of breaking the page. Spacing follows a 4px-based rhythm (4/8/12/16/20/24/32). Density is deliberately high inside tables and calm between sections — generous vertical separation between the four Parts, tight rhythm within a row.

## Elevation & Depth

Primarily tonal: depth is built from the adjacent-surface ladder (surface-2 base → surface-1 cards → surface-3 table headers) and hairline `#E2E8F0` borders before any shadow. Shadows are soft, navy-tinted, and reserved for the top-level working card and hover feedback.

### Shadow Vocabulary
- **sm** (`0 1px 3px rgba(15,23,42,0.10), 0 1px 2px rgba(15,23,42,0.06)`): Small buttons and inline controls at rest.
- **md** (`0 4px 6px rgba(15,23,42,0.07), 0 2px 4px rgba(15,23,42,0.06)`): Hover feedback.
- **lg** (`0 10px 15px rgba(15,23,42,0.10), 0 4px 6px rgba(15,23,42,0.05)`): The total/hero card and the main working card.

### Named Rules
**The Ladder-First Rule.** Reach for the next surface step and a hairline border before adding a shadow. Do not nest cards to fake depth.

## Shapes

A soft, consistently rounded language. Radii climb by role: `4px` (sm, inline), `8px` (md, inputs), `12px` (lg, primary buttons), `16px` (xl/2xl, secondary buttons and the total card), `24px` (3xl, the main working card), `9999px` (pills/badges). Borders are hairline (1px, `#E2E8F0`) and do structural work; heavier strokes are avoided.

## Components

### Buttons
- **Shape:** Rounded (primary `12px`; secondary `16px`).
- **Primary:** Teal (`#0F766E`) fill, white text, Outfit label, padding `16px 24px`, `shadow-sm`.
- **Hover / Focus:** Deepen to Teal Dark (`#0D5D5A`), lift to `shadow-md`; visible focus ring required.
- **Secondary:** White fill, navy text, `1px` `#E2E8F0` border, `16px` radius — used for lower-emphasis actions like "Review Plan Data."

### Cards / Containers
- **Working card:** White, `rounded-3xl` (24px), `1px` light border, `shadow-xl`, padding 24–40px. The page's single frame.
- **Total / hero card:** Navy (`#0F172A`) fill, white text, `rounded-2xl` (16px), `shadow-lg` — carries the headline opportunity figure in Display type.
- **Border:** Hairline `#E2E8F0`. Do not nest cards.

### Inputs / Fields
- **Style:** White fill, `1px` `#CBD5E1` border, `8px` radius, Inter 16px value text.
- **Focus:** Teal border shift + focus ring. Numeric current/potential-volume fields use tabular numerals.

### Data Tables
- **Header:** `#F1F5F9` background, Outfit 12px uppercase labels (`0.08em`), muted text, hairline bottom divider.
- **Body:** Inter, tabular numerals for all fee/volume/currency columns, row dividers in `#E2E8F0`.
- **Responsive:** Wrapped in `overflow-x-auto`; the page body never scrolls horizontally.

### Accordion (signature)
The four service categories (Government-Funded Programs, Vaccinations, Pharmacy Programs & Services, Biologics) are accordion sections. Header buttons carry Outfit `font-heading` labels, a teal chevron that rotates on expand, and full `aria-expanded` / `aria-controls` wiring.

## Do's and Don'ts

### Do:
- **Do** keep exactly one primary (teal) action per moment and one Fraunces headline per view.
- **Do** use tabular numerals for every currency and volume figure so columns stay aligned.
- **Do** build depth with the surface ladder and hairline borders first; add shadow only for the working card and hover.
- **Do** wrap dense tables in `overflow-x-auto` and keep 16px minimum input font size on mobile.
- **Do** reserve amber for opportunity/warning and keep it scarce.
- **Do** target WCAG AA, pair color states with text/icon cues, and keep visible focus states.

### Don't:
- **Don't** introduce a second action color or use teal for decoration.
- **Don't** set Fraunces on body, labels, or more than one headline — it's the serif-once voice.
- **Don't** nest cards or stack shadows to fake hierarchy.
- **Don't** let more than one amber element sit at rest in a viewport.
- **Don't** use muted `#94A3B8` for informational body text on light surfaces (fails AA alone), and **don't** put white text on amber.
- **Don't** make the tool feel like a generic blue healthcare dashboard — the brand lives in restraint and precise detail.
