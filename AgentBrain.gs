/**
 * THE AGENT BRAIN
 * Uses an LLM to summarize the technical diffs.
 */

function summarizeChangesWithAI(technicalDiffs) {
  if (!technicalDiffs || technicalDiffs.length === 0) return "No significant technical changes detected in the survey/choices definition.";
  
  // If it's the first run message
  if (technicalDiffs.length === 1 && technicalDiffs[0].indexOf("First run") > -1) {
    return "Agent detected no history: Initial deployment or first time in Agent Mode.";
  }

  // Cap the diffs to avoid token limits, but increased significantly per user request
  // Gemini 1.5/2.0 context is large enough for 500+ lines easily.
  var diffText = technicalDiffs.slice(0, 500).join("\n");
  if (technicalDiffs.length > 500) diffText += `\n...[${technicalDiffs.length - 500} more changes truncated]`;

  // 1. Prepare the Prompt
  var prompt = `
You are a direct, technical deployment logger for SurveyCTO form logic programmed in Google spreadsheet.
Your goal is to write a clean, bulleted list of changes based on the raw logs below.

RULES:
1. NO conversational filler. Start directly with the bullet points.
2. ACCURACY IS PARAMOUNT. specific technical values matter (relevance, calculate, etc).
3. IF you see "TRANSLATION_CHANGED: [column]", summarize it as "Revised translation in [column] for [question/row]".
4. For specific columns (relevance, calculate, name, type, constraint, required, disabled, list_name, value, repeat_count, choice_filter):
   - You MUST report the exact change: "The [column] for [question] changed: [old_val] -> [new_val]"
   - Do NOT generalize these if they are few.
5. IF there are MANY changes (over 20):
   - Group purely content/translation changes: "Revised translations for X questions."
   - BUT ALWAYS explicitly list logic changes (relevance/calculate) unless there are hundreds of them.
6. Do NOT escape underscores (e.g., write "test_var", NOT "test\_var").

RAW LOGS:
${diffText}

SUMMARY:
`;

  // 2. Call the API (Gemini)
  try {
    var apiKey = getGeminiApiKey(); // From Secrets.gs
    // Using gemini-2.0-flash
    var url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    var payload = {
      "contents": [{
        "parts": [{"text": prompt}]
      }]
    };

    var options = {
      "method": "post",
      "contentType": "application/json",
      "payload": JSON.stringify(payload),
      "muteHttpExceptions": true
    };

    var response = UrlFetchApp.fetch(url, options);
    var code = response.getResponseCode();
    
    if (code !== 200) {
        var errorBody = response.getContentText();
        var errorMsg = errorBody;
        try {
           var errorJson = JSON.parse(errorBody);
           if (errorJson.error && errorJson.error.message) {
              errorMsg = errorJson.error.message;
           }
        } catch (e) {}
        
        return "Agent Error (Status " + code + "): " + errorMsg;
    }

    var json = JSON.parse(response.getContentText());
    
    if (json.candidates && json.candidates.length > 0 && json.candidates[0].content) {
        return json.candidates[0].content.parts[0].text;
    } else {
        return "Agent Warning: AI returned empty response.";
    }

  } catch (e) {
    return "AI Summary Failed: " + e.message + "\n(Logged " + technicalDiffs.length + " changes)";
  }
}
