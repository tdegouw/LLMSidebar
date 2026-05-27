# Architecture

LLMSidebar is a **Manifest V3** Chrome extension built with a clean, modern modular architecture using **native ES Modules** (no bundler required).

The goal is to keep the codebase understandable and maintainable even as features are added, by enforcing strong ownership boundaries and keeping files small and single-purpose.

## Guiding Principles

- **Views own their DOM** — Only UI modules (`ui/*`) are allowed to call `document.getElementById` / `querySelector` for their area.
- **No globals** — Everything is explicitly created and wired in the Composition Root (`app.js`).
- **Factory-based Dependency Injection** — All services and views are created with `createXxx(deps)` functions. No module-level singletons.
- **Small, focused files** — Most files stay under 150–200 lines.
- **Clear layers**:
  - `core/` → Pure, side-effect free functions
  - `adapters/` → Communication with external systems (LLM, Chrome APIs, messaging)
  - `services/` → Application logic and state
  - `ui/` → Presentation only
- **Presentation vs Behavior** — JavaScript controls state and behavior; CSS controls all visual presentation. Direct `.style.*` manipulation is avoided.
- **Native ES Modules** — The sidepanel uses `<script type="module">`. The extension remains loadable as an unpacked folder without any build step.

## High-Level Structure

```
LLMSidebar/
├── background.js              # Thin service worker (context menu + side panel opener + messaging)
├── sidepanel.html
├── sidepanel-init.js          # Early bootstrap + pending message handling
├── app.js                     # Composition Root – creates and wires everything

├── core/                      # Pure domain logic (no DOM, no chrome, no side effects)
│   ├── markdown.js
│   ├── prompts.js
│   └── temperature.js

├── adapters/                  # Ports to the outside world
│   ├── llm-adapter.js         # Streaming chat + model loading (LM Studio compatible)
│   ├── content-extractor.js   # Page content extraction via chrome.scripting
│   ├── messaging.js           # Sidepanel ↔ Background messaging abstraction
│   ├── config-resources.js    # Loads the two static config JSONs (chrome.runtime.getURL + fetch)
│   ├── active-tab.js          # Returns the ID of the currently active browser tab
│   ├── storage.js             # localStorage persistence adapter (browser I/O boundary)
│   └── image-capture.js       # Captures images from pages as base64 for vision models

├── services/                  # Business logic & state
│   ├── analysis-service.js    # Orchestrates a full analysis run
│   ├── config-service.js      # Prompts, languages, temperature config + persistence
│   └── theme-service.js       # Theme state (pure persistence only)

├── ui/                        # UI ownership (each owns its slice of the DOM)
│   ├── config-view.js         # Coordinator + model selection + temperature + main language dropdown
│   ├── prompt-editor-view.js  # Prompt editor section (Config tab)
│   ├── language-manager-view.js # Custom language add/remove (Config tab)
│   ├── reset-view.js          # Reset All section (Config tab)
│   ├── main-config-inputs-view.js # Main model/task/language selects (Config tab)
│   ├── output-view.js         # Entire Output tab + streaming results
│   ├── tab-controller.js      # Tab switching
│   ├── theme-controller.js    # Header theme toggle button
│   ├── header-view.js         # Header elements (e.g. current model title)
│   └── analysis-controller.js # Analysis flows (Process Page + context menu) – extracted from app.js for thin root

├── css/                       # Modular CSS (no build step)
│   ├── sidepanel.css          # Thin entry point (only @imports)
│   ├── base.css
│   ├── layout.css
│   ├── components.css
│   ├── results.css
│   └── themes.css             # Variables + all theme definitions

├── config/
│   ├── system-prompts.json
│   └── lang.json

├── manifest.json
└── icons/
```

## Composition Root (`app.js`)

`app.js` is the single place that:

1. Creates all infrastructure (`storage`, `messaging`)
2. Creates services and adapters with proper dependencies
3. Creates the UI views and thin controllers
4. Wires callbacks between collaborators

The two main user flows ("Process Page" and context menu "Send to LLM") were extracted in 2026 into `AnalysisController` (ui/analysis-controller.js) so the root can remain extremely thin and focused purely on creation + wiring.

After initialization, `app.js` stays very thin (target < 200 LOC). It contains zero DOM access and zero direct style manipulation. All significant behavior lives in dedicated modules.

## UI Ownership Rules

The UI layer is deliberately split into small, focused modules so that each piece of the interface has a single, clear owner.

| Module                        | Owns                                                                 |
|-------------------------------|----------------------------------------------------------------------|
| `config-view.js`              | Lightweight coordinator for the Config tab (5 focused sub-views) |
| `prompt-editor-view.js`       | Prompt editor section inside the Config tab                          |
| `language-manager-view.js`    | Custom language management (add/remove) inside the Config tab        |
| `reset-view.js`               | Reset All section (button + temporary status) inside the Config tab  |
| `main-config-inputs-view.js`  | Primary model / task / language selects + refresh in the Config tab  |
| `output-view.js`              | Output tab content, streaming results, reasoning panel, error overlay, action buttons |
| `tab-controller.js`           | Tab navigation and content switching                                 |
| `theme-controller.js`         | The header theme toggle button (`#themeToggle`) **and** `body[data-theme]` application (the only legal place for this DOM write) |
| `header-view.js`              | Header elements that are not tab-specific (e.g. `#modelTitle`)       |
| `analysis-controller.js`      | The two analysis entry points (Process Page + context menu "Send to LLM") and cross-view processing state coordination. Extracted to keep app.js thin. |

