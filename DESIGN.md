---
name: Cadence
description: Dark tablet-first personal LifeOS dashboard for daily glanceability.
colors:
  page-bg: "#101820"
  surface-card: "#1A242D"
  sidebar-glass: "#151E27EB"
  text-primary: "#E9EEF2"
  text-strong: "#D9E2E8"
  text-muted: "#B5C0C8"
  text-soft: "#87939D"
  text-faint: "#697681"
  border-subtle: "#3A4650"
  surface-muted: "#25313B"
  separator: "#FFFFFF14"
  action-blue: "#6AA7F2"
  success-green: "#73D895"
  warning-orange: "#F4B45C"
  danger-red: "#F06B62"
  focus-indigo: "#A08AF0"
typography:
  display:
    fontFamily: "var(--font-geist-mono), monospace"
    fontSize: "64px"
    fontWeight: 200
    lineHeight: 1
    letterSpacing: "-4px"
  headline:
    fontFamily: "var(--font-geist), -apple-system, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.3px"
  title:
    fontFamily: "var(--font-geist), -apple-system, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "normal"
  body:
    fontFamily: "var(--font-geist), -apple-system, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  label:
    fontFamily: "var(--font-geist), -apple-system, sans-serif"
    fontSize: "9px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.08em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "18px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "14px"
  xxl: "20px"
components:
  card:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "12px 14px"
  button-primary:
    backgroundColor: "{colors.action-blue}"
    textColor: "{colors.surface-card}"
    rounded: "{rounded.md}"
    height: "48px"
    padding: "0 16px"
  button-quiet:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.md}"
    height: "48px"
    padding: "0 16px"
  sidebar-nav-active:
    backgroundColor: "{colors.action-blue}"
    textColor: "{colors.surface-card}"
    rounded: "{rounded.sm}"
    height: "40px"
    width: "40px"
  input-field:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
---

# Design System: Cadence

## 1. Overview

**Creative North Star: "The Tablet Daily Glance"**

Cadence is a personal LifeOS dashboard designed for one real device: the Samsung Galaxy Tab A7 Lite in landscape. The interface is compact, direct, and built for repeat glances, not extended configuration on the home screen. It should answer what is coming up, what still needs attention, and how the day is tracking without making the user manage the system first.

The visual system is minimal, bold, and intuitive. It now uses a low-chroma dark tablet palette, dense card surfaces, small uppercase labels, strong status color, and mobile-native Ionic controls. Complexity is allowed, but only after the user enters a focused side view or task surface.

Cadence must not feel gamified, too corporate, cluttered, or like a generic SaaS dashboard. The rejected dark Pentagon Pizza Index / DEFCON-style direction is prohibited unless explicitly requested again.

**Key Characteristics:**
- Tablet-first density tuned for roughly 893px by 533px landscape.
- Glanceable dark cards with clear hierarchy and very little decorative chrome.
- Mobile-native controls, especially Ionic React buttons, checkboxes, list items, and touch behavior.
- Strong color only for action, state, priority, and category.
- Simple dashboard surface with deeper complexity in side navigation and focused views.

## 2. Colors

The palette is a restrained dark system: blue-tinted charcoal background, lifted dark cards, soft separators, and one dominant blue action color supported by semantic status colors. The physical scene is the owner checking a Galaxy Tab A7 Lite in landscape throughout the day, often in lower ambient light; dark mode reduces glare while keeping the dashboard calm.

### Primary
- **Signal Blue**: Primary action, selected navigation, completed todos, current-day emphasis, and informational unread state. It must stay functional, not decorative.

### Secondary
- **Focus Indigo**: Deep work, PM habits, and secondary goal identity. Use it as a category signal, never as a page-wide theme.
- **Success Green**: Completed habits, completed focus targets, and positive weekly review states.

### Tertiary
- **Attention Orange**: AM habit urgency, client or pending calendar states, and warm warning emphasis.
- **Now Red**: Current-time marker, unread count badge, high-priority attention, and destructive or alert states.

### Neutral
- **Tablet Night**: The app background. It reduces glare on the A7 Lite while keeping the surface calm, not theatrical.
- **Charcoal Surface**: Cards, list containers, inputs, and weather pills.
- **Soft Ink**: Primary text and high-value numbers.
- **Layered Grays**: Secondary text, muted labels, separators, disabled controls, and low-emphasis surfaces.

### Named Rules

**The Color Earns Its Place Rule.** Blue, green, orange, red, and indigo are reserved for state, category, priority, or action. Do not use them to decorate empty space.

**The Quiet Dark Rule.** The current system is dark by request, but it must stay quiet, low-chroma, and personal. Do not reintroduce the dark DEFCON-style direction without explicit instruction.

## 3. Typography

**Display Font:** Geist Mono through `var(--font-geist-mono), monospace`
**Body Font:** Geist through `var(--font-geist), -apple-system, sans-serif`
**Label/Mono Font:** Geist Mono for time, totals, percentages, counters, and timer numerals

