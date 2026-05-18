// ==================== OUTPUT TAB ====================

const resultBody = document.getElementById('resultBody');
const reasoningBody = document.getElementById('reasoningBody');
const reasoningContainer = document.getElementById('reasoningContainer');
const maximizeReasoningBtn = document.getElementById('maximizeReasoningBtn');
const statusIndicator = document.getElementById('statusIndicator');
const copyBtn = document.getElementById('copyBtn');
const clearBtn = document.getElementById('clearBtn');
const stopBtn = document.getElementById('stopBtn');
const analyzeBtn = document.getElementById('analyzeBtn');

const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

// Tab switching
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');
    });
});

// Analyze button
analyzeBtn?.addEventListener('click', () => {
    if (typeof performAnalysis === 'function') {
        performAnalysis();
    }
});

// Stop button
stopBtn?.addEventListener('click', () => {
    if (typeof currentAbortController !== 'undefined' && currentAbortController) {
        currentAbortController.abort();
    }
    if (typeof UIState !== 'undefined') UIState.setProcessing(false);
});

// Clear button
clearBtn?.addEventListener('click', () => {
    resultBody.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">📝</div>
            <p class="empty-state-text">Click "Process Page" to analyze content</p>
        </div>`;
    reasoningContainer.style.display = 'none';
    reasoningBody.textContent = '';
    reasoningBody.datset.raw = '';
    UIState.clearError();
});

// Copy button
copyBtn?.addEventListener('click', async () => {
    const textToCopy = resultBody.innerText || resultBody.textContent;
    if (!textToCopy) return;

    try {
        await navigator.clipboard.writeText(textToCopy);
        const originalText = copyBtn.textContent;
        copyBtn.textContent = '✅';
        setTimeout(() => {
            copyBtn.textContent = originalText;
        }, 1500);
    } catch (err) {
        console.error('Failed to copy:', err);
    }
});

// Maximize reasoning panel
let reasoningMaximized = false;
maximizeReasoningBtn?.addEventListener('click', () => {
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