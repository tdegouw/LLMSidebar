let modelsLoaded = false;

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
        const response = await fetch('http://localhost:1234/api/v0/models');
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }
        const data = await response.json();
        populateModelSelect(llmSelect, data.data);
    } catch (error) {
        console.error('Failed to load models:', error);
        llmSelect.innerHTML = '<option value="">LM Studio not available</option>';
        updateModelTitle();
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

    // Update the header title after populating the select
    updateModelTitle();
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
const analyzeBtn = document.getElementById('analyzeBtn');

// Form inputs - visible on config tab
const llmSelect = document.getElementById('llmSelect');
const promptSelect = document.getElementById('promptSelect');
const langSelect = document.getElementById('langSelect');

// Config inputs
const maxLenInput = document.getElementById('maxLenInput');
const temperatureInput = document.getElementById('temperatureInput');
const temperatureThresholdInput = document.getElementById('temperatureThresholdInput');
const temperatureHighInput = document.getElementById('temperatureHighInput');

// Prompt editor inputs
const promptEditorSelect = document.getElementById('promptEditorSelect');
const promptEditorTextarea = document.getElementById('promptEditorTextarea');
const savePromptBtn = document.getElementById('savePromptBtn');
const resetPromptBtn = document.getElementById('resetPromptBtn');
const editorHelp = document.getElementById('editorHelp');

// Tab navigation
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

// ------------------- PROMPT MANAGEMENT -------------------------
let currentLang = 'English';
let PROMPTS = {}; // Will be populated from external JSON
let promptsInitialized = false;
let DEFAULT_PROMPTS = {}; // Raw default templates for editor

// ------------------- LANGUAGE CONFIG -------------------------
let LANG = {};
let langsInitialized = false;
let CUSTOM_LANGS = {};

/**
 * Loads language options from the external configuration file.
 */
async function loadLang() {
    try {
        const response = await fetch(chrome.runtime.getURL('config/') + 'lang.json');
        if (!response.ok) {
            throw new Error(`Failed to load language configuration: ${response.statusText}`);
        }
        LANG = await response.json();
    } catch (error) {
        console.error('FATAL ERROR: Could not load language config from file.', error);
        LANG = { english: 'English' };
    }
}

/**
 * Loads custom languages from localStorage.
 */
function loadCustomLangs() {
    try {
        const stored = localStorage.getItem('customLangs');
        CUSTOM_LANGS = stored ? JSON.parse(stored) : {};
    } catch (error) {
        console.error('Failed to load custom languages from localStorage.', error);
        CUSTOM_LANGS = {};
    }
}

/**
 * Gets the merged language list (config + custom).
 */
function getAllLangs() {
    return { ...LANG, ...CUSTOM_LANGS };
}

/**
 * Adds a custom language.
 */
function addCustomLang(code, name) {
    CUSTOM_LANGS[code] = name;
    localStorage.setItem('customLangs', JSON.stringify(CUSTOM_LANGS));
    rebuildLangSelect();
}

/**
 * Removes a custom language.
 */
function removeCustomLang(code) {
    delete CUSTOM_LANGS[code];
    localStorage.setItem('customLangs', JSON.stringify(CUSTOM_LANGS));
    rebuildLangSelect();
}

/**
 * Rebuilds the language selector dropdown.
 */
function rebuildLangSelect() {
    const allLangs = getAllLangs();
    langSelect.innerHTML = '';
    for (const code in allLangs) {
        const opt = document.createElement('option');
        opt.value = code;
        opt.textContent = allLangs[code];
        langSelect.appendChild(opt);
    }
}

/**
 * Initializes language config - can be called multiple times safely
 */
async function initializeLang() {
    if (langsInitialized) return;
    await loadLang();
    loadCustomLangs();
    rebuildLangSelect();
    langsInitialized = true;
}

/**
 * Loads all system prompts from the external configuration file.
 */
async function loadPrompts() {
    try {
        const response = await fetch(chrome.runtime.getURL('config/') + 'system-prompts.json');
        if (!response.ok) {
            throw new Error(`Failed to load prompt configuration: ${response.statusText}`);
        }
        const rawPrompts = await response.json();

        // Store default prompts for the editor to reference
        DEFAULT_PROMPTS = { ...rawPrompts };

        // Also persist defaults in localStorage so they survive page reloads
        const storedDefaults = localStorage.getItem('defaultPrompts');
        if (!storedDefaults) {
            localStorage.setItem('defaultPrompts', JSON.stringify(rawPrompts));
        }

        // Merge with any custom prompts from localStorage
        const customPrompts = getCustomPrompts();
        PROMPTS = {};
        for (const key in rawPrompts) {
            if (Object.hasOwnProperty.call(rawPrompts, key)) {
                const template = customPrompts[key] || rawPrompts[key];
                const fn = createPromptFunction(template);
                PROMPTS[key] = fn;
            }
        }
    } catch (error) {
        console.error('FATAL ERROR: Could not load prompts from config file.', error);
        PROMPTS = {};
        DEFAULT_PROMPTS = {};
    }
}

/**
 * Gets custom prompts from localStorage.
 */
function getCustomPrompts() {
    try {
        const stored = localStorage.getItem('customPrompts');
        return stored ? JSON.parse(stored) : {};
    } catch (error) {
        console.error('Failed to load custom prompts from localStorage.', error);
        return {};
    }
}

/**
 * Saves a custom prompt to localStorage.
 */
function saveCustomPrompt(key, template) {
    const customPrompts = getCustomPrompts();
    customPrompts[key] = template;
    localStorage.setItem('customPrompts', JSON.stringify(customPrompts));
}

/**
 * Removes a custom prompt from localStorage.
 */
function removeCustomPrompt(key) {
    const customPrompts = getCustomPrompts();
    delete customPrompts[key];
    localStorage.setItem('customPrompts', JSON.stringify(customPrompts));
}

/**
 * Checks if a prompt has been customized by the user.
 */
function isPromptCustomized(key) {
    const customPrompts = getCustomPrompts();
    return Object.hasOwnProperty.call(customPrompts, key);
}

/**
 * Generates a prompt function from the template string loaded from JSON.
 */
function createPromptFunction(template) {
    if (!template) return () => '';
    return (lang) => template.replace(/\$\{lang\}/g, lang);
}

/**
 * Initializes prompts - can be called multiple times safely
 */
async function initializePrompts() {
    if (promptsInitialized) return;
    await loadPrompts();
    promptsInitialized = true;
}

// ------------------- CONFIG MANAGEMENT -------------------------
const DEFAULT_CONFIG = {
    maxLen: 8000,
    temperature: 0.6,
    temperatureThreshold: 1000,
    temperatureHigh: 0.8
};

function loadConfig() {
    try {
        const stored = localStorage.getItem('llmSidebarConfig');
        if (stored) {
            return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
        }
    } catch (error) {
        console.error('Failed to load config from localStorage.', error);
    }
    return { ...DEFAULT_CONFIG };
}

function saveConfig(config) {
    try {
        localStorage.setItem('llmSidebarConfig', JSON.stringify(config));
    } catch (error) {
        console.error('Failed to save config to localStorage.', error);
    }
}

let CONFIG = loadConfig();

async function performAnalysis(contentToSend = null) {
    // Ensure prompts are loaded before proceeding
    if (!promptsInitialized) {
        await initializePrompts();
    }

    if (!contentToSend) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
            throw new Error("No active tab found.");
        }
        contentToSend = await extractPageContent(tab.id);
    }

    if (!contentToSend || contentToSend.trim() === '') {
        throw new Error("No text found to analyze!");
    }

    // Hide loading overlay - streaming text is the visual feedback
    loadingOverlay.classList.remove('active');
    errorOverlay.classList.remove('active');
    statusIndicator.classList.add('active');

    try {
        const selectedModel = llmSelect.value;
        if (!selectedModel) {
            throw new Error("Please select an LLM model first.");
        }
        const promptType = promptSelect.value;
        currentLang = getAllLangs()[langSelect.value] || 'English';

        // Verify we have a function before calling
        if (typeof PROMPTS[promptType] !== 'function') {
            console.error('PROMPTS object state:', PROMPTS);
            throw new Error(`Invalid prompt type: ${promptType}`);
        }

        const promptText = PROMPTS[promptType](currentLang);

        // Clear previous results
        resultBody.innerHTML = '';
        reasoningBody.textContent = '';
        reasoningBody.dataset.raw = '';
        reasoningContainer.style.display = 'none';
        let accumulated = '';

        // Stream the response
        await streamChatCompletion(selectedModel, promptText, contentToSend, (chunk) => {
            accumulated += chunk;
            resultBody.innerHTML = markdownToHtml(accumulated);
        }, (reasoningChunk) => {
            reasoningContainer.style.display = 'block';
            reasoningBody.dataset.raw = (reasoningBody.dataset.raw || '') + reasoningChunk;
            reasoningBody.innerHTML = markdownToHtml(reasoningBody.dataset.raw);
            reasoningBody.scrollTop = reasoningBody.scrollHeight;
        });

        // Final render of results
        resultBody.innerHTML = markdownToHtml(accumulated);

    } catch (error) {
        console.error('Error during analysis:', error);
        errorMessage.textContent = error.message;
        errorOverlay.classList.add('active');
    } finally {
        loadingOverlay.classList.remove('active');
        statusIndicator.classList.remove('active');
    }
}


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "LLMsidebarMessage") {
        console.log("Data received from context menu:", message.data);

        const selectionText = message.data.selectionText || '';

        // Open the sidebar (in case it's closed)
        chrome.sidePanel.open({ tabId: message.data.tabId }).catch(() => {});

        // Perform analysis with the selected text - this will now wait for prompts to load
        performAnalysis(selectionText)
            .catch(err => {
                console.error(err);
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
    
    const body = document.body;

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

    langSelect.addEventListener('change', function () {
        currentLang = getAllLangs()[this.value] || 'English';
        localStorage.setItem('selectedLang', this.value);
        updateLangDisplay();
    });

    // Restore saved language
    const savedLang = localStorage.getItem('selectedLang');
    if (savedLang) {
        langSelect.value = savedLang;
        currentLang = getAllLangs()[savedLang] || 'English';
    }

    function updateLangDisplay() {
        const display = document.getElementById('currentLangDisplay');
        if (display) {
            display.textContent = 'Current language: ' + currentLang;
        }
    }

    updateLangDisplay();

    analyzeBtn.addEventListener('click', () => {
        performAnalysis();
    });

    // Prompt editor
    function loadPromptIntoEditor(key) {
        const customPrompts = getCustomPrompts();
        const customPrompt = customPrompts[key];
        const template = customPrompt || DEFAULT_PROMPTS[key] || '';
        
        promptEditorTextarea.value = template;
        
        // Update help text
        if (customPrompt) {
            editorHelp.textContent = 'Custom prompt - changes are saved to localStorage';
        } else {
            editorHelp.textContent = 'Default prompt loaded from config';
        }
    }

    promptEditorSelect.addEventListener('change', () => {
        loadPromptIntoEditor(promptEditorSelect.value);
    });

    savePromptBtn.addEventListener('click', () => {
        const key = promptEditorSelect.value;
        const template = promptEditorTextarea.value;
        saveCustomPrompt(key, template);
        initializePrompts(); // Reload prompts to apply changes
        loadPromptIntoEditor(key);
    });

    resetPromptBtn.addEventListener('click', () => {
        const key = promptEditorSelect.value;
        if (isPromptCustomized(key)) {
            removeCustomPrompt(key);
            initializePrompts(); // Reload prompts to apply changes
            loadPromptIntoEditor(key);
        }
    });

    // Initialize prompt editor with summarize prompt
    loadPromptIntoEditor('summarize');

    // Language management
    const addLangBtn = document.getElementById('addLangBtn');
    const newLangCode = document.getElementById('newLangCode');
    const newLangName = document.getElementById('newLangName');
    const langList = document.getElementById('langList');

    function renderLangList() {
        langList.innerHTML = '';
        for (const code in CUSTOM_LANGS) {
            const div = document.createElement('div');
            div.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: var(--surface-elevated); border-radius: var(--border-radius-sm); font-size: 13px;';
            div.innerHTML = `<span>${CUSTOM_LANGS[code]}</span><button class="remove-lang-btn" data-code="${code}" style="background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 16px;">✕</button>`;
            langList.appendChild(div);
        }

        // Add click handlers for remove buttons
        langList.querySelectorAll('.remove-lang-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const code = btn.dataset.code;
                removeCustomLang(code);
                renderLangList();
            });
        });
    }

    addLangBtn.addEventListener('click', () => {
        const code = newLangCode.value.trim().toLowerCase();
        const name = newLangName.value.trim();
        if (code && name) {
            addCustomLang(code, name);
            newLangCode.value = '';
            newLangName.value = '';
            renderLangList();
        }
    });

    renderLangList();

    // Reset all
    const resetAllBtn = document.getElementById('resetAllBtn');
    const resetStatus = document.getElementById('resetStatus');
    resetAllBtn.addEventListener('click', () => {
        localStorage.removeItem('customLangs');
        localStorage.removeItem('customPrompts');
        localStorage.removeItem('defaultPrompts');
        localStorage.removeItem('selectedLang');
        localStorage.removeItem('theme');
        localStorage.removeItem('llmSidebarConfig');
        CUSTOM_LANGS = {};
        CONFIG = { ...DEFAULT_CONFIG };
        initializeLang();
        loadPromptIntoEditor('summarize');
        maxLenInput.value = CONFIG.maxLen;
        temperatureInput.value = CONFIG.temperature;
        temperatureThresholdInput.value = CONFIG.temperatureThreshold;
        temperatureHighInput.value = CONFIG.temperatureHigh;
        resetStatus.style.display = 'block';
        setTimeout(() => { resetStatus.style.display = 'none'; }, 3000);
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

    llmSelect.addEventListener('change', updateModelTitle);

    // Load saved config values
    maxLenInput.value = CONFIG.maxLen;
    temperatureInput.value = CONFIG.temperature;
    temperatureThresholdInput.value = CONFIG.temperatureThreshold;
    temperatureHighInput.value = CONFIG.temperatureHigh;

    // Wire up config inputs to save on change
    function onConfigChange() {
        CONFIG.maxLen = parseInt(maxLenInput.value) || DEFAULT_CONFIG.maxLen;
        CONFIG.temperature = parseFloat(temperatureInput.value) || DEFAULT_CONFIG.temperature;
        CONFIG.temperatureThreshold = parseInt(temperatureThresholdInput.value) || DEFAULT_CONFIG.temperatureThreshold;
        CONFIG.temperatureHigh = parseFloat(temperatureHighInput.value) || DEFAULT_CONFIG.temperatureHigh;
        saveConfig(CONFIG);
    }

    maxLenInput.addEventListener('input', onConfigChange);
    temperatureInput.addEventListener('input', onConfigChange);
    temperatureThresholdInput.addEventListener('input', onConfigChange);
    temperatureHighInput.addEventListener('input', onConfigChange);

});
