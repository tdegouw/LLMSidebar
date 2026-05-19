# LLMSidebar

**A Chrome Extension for real-time local LLM-powered text analysis, right from your browser sidebar.**

LLMSidebar brings the power of local LLMs (via [LM Studio](https://lmstudio.ai)) directly into your browsing workflow. Right-click any text on any webpage and get instant, streamed AI analysis — summaries, translations, code reviews, simplifications, and more — in a clean, persistent sidebar.

Inspired by [LM-Studio-Assistant](https://github.com/microup/LM-Studio-Assistant), but
built with Chrome’s Sidebar API for a non-intrusive, always-available workspace.

---

## Features

| Feature                    | Description |
|---------------------------|-------------|
| **Context Menu Integration** | Right-click selected text → "Send to LLM" opens the sidebar instantly |
| **Full Page Analysis**     | No selection? The extension extracts the main content of the current page |
| **11 Task Types**          | Summarize, Translate, Code Review, Simplify, Grammar Correction, Explain, Bulleted List, Change Tone, ELI5, Caveman, Haiku |
| **Streaming Responses**    | Token-by-token streaming via SSE for near-instant feedback |
| **Reasoning Panel**        | Dedicated expandable panel for models that output `reasoning` / `reasoning_content` |
| **Multi-Language Support** | English, French, Spanish, Portuguese, Chinese, Dutch + custom languages |
| **Dynamic Temperature**    | Automatically adjusts temperature based on content length |
| **Custom Prompt Editor**   | Edit, save and reset any system prompt (persisted in localStorage) |
| **Dark / Light Theme**     | One-click theme toggle with automatic persistence |
| **Persistent Configuration** | All settings survive reloads |

---

## Installation

### Prerequisites
- [LM Studio](https://lmstudio.ai) running locally with the local server enabled (default: `http://localhost:1234`)
- Chrome or any Chromium-based browser

### Steps
1. Start LM Studio and load a model.
2. Go to `chrome://extensions/`
3. Enable **Developer mode**
4. Click **Load unpacked** and select the `LLMSidebar` folder
5. Right-click any text on a webpage → you should see **"Send to LLM"**

---

## Usage

### Quick Start
1. Highlight text on any page.
2. Right-click → **Send to LLM**.
3. The sidebar opens and starts streaming results immediately.

### Full Page Analysis
Open the sidebar → go to the **Output** tab → choose a task → click **Process Page**.

### Output Tab Controls
- **Analyze** — manually trigger analysis
- **Stop** — abort the current stream
- **Clear** — reset results and reasoning panel
- **Copy** — copy the full result to clipboard
- **Maximize** — expand the reasoning panel to full height

---

## Architecture

LLMSidebar is a **Manifest V3** Chrome extension with a clean modular structure:

```
LLMSidebar/
├── background.js              # Service worker – context menu + sidebar activation
├── sidepanel.html             # Main sidebar UI
├── sidepanel.css              # Dark + light theme styles
├── sidepanel.js               # Core orchestration + model loading
├── sidepanel_config.js        # Config management, prompts, languages, persistence
├── sidepanel_output.js        # Output tab logic (buttons, copy, reasoning panel, tab switching)
├── api.js                     # LM Studio SSE streaming + model fetching
├── extractPageContent.js      # Page/main content extraction
├── markdownParser.js          # Secure Markdown → HTML conversion
├── config/
│   ├── system-prompts.json    # Default prompts for all 11 task types
│   └── lang.json              # Language mappings
├── icons/                     # Extension icons (16/32/48/128)
├── manifest.json
├── LICENSE
└── README.md
```


### Component Responsibilities

| File                        | Responsibility |
|----------------------------|----------------|
| `background.js`            | Registers context menu and opens sidebar. Sets `openPanelOnActionClick`. |
| `sidepanel.js`             | Main logic: model loading, prompt handling, analysis orchestration. |
| `sidepanel_config.js`      | Configuration UI, custom prompts/languages, localStorage persistence. |
| `sidepanel_output.js`      | Output tab interactions: analyze/stop/clear/copy, reasoning maximization, tab switching. |
| `api.js`                   | `streamChatCompletion()` (SSE) and `loadModelsFromAPI()`. |
| `extractPageContent.js`    | Smart content extraction (semantic elements + fallback). |
| `markdownParser.js`        | XSS-safe Markdown to HTML conversion with full feature support. |

---

## Configuration

All settings live in the **Config** tab and are persisted in `localStorage`.

### Task Types (11)
Each task has a carefully crafted system prompt. You can edit any of them live in the Prompt Editor.

### Dynamic Temperature
- **< 1000 characters** → `temperature: 0.6` (focused)
- **≥ 1000 characters** → `temperature: 0.8` (more creative)

### Max Content Length
Default: **8000 characters**. Adjust based on your model’s context window.

---

## Theming

Toggle between beautiful **Dark** (default) and **Light** themes. Preference is saved automatically.


## Troubleshooting

| Issue                              | Solution |
|------------------------------------|----------|
| "LM Studio not available"          | Make sure LM Studio is running and the local server is enabled on port 1234. Click the refresh button. |
| No models in dropdown              | Load a model in LM Studio first, then refresh. |
| Extension does nothing on right-click | Check that the extension has **Context menus** permission. |
| Sidebar won't open                 | Avoid `chrome://` and `chrome-extension://` pages. |
| Streaming feels slow               | Try a smaller/faster model or reduce Max Content Length. |

---

## Development

Just load it as an unpacked extension during development
No build step required (pure vanilla JS + Manifest V3)
Contributions are welcome! Feel free to open issues or pull requests.