No other file should reach into these elements.

## Presentation vs Behavior Separation

A key quality goal in the current architecture is to keep JavaScript responsible for **behavior and state**, while CSS is responsible for **presentation**.

- Direct manipulation of `.style.*` properties (especially `display`, `height`, `width`) is actively avoided.
- Visibility, sizing, and visual states are controlled via CSS classes (e.g. `.hidden`, `.visible`, `.maximized`).
- This improves maintainability, makes theming easier, and keeps the separation of concerns clean.

This principle was significantly strengthened during recent refactoring passes.

## Theming System

Theming is deliberately split into two concerns with strict ownership:

- **ThemeService** (`services/theme-service.js`): Pure model. Handles only persistence and the current theme name (no DOM).
- **ThemeController** (`ui/theme-controller.js`): Owns the toggle button, icon updates, **and** applying the `data-theme` attribute to `<body>`. This is the sole module allowed to touch theme-related DOM.
- **CSS** (`css/themes.css`): All variables and `[data-theme]` overrides live here. Adding a new theme is mostly a matter of adding one new `body[data-theme="new"]` block.

## CSS Organization

The stylesheet is split for maintainability:

- `themes.css` — CSS custom properties + all theme variants (must be imported first)
- `base.css` — Reset, body defaults, scrollbar, global animations
- `layout.css` — Structural layout (header, tabs, footer, responsive)
- `components.css` — Reusable pieces (cards, buttons, selects, badges, empty states…)
- `results.css` — Everything related to the output/results area
- `sidepanel.css` — Only `@import` statements (the file actually linked from HTML)

## Main Data Flows

### Context Menu Flow ("Send to LLM")
1. `background.js` receives `chrome.contextMenus.onClicked`
2. Opens the side panel + sends `LLMsidebarMessage` (with unique `messageId`) via `chrome.runtime.sendMessage`
3. `sidepanel-init.js` captures early messages (temporary listener, removed after init) if the app is not ready yet
4. `app.js` receives the message and delegates to `AnalysisController.handleContextMenuMessage` (the flow logic no longer lives in the Composition Root). A small identity+window guard inside the controller suppresses any duplicate deliveries of the same `messageId` (e.g. direct send + READY replay).
5. `AnalysisService.run()` is started with the selected text
6. Streaming chunks go to `OutputView.appendContent()`

### "Process Page" Flow
1. User clicks **Process Page** in the Output tab
2. `OutputView` calls the injected `onAnalyze` callback
3. `app.js` reads current selection from `ConfigView`
4. `AnalysisService` uses `ContentExtractor` (via `chrome.scripting`) to get page content
5. Same streaming path as above

## Key Technical Decisions

- **No build step** — The extension must remain loadable as an unpacked folder. Native ES Modules + JSDoc are used instead of TypeScript or a bundler.
- **Factory pattern over classes** — `createXxx()` functions make dependency injection explicit and easy to test/mock.
- **Streaming with throttling** — 10ms batching in the LLM adapter for perceived performance without overloading the UI.
- **Pending message handshake** — Because side panels can receive messages before they are fully initialized.

## Extension Points (Future)

The architecture is prepared for:

- Multiple LLM providers (add new adapters that implement the same interface)
- Input field filling (new analysis mode that writes back into the page)
- Additional UI surfaces (history, multi-turn chat, settings page)
- More themes (just extend `themes.css` + `ThemeService`/`ThemeController`)
- Vision / multimodal inputs (new `image-capture` adapter + multimodal support in the LLM adapter)

## Current State (as of 2026)

- `app.js` is now a **very thin Composition Root** (208 LOC after deliberate lightening). Zero direct DOM access, zero `.style.*`.
- Major behavior extraction: Analysis flows live in the new `ui/analysis-controller.js` (following the proven controller pattern).
- Strong ownership boundaries: every UI area + major flow has a dedicated owner (4 sub-views under Config + AnalysisController + Tab/Theme/Header controllers).
- **Direct `.style.*` manipulation has been fully eliminated** across the entire JavaScript codebase.
- CSS is well modularized.
- Language system uses ISO 639-1 codes.
- The architecture continues to improve in the direction of the AGENTS.md vision (small focused files, explicit DI, Composition Root stays honest).
- **Layer violations fixed**: `services/theme-service.js` no longer touches DOM; resource loading moved from `services/config-service.js` into the new `adapters/config-resources.js`.

The project is in an excellent position regarding separation of concerns and long-term maintainability.

---

*This document should be updated whenever major architectural boundaries change.*