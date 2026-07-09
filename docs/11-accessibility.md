# 11 — Accessibility Strategy

## Executive Summary

**WHY:** Accessibility is both a scored evaluation criterion and a core product principle. AEGIS treats accessibility as a first-class domain — not a bolt-on. This document defines WCAG 2.1 AA compliance requirements, implementation patterns, and verification procedures.

---

## Accessibility Principles

1. **Perceivable** — Information and UI components must be presentable to users in ways they can perceive.
2. **Operable** — UI components and navigation must be operable via keyboard, assistive tech, and alternative inputs.
3. **Understandable** — Information and UI operation must be understandable.
4. **Robust** — Content must be robust enough to be interpreted by a wide variety of user agents, including assistive technologies.

---

## WCAG 2.1 AA Compliance Requirements

### Perceivable

| Criterion | Requirement | Implementation |
|---|---|---|
| 1.1.1 Non-text Content | All non-text content has text alternative | Icons have `aria-label`; confidence bars have `aria-valuenow` |
| 1.3.1 Info & Relationships | Semantic structure conveyed programmatically | `<dl>` for explainability; `role="feed"` for recommendations |
| 1.3.2 Meaningful Sequence | Reading order matches visual order | DOM order = visual order; no CSS-only reordering |
| 1.4.1 Use of Color | Color is never the sole signal | Domain badges use icon + text + color; severity uses icon + label |
| 1.4.3 Contrast | Minimum 4.5:1 for normal text, 3:1 for large | CSS variables validated; dark/light modes tested |
| 1.4.4 Resize Text | Text resizable to 200% without loss | Rem-based sizing; responsive layout |
| 1.4.11 Non-text Contrast | UI components ≥ 3:1 against adjacent colors | Buttons, inputs, focus indicators verified |

### Operable

| Criterion | Requirement | Implementation |
|---|---|---|
| 2.1.1 Keyboard | All functionality via keyboard | Tab order, Enter/Space activation, Escape to dismiss |
| 2.1.2 No Keyboard Trap | Focus never trapped | Modal dialogs return focus on close |
| 2.4.1 Bypass Blocks | Skip navigation mechanism | "Skip to main content" link |
| 2.4.3 Focus Order | Logical focus sequence | DOM order matches visual; focus managed on route change |
| 2.4.6 Headings & Labels | Descriptive headings and labels | Single `<h1>` per page; labeled form controls |
| 2.4.7 Focus Visible | Visible focus indicator | Custom `:focus-visible` ring (3px, high contrast) |

### Understandable

| Criterion | Requirement | Implementation |
|---|---|---|
| 3.1.1 Language of Page | `lang` attribute on `<html>` | Dynamic based on LanguageSelector |
| 3.1.2 Language of Parts | Language changes marked | `lang` attribute on localized content blocks |
| 3.2.1 On Focus | No context change on focus | No auto-submit, no auto-navigation on focus |
| 3.3.1 Error Identification | Errors identified and described | Form validation with `aria-describedby` error messages |

### Robust

| Criterion | Requirement | Implementation |
|---|---|---|
| 4.1.1 Parsing | Valid HTML | No duplicate IDs; proper nesting |
| 4.1.2 Name, Role, Value | Custom components expose role | Radix UI primitives; ARIA attributes where needed |

---

## Accessibility as a Domain

AEGIS treats accessibility not just as a UI concern but as an **operational domain**:

- **Accessibility Coordinator** is a first-class persona.
- **R-ACC-01** rule detects accessible route congestion and queued assistance requests.
- Recommendations are tagged and routed to the Accessibility Coordinator.
- Fan-facing notifications consider accessible formats.

---

## RTL (Right-to-Left) Support

Arabic (`ar`) is a supported language:

```css
/* Applied when lang="ar" */
[dir="rtl"] {
  direction: rtl;
  text-align: right;
}

[dir="rtl"] .recommendation-card {
  /* Mirror layout: badges, controls swap sides */
  flex-direction: row-reverse;
}
```

- `dir="rtl"` set on `<html>` when Arabic selected.
- All layouts use logical properties (`margin-inline-start` vs `margin-left`).
- Icons that imply direction (arrows) are mirrored.

---

## Assistive Technology Considerations

### Screen Readers

- Live regions: `aria-live="polite"` for new recommendations; `aria-live="assertive"` for critical alerts.
- Recommendation cards use `role="article"` with `aria-labelledby` pointing to the title.
- Confidence expressed as: "Confidence: 86 percent" (not just a visual bar).
- Evidence list is a proper `<ul>` with descriptive items.

### Keyboard Navigation

```
Tab         → Move between interactive elements
Enter/Space → Activate buttons, expand panels
Escape      → Close modals/dialogs
Arrow keys  → Navigate within select menus
```

- Focus trap within modals (approval confirmation dialog).
- Focus returned to trigger element on modal close.
- Skip-to-main-content link as first focusable element.

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Testing & Verification

### Automated

| Tool | Integration | What It Catches |
|---|---|---|
| axe-core | Vitest + @axe-core/react | WCAG violations in rendered components |
| eslint-plugin-jsx-a11y | ESLint | Static JSX accessibility issues |
| Lighthouse Accessibility | CI (optional) | Page-level audit score |

### Manual Checklist (Pre-Submission)

- [ ] Full workflow completable with keyboard only.
- [ ] Screen reader (NVDA/VoiceOver) reads recommendation cards coherently.
- [ ] Color-blind mode: all information conveyed without color alone.
- [ ] 200% zoom: no content overflow or loss.
- [ ] Arabic RTL: layout mirrors correctly, text renders properly.
- [ ] `prefers-reduced-motion`: animations suppressed.
- [ ] Skip navigation link visible on focus.
- [ ] All form controls have visible labels.

---

## Accessibility Definition of Done

- [ ] axe-core: 0 violations across all views.
- [ ] `eslint-plugin-jsx-a11y`: 0 errors.
- [ ] Keyboard-only full workflow verified.
- [ ] Manual screen reader test passed.
- [ ] RTL layout correct for Arabic.
- [ ] Contrast ratios ≥ 4.5:1 verified.
- [ ] `prefers-reduced-motion` respected.
