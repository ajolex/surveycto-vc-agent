/**
 * SurveyCTO Version Control - Background Service Worker
 * 
 * Handles:
 * - Communication between Google Apps Script and Chrome extension
 * - Deployment tracking and logging
 * - Tab management
 */

// Store deployment context
let deploymentContext = {
  fileBlob: null,
  fileName: null,
  formId: null,
  message: null,
  tabId: null
};

/**
 * Listen for messages from content script and other parts of extension
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] 📨 Message received:', message.type, 'from:', sender.url);

  if (message.type === 'GET_FORM_IDS') {
    console.log('[Background] Processing GET_FORM_IDS request');
    handleGetFormIds(message, sender, sendResponse);
  } else if (message.type === 'LOG_DEPLOYMENT') {
    console.log('[Background] Processing LOG_DEPLOYMENT request');
    handleLogDeployment(message, sender, sendResponse);
  } else if (message.type === 'UPLOAD_FORM') {
    console.log('[Background] Processing UPLOAD_FORM request');
    handleFormUpload(message, sender, sendResponse);
  } else if (message.type === 'CHECK_PAGE_READY') {
    console.log('[Background] Processing CHECK_PAGE_READY request');
    handlePageReady(message, sender, sendResponse);
  } else if (message.type === 'UPLOAD_COMPLETE') {
    console.log('[Background] Processing UPLOAD_COMPLETE request');
    handleUploadComplete(message, sender, sendResponse);
  } else if (message.type === 'GET_DEPLOYMENT_DATA') {
    console.log('[Background] Processing GET_DEPLOYMENT_DATA request');
    sendResponse({
      success: true,
      data: deploymentContext.fileBlob ? deploymentContext : null
    });
  } else {
    console.warn('[Background] Unknown message type:', message.type);
  }

  return true;
});

function handleOpenOrFocus(targetUrl) {
  console.log('[Background] Handling Open/Focus:', targetUrl);
  chrome.tabs.query({}, (tabs) => {
    let foundTab = null;
    try {
      const targetObj = new URL(targetUrl);
      const targetBase = targetObj.origin + targetObj.pathname;

      for (const tab of tabs) {
        if (tab.url && tab.url.includes(targetBase)) {
          foundTab = tab;
          break;
        }
      }
    } catch (e) {
      console.error('Invalid URL:', targetUrl);
    }

    if (foundTab) {
      console.log('[Background] Focus tab:', foundTab.id);
      chrome.tabs.update(foundTab.id, { active: true });
      chrome.windows.update(foundTab.windowId, { focused: true });
    } else {
      console.log('[Background] Create tab');
      chrome.tabs.create({ url: targetUrl });
    }
  });
}

/**
 * Handle request for form IDs from Google Sheets
 */
function handleGetFormIds(message, sender, sendResponse) {
  console.log('[Background] 🔍 Looking for Google Sheets tabs...');

  // Try to get from any Google Sheets tabs
  chrome.tabs.query({ url: '*://docs.google.com/spreadsheets/*' }, async (tabs) => {
    console.log('[Background] Found', tabs.length, 'Google Sheets tab(s)');

    if (tabs.length === 0) {
      console.warn('[Background] ⚠️ No Google Sheets tab found - keep your Google Sheet open');
      sendResponse({ formIds: [] });
      return;
    }

    // Try each tab until one succeeds
    for (const tab of tabs) {
      console.log(`[Background] Trying tab ${tab.id} (${tab.title})...`);
      try {
        const response = await sendMessageToTab(tab.id, {
          type: 'GET_FORM_IDS',
          action: 'getAllFormIds'
        });

        if (response && response.formIds && response.formIds.length > 0) {
          console.log('[Background] ✅ Found form IDs in tab:', tab.id);
          sendResponse(response);
          return;
        } else if (response && response.error) {
          console.log('[Background] Tab responded with error:', response.error);
        }
      } catch (err) {
        console.log(`[Background] Tab ${tab.id} failed:`, err.message);
      }
    }

    // If we get here, no tab worked
    console.warn('[Background] ❌ Could not get form IDs from any tab (Sidebar might be closed)');
    sendResponse({ formIds: [], error: 'Sidebar not detected in any tab' });
  });

  return true; // Keep channel open for async response
}

function sendMessageToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Handle deployment logging from content script
 */
