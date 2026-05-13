// ------------------- DOM ELEMENTS (Config) -------------------------
const llmSelect = document.getElementById('llmSelect');
const promptSelect = document.getElementById('promptSelect');
const langSelect = document.getElementById('langSelect');
const maxLenInput = document.getElementById('maxLenInput');
const temperatureInput = document.getElementById('temperatureInput');
const temperatureThresholdInput = document.getElementById('temperatureThresholdInput');
const temperatureHighInput = document.getElementById('temperatureHighInput');
const promptEditorSelect = document.getElementById('promptEditorSelect');
const promptEditorTextarea = document.getElementById('promptEditorTextarea');
const savePromptBtn = document.getElementById('savePromptBtn');
const resetPromptBtn = document.getElementById('resetPromptBtn');
const editorHelp = document.getElementById('editorHelp');
const addLangBtn = document.getElementById('addLangBtn');
const newLangCode = document.getElementById('newLangCode');
const newLangName = document.getElementById('newLangName');
const langList = document.getElementById('langList');
const resetAllBtn = document.getElementById('resetAllBtn');
const resetStatus = document.getElementById('resetStatus');

// ------------------- PROMPT MANAGEMENT -------------------------
let currentLang = 'English';
let PROMPTS = {};
let promptsInitialized = false;
let DEFAULT_PROMPTS = {};

// ------------------- LANGUAGE CONFIG -------------------------
let LANG = {};
let langsInitialized = false;
let CUSTOM_LANGS = {};

/**
 * Loads the built-in language configuration from lang.json.
 * @returns {Promise<void>}
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
 * Returns a merged object of built-in and custom languages.
 * @returns {Object} Merged language code-to-name mapping.
 */
function getAllLangs() {
    return { ...LANG, ...CUSTOM_LANGS };
}

/**
 * Adds a custom language and persists it to localStorage.
 * @param {string} code - The language code (e.g. 'ja').
 * @param {string} name - The display name (e.g. 'Japanese').
 */
function addCustomLang(code, name) {
    CUSTOM_LANGS[code] = name;
    localStorage.setItem('customLangs', JSON.stringify(CUSTOM_LANGS));
    rebuildLangSelect();
}

/**
 * Removes a custom language and persists the change to localStorage.
 * @param {string} code - The language code to remove.
 */
function removeCustomLang(code) {
    delete CUSTOM_LANGS[code];
    localStorage.setItem('customLangs', JSON.stringify(CUSTOM_LANGS));
    rebuildLangSelect();
}

/**
 * Rebuilds the language select dropdown from the merged language list.
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
 * Initializes the language system: loads built-in langs, custom langs, and rebuilds the selector.
 * @returns {Promise<void>}
 */
async function initializeLang() {
    if (langsInitialized) return;
    await loadLang();
    loadCustomLangs();
    rebuildLangSelect();
    langsInitialized = true;
}

/**
 * Loads prompt templates from the config file and creates callable prompt functions.
 * @returns {Promise<void>}
 */
async function loadPrompts() {
    try {
        const response = await fetch(chrome.runtime.getURL('config/') + 'system-prompts.json');
        if (!response.ok) {
            throw new Error(`Failed to load prompt configuration: ${response.statusText}`);
        }
        const rawPrompts = await response.json();

        DEFAULT_PROMPTS = { ...rawPrompts };

        const storedDefaults = localStorage.getItem('defaultPrompts');
        if (!storedDefaults) {
            localStorage.setItem('defaultPrompts', JSON.stringify(rawPrompts));
        }

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
 * Retrieves custom prompts stored in localStorage.
 * @returns {Object} The custom prompts object.
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
 * Saves a custom prompt template to localStorage.
 * @param {string} key - The prompt key.
 * @param {string} template - The prompt template string.
 */
function saveCustomPrompt(key, template) {
    const customPrompts = getCustomPrompts();
    customPrompts[key] = template;
    localStorage.setItem('customPrompts', JSON.stringify(customPrompts));
}

/**
 * Removes a custom prompt from localStorage.
 * @param {string} key - The prompt key to remove.
 */
function removeCustomPrompt(key) {
    const customPrompts = getCustomPrompts();
    delete customPrompts[key];
    localStorage.setItem('customPrompts', JSON.stringify(customPrompts));
}

/**
 * Checks whether a prompt has been customized (i.e., differs from the default).
 * @param {string} key - The prompt key to check.
 * @returns {boolean} True if the prompt is customized.
 */
function isPromptCustomized(key) {
    const customPrompts = getCustomPrompts();
    return Object.hasOwnProperty.call(customPrompts, key);
}

/**
 * Creates a function from a prompt template that substitutes the language placeholder.
 * @param {string} template - The prompt template with ${lang} placeholders.
 * @returns {function} A function that takes a language string and returns the resolved prompt.
 */
function createPromptFunction(template) {
    if (!template) return () => '';
    return (lang) => template.replace(/\$\{lang\}/g, lang);
}

/**
 * Initializes the prompt system by loading prompt templates.
 * @returns {Promise<void>}
 */
/**
 * Populates #promptSelect and #promptEditorSelect from DEFAULT_PROMPTS keys.
 */
function populateTaskSelects() {
    const keys = Object.keys(DEFAULT_PROMPTS);
    
    // #promptSelect - output tab with display labels
    promptSelect.innerHTML = '';
    for (const key of keys) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        promptSelect.appendChild(opt);
    }
    
    // #promptEditorSelect - config tab with raw key names
    promptEditorSelect.innerHTML = '';
    for (const key of keys) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = key;
        promptEditorSelect.appendChild(opt);
    }
}

