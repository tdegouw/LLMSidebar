let modelsLoaded = false;
let currentAbortController = null;

/**
 * Updates the header title to show the currently selected model.
 */
function updateModelTitle() {
    const modelTitle = document.getElementById('modelTitle');
    const llmSelect = document.getElementById('llmSelect');
    if (!modelTitle || !llmSelect) return;
    const selectedModel = llmSelect.value;
    if (selectedModel) {
        modelTitle.textContent = selectedModel;
    } else {
        modelTitle.textContent = 'LMM Assistant';
    }
}

/**
 * Populates a select element with LLM/VLM model options.
 */
function populateModelSelect(selectElement, models) {
    selectElement.innerHTML = '';

    const llmModels = models.filter(model => model.type === 'llm' || model.type === 'vlm');

    if (llmModels.length > 0) {
        llmModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.text = `${model.id} (${model.state})`;
            selectElement.appendChild(option);
        });
    } else {
        const option = document.createElement('option');
        option.value = '';
        option.text = 'No LLM models found';
        selectElement.appendChild(option);
    }

    // Restore last used model if it still exists
    const lastModel = localStorage.getItem('lastSelectedModel');
    if (lastModel) {
        const optionExists = Array.from(selectElement.options).some(opt => opt.value === lastModel);
        if (optionExists) {
            selectElement.value = lastModel;
        }
    }

    // Update the header title after populating the select
    updateModelTitle();
}

/**
 * Loads LLM models from LM Studio API and populates the model selector.
 */
async function loadLLMModels() {
    if (modelsLoaded) return;
    modelsLoaded = true;

    const llmSelect = document.getElementById('llmSelect');
    if (!llmSelect) {
        console.warn('llmSelect element not found');
        return;
    }

    try {
        const models = await loadModelsFromAPI();
        populateModelSelect(llmSelect, models);
    } catch (error) {
        console.error('Failed to load models:', error);
        llmSelect.innerHTML = '<option value="">LM Studio not available</option>';
        updateModelTitle();
    }
}

// ------------------- DOM ELEMENTS -------------------------
const resultBody = document.getElementById('resultBody');
const reasoningBody = document.getElementById('reasoningBody');
const reasoningContainer = document.getElementById('reasoningContainer');
const maximizeReasoningBtn = document.getElementById('maximizeReasoningBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const errorOverlay = document.getElementById('errorOverlay');
const statusIndicator = document.getElementById('statusIndicator');
const errorMessage = document.getElementById('errorMessage');
const clearBtn = document.getElementById('clearBtn');
const stopBtn = document.getElementById('stopBtn');
const analyzeBtn = document.getElementById('analyzeBtn');

// Tab navigation
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

function showCancelButton(show) {
    if (stopBtn) stopBtn.style.display = show ? 'inline' : 'none';
    if (analyzeBtn) analyzeBtn.style.display = !show ? 'inline' : 'none';
}

/**
 * Performs an LLM analysis on the given content (or the current page content).
 * Streams the response and renders it to the result body.
 * @param {string} [contentToSend] - Optional content to analyze. If omitted, the current page content is extracted.
 * @returns {Promise<void>}
 */
async function performAnalysis(contentToSend = null) {
    // Always create a fresh controller (in case it was called directly from button)
    if (currentAbortController) {
        currentAbortController.abort();
    }
    currentAbortController = new AbortController();
    const signal = currentAbortController.signal;
    showCancelButton(true);

    if (!promptsInitialized) {
        await initializePrompts();
    }

    if (!contentToSend) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) throw new Error("No active tab found.");
        contentToSend = await extractPageContent(tab.id);
    }

    if (!contentToSend || contentToSend.trim() === '') {
        throw new Error("No text found to analyze!");
    }

    loadingOverlay.classList.remove('active');
    errorOverlay.classList.remove('active');
    statusIndicator.classList.add('active');

    try {
        const selectedModel = llmSelect.value;
        if (!selectedModel) throw new Error("Please select an LLM model first.");

        const promptType = promptSelect.value;
        currentLang = getAllLangs()[langSelect.value] || 'English';

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
        if (error.name === 'AbortError') {
            console.log('[LLMSidebar] Previous request aborted');
            return;
        }
        console.error('Error during analysis:', error);
        errorMessage.textContent = error.message.includes('Failed to fetch') 
            ? 'Cannot connect to LM Studio. Is it running on port 1234?' 
            : error.message;
        errorOverlay.classList.add('active');
    } finally {
        loadingOverlay.classList.remove('active');
        statusIndicator.classList.remove('active');
        showCancelButton(false);
        currentAbortController = null;
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "LLMsidebarMessage") {
        const selectionText = message.data.selectionText || '';

        // Abort any previous request immediately when new context menu click comes in
        if (currentAbortController) {
            currentAbortController.abort();
        }
        currentAbortController = new AbortController();

        performAnalysis(selectionText).catch(err => {
            if (err.name !== 'AbortError') console.error(err);
        });
    }
});

