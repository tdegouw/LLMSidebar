// background.js

const MENU_ID = "LLMsidebar";

// Create the "Send to LLM" context menu item when the extension is installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Send to LLM",
    contexts: ["selection"]   
  });
});

// Handle context menu click: open the side panel and send the selected text to it
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  await chrome.sidePanel.open({ tabId: tab.id });

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


chrome.sidePanel.setPanelBehavior({ 
  openPanelOnActionClick: true 
});