async function initializePrompts() {
    if (promptsInitialized) return;
    await loadPrompts();
    populateTaskSelects();
    promptsInitialized = true;
}

// ------------------- CONFIG MANAGEMENT -------------------------
const DEFAULT_CONFIG = {
    maxLen: 8000,
    temperature: 0.6,
    temperatureThreshold: 1000,
    temperatureHigh: 0.8
};

/**
 * Loads the application configuration from localStorage, merging with defaults.
 * @returns {Object} The merged configuration object.
 */
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

/**
 * Saves the application configuration to localStorage.
 * @param {Object} config - The configuration object to save.
 */
function saveConfig(config) {
    try {
        localStorage.setItem('llmSidebarConfig', JSON.stringify(config));
    } catch (error) {
        console.error('Failed to save config to localStorage.', error);
    }
}

let CONFIG = loadConfig();

// ------------------- CONFIG EVENT HANDLERS -------------------------
document.addEventListener('DOMContentLoaded', function () {
    // Language selector
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

    // Prompt editor
    /**
     * Loads a prompt template into the editor textarea for the given prompt key.
     * @param {string} key - The prompt key.
     */
    function loadPromptIntoEditor(key) {
        const customPrompts = getCustomPrompts();
        const customPrompt = customPrompts[key];
        const template = customPrompt || DEFAULT_PROMPTS[key] || '';
        
        promptEditorTextarea.value = template;
        
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
        initializePrompts();
        loadPromptIntoEditor(key);
    });

    resetPromptBtn.addEventListener('click', () => {
        const key = promptEditorSelect.value;
        if (isPromptCustomized(key)) {
            removeCustomPrompt(key);
            initializePrompts();
            loadPromptIntoEditor(key);
        }
    });

    loadPromptIntoEditor('summarize');

    // Language management
    /**
     * Renders the list of custom languages with remove buttons.
     */
    function renderLangList() {
        langList.innerHTML = '';
        for (const code in CUSTOM_LANGS) {
            const div = document.createElement('div');
            div.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: var(--surface-elevated); border-radius: var(--border-radius-sm); font-size: 13px;';
            div.innerHTML = `<span>${CUSTOM_LANGS[code]}</span><button class="remove-lang-btn" data-code="${code}" style="background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 16px;">✕</button>`;
            langList.appendChild(div);
        }

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

    // Load saved config values
    maxLenInput.value = CONFIG.maxLen;
    temperatureInput.value = CONFIG.temperature;
    temperatureThresholdInput.value = CONFIG.temperatureThreshold;
    temperatureHighInput.value = CONFIG.temperatureHigh;

    // Wire up config inputs to save on change
    /**
     * Reads config input values and saves the merged config to localStorage.
     */
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

    // Refresh models button
    const refreshModelsBtn = document.getElementById('refreshModelsBtn');
    if (refreshModelsBtn) {
        refreshModelsBtn.addEventListener('click', () => {
            modelsLoaded = false;
            loadLLMModels();
        });
    }
});