// Handle context menu clicks from background.js
document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.tab') || e.target.closest('select') || e.target.closest('button')) {
        e.preventDefault();
    }
});

document.addEventListener('DOMContentLoaded', async function () {
    await initializePrompts();
    await initializeLang();
    
    // Theme management - find all theme toggle buttons by class
    const themeToggles = document.querySelectorAll('.theme-toggle-btn');

    function updateAllThemeIcons(theme) {
        themeToggles.forEach(btn => {
            btn.textContent = theme === 'light' ? '☀️' : '🌙';
        });
    }

    // Load saved theme from localStorage or default to dark
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.body.setAttribute('data-theme', savedTheme);
    updateAllThemeIcons(savedTheme);

    // Add click handler for each theme toggle button
    themeToggles.forEach(toggle => {
        toggle.addEventListener('click', function(e) {
            e.stopPropagation();
            const currentTheme = document.body.getAttribute('data-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';

            // Update HTML attribute
            document.body.setAttribute('data-theme', newTheme);

            // Save to localStorage
            localStorage.setItem('theme', newTheme);

            // Update all toggle buttons icon
            updateAllThemeIcons(newTheme);
        });
    });

    // Tab switching
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });

    analyzeBtn.addEventListener('click', () => {
        performAnalysis();
    });

    stopBtn.addEventListener('click', () => {
        if (currentAbortController) {
            currentAbortController.abort();
        }
        showCancelButton(false);
    });

    clearBtn.addEventListener('click', () => {
        resultBody.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📝</div><p class="empty-state-text">Click "Process Page" to analyze content</p></div>';
        reasoningContainer.style.display = 'none';
        reasoningBody.textContent = '';
        reasoningBody.dataset.raw = '';
        errorOverlay.classList.remove('active');
        loadingOverlay.classList.remove('active');
        showCancelButton(false);
    });

    // Maximize reasoning panel
    let reasoningMaximized = false;
    maximizeReasoningBtn.addEventListener('click', () => {
        reasoningMaximized = !reasoningMaximized;
        
        if (reasoningMaximized) {
            reasoningBody.style.height = 'calc(100vh - 200px)';
            reasoningBody.style.maxHeight = 'calc(100vh - 200px)';
            reasoningBody.style.overflowY = 'scroll';
            maximizeReasoningBtn.textContent = '↙';
        } else {
            reasoningBody.style.height = 'calc(8 * 1.6em)';
            reasoningBody.style.maxHeight = 'calc(8 * 1.6em)';
            reasoningBody.style.overflowY = 'scroll';
            maximizeReasoningBtn.textContent = '⛶';
        }
    });

    // Initialize model loading
    loadLLMModels();

    llmSelect.addEventListener('change', () => {
        localStorage.setItem('lastSelectedModel', llmSelect.value);
        updateModelTitle();
    });

});
