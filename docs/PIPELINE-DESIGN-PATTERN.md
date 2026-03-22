# Pipeline Design Pattern

Standard UI pattern for admin views across Southland properties. Derived from the pipeline implementations in `southland-inventory` (quotes, leads, operations, dashboard).

## Design Principles

1. **No useless color.** Color must encode data — a status, a health score, a threshold. If removing the color loses no information, remove the color.
2. **No pills.** Pill-shaped buttons (`border-radius: 9999px`) are ugly. Use **filled rectangular buttons** with subtle rounding (`border-radius: 6px`) instead. Selected state = solid fill, not outline.
3. **Cards are for marketing.** Admin/ops pages use tables. If you can compare rows, it's a table.
4. **Density over whitespace.** Admin users scan 10-50 rows. Don't waste vertical space on padding and decoration.
5. **Every column earns its place.** If the data doesn't change across rows or doesn't drive a decision, cut the column.

---

## When to Use

Use a pipeline table when displaying a list of entities with:
- Multiple comparable attributes (numbers, statuses, dates)
- Status progression (stages, health, freshness)
- Actionable next steps per row
- Filtering by category or status

---

## Anatomy

```text
┌─────────────────────────────────────────────────────────────────┐
│  Page Title                                                     │
│  10 personas · 5 live · 2 building · 1,661 customers            │
├─────────────────────────────────────────────────────────────────┤
│  Underline Tabs                                                 │
│  All (10)  Poultry (5)  Turf & Soil (4)  Waste (1)            │
│  ─────────────────────────────────────────────────              │
├─────────────────────────────────────────────────────────────────┤
│  Pipeline Table                                                 │
│  ┌───┬──────────┬─────┬─────┬───────────┬────────┬───────────┐ │
│  │ ● │ Name     │ Num │ Num │ JTBD Bar  │ Status │ Next Move │ │
│  ├───┼──────────┼─────┼─────┼───────────┼────────┼───────────┤ │
│  │ ● │ Row      │  44%│  574│ ████░░    │ Live   │ Gap text  │ │
│  │ ● │ Row      │   0%│    0│ ░░░░░░    │ Green  │ Gap text  │ │
│  └───┴──────────┴─────┴─────┴───────────┴────────┴───────────┘ │
│                                                                 │
│  ← Left border accent = health/freshness color                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Summary Line

No colored cards. Put summary metrics in a single text line under the page title. Plain text, `·` separated. Numbers speak for themselves.

```
10 personas · 5 live · 2 building · 3 greenfield · 1,661 customers · 14/60 jobs covered
```

---

## 2. Underline Tabs

Filter controls use **underline tabs** — the same pattern as `southland-inventory: /quotes/page.tsx`. A horizontal row of text tabs sitting on a `border-bottom`, with the active tab having a `border-bottom: 2px solid` in the text color. No fills, no backgrounds, no badges.

Two tab groups separated by a gap:
- **Segment group** (category): All (10), Poultry (5), Turf & Soil (4), Waste (1)
- **Status group** (stage): All, Live (5), Building (2), Greenfield (3)

Counts are inline parenthetical text, not colored badges.

### Tab states

| State    | Text color       | Border bottom              |
|----------|-----------------|---------------------------|
| Default  | `--text-tertiary`| `transparent`             |
| Hover    | `--text`         | `transparent`             |
| Selected | `--text`         | `2px solid var(--text)`   |

### CSS

```css
.tab-bar {
  display: flex;
  gap: 2rem;
  border-bottom: 1px solid var(--border);
}

.tab {
  padding: 0.5rem 0.75rem;
  margin-bottom: -1px;
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  color: var(--text-tertiary);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
}

.tab[aria-selected="true"] {
  color: var(--text);
  border-bottom-color: var(--text);
}
```

### Interaction

Client-side JS. Tabs set `aria-selected`. Rows have `data-segment` and `data-status` attributes. Filtering toggles `display: none` on non-matching rows.

---

## 3. Pipeline Table

### Structure

```html
<div class="table-wrap">       <!-- overflow-x: auto, border, border-radius -->
  <table class="pipeline-table">
    <thead>...</thead>          <!-- sticky, surface background -->
    <tbody>
      <tr class="pipeline-row"  <!-- clickable, left border accent -->
          data-segment="..."
          data-status="..."
          data-href="/detail/url/"
          style="border-left: 4px solid {healthColor}">
