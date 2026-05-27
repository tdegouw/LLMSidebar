# LLMSidebar

**A Chrome Extension for real-time local LLM-powered text and image analysis, right from your browser sidebar.**

LLMSidebar brings the power of local LLMs (via [LM Studio](https://lmstudio.ai)) directly into your browsing workflow. Right-click selected text or images on any webpage and get instant, streamed AI analysis — summaries, translations, code reviews, AI image detection, and more — in a clean, persistent sidebar.

Inspired by [LM-Studio-Assistant](https://github.com/microup/LM-Studio-Assistant), but
built with Chrome’s Sidebar API for a non-intrusive, always-available workspace.

---

## Features

| Feature                    | Description |
|---------------------------|-------------|
| **Context Menu Integration** | Right-click selected text → "Send to LLM" or images/videos → "Check if this image is AI-generated" |
| **Vision / Image Analysis** | Right-click images or video frames → "Check if this image is AI-generated" (requires a vision model marked 👁️ Vision) |
| **Full Page Analysis**     | No selection? The extension extracts the main content of the current page |
| **12 Task Types**          | Summarize, Translate, Code Review, Simplify, Grammar Correction, Explain, Bulleted List, Change Tone, ELI5, Caveman, Haiku, AI Image Detection |
| **Streaming Responses**    | Token-by-token streaming via SSE for near-instant feedback |
| **Reasoning Panel**        | Dedicated expandable panel for models that output `reasoning` / `reasoning_content` |
| **Multi-Language Support** | 16 languages (English, Spanish, Chinese, Hindi, Arabic, etc.) + custom languages |
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
5. Right-click any text or image on a webpage → you should see **"Send to LLM"** or **"Check if this image is AI-generated"**

---

## Usage

### Quick Start
**Text analysis**
1. Highlight text on any page.
2. Right-click → **Send to LLM**.
3. The sidebar opens and starts streaming results immediately.

**Image analysis (AI detection)**
1. Right-click any image or video on a webpage.
2. Select **Check if this image is AI-generated**.
3. The sidebar opens (if closed) and a vision model analyzes the image for AI generation artifacts. Requires a model marked **👁️ Vision**.

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

See [ARCHITECTURE.md](ARCHITECTURE.md) for the current modular architecture, ownership rules, data flows, and how to extend the system.

---

## Configuration

All settings live in the **Config** tab and are persisted in `localStorage`.

### Task Types
Each task has a carefully crafted system prompt (including **AI Image Detection**). You can edit any of them live in the Prompt Editor.

Vision models (marked **👁️ Vision** in the model selector) unlock the image right-click feature for detecting AI-generated content.

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