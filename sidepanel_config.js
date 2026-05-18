// ==================== CONFIG & PROMPT MANAGEMENT ====================

// DOM Elements (Config tab)
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

// ------------------- STATE -------------------------
let currentLang = 'English';
let PROMPTS = {};
let promptsInitialized = false;
let DEFAULT_PROMPTS = {};

let LANG = {};
let langsInitialized = false;
let CUSTOM_LANGS = {};

const DEFAULT_CONFIG = {
    maxLen: 8000,
    temperature: 0.6,
    temperatureThreshold: 1000,
    temperatureHigh: 0.8
};

let CONFIG = loadConfig();


// ------------------- MODEL -------------------
function populateModelSelect(selectElement, models) {
    selectElement.innerHTML = '';
    const llmModels = models.filter(m => m.type === 'llm' || m.type === 'vlm');

    if (llmModels.length > 0) {
        llmModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = `${model.id} (${model.state})`;
            selectElement.appendChild(option);
        });
    } else {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No LLM models found';
        selectElement.appendChild(option);
    }

    const lastModel = localStorage.getItem('lastSelectedModel');
    if (lastModel && Array.from(selectElement.options).some(opt => opt.value === lastModel)) {
        selectElement.value = lastModel;
    }
    UIState.setCurrentModelName(llmSelect.value);
}

async function loadLLMModels() {
    if (modelsLoaded) return;
    modelsLoaded = true;
    if (!llmSelect) return;

    try {
        const models = await loadModelsFromAPI();
        populateModelSelect(llmSelect, models);
    } catch (error) {
        console.error('Failed to load models:', error);
        llmSelect.innerHTML = '<option value="">LM Studio not available</option>';
        updateModelTitle();
    }
}

// ------------------- LANGUAGE -------------------------
async function loadLang() {
    try {
        const response = await fetch(chrome.runtime.getURL('config/') + 'lang.json');
        if (!response.ok) throw new Error(`Failed to load lang.json: ${response.statusText}`);
        LANG = await response.json();
    } catch (error) {
        console.error('FATAL ERROR: Could not load language config.', error);
        LANG = { english: 'English' };
    }
}

function loadCustomLangs() {
    try {
        const stored = localStorage.getItem('customLangs');
        CUSTOM_LANGS = stored ? JSON.parse(stored) : {};
    } catch {
        CUSTOM_LANGS = {};
    }
}

function getAllLangs() {
    return { ...LANG, ...CUSTOM_LANGS };
}

function addCustomLang(code, name) {
    CUSTOM_LANGS[code] = name;
    localStorage.setItem('customLangs', JSON.stringify(CUSTOM_LANGS));
    rebuildLangSelect();
}

function removeCustomLang(code) {
    delete CUSTOM_LANGS[code];
    localStorage.setItem('customLangs', JSON.stringify(CUSTOM_LANGS));
    rebuildLangSelect();
}

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

async function initializeLang() {
    if (langsInitialized) return;
    await loadLang();
    loadCustomLangs();
    rebuildLangSelect();

    // === Restore Last Language selected  ===
    const savedLang = localStorage.getItem('selectedLang');
    if (savedLang && getAllLangs()[savedLang]) {
        langSelect.value = savedLang;
        currentLang = getAllLangs()[savedLang];
        UIState.setCurrentLanguage(currentLang)
    } else {
        // fallback
        const firstLang = Object.keys(getAllLangs())[0] || 'english';
        langSelect.value = firstLang;
        currentLang = getAllLangs()[firstLang] || 'English';
        UIState.setCurrentLanguage(currentLang)
    }
    langsInitialized = true;
}

// ------------------- PROMPTS -------------------------
function createPromptFunction(template) {
    if (!template) return () => '';
    return (lang) => template.replace(/\${lang}/g, lang);
}

function getCustomPrompts() {
    try {
        const stored = localStorage.getItem('customPrompts');
        return stored ? JSON.parse(stored) : {};
    } catch {
        return {};
    }
}

function saveCustomPrompt(key, template) {
    const customPrompts = getCustomPrompts();
    customPrompts[key] = template;
    localStorage.setItem('customPrompts', JSON.stringify(customPrompts));
}

function removeCustomPrompt(key) {
    const customPrompts = getCustomPrompts();
    delete customPrompts[key];
    localStorage.setItem('customPrompts', JSON.stringify(customPrompts));
}

function isPromptCustomized(key) {
    return Object.prototype.hasOwnProperty.call(getCustomPrompts(), key);
}

async function loadPrompts() {
    try {
        const response = await fetch(chrome.runtime.getURL('config/') + 'system-prompts.json');
        if (!response.ok) throw new Error(`Failed to load prompts: ${response.statusText}`);

        const rawPrompts = await response.json();
        DEFAULT_PROMPTS = { ...rawPrompts };

        if (!localStorage.getItem('defaultPrompts')) {
            localStorage.setItem('defaultPrompts', JSON.stringify(rawPrompts));
        }

        const customPrompts = getCustomPrompts();
        PROMPTS = {};

        for (const key in rawPrompts) {
            const template = customPrompts[key] || rawPrompts[key];
            PROMPTS[key] = createPromptFunction(template);
        }
    } catch (error) {
        console.error('FATAL ERROR loading prompts:', error);
        PROMPTS = {};
        DEFAULT_PROMPTS = {};
    }
}

function populateTaskSelects() {
    const keys = Object.keys(DEFAULT_PROMPTS);

    // Output tab
    promptSelect.innerHTML = '';
    keys.forEach(key => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        promptSelect.appendChild(opt);
    });

    // Config tab
    promptEditorSelect.innerHTML = '';
    keys.forEach(key => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = key;
        promptEditorSelect.appendChild(opt);
    });
}

async function initializePrompts() {
    if (promptsInitialized) return;
    await loadPrompts();
    populateTaskSelects();
    promptsInitialized = true;
}

// ------------------- CONFIG -------------------------
function loadConfig() {
    try {
        const stored = localStorage.getItem('llmSidebarConfig');
        return stored ? { ...DEFAULT_CONFIG, ...JSON.parse(stored) } : { ...DEFAULT_CONFIG };
    } catch {
        return { ...DEFAULT_CONFIG };
    }
}

function saveConfig(config) {
    localStorage.setItem('llmSidebarConfig', JSON.stringify(config));
}

// ------------------- CONFIG EVENT HANDLERS -------------------------
document.addEventListener('DOMContentLoaded', function () {

    // Initial model load
    loadLLMModels();
    initializeLang();

    // Prompt Editor
    function loadPromptIntoEditor(key) {
        const custom = getCustomPrompts()[key];
        const template = custom || DEFAULT_PROMPTS[key] || '';
        promptEditorTextarea.value = template;
        editorHelp.textContent = custom 
            ? 'Custom prompt - changes saved to localStorage' 
            : 'Default prompt loaded from config';
    }

    promptEditorSelect.addEventListener('change', () => loadPromptIntoEditor(promptEditorSelect.value));
    savePromptBtn.addEventListener('click', () => {
        saveCustomPrompt(promptEditorSelect.value, promptEditorTextarea.value);
        initializePrompts();
        loadPromptIntoEditor(promptEditorSelect.value);
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
    function renderLangList() {
        langList.innerHTML = '';
        Object.keys(CUSTOM_LANGS).forEach(code => {
            const div = document.createElement('div');
            div.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--surface-elevated);border-radius:var(--border-radius-sm);font-size:13px;';
            div.innerHTML = `<span>${CUSTOM_LANGS[code]}</span><button class="remove-lang-btn" data-code="${code}" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;">✕</button>`;
            langList.appendChild(div);
        });

        langList.querySelectorAll('.remove-lang-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                removeCustomLang(btn.dataset.code);
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

    // Reset All
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
        setTimeout(() => resetStatus.style.display = 'none', 3000);
    });

    // Load config values
    maxLenInput.value = CONFIG.maxLen;
    temperatureInput.value = CONFIG.temperature;
    temperatureThresholdInput.value = CONFIG.temperatureThreshold;
    temperatureHighInput.value = CONFIG.temperatureHigh;

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
            if (typeof modelsLoaded !== 'undefined') modelsLoaded = false;
            if (typeof loadLLMModels === 'function') loadLLMModels();
        });
    }


    // Language
    langSelect.addEventListener('change', function () {
        console.info('Switching language to ' + langSelect.value)
        currentLang = getAllLangs()[langSelect.value] || 'English';
        localStorage.setItem('selectedLang', langSelect.value);
        UIState.setCurrentLanguage(currentLang)
    });

    // Model change
    llmSelect?.addEventListener('change', () => {
        localStorage.setItem('lastSelectedModel', llmSelect.value);
        UIState.setCurrentModelName(llmSelect.value);
    });

});