function handleLogDeployment(message, sender, sendResponse) {
  console.log('[Background] Logging deployment:', message);

  // Find a Google Sheets tab and send the logging request
  chrome.tabs.query({ url: '*://docs.google.com/spreadsheets/*' }, (tabs) => {
    if (tabs.length > 0) {
      // Send message to Google Sheets to log deployment
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'LOG_DEPLOYMENT',
        functionName: 'logDeploymentWithVersion',
        data: {
          formId: message.formId,
          deployedVersion: message.deployedVersion,
          formName: message.formId,
          message: message.message || ''
        }
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('[Background] Could not reach Sheets:', chrome.runtime.lastError);
          sendResponse({ success: false, error: 'Could not contact Google Sheets' });
        } else {
          console.log('[Background] Logged deployment:', response);
          sendResponse({ success: true, message: 'Deployment logged' });
        }
      });
    } else {
      console.log('[Background] No Google Sheets tab found - cannot log deployment');
      sendResponse({ success: false, error: 'No Google Sheets tab open' });
    }
  });

  return true;
}

/**
 * Handle form upload request from Apps Script
 */
function handleFormUpload(message, sender, sendResponse) {
  console.log('[Background] Received UPLOAD_FORM message');
  console.log('[Background] Form ID:', message.formId);
  console.log('[Background] File size:', message.fileBlob.size);

  deploymentContext = {
    fileBlob: message.fileBlob,
    fileName: message.fileName,
    formId: message.formId,
    message: message.message,
    attachmentBlobs: message.attachmentBlobs || [],
    tabId: null
  };

  console.log('[Background] Deployment context stored');

  // Open SurveyCTO Design page in a new tab
  const url = 'https://' + message.serverUrl + '/main.html#Design';
  console.log('[Background] Opening URL:', url);

  chrome.tabs.create(
    {
      url: url,
      active: true
    },
    (tab) => {
      deploymentContext.tabId = tab.id;
      console.log('[Background] Opened SurveyCTO in tab:', tab.id);
      console.log('[Background] Deployment context ready for content script to retrieve');

      sendResponse({
        success: true,
        message: 'Opening SurveyCTO. Auto-upload will begin shortly.',
        tabId: tab.id
      });
    }
  );
}

/**
 * Alternative: Handle upload notification from Apps Script (for sandbox workaround)
 * In this case, the file data is passed, and we store it for the content script
 */
function handleUploadNotification(message, sender, sendResponse) {
  console.log('[Background] Received upload notification');

  // Convert base64 back to blob if needed
  let fileBlob = message.fileBlob;
  if (typeof message.fileBlob === 'string') {
    // It's base64 encoded
    const byteCharacters = atob(message.fileBlob);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    fileBlob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  deploymentContext = {
    fileBlob: fileBlob,
    fileName: message.fileName,
    formId: message.formId,
    message: message.message || '',
    attachmentBlobs: message.attachmentBlobs || [],
    tabId: null
  };

  console.log('[Background] Deployment context stored from notification');

  // Open SurveyCTO Design page
  const serverUrl = message.serverUrl || 'pspsicm.surveycto.com';
  const url = 'https://' + serverUrl + '/main.html#Design';
  console.log('[Background] Opening URL:', url);

  chrome.tabs.create(
    {
      url: url,
      active: true
    },
    (tab) => {
      deploymentContext.tabId = tab.id;
      console.log('[Background] Opened SurveyCTO in tab:', tab.id);

      sendResponse({
        success: true,
        message: 'Opening SurveyCTO. Auto-upload will begin shortly.',
        tabId: tab.id
      });
    }
  );
}

/**
 * Handle page ready signal from content script
 */
function handlePageReady(message, sender, sendResponse) {
  const tabId = sender.tab.id;
  console.log('[Background] Console page ready in tab:', tabId);

  if (deploymentContext.fileBlob && tabId === deploymentContext.tabId) {
    // Send file upload data to content script
    chrome.tabs.sendMessage(tabId, {
      type: 'PERFORM_UPLOAD',
      fileBlob: deploymentContext.fileBlob,
      fileName: deploymentContext.fileName,
      formId: deploymentContext.formId
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[Background] Error sending upload command:', chrome.runtime.lastError);
        sendResponse({ success: false, error: 'Failed to send upload command' });
      } else {
        console.log('[Background] Upload command sent to content script');
        sendResponse({ success: true, message: 'Upload in progress' });
      }
    });
  } else {
    sendResponse({ success: false, error: 'No deployment in progress' });
  }
}

/**
 * Handle upload completion
 */
function handleUploadComplete(message, sender, sendResponse) {
  console.log('[Background] Upload completed:', message);

  // Store result for later retrieval
  deploymentContext.uploadResult = {
    success: message.success,
    message: message.message,
    timestamp: new Date().toISOString()
  };

  sendResponse({ success: true, message: 'Upload result recorded' });
}

/**
 * Clean up old deployments when extension loads
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Background] Extension installed');
  } else if (details.reason === 'update') {
    console.log('[Background] Extension updated');
  }
});

/**
 * Listen for tab close events to clean up
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === deploymentContext.tabId) {
    console.log('[Background] SurveyCTO tab closed');
    // Optional: Store the upload result if available
  }
});