**Character:** The type system is compact and operational. Geist carries labels and short text; Geist Mono gives time and progress values a stable, glanceable rhythm.

### Hierarchy
- **Display** (200, 64px, 1): Reserved for the focus timer and any similarly dominant time display.
- **Headline** (700, 15-16px, 1.25): Focused view titles, weekly review headings, and high-level labels.
- **Title** (500-600, 11-13px, 1.3-1.4): Card row titles, goal labels, event names, and task names.
- **Body** (400, 12-13px, 1.4): Supporting text, empty states, subtitles, and secondary explanations.
- **Label** (600-700, 9-11px, 0.08em-0.1em, uppercase): Card eyebrows, section labels, day labels, and compact metadata.

### Named Rules

**The No Display Labels Rule.** UI labels, buttons, rows, and data never use expressive display fonts. Use Geist or Geist Mono and let weight, size, and spacing do the work.

**The Tabular Data Rule.** Times, percentages, streaks, counters, and durations use tabular numerals or Geist Mono so values do not jitter as they update.

## 4. Elevation

Cadence uses a hybrid of tonal layering and soft ambient shadow. Cards sit on the cool page background with a low, broad shadow. Separators are hairline and quiet. Depth should help the dashboard scan faster, not create a stack of floating objects.

### Shadow Vocabulary
- **Card Ambient** (`box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.04)`): Default for dashboard cards, weather pill, and contained views.
- **Small Ambient** (`box-shadow: 0 1px 2px rgba(0,0,0,0.07)`): Use for compact controls only when a flat boundary is not enough.

### Named Rules

**The Quiet Elevation Rule.** Shadows stay soft, low contrast, and ambient. If a card looks lifted for decoration rather than separation, the shadow is too strong.

## 5. Components

### Buttons

- **Shape:** Mobile-friendly rounded rectangles with medium radius (12px) or pills for compact segmented choices.
- **Primary:** Signal Blue or the active goal color, white text, at least 48px tall where practical.
- **Hover / Focus:** State change should be color, opacity, or outline only. Do not animate layout.
- **Secondary / Ghost / Tertiary:** Quiet gray backgrounds or clear Ionic buttons for secondary operations. Destructive affordances stay muted until the user is in a management context.

### Chips

- **Style:** Small pill badges using a light tint of the semantic color and matching text color.
- **State:** Chips identify mode, goal, period, unread count, or status. They should not become collectible rewards or gamified badges.

### Cards / Containers

- **Corner Style:** Large but not playful (18px).
- **Background:** White Surface over Tablet Mist.
- **Shadow Strategy:** Card Ambient by default.
- **Border:** Use 0.5px separators inside dense lists, not heavy card outlines.
- **Internal Padding:** Dashboard cards usually sit at 12px 14px; focused views may use 16px 20px.

### Inputs / Fields

- **Style:** White background, subtle gray border, 8px radius, 10px 12px padding, and 12-14px type.
- **Focus:** Border or platform-native Ionic focus treatment. Avoid glow unless it is required for accessibility.
- **Error / Disabled:** Error uses Now Red plus text or icon support. Disabled controls use muted gray and reduced contrast, never color alone.

### Navigation

The sidebar is icon-first and narrow on the tablet dashboard: 56px wide, 40px square buttons, 10px radius, active blue fill, and a small unread dot. It uses weather and time as passive context near the bottom. Navigation should stay compact because the dashboard grid needs the horizontal space.

### Signature Component: Dashboard Card Grid

The dashboard grid is the product's main composition. It uses three columns with an 8px gap: habits, calendar plus todos, and daily goals. The grid should remain dense, predictable, and stable at the A7 Lite landscape viewport. Do not add large headers, hero content, or decorative panels to the dashboard.

## 6. Do's and Don'ts

### Do:

- **Do** design for the Samsung Galaxy Tab A7 Lite landscape viewport first.
- **Do** keep the dashboard glanceable: meetings, todos, habits, notifications, and daily goals should be readable without navigation.
- **Do** use Ionic React controls when they improve touch behavior, mobile ergonomics, or maintainability.
- **Do** keep touch targets near 48px where practical, especially primary actions, checkbox rows, and navigation buttons.
- **Do** use color with a job: action, state, priority, category, or current-time signal.
- **Do** move complexity into side menus and focused views instead of the main dashboard.

### Don't:

- **Don't** make Cadence feel gamified.
- **Don't** make Cadence feel too corporate.
- **Don't** make Cadence feel cluttered.
- **Don't** revive the dark Pentagon Pizza Index / DEFCON-style direction; this dark mode is calm tablet utility, not an alert console.
- **Don't** turn the dashboard into a command center with oversized chrome, dramatic alerts, or theatrical status panels.
- **Don't** use generic SaaS dashboard tropes, productivity-bro styling, decorative complexity, or repeated identical marketing cards.
- **Don't** rely on color alone for status; reinforce meaning with text, icon, position, or shape.
