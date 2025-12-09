/**
 * SurveyCTO Form Deployment Tracker - Content Script
 * 
 * Monitors SurveyCTO Design page for successful form deployments
 * Detects success dialog, extracts form version, and logs to Google Sheets
 */

console.log('[Content Script] ✅ Loaded on SurveyCTO Design page');

// Store available form IDs from Google Sheets
let availableFormIds = [];

/**
 * Initialize: Get list of form IDs from Google Sheets
 */
function initializeFormIds() {
  console.log('[Content Script] 🚀 Initializing - requesting form IDs from background');
  
  chrome.runtime.sendMessage(
    { type: 'GET_FORM_IDS' },
    (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[Content Script] Chrome error:', chrome.runtime.lastError);
      }
      
      if (response && response.formIds) {
        availableFormIds = response.formIds;
        console.log('[Content Script] ✅ Available form IDs:', availableFormIds);
      } else {
        console.warn('[Content Script] No form IDs received from background');
        availableFormIds = [];
      }
    }
  );
}

/**
 * Listen for messages from background script
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DEPLOYMENT_DETECTED') {
    console.log('[Content Script] Deployment detected:', message.data);
  }
});

/**
 * Monitor the page for the success dialog
 * SurveyCTO shows: "Form uploaded successfully"
 */
function monitorForSuccessDialog() {
  console.log('[Content Script] 🔍 Monitoring for success dialog...');
  
  // Check for existing dialogs on page
  const existingDialog = document.querySelector('[role="dialog"]');
  if (existingDialog && existingDialog.textContent.includes('Form uploaded successfully')) {
    console.log('[Content Script] ✅ Found existing success dialog');
    handleSuccessDialog();
    return;
  }
  
  const observer = new MutationObserver((mutations) => {
    try {
      const dialog = document.querySelector('[role="dialog"]');
      
      if (dialog) {
        const dialogText = dialog.textContent;
        
        if (dialogText.includes('Form uploaded successfully') || 
            dialogText.includes('Form uploaded')) {
          console.log('[Content Script] ✅ SUCCESS DIALOG DETECTED');
          console.log('[Content Script] Dialog text:', dialogText.substring(0, 100));
          
          setTimeout(() => {
            handleSuccessDialog();
          }, 500);
          
          observer.disconnect();
        }
      }
    } catch (err) {
      console.error('[Content Script] Error in MutationObserver:', err);
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeOldValue: false
  });
  
  // Also check every 2 seconds as a fallback
  setInterval(() => {
    try {
      const dialog = document.querySelector('[role="dialog"]');
      if (dialog && dialog.textContent.includes('Form uploaded successfully')) {
        console.log('[Content Script] ✅ Dialog found via interval check');
        observer.disconnect();
        handleSuccessDialog();
      }
    } catch (err) {
      console.error('[Content Script] Error in interval check:', err);
    }
  }, 2000);
}

/**
 * Handle the success dialog
 */
function handleSuccessDialog() {
  console.log('[Content Script] === HANDLING SUCCESS DIALOG ===');
  
  const formsList = extractFormsFromPage();
  console.log('[Content Script] Forms on page:', formsList);
  
  if (formsList.length === 0) {
    console.warn('[Content Script] No forms found on page');
    return;
  }
  
  const deployedForm = findDeployedForm(formsList);
  
  if (!deployedForm) {
    console.warn('[Content Script] Could not match deployed form');
    return;
  }
  
  console.log('[Content Script] ✅ Deployed form identified:', deployedForm);
  
  setTimeout(() => {
    showDeploymentNotesDialog(deployedForm);
  }, 1000);
}

/**
 * Extract all forms from the SurveyCTO Design page
 */
function extractFormsFromPage() {
  const forms = [];
  
  const textElements = document.querySelectorAll('*');
  
  for (let el of textElements) {
    const text = el.textContent;
    
    const match = text.match(/Form\s+ID:\s*([^,]+),\s*Deployed\s+version:\s*(\d+)/);
    
    if (match) {
      const formId = match[1].trim();
      const version = match[2].trim();
      
      if (el.children.length === 0 || el.textContent.length < 100) {
        forms.push({ formId, version });
        console.log(`[Content Script] Found form: ${formId} (v${version})`);
      }
    }
  }
  
  const uniqueForms = [];
  const seen = new Set();
  
  for (let form of forms) {
    const key = form.formId + '-' + form.version;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueForms.push(form);
    }
  }
  
  return uniqueForms;
}

