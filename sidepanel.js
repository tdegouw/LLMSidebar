

// ==================== UI Elements ===========================
const errorMessage = document.getElementById('errorMessage');
const errorOverlay = document.getElementById('errorOverlay');

// ==================== CORE STATE & LOGIC ====================
let modelsLoaded = false;
let currentAbortController = null;

// ------------------- UI STATE -------------------
const UIState = {
    // UI State properties
     currentLang: 'English',

    setProcessing(isProcessing) {
        if (stopBtn) stopBtn.style.display = isProcessing ? 'inline' : 'none';
        if (analyzeBtn) analyzeBtn.style.display = isProcessing ? 'none' : 'inline';
        if (statusIndicator) statusIndicator.classList.toggle('active', isProcessing);
        if (llmSelect) llmSelect.disabled = isProcessing;
        if (promptSelect) promptSelect.disabled = isProcessing;
        if (copyBtn) copyBtn.style.display = isProcessing ? 'none' : 'inline';
    },

    setError(message) {
        this.setProcessing(false);
        if (errorMessage) errorMessage.textContent = message;
        if (errorOverlay) errorOverlay.classList.add('active');
    },
    clearError() {
        this.setProcessing(false);
        if (errorMessage) errorMessage.textContent = '';
        if (errorOverlay) errorOverlay.classList.remove('active');
    },
    setCurrentModelName(modelname) {
    const modelTitle = document.getElementById('modelTitle');
        if (!modelTitle) return;
        modelTitle.textContent = modelname || 'LMM Assistant';
    },
    setCurrentLanguage(language) {
        this.currentLang = language;
        console.info('Switched lang to ' + language)
        const display = document.getElementById('currentLangDisplay');
        if (display) {
            display.textContent = 'Current language: ' + language;
        }
    },
    getCurrentLang() {
        return this.currentLang;
    },
    reset() {
        this.clearError();
    }
};

// ------------------- MAIN ANALYSIS FUNCTION -------------------
async function performAnalysis(contentToSend = null) {
    if (currentAbortController) currentAbortController.abort();
    currentAbortController = new AbortController();
    const signal = currentAbortController.signal;

    UIState.setProcessing(true);

    if (!promptsInitialized) {
        await initializePrompts();
    }

    if (!contentToSend) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
            UIState.reset();
            throw new Error("No active tab found.");
        }
        contentToSend = await extractPageContent(tab.id);
    }

    if (!contentToSend || contentToSend.trim() === '') {
        UIState.reset();
        throw new Error("No text found to analyze!");
    }

    try {
        const selectedModel = llmSelect.value;
        if (!selectedModel) throw new Error("Please select an LLM model first.");

        const promptType = promptSelect.value;
        currentLang = UIState.getCurrentLang();

        if (typeof PROMPTS[promptType] !== 'function') {
            throw new Error(`Invalid prompt type: ${promptType}`);
        }

        const promptText = PROMPTS[promptType](currentLang);

        resultBody.innerHTML = '';
        reasoningBody.textContent = '';
        reasoningBody.dataset.raw = '';
        reasoningContainer.style.display = 'none';

        let accumulated = '';

        await streamChatCompletion(
            selectedModel,
            promptText,
            contentToSend,
            (chunk) => {
                accumulated += chunk;
                resultBody.innerHTML = markdownToHtml(accumulated);
            },
            (reasoningChunk) => {
                reasoningContainer.style.display = 'block';
                reasoningBody.dataset.raw = (reasoningBody.dataset.raw || '') + reasoningChunk;
                reasoningBody.innerHTML = markdownToHtml(reasoningBody.dataset.raw);
                reasoningBody.scrollTop = reasoningBody.scrollHeight;
            },
            signal
        );

        resultBody.innerHTML = markdownToHtml(accumulated);

    } catch (error) {
        if (error.name === 'AbortError') return;
        UIState.setError(error.message);
    } finally {
        UIState.setProcessing(false);
        currentAbortController = null;
    }
}

// ------------------- MESSAGE LISTENER -------------------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "LLMsidebarMessage") {
        const selectionText = message.data.selectionText || '';
        if (currentAbortController) currentAbortController.abort();
        currentAbortController = new AbortController();

        performAnalysis(selectionText).catch(err => {
            if (err.name !== 'AbortError') console.error(err);
        });
    }
});

// ------------------- INITIALIZATION -------------------
document.addEventListener('DOMContentLoaded', async function () {
    await initializePrompts();
    await initializeLang();

    // Theme toggling
    const themeToggles = document.querySelectorAll('.theme-toggle-btn');

    function updateAllThemeIcons(theme) {
        themeToggles.forEach(btn => {
            btn.textContent = theme === 'light' ? '☀️' : '🌙';
        });
    }

    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.body.setAttribute('data-theme', savedTheme);
    updateAllThemeIcons(savedTheme);

    themeToggles.forEach(toggle => {
        toggle.addEventListener('click', function(e) {
            e.stopPropagation();
            const currentTheme = document.body.getAttribute('data-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            document.body.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateAllThemeIcons(newTheme);
        });
    });
});