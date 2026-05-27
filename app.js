/**
 * App – Composition Root
 *
 * This object is the single source of truth for wiring the entire application.
 * It is responsible for:
 *   - Creating all services and adapters (with proper dependency injection)
 *   - Creating the UI views and thin controllers
 *   - Wiring callbacks between collaborators
 *   - Managing cross-cutting concerns (messaging setup, model loading at startup, LAST_MODEL persistence)
 *
 * The two main user flows (Process Page + context menu "Send to LLM") have been
 * deliberately extracted into AnalysisController so this file can stay extremely thin.
 *
 * Design goals (per AGENTS.md + ARCHITECTURE.md):
 * - Keep this file as a pure "parts list + bootstrap", not a god object.
 * - Zero direct DOM access anywhere in this file.
 * - Zero direct .style.* manipulation.
 * - All significant behavior lives in focused services / adapters / controllers / views.
 *
 * Public surface (used by sidepanel-init.js):
 *   - App.init()
 *   - App.processPendingContextMessage(message)
 */

import { createStorage } from './adapters/storage.js';
import { createThemeService } from './services/theme-service.js';
import { createConfigService } from './services/config-service.js';
import { createLLMAdapter } from './adapters/llm-adapter.js';
import { createContentExtractor } from './adapters/content-extractor.js';
import { createConfigResources } from './adapters/config-resources.js';
import { createActiveTabProvider } from './adapters/active-tab.js';
import { createAnalysisService } from './services/analysis-service.js';
import { createOutputView } from './ui/output-view.js';
import { createConfigView } from './ui/config-view.js';
import { createTabController } from './ui/tab-controller.js';
import { createThemeController } from './ui/theme-controller.js';
import { createHeaderView } from './ui/header-view.js';
import { createAnalysisController } from './ui/analysis-controller.js';
import { createSidepanelMessaging } from './adapters/messaging.js';
import { markdownToHtml } from './core/markdown.js';

export const App = {
  // === Injected Dependencies (populated in init) ===
  storage: null,
  themeService: null,
  configService: null,
  llmAdapter: null,
  contentExtractor: null,
  analysisService: null,
  outputView: null,
  configView: null,
  tabController: null,
  themeController: null,
  headerView: null,
  analysisController: null,
  messaging: null,

  // =====================================================
  // PUBLIC API
  // =====================================================

  /**
   * Bootstraps the entire application.
   * Must be called once on DOMContentLoaded.
   */
  async init() {
    this._createInfrastructure();
    this._createServicesAndAdapters();
    this._createViews();
    await this._initializeUI();

    this._setupMessaging();
    this.messaging.notifyReady();

    console.log('[App] Composition root initialized');
  },

  /**
   * Called by sidepanel-init.js when a context menu message
   * arrived before App.init() had finished.
   * Real handling is delegated to AnalysisController.
   */
  processPendingContextMessage(message) {
    if (message?.type === 'LLMsidebarMessage') {
      this.analysisController?.handleContextMenuMessage(message);
    }
  },

  // =====================================================
  // PRIVATE SETUP
  // =====================================================

  _createInfrastructure() {
    this.storage = createStorage();

    this.themeService = createThemeService(this.storage);

    // Dedicated controller owns the header toggle button, icon updates,
    // and body[data-theme] application. ThemeService is now purely persistence.
    this.themeController = createThemeController({ themeService: this.themeService });
    this.themeController.initialize();
  },

  _createServicesAndAdapters() {
    // Explicit DI: config resources adapter owns the (chrome + fetch) loading of the two static JSONs.
    // ConfigService stays pure application logic + state.
    const configResources = createConfigResources();
    this.configService = createConfigService({ storage: this.storage, configResources });
    // configService.initialize() is async → called later in _initializeUI

    this.llmAdapter = createLLMAdapter();
    this.contentExtractor = createContentExtractor();

    // Active tab capability is provided by a dedicated adapter so the
    // Composition Root stays free of direct Chrome API calls.
    const activeTabProvider = createActiveTabProvider();

    this.analysisService = createAnalysisService({
      llmAdapter: this.llmAdapter,
      contentExtractor: this.contentExtractor,
      configService: this.configService,
      getActiveTabId: activeTabProvider.getActiveTabId,
    });
  },

  _createViews() {
    this.outputView = createOutputView({
      // NOTE: we reference analysisController via `this` because it is created
      // synchronously later in this same method. By the time any user action
      // can fire the callback, the controller will be assigned.
      onAnalyze: () => this.analysisController?.handleAnalyze(),
      onStop: () => this.analysisService?.abort(),
      onClear: () => this._resetResults(),
      renderMarkdown: markdownToHtml,
    });

    this.configView = createConfigView({
      configService: this.configService,
      onModelChange: (model) => {
        // HeaderView owns the visible title; storage owns LAST_MODEL persistence.
        this.headerView?.setModelName(model);
        this.storage.set(this.storage.keys.LAST_MODEL, model);
      },
      onLanguageChange: () => {
        // Placeholder for future live language display updates
      },
      onRefreshModels: () => this._loadModels(),
    });

    this.tabController = createTabController();
    this.headerView = createHeaderView();

    // Analysis orchestration extracted here (highest-leverage lightening step).
    // All flow logic that used to live in _handleAnalyze / _handleContextMenuMessage / _runAnalysis
    // now lives in a dedicated thin controller following the TabController / ThemeController pattern.
    this.analysisController = createAnalysisController({
      analysisService: this.analysisService,
      outputView: this.outputView,
      configView: this.configView,
      tabController: this.tabController,
    });
  },

  async _initializeUI() {
    await this.configService.initialize();

    this.configView.populateTaskSelects();
    this.configView.initialize();

    // Restore last used model (header title only; model dropdown restoration is in ConfigView)
    const lastModel = this.storage.get(this.storage.keys.LAST_MODEL);
    if (lastModel) {
      this.headerView?.setModelName(lastModel);
    }

    await this._loadModels();

    this.tabController.initialize('output');

    // Ensure correct initial button state (Process Page visible, Stop hidden)
    this.outputView?.setProcessing?.(false);
  },

  _setupMessaging() {
    this.messaging = createSidepanelMessaging();

    this.messaging.on('LLMsidebarMessage', (message) => {
      this.analysisController?.handleContextMenuMessage(message);
    });
  },

  // =====================================================
  // SMALL HELPERS (kept for intention-revealing wiring)
  // =====================================================

  /** Clears the result area (OutputView fully owns results + accumulator) */
  _resetResults() {
    this.outputView?.clearResults?.();
  },

  async _loadModels() {
    try {
      const models = await this.llmAdapter.loadModels();
      this.configView.populateModelSelect(models);

      const last = this.storage.get(this.storage.keys.LAST_MODEL);
      this.configView.restoreLastSelectedModel?.(last);
    } catch (err) {
      console.warn('[App] Could not load models (LM Studio not running?)', err);
      // ConfigView owns the model select DOM entirely
      this.configView?.setModelSelectError?.('LM Studio not available');
    }
  },
};
