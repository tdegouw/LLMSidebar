# AGENTS.md – Coding Guidelines for LLMSidebar

This document defines the vision, principles, and concrete rules for anyone (human or AI) working on the LLMSidebar codebase. It exists to protect the hard-won architectural quality of the project and to ensure that future changes increase clarity and maintainability rather than erode it.

## 1. Project Vision

LLMSidebar is a **Manifest V3 Chrome extension** that brings local LLM capabilities (primarily LM Studio) into the browser as a persistent, high-quality side panel experience.

**Core Vision:**
- Deliver a **joyful, professional-grade developer experience** in a zero-dependency, no-build vanilla JavaScript environment.
- Prove that it is possible to build a clean, scalable, well-architected browser extension **without** bundlers, frameworks, or heavy tooling.
- Create a codebase that remains understandable and pleasant to work in even after years of evolution and feature additions.
- Treat code quality, small mental load, and long-term maintainability as first-class features — on par with (or more important than) user-facing features.

The project values **small, single-purpose files** above almost everything else. The explicit goal is to prevent "mind-overflow" — the feeling that a file or module has become too complex to hold in your head comfortably.

## 2. Non-Negotiable Architectural Principles

These principles are the foundation of the project. Any change that violates them should be considered a regression unless there is an extremely strong, documented reason.

### 2.1 Small Files Philosophy
- Most files should stay **well under 200 lines**.
- The sweet spot for most modules is **80–150 lines**.
- When a file approaches or exceeds ~250 lines, this is a **strong signal** that it should be decomposed.
- Prefer many small, focused files over fewer larger ones.

### 2.2 Views Own Their DOM (Strict Ownership)
- Only modules inside `ui/` are allowed to call `document.getElementById`, `document.querySelector`, or directly manipulate DOM elements.
- No `.style.*` assignments are allowed anywhere except inside the responsible UI view module.
- The Composition Root (`app.js`) and all services/adapters **must never** touch the DOM directly.
- When a new UI section becomes complex, extract it into its own focused view (see the successful pattern used for `prompt-editor-view.js`, `language-manager-view.js`, and `reset-view.js`).

### 2.3 No Globals, Explicit Dependency Injection
- No module-level singletons.
- Everything is created via factory functions (`createXxx(deps)`).
- Dependencies are passed explicitly. `app.js` is the single Composition Root where all wiring happens.
- Prefer constructor/factory injection over service locators or global state.

### 2.4 Clear Layered Architecture
- `core/` — Pure functions with no side effects (markdown, prompts, temperature resolution).
- `adapters/` — All communication with the outside world (LLM, Chrome APIs, messaging).
- `services/` — Application logic and state that is not UI-specific.
- `ui/` — Presentation and DOM ownership only.

### 2.5 Presentation vs Behavior Separation
- JavaScript owns **state and behavior**.
- CSS owns **all visual presentation**.
- Direct manipulation of `.style.display`, `.style.height`, etc. is considered technical debt and should be removed.
- Use CSS classes (`.hidden`, `.visible`, `.maximized`, etc.) for dynamic visual states.

### 2.6 No Build Step Requirement
- The extension must remain loadable directly as an unpacked folder.
- Native ES Modules (`<script type="module">`) are the only allowed module system.
- Any change that introduces a mandatory build step for development or loading is a violation of the project vision.

## 3. Coding Standards & Patterns

### 3.1 File & Module Naming
- Use kebab-case for files: `prompt-editor-view.js`, `language-manager-view.js`.
- Use descriptive, intention-revealing names.
- Sub-views in the `ui/` folder are preferred when a section of a larger view becomes complex.

### 3.2 Factory Function Pattern
All major constructs use the `createXxx(deps)` factory pattern:

```js
export function createSomething(deps = {}) {
  const { serviceA, onEvent } = deps;

  // private state and functions here

  return {
    publicMethod() { ... },
    // only expose what is truly needed
  };
}
```

### 3.3 Composition Root (`app.js`)
- `app.js` should remain relatively thin.
- Its primary job is creation + wiring.
- If private methods in `app.js` start containing significant logic, consider extracting small coordinators or moving responsibility into services.

### 3.4 Sub-View Extraction Pattern (Proven)
When a section inside a view becomes complex (own DOM cluster + logic + events), extract it:

1. Create a new file: `ui/<feature>-view.js`
2. Give it its own `create<Feature>View({ configService, onXxx })`
3. Let the parent view create it and delegate wiring + calls.
4. The parent stays responsible for coordination and cross-cutting refreshes.

This pattern has proven very successful for the Config tab.

### 3.5 CSS Organization
- Keep presentational concerns in CSS.
- Use the existing split: `base.css`, `layout.css`, `components.css`, `results.css`, `themes.css`.
- When adding new visual states, prefer adding classes in the appropriate CSS file over inline styles or direct style manipulation.

