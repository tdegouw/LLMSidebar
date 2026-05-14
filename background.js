// background.js

const MENU_ID = "LLMsidebar";

// Create the "Send to LLM" context menu item when the extension is installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Send to LLM",
    contexts: ["selection"]   
  });

  chrome.sidePanel.setPanelBehavior({ 
    openPanelOnActionClick: true 
});
});

// Handle context menu click: open the side panel and send the selected text to it
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  // In background.js, after open:
  chrome.sidePanel.open({ tabId: tab.id }).then(() => {
    // Small delay or use a "ready" message from sidepanel
    setTimeout(() => {
      chrome.runtime.sendMessage(message).catch(() => {});
    }, 150);
  }).catch(err => console.error("Failed to open side panel", err));

  const message = {
    type: "LLMsidebarMessage",
    data: {
      selectionText: info.selectionText,
      pageUrl: info.pageUrl,
      tabId: tab.id
    }
  };

  chrome.runtime.sendMessage(message);
});