```

### Left Border Accent

The defining visual element. 4px left border on every row, color-coded by health/freshness. **This is the one place color earns its keep** — it gives you a scannable heatmap down the left edge.

| Health          | Color     | Hex       |
|-----------------|-----------|-----------|
| Good (>50%)     | Emerald   | `#10b981` |
| Warning (20-50%)| Amber     | `#f59e0b` |
| Danger (<20%)   | Red       | `#ef4444` |

Derived from `southland-inventory` leads pipeline where freshness determines the left border (green = active, amber = stale 7d+, red = expired 30d+).

### Column types

| Type | Alignment | Font | Notes |
|------|-----------|------|-------|
| **Entity** (name + subtitle) | Left | Name: 600 weight. Subtitle: 0.75rem tertiary. | Colored dot for persona identity |
| **Number** | Right | 600 weight, `tabular-nums` | Right-align so digits line up across rows |
| **Progress bar** | Left | 6px bar + label below | Segmented: green/amber/red |
| **Status TOKEN** | Left | Filled badge, `border-radius: 4px`, 0.72rem, 600 weight | **Not a pill.** Rectangular with slight rounding. |
| **Next action** | Left | 0.8rem, secondary, 2-line clamp | The most important column — what to do next |

### Status TOKEN

Filled badge. **`border-radius: 4px`, not `9999px`.**

```css
.status-token {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: 4px;
  font-size: 0.72rem;
  font-weight: 600;
  border: 1px solid;
}
```

Color follows the TOKEN system (see below), but only 3 statuses matter in practice: live, building, greenfield. Don't invent more.

### Row interaction

- **Hover**: `background: var(--surface)`
- **Click**: Navigate to detail page (via `data-href`)
- **Link in name column**: Direct anchor, prevents double-navigation on click

---

## 4. Responsive

| Breakpoint | Behavior |
|-----------|----------|
| Desktop (>768px) | Full table, all columns |
| Mobile (<768px) | Hide: tagline, low-priority number columns, next move. Keep: name, status, primary metric. |

---

## TOKEN Color System

Maps semantic meaning to fill colors. **Use sparingly.** If everything is colored, nothing stands out.

```
live / success:      bg: #ecfdf5  text: #065f46  border: #a7f3d0
building / warning:  bg: #fffbeb  text: #92400e  border: #fde68a
greenfield / danger: bg: #fef2f2  text: #991b1b  border: #fecaca
neutral / info:      bg: #f9fafb  text: inherit   border: var(--border)
```

**Rule: no more than 2 colored tokens visible per row.** If you need more, the data model is wrong.

---

## Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| `border-radius: 9999px` (pill shapes) | `border-radius: 4-6px` (filled rectangles) |
| Colored summary cards | Plain text summary line. Numbers speak for themselves. |
| Colored dots / icons per row for identity | Let the name column do its job. |
| Filled button filters | Underline tabs — text only, `border-bottom: 2px`. |
| Rainbow left borders (5+ colors) | Max 3: good / warning / danger |
| Cards for admin data | Tables. Always tables. |
| Decorative color (backgrounds, borders, dividers "for visual interest") | Remove it. If it doesn't encode data, it's noise. |
| Count badges with colored backgrounds | Inline parenthetical text: "Poultry (5)" |

---

## Implementations

| Location | Pattern | Entities |
|----------|---------|----------|
| `southland-inventory: /quotes/pipeline/` | Horizontal kanban (4 columns, drag-drop) | Deals |
| `southland-inventory: /leads/pipeline/` | **Table pipeline** (this pattern) | Leads |
| `southland-inventory: /operations/ship/` | Button nav + table with stage/action lanes | Orders |
| `southland-inventory: /dashboard/` | Vertical metrics pipeline | Stages |
| **`southland-platform: /admin/personas/`** | **Table pipeline** | Personas |

---

## Checklist for New Pipeline Views

1. Define entity list with comparable attributes
2. Derive health color for left border accent (max 3 levels)
3. Derive status for TOKEN column (max 3 statuses)
4. Derive "next move" or action for last column
5. Write a plain text summary line (no colored cards)
6. Build underline tabs for filtering (no buttons, no pills)
7. Build table with sticky thead, clickable rows, left border accent
8. Cut any column that doesn't vary across rows or drive a decision
9. Count color sources per row — if more than 2, cut one
10. Add responsive hiding for non-essential columns
11. Wire click-to-navigate via `data-href`
