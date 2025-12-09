/**
 * Google Sheets Content Script
 * 
 * Runs on Google Sheets pages (in content script sandbox)
 * Communicates with the Apps Script Sidebar (Sidebar.html)
 * to access google.script.run
 */

console.log('[Sheets Content] 🔧 Loaded on Google Sheets');

// Store pending requests
const pendingRequests = {};
let requestId = 0;
let sidebarActive = false;
let lastSidebarPing = 0;

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Sheets Content] 📨 Received from background:', message.type);

  if (message.type === 'GET_FORM_IDS') {
    handleGetFormIds(sendResponse);
    return true; // Keep channel open for async
  } else if (message.type === 'LOG_DEPLOYMENT') {
    handleLogDeployment(message.data, sendResponse);
    return true;
  }
});

// Listen for messages from Sidebar
// Listen for messages from Sidebar AND Dialogs (Apps Script served frames)
window.addEventListener('message', (event) => {
  // We accept messages from the main window (where the sidebar/dialog lives inside an iframe but posts to top)

  if (event.data.type === 'SURVEYCTO_SIDEBAR_READY') {
    if (!sidebarActive) {
      console.log('[Sheets Content] 🔌 Sidebar bridge connected');
      sidebarActive = true;
    }
    lastSidebarPing = Date.now();
    return;
  }

  // Handle Smart Redirect Request from DeployPopup
  if (event.data.type === 'SURVEYCTO_OPEN_OR_FOCUS') {
    console.log('[Sheets Content] 🔄 Received Smart Redirect request:', event.data.url);
    chrome.runtime.sendMessage({
      type: 'OPEN_OR_FOCUS_TAB',
      url: event.data.url
    });
    return;
  }

  if (event.data.type === 'SURVEYCTO_BRIDGE_RESPONSE') {
    const req = pendingRequests[event.data.requestId];
    if (req) {
      console.log(`[Sheets Content] 📥 Response for req ${event.data.requestId}:`, event.data.success);
      if (event.data.success) {
        // Transform data to match expected format
        if (req.type === 'GET_FORM_IDS') {
          req.callback({ formIds: event.data.data || [] });
        } else {
          req.callback({ success: true, result: event.data.data });
        }
      } else {
        req.callback({ success: false, error: event.data.error });
      }
      delete pendingRequests[event.data.requestId];
    }
  }
});

// Periodically check if sidebar is alive
setInterval(() => {
  if (Date.now() - lastSidebarPing > 5000) {
    sidebarActive = false;
  }
}, 5000);

// Ping sidebar to trigger a ready response
function ensureSidebarConnection() {
  window.postMessage({ type: 'SURVEYCTO_Request_Ping' }, '*');
}
setInterval(ensureSidebarConnection, 2000);

function checkSidebar(callback) {
  if (sidebarActive) return true;

  // Attempt one ping
  ensureSidebarConnection();

  // Check shortly after
  setTimeout(() => {
    if (!sidebarActive) {
      // alert('⚠️ SurveyCTO Sync Error\n\nPlease open the "SurveyCTO Version Control" sidebar in Google Sheets to sync data.\n\nExtensions > SurveyCTO Version Control > Open Sidebar');
      callback({ error: 'Sidebar not open' });
    }
  }, 500);
  return false;
}

/**
 * Request form IDs from Sidebar
 */
function handleGetFormIds(callback) {
  if (!checkSidebar(callback)) return;

  const rId = ++requestId;
  pendingRequests[rId] = { callback, type: 'GET_FORM_IDS' };

  console.log('[Sheets Content] 📤 Requesting form IDs via Bridge');

  window.postMessage({
    type: 'SURVEYCTO_BRIDGE_GET_FORM_IDS', // Legacy or filtered?
    // Actually we standardized on SURVEYCTO_BRIDGE_
    type: 'SURVEYCTO_BRIDGE_REQUEST',
    action: 'GET_FORM_IDS',
    requestId: rId
  }, '*');

  setCallbackTimeout(rId, callback, []);
}

/**
 * Request deployment logging via Sidebar
 */
function handleLogDeployment(deploymentData, callback) {
  if (!checkSidebar(callback)) return;

  const rId = ++requestId;
  pendingRequests[rId] = { callback, type: 'LOG_DEPLOYMENT' };

  console.log('[Sheets Content] 📤 Requesting deployment log via Bridge');

  window.postMessage({
    type: 'SURVEYCTO_BRIDGE_REQUEST',
    action: 'LOG_DEPLOYMENT',
    requestId: rId,
    payload: deploymentData
  }, '*');

  setCallbackTimeout(rId, callback, { success: false, error: 'Timeout' });
}

function setCallbackTimeout(rId, callback, defaultResponse) {
  setTimeout(() => {
    if (pendingRequests[rId]) {
      console.error('[Sheets Content] ❌ Bridge timeout');
      callback(defaultResponse);
      delete pendingRequests[rId];
    }
  }, 10000); // 10s timeout
}

