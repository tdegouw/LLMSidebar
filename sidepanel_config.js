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



const ConfigState = {
    currentLang : 'English',
    PROMPTS: {},
    DEFAULT_PROMPTS: {},
    LANG : {},
    CUSTOM_LANGS : {},
    DEFAULT_CONFIG : {
        maxLen: 8000,
        temperature: 0.6,
        temperatureThreshold: 1000,
        temperatureHigh: 0.8
    },
    CONFIG : {},
    loadConfig(setDefault) {
        if(setDefault) {
            this.CONFIG = { ...this.DEFAULT_CONFIG };
        }

        try {
            const stored = localStorage.getItem('llmSidebarConfig');
            this.CONFIG = stored ? { ...this.DEFAULT_CONFIG, ...JSON.parse(stored) } : { ...this.DEFAULT_CONFIG };
        } catch {
            this.CONFIG = { ...this.DEFAULT_CONFIG };
        }
    },
    saveConfig() {
        localStorage.setItem('llmSidebarConfig', JSON.stringify(this.CONFIG));
    },
    promptsInitialized() {
        return ConfigStateState.PROMPTS.length > 1
    },
    async loadPrompts() {
        try {
            const response = await fetch(chrome.runtime.getURL('config/') + 'system-prompts.json');
            if (!response.ok) throw new Error(`Failed to load prompts: ${response.statusText}`);

            const rawPrompts = await response.json();
            this.DEFAULT_PROMPTS = { ...rawPrompts };

            if (!localStorage.getItem('defaultPrompts')) {
                localStorage.setItem('defaultPrompts', JSON.stringify(rawPrompts));
            }

            const customPrompts = getCustomPrompts();
            this.PROMPTS = {};

            for (const key in rawPrompts) {
                const template = customPrompts[key] || rawPrompts[key];
                this.PROMPTS[key] = createPromptFunction(template);
            }
        } catch (error) {
            console.error('FATAL ERROR loading prompts:', error);
            this.PROMPTS = {};
            this.DEFAULT_PROMPTS = {};
        }
    },
    async loadLang() {
        try {
            const response = await fetch(chrome.runtime.getURL('config/') + 'lang.json');
            if (!response.ok) throw new Error(`Failed to load lang.json: ${response.statusText}`);
            this.LANG = await response.json();
        } catch (error) {
            console.error('FATAL ERROR: Could not load language config.', error);
            this.LANG = { english: 'English' };
        }
    },
    async initializeLang(langSelectElement) {
        await this.loadLang();
        this.loadCustomLangs();
        this.rebuildLangSelect(langSelectElement);

        // === Restore Last Language selected  ===
        const savedLang = localStorage.getItem('selectedLang');
        if (savedLang && this.getAllLangs()[savedLang]) {
            langSelectElement.value = savedLang;
            this.currentLang = this.getAllLangs()[savedLang];
            UIState.setCurrentLanguage(this.currentLang)
        } else {
            // fallback
            const firstLang = Object.keys(this.getAllLangs())[0] || 'english';
            langSelect.value = firstLang;
            this.currentLang = this.getAllLangs()[firstLang] || 'English';
            UIState.setCurrentLanguage(this.currentLang)
        }
    },
    /**
     * Rebuilds the language <select> dropdown
     * @param {HTMLSelectElement} langSelectElement
     */
    rebuildLangSelect(langSelectElement) {
        if (!langSelectElement) return;
        const allLangs = this.getAllLangs();
        langSelectElement.innerHTML = '';
        for (const code in allLangs) {
            const opt = document.createElement('option');
            opt.value = code;
            opt.textContent = allLangs[code];
            langSelectElement.appendChild(opt);
        }
    },
    loadCustomLangs() {
        try {
            const stored = localStorage.getItem('customLangs');
            this.CUSTOM_LANGS = stored ? JSON.parse(stored) : {};
        } catch {
            this.CUSTOM_LANGS = {};
        }
    },
    getAllLangs() {
        return { ...this.LANG, ...this.CUSTOM_LANGS };
    },
    addCustomLang(code, name) {
        this.CUSTOM_LANGS[code] = name;
        localStorage.setItem('customLangs', JSON.stringify(this.CUSTOM_LANGS));
        rebuildLangSelect();
    },
    removeCustomLang(code) {
        delete this.CUSTOM_LANGS[code];
        localStorage.setItem('customLangs', JSON.stringify(this.CUSTOM_LANGS));
        rebuildLangSelect();
    }

}

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

