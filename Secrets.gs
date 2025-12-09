/**
 * SECRETS MANAGEMENT
 * Handles secure retrieval of API keys.
 */

const KEY_NAME = 'LLM_API_KEY';

/**
 * Retrieves the Gemini API Key from Script Properties.
 * Throws an error if not found to ensure security best practices.
 */
function getGeminiApiKey() {
  const props = PropertiesService.getScriptProperties();
  const key = props.getProperty(KEY_NAME);
  
  if (!key) {
    throw new Error(`API Key not set. Please go to Project Settings > Script Properties and add '${KEY_NAME}'.`);
  }
  
  return key;
}