/**
 * Find which form on the page matches our available form IDs
 */
function findDeployedForm(formsList) {
  console.log('[Content Script] Matching forms. Available IDs:', availableFormIds);
  
  if (availableFormIds.length === 0) {
    if (formsList.length > 0) {
      return formsList[formsList.length - 1];
    }
    return null;
  }
  
  for (let form of formsList) {
    if (availableFormIds.includes(form.formId)) {
      console.log(`[Content Script] ✅ Matched: ${form.formId}`);
      return form;
    }
  }
  
  if (formsList.length > 0) {
    console.log('[Content Script] No exact match, using most recent form');
    return formsList[formsList.length - 1];
  }
  
  return null;
}

/**
 * Show a dialog for the user to enter deployment notes
 */
function showDeploymentNotesDialog(deployedForm) {
  console.log('[Content Script] Showing deployment notes dialog for:', deployedForm.formId);
  
  const overlay = document.createElement('div');
  overlay.id = 'surveycto-deployment-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;
  
  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: white;
    padding: 30px;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    max-width: 500px;
    width: 90%;
    font-family: Arial, sans-serif;
  `;
  
  dialog.innerHTML = `
    <h2 style="margin-top: 0; color: #333;">Deployment Logged</h2>
    <div style="background: #f0f0f0; padding: 15px; border-radius: 4px; margin: 20px 0; font-size: 14px;">
      <p style="margin: 5px 0;"><strong>Form ID:</strong> ${deployedForm.formId}</p>
      <p style="margin: 5px 0;"><strong>Version:</strong> ${deployedForm.version}</p>
    </div>
    <p style="color: #666; font-size: 14px; margin-bottom: 15px;">
      Add deployment notes (optional):
    </p>
    <textarea id="deployment-message" placeholder="e.g., Minor bug fixes, added new questions, etc."
      style="
        width: 100%;
        height: 100px;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        box-sizing: border-box;
      "></textarea>
    <div style="display: flex; gap: 10px; margin-top: 20px; justify-content: flex-end;">
      <button id="cancel-button" style="
        padding: 10px 20px;
        background: #f0f0f0;
        border: 1px solid #ddd;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
      ">Cancel</button>
      <button id="submit-button" style="
        padding: 10px 20px;
        background: #4285f4;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
      ">Log Deployment</button>
    </div>
  `;
  
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  
  document.getElementById('cancel-button').addEventListener('click', () => {
    overlay.remove();
    setTimeout(() => monitorForSuccessDialog(), 1000);
  });
  
  document.getElementById('submit-button').addEventListener('click', () => {
    const message = document.getElementById('deployment-message').value;
    
    // Send to background script, which will relay to Apps Script
    chrome.runtime.sendMessage({
      type: 'LOG_DEPLOYMENT',
      formId: deployedForm.formId,
      deployedVersion: deployedForm.version,
      message: message,
      timestamp: new Date().toISOString(),
      user: 'extension'
    }, (response) => {
      if (response && response.success) {
        console.log('[Content Script] ✅ Deployment logged');
        
        dialog.innerHTML = `
          <div style="text-align: center; padding: 20px;">
            <h2 style="color: #4285f4; margin-top: 0;">✓ Logged Successfully</h2>
            <p style="color: #666;">Your deployment has been recorded in the Version History.</p>
          </div>
        `;
        
        setTimeout(() => {
          overlay.remove();
          setTimeout(() => monitorForSuccessDialog(), 1000);
        }, 2000);
      } else {
        alert('Error logging deployment: ' + (response?.error || 'Unknown error'));
      }
    });
  });
}

/**
 * Initialize when page loads
 */
if (document.readyState === 'complete') {
  initializeFormIds();
  monitorForSuccessDialog();
} else {
  window.addEventListener('load', () => {
    initializeFormIds();
    monitorForSuccessDialog();
  });
}