// ------------------- PROMPTS -------------------------
function populateTaskSelects(ConfigStateRef) {
        const keys = Object.keys(ConfigStateRef.DEFAULT_PROMPTS);
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


// Language management
function renderLangList() {
    langList.innerHTML = '';
    Object.keys(ConfigState.CUSTOM_LANGS).forEach(code => {
        const div = document.createElement('div');
        div.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--surface-elevated);border-radius:var(--border-radius-sm);font-size:13px;';
        div.innerHTML = `<span>${ConfigState.CUSTOM_LANGS[code]}</span><button class="remove-lang-btn" data-code="${code}" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;">✕</button>`;
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


// Prompt Editor
function loadPromptIntoEditor(key) {
    const custom = getCustomPrompts()[key];
    const template = custom || ConfigState.DEFAULT_PROMPTS[key] || '';
    promptEditorTextarea.value = template;
    editorHelp.textContent = custom 
        ? 'Custom prompt - changes saved to localStorage' 
        : 'Default prompt loaded from config';
}

function onConfigChange() {
    ConfigState.CONFIG.maxLen = parseInt(maxLenInput.value) || ConfigState.DEFAULT_CONFIG.maxLen;
    ConfigState.CONFIG.temperature = parseFloat(temperatureInput.value) || ConfigState.DEFAULT_CONFIG.temperature;
    ConfigState.CONFIG.temperatureThreshold = parseInt(temperatureThresholdInput.value) || ConfigState.DEFAULT_CONFIG.temperatureThreshold;
    ConfigState.CONFIG.temperatureHigh = parseFloat(temperatureHighInput.value) || ConfigState.DEFAULT_CONFIG.temperatureHigh;
    ConfigState.saveConfig();
}


function fillTemperatureValues() {
    maxLenInput.value = ConfigState.CONFIG.maxLen;
    temperatureInput.value = ConfigState.CONFIG.temperature;
    temperatureThresholdInput.value = ConfigState.CONFIG.temperatureThreshold;
    temperatureHighInput.value = ConfigState.CONFIG.temperatureHigh;
}

async function resetAll() {
    localStorage.removeItem('customLangs');
    localStorage.removeItem('customPrompts');
    localStorage.removeItem('defaultPrompts');
    localStorage.removeItem('selectedLang');
    localStorage.removeItem('theme');
    localStorage.removeItem('llmSidebarConfig');

    ConfigState.CUSTOM_LANGS = {};
    ConfigState.loadConfig(true)
    ConfigState.initializeLang();
    await ConfigState.loadPrompts();
    loadPromptIntoEditor('summarize');
    fillTemperatureValues()
    // Show the reset popup
    resetStatus.style.display = 'block';
    setTimeout(() => resetStatus.style.display = 'none', 3000);
}

function resetPrompt() {
        const key = promptEditorSelect.value;
        if (isPromptCustomized(key)) {
            removeCustomPrompt(key);
            loadPromptIntoEditor(key);
        }
    }

// ------------------- CONFIG EVENT HANDLERS -------------------------
document.addEventListener('DOMContentLoaded', async function () {

    // On load, preload our config object en entries
    await ConfigState.loadConfig();
    await ConfigState.loadPrompts();
    await ConfigState.initializeLang(langSelect);

    // Initial model load
    loadLLMModels();

    // Fill the edit dropdown with prompts to edit
    populateTaskSelects(ConfigState);

    promptEditorSelect.addEventListener('change', () => loadPromptIntoEditor(promptEditorSelect.value));

    savePromptBtn.addEventListener('click', () => {
        saveCustomPrompt(promptEditorSelect.value, promptEditorTextarea.value);
        loadPromptIntoEditor(promptEditorSelect.value);
    });

    resetPromptBtn.addEventListener('click', () => resetPrompt());

    // Reset All
    resetAllBtn.addEventListener('click', () => resetAll()); 

    fillTemperatureValues()
    loadPromptIntoEditor('summarize');
    renderLangList();

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
        ConfigState.currentLang = ConfigState.getAllLangs()[langSelect.value] || 'English';
        localStorage.setItem('selectedLang', langSelect.value);
        UIState.setCurrentLanguage(ConfigState.currentLang)
    });

    // Model change
    llmSelect?.addEventListener('change', () => {
        localStorage.setItem('lastSelectedModel', llmSelect.value);
        UIState.setCurrentModelName(llmSelect.value);
    });

});