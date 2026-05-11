# LLMSidebar

**A Chrome Extension for real-time local LLM-powered text analysis, right from your browser sidebar.**

LLMSidebar is a Chrome extension that connects to [LM Studio](https://lmstudio.ai) running locally on your machine, bringing the power of large language models directly into your browsing workflow. Right-click any text on any webpage, and instantly get AI-powered analysis — summaries, translations, code reviews, simplifications, and more — streamed live in a sleek sidebar panel.

Inspired by [LM-Studio-Assistant](https://github.com/microup/LM-Studio-Assistant), LLMSidebar goes further by using Chrome's Sidebar API for a persistent, non-intrusive workspace that stays open alongside your content.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
  - [Model Selection](#model-selection)
  - [Task Types](#task-types)
  - [Language Support](#language-support)
  - [Temperature Control](#temperature-control)
  - [Max Content Length](#max-content-length)
- [Prompt Editor](#prompt-editor)
- [Config File Reference](#config-file-reference)
  - [system-prompts.json](#system-promptsjson)
  - [lang.json](#langjson)
- [API & Data Flow](#api--data-flow)
- [Theming](#theming)
- [Troubleshooting](#troubleshooting)
- [File Structure](#file-structure)
- [License](#license)

---

## Features

| Feature | Description |
|---|---|
| **Context Menu Integration** | Right-click any selected text and choose "Send to LLM" to instantly analyze it in the sidebar. |
| **Full Page Analysis** | When no text is selected, the extension extracts the main content from the current page and sends it for processing. |
| **11 Task Types** | Choose from Summarize, Translate, Code Review, Simplify, Grammar Correction, Explain, Bulleted List, Change Tone, ELI5, Caveman, and Haiku. |
| **Streaming Responses** | Results stream token-by-token from LM Studio using Server-Sent Events (SSE), giving you near-instant feedback. |
| **Reasoning Panel** | When a model outputs reasoning content (`reasoning` or `reasoning_content` fields), it appears in a dedicated expandable panel. |
| **Multi-Language Support** | Built-in support for English, French, Spanish, Portuguese, Chinese, and Dutch. Add custom languages via the Config tab. |
| **Dynamic Temperature** | Automatically adjusts temperature based on content length — lower temperature for short text, higher for long text. |
| **Custom Prompt Editor** | Edit, save, and reset any system prompt template. Custom prompts are persisted in `localStorage`. |
| **Dark / Light Theme** | Toggle between dark and light themes with a single click. Your preference is saved automatically. |
| **Persistent Configuration** | All settings — model, language, temperature, max content length, theme — are saved to `localStorage` and restored on reload. |

---

## Architecture

LLMSidebar is a **Manifest V3** Chrome extension composed of four JavaScript modules and a single HTML panel:

```
LLMSidebar/
├── background.js              # Service worker: context menus, sidebar activation
├── sidepanel.html             # Sidebar UI: tabs, config, results, theming
├── sidepanel.css              # Sidebar styles: dark/light themes, components
├── sidepanel.js               # Sidebar logic: model loading, analysis, event handlers
├── sidepanel_config.js        # Config management: prompts, languages, settings persistence
├── api.js                     # API layer: LM Studio SSE streaming, model loading
├── extractPageContent.js      # Page content extraction via script injection
├── markdownParser.js          # Markdown-to-HTML converter for streamed results
├── config/
│   ├── system-prompts.json    # Default prompt templates (11 task types)
│   └── lang.json              # Language code → name mappings
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── manifest.json              # Extension manifest (MV3)
└── README.md
```

### Component Responsibilities

| File | Role |
|---|---|
| **`background.js`** | Registers the "Send to LLM" context menu. When clicked, opens the sidebar and forwards the selected text. Also sets `openPanelOnActionClick` so clicking the toolbar icon opens the sidebar. |
| **`sidepanel.html`** | The entire sidebar UI. Contains two tabs (Output and Config), CSS styles for dark/light themes, the model selector, task type dropdown, language picker, prompt editor, and result display areas. |
| **`sidepanel.js`** | Core logic: loads models from LM Studio, initializes prompts and languages, handles tab switching, theme toggling, and orchestrates the analysis pipeline. |
| **`sidepanel_config.js`** | Configuration management: loads/saves config to localStorage, manages prompt templates, custom languages, prompt editor state, and config UI event handlers. |
| **`api.js`** | `streamChatCompletion()` — sends the request to LM Studio and parses SSE stream, delivering chunks to callbacks. `loadModelsFromAPI()` — fetches available models from the LM Studio local server. |
| **`extractPageContent.js`** | `extractPageContent()` — injects a script into the target tab to grab selected text or main page content. |
| **`markdownParser.js`** | Converts streamed Markdown into HTML in the browser. Supports headings, bold, italic, links, inline code, code blocks, lists, blockquotes, horizontal rules, and paragraphs. Escapes HTML to prevent XSS. |

### Data Flow

```
User right-clicks text on a webpage
        │
        ▼
background.js receives context menu click
        │
        ├─► chrome.sidePanel.open()  — opens the sidebar
        │
        └─► chrome.runtime.sendMessage()  — sends selection text + tab ID
                          │
                          ▼
              sidepanel.js receives message
                          │
                          ├─► If no selection: extractPageContent(tabId)
                          │     (injects script into tab to grab main content)
                          │
                          ├─► Loads prompt template from PROMPTS[promptType](lang)
                          │
                          └─► streamChatCompletion(model, systemPrompt, content)
                                 │
                                 ▼
                          POST http://localhost:1234/v1/chat/completions
                                 (stream: true, SSE)
                                 │
                                 ├─► onChunk(chunk)  → markdownToHtml() → resultBody
                                 └─► onReasoning(chunk) → reasoningBody
```

---

## Installation

### Prerequisites

- [LM Studio](https://lmstudio.ai) installed and running locally
- LM Studio's local server enabled (default: `http://localhost:1234`)
- Chrome or a Chromium-based browser

### Steps

1. **Start LM Studio** and ensure the local server is running on port 1234. Load any LLM model you wish to use.

2. **Open Chrome Extensions page** — navigate to `chrome://extensions/`.

3. **Enable Developer mode** — toggle the switch in the top-right corner.

4. **Load the unpacked extension** — click **"Load unpacked"** and select the `LLMSidebar` folder.

5. **Verify installation** — the LLMSidebar icon should appear in your Chrome toolbar. Right-click any text on any webpage and you should see **"Send to LLM"** in the context menu.

6. **Select a model** — open the sidebar (click the toolbar icon or right-click → "Send to LLM"), go to the **Config** tab, and select a loaded model from the dropdown.

---

## Usage

### Analyzing Selected Text

1. Highlight any text on a webpage.
2. Right-click and select **"Send to LLM"**.
3. The sidebar opens and begins processing immediately.
4. Results stream into the Output tab in real time.

### Analyzing the Full Page

1. Open the sidebar (click the toolbar icon).
2. Go to the **Output** tab.
3. Select your desired **Task Type** from the dropdown.
4. Click **"Process Page"**.
5. The extension extracts the main content from the current tab and sends it to your selected LLM.

### Switching Tabs

- Click **Output** to view results and configure tasks.
- Click **Config** to manage models, languages, prompts, and settings.

---

## Configuration

All configuration lives in the **Config** tab of the sidebar. Settings are persisted in `localStorage` and survive page reloads.

### Model Selection

The extension queries `http://localhost:1234/api/v0/models` to populate the model dropdown. Only models with `type` of `llm` or `vlm` are shown.

- **Auto-refresh**: Models are loaded once when the sidebar opens. Click the **🔄** button to refresh the list.
- **Header display**: The currently selected model name appears in the sidebar header.
- **"LM Studio not available"**: If the local server is unreachable, the dropdown shows this message instead.

### Task Types

The sidebar supports 11 built-in task types, each with a curated system prompt:

| Task | Description |
|---|---|
| **Summarize** | Generates a structured summary with overview, key points, and conclusion. |
| **Translate** | Translates text into the target language, preserving formatting and tone. |
| **Code Review** | Provides bug analysis, performance suggestions, style recommendations, and security notes. |
| **Simplify** | Rewrites text for a general audience with shorter sentences and clearer vocabulary. |
| **Grammar Correction** | Fixes all grammatical, spelling, and punctuation errors while preserving style. |
| **Explain** | Breaks down complex concepts using analogies and digestible explanations. |
| **Bulleted List** | Converts text into organized bullet points grouped under subheadings. |
| **Change Tone** | Rewrites text to shift tone (professional, casual, persuasive, empathetic). |
| **ELI5** | Explains content as if to a 5-year-old — simple words, fun analogies, no jargon. |
| **Caveman** | Rewrites text in humorous caveman speech while preserving core meaning. |
| **Haiku** | Converts text into a series of interconnected 5-7-5 syllable haikus. |

### Language Support

The extension ships with 6 built-in languages defined in `config/lang.json`:

| Code | Language |
|---|---|
| `english` | English |
| `french` | French |
| `spanish` | Spanish |
| `portuguese` | Portuguese |
| `chinese` | Chinese |
| `dutch` | Dutch |

**Adding custom languages**: In the Config tab, enter a language code (e.g., `ja`) and name (e.g., `Japanese`), then click **Add Language**. Custom languages are saved to `localStorage` and appear in the language dropdown.

**Removing custom languages**: Click the **✕** button next to any custom language in the language list.

### Temperature Control

Temperature affects the creativity and randomness of the LLM's output (0.0 = deterministic, 2.0 = highly creative). LLMSidebar uses a **dynamic temperature** approach:

| Setting | Default | Description |
|---|---|---|
| **Low Temperature** | `0.6` | Used when content length is **below** the threshold. |
| **High Temperature** | `0.8` | Used when content length **exceeds** the threshold. |
| **Threshold (chars)** | `1000` | Content length in characters that triggers the switch between low and high temperature. |

This adaptive approach ensures consistent output quality regardless of input size — lower temperature for short text (more focused), higher temperature for long text (more creative).

### Max Content Length

Controls the maximum number of characters extracted from the page. Default: **8000 characters**.

> **Note**: This should not exceed the context window of your chosen model. For models with smaller context windows (e.g., 4K), reduce this value accordingly.

---

## Prompt Editor

The Config tab includes a **Prompt Editor** for customizing any of the 11 task type prompts.

### How It Works

1. Select a task type from the dropdown.
2. The editor loads the current prompt template (default or custom).
3. Edit the template — use `${lang}` as a placeholder for the target language.
4. Click **Save** to persist your custom prompt to `localStorage`.
5. Click **Reset** to restore the default prompt for that task type.

### Persistence

- **Custom prompts** are stored under the `customPrompts` key in `localStorage`.
- **Default prompts** are stored under the `defaultPrompts` key (loaded once from `config/system-prompts.json`).
- The active prompt is resolved by merging: `custom prompt` overrides `default prompt` from the config file.

### Reset All

The **Reset All Settings** button at the bottom of the Config tab clears:

- Custom languages (`customLangs`)
- Custom prompts (`customPrompts`)
- Default prompts cache (`defaultPrompts`)
- Selected language (`selectedLang`)
- Theme preference (`theme`)
- All config values (`llmSidebarConfig`)

After resetting, the extension returns to its original default state.

---

## Config File Reference

### `config/system-prompts.json`

Contains the 10 default system prompt templates. Each key corresponds to a task type. Use `${lang}` as the language placeholder.

```json
{
    "summarize": "You are an expert analyst. Generate a response in ${lang}. Analyze the provided text...",
    "translate": "Translate the following text into ${lang}. Preserve all original formatting...",
    "code_review": "You are a senior software engineer. Generate a response in ${lang}. Review the provided code...",
    ...
}
```

### `config/lang.json`

Maps language codes to display names:

```json
{
    "english": "English",
    "spanish": "Spanish",
    "french": "French",
    "portuguese": "Portuguese",
    "chinese": "Chinese",
    "dutch": "Dutch"
}
```

---

## API & Data Flow

### Content Extraction (`extractPageContent`)

When no text is selected, the extension extracts page content using two strategies:

1. **Primary**: Looks for semantic HTML elements (`main`, `article`, `[role="main"]`, `#content`, `.content`, `.main-content`) and extracts `innerText`.
2. **Fallback**: Clones `document.body`, removes navigation/sidebar elements (`nav`, `header`, `footer`, `aside`, `[role="navigation"]`, etc.), and extracts the remaining `innerText`.

The result is truncated to `CONFIG.maxLen` characters.

### Streaming Completion (`streamChatCompletion`)

The extension sends a streaming chat completion request to LM Studio:

```
POST http://localhost:1234/v1/chat/completions

{
    "model": "<selected-model-id>",
    "messages": [
        { "role": "system", "content": "<system-prompt>" },
        { "role": "user", "content": "<extracted-content>" }
    ],
    "temperature": <resolved-temperature>,
    "stream": true
}
```

The SSE response is parsed line-by-line. Each chunk is delivered to:

- **`onChunk(chunk)`** — rendered as Markdown in the results panel
- **`onReasoning(chunk)`** — rendered in the reasoning panel (if the model outputs reasoning content)

A 10ms delay between chunks prevents overwhelming the UI during fast streaming.

### Reasoning Content

Models that output reasoning (e.g., via `reasoning` or `reasoning_content` delta fields) display their chain-of-thought in a dedicated panel. The panel can be maximized to full height using the maximize button.

---

## Theming

LLMSidebar ships with **dark** and **light** themes, controlled via the `data-theme` attribute on the `<body>` element.

### Dark Theme (Default)

- Background: Deep navy (`#1a1a2e`)
- Cards: Dark blue (`#16213e`)
- Text: White (`#ffffff`)
- Accent: Purple (`#7c3aed`)

### Light Theme

- Background: Light gray (`#f8fafc`)
- Cards: White (`#ffffff`)
- Text: Dark slate (`#1e293b`)
- Accent: Purple (`#7c3aed`)

### Toggle

Click the **theme toggle** button in the header to switch themes. The preference is saved to `localStorage` and restored on next load.

---

## Troubleshooting

| Issue | Solution |
|---|---|
| **"LM Studio not available"** in the model dropdown | Ensure LM Studio is running and its local server is enabled (default port 1234). Click the 🔄 button to refresh. |
| **Extension does nothing** when right-clicking | Verify the **Context menus** permission is granted. Go to `chrome://extensions/`, find LLMSidebar, and check permissions. |
| **Sidebar doesn't open** | Make sure you're on a supported page (not `chrome://` or `chrome-extension://` URLs). |
| **No models appear** in the dropdown | Load a model in LM Studio first, then click the refresh button. |
| **Results don't appear** | Check the browser console (F12) for errors. Ensure LM Studio's server is responding at `http://localhost:1234`. |
| **Streaming is slow** | Try a smaller model or reduce the Max Content Length. |
| **Custom prompts/languages lost** | They are stored in `localStorage`. Clearing browser data will remove them. Use the Config tab to re-add them. |

---