## 4. What Good Changes Look Like

A good change:
- Makes at least one file smaller or clearer.
- Strengthens ownership boundaries.
- Reduces direct style/DOM access in the wrong places.
- Introduces or improves a focused module rather than making an existing one larger.
- Updates `ARCHITECTURE.md` when architectural boundaries or important decisions change.
- Keeps files small and mentally manageable.

## 5. What to Avoid

**Strongly discouraged:**
- Adding significant new logic directly into `app.js`.
- Putting more responsibilities into `config-view.js` without extracting a sub-view.
- Using `element.style.xxx = ...` anywhere (except inside the owning UI view as a last resort during transition).
- Creating new large files (>250 lines) without a decomposition plan.
- Adding new globals or module-level singletons.
- Duplicating logic across multiple places (especially clear duplication like the previous double `clearResults`).
- Letting the file tree in `ARCHITECTURE.md` or `README.md` drift from reality.

## 6. Current Known Architectural Weak Points (as of latest analysis)

**Cleanup phase complete (as of this commit):** All previously listed architectural hygiene items have been addressed or received explicit, documented decisions.

These are the areas that currently stand out as the biggest opportunities for improvement:

**Major progress achieved (P0 + P1 work completed):**
- `services/config-service.js` — Successfully decomposed. Language and prompt concerns extracted into focused `language-service.js` and `prompt-service.js`. Now a thin runtime config coordinator (~184 lines).
- `ui/config-view.js` — Successfully lightened via extraction of `main-config-inputs-view.js`. Now a much lighter coordinator of 5 focused sub-views (~173 lines).
- Storage layer aligned: `storage.js` moved to `adapters/`.
- Last direct Chrome API call removed from Composition Root (`app.js`) into `adapters/active-tab.js`.
- ThemeService is now purely persistence (no DOM).

**Remaining opportunities:**
- `ui/output-view.js` (~211 lines) — Still the largest UI file. Minor duplication in clear/reset logic remains.
- `app.js` (~214 lines) — Still slightly above the ideal thin root target. Module-level `export const App` singleton pattern is an outlier.
- Callback coupling between `config-view.js` (now lighter) and its sub-views — reduced but not eliminated.
- Temperature resolution logic is still somewhat fragmented (defaults duplicated between `core/temperature.js` and config).
- Complete absence of automated tests (documented decision below).
- Module-top-level creation of messaging adapters in entry points (`background.js`, `sidepanel-init.js`).
- `window.__llmSidebar...` global guard flag in messaging adapter.

When working on the codebase, actively look for opportunities to improve these areas while continuing to follow the small-files and ownership principles.

### Decision on Automated Tests (as of 2026)

After careful consideration, the project has made an explicit decision **not** to introduce automated tests at this time, for the following reasons:

- The core non-negotiable requirement is "zero-dependency, loadable directly as an unpacked folder, no build step."
- Any popular test runner (Jest, Vitest, Mocha, etc.) would either require a build step or `npm install`, violating the vision.
- Node's built-in `--test` runner is still immature for complex async/browser-extension scenarios and would provide limited value.
- The combination of:
  - Extremely small, single-purpose files
  - Strict ownership boundaries
  - Consistent factory + explicit DI patterns
  - Thorough manual verification on every change
  - Strong architectural discipline (AGENTS.md)

...has so far provided sufficient confidence and maintainability.

**This decision will be revisited** if:
- A high-value, zero-dependency testing approach becomes viable, or
- The project grows large enough that manual verification becomes unreliable.

Until then, "tests" means excellent manual test procedures + architectural invariants that are easy to verify statically.

## 7. Documentation Responsibility

- Major architectural changes must be reflected in `ARCHITECTURE.md`.
- When you extract a new sub-view or change ownership boundaries, update the relevant sections (especially the file tree and UI Ownership Rules table).
- Treat documentation as part of the work, not an afterthought.

## 8. Decision Framework

When facing a choice, ask:

1. Does this make the mental model of the system simpler or more complex?
2. Does this keep files small and focused?
3. Does this strengthen (or at least not weaken) ownership boundaries?
4. Would a future developer thank me for this change in 6–12 months?
5. Is there a way to achieve the goal with smaller, more focused files instead of larger ones?

If the answer to any of these is negative, reconsider the approach.

## 9. Long-Term Vision

The ultimate goal is a codebase where:
- Adding a significant new feature (new provider, multi-turn chat, input field filling, etc.) feels like a natural extension rather than a fight against the architecture.
- A new contributor can understand the overall structure and start making valuable changes within a few hours.
- The project remains a pleasure to work on for many years.

This vision is more important than any individual feature.

---

**This document should be treated as authoritative.** When in doubt, refer back to these principles. Changes that clearly move the codebase toward this vision are strongly encouraged. Changes that move it away from this vision should be challenged.