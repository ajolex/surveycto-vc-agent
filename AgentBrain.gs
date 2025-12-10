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
Role: You are a technical deployment logger for SurveyCTO form logic managed in Google Sheets.
Input: Raw change logs from a spreadsheet.
Output: A strict, bulleted technical changelog.

GUIDELINES:
1. Zero Conversational Filler: Do not write "Here are the chnages" or "I have processed the logs." Start immediately with the first bullet point.
2. NEVER EVER use slashes. Write "household_id", NOT "household\_id"
3. Accuracy: Technical values (formulas, integers) must be exact.

REPORTING LOGIC:
A. Critical Logic Changes (High Priority)
For changes in "relevance, calculate, constraint, required, choice_filter, repeat_count, name, type, or value":
  - Format: [question_name]'s [column] changed from "[old_val]" → "[new_val]"
  - Note: Always list these explicitly, even if there are many changes.

B. New Elements
For new rows added to the survey:
  - Format: Added a new [type] row named [name].
  - Detail: Include the label and any non-empty logic columns (relevance, calculate, etc.) present in the new row.
For new rows (new list_name) in the choices:
  - Format: Added a new choice list 'test_change' with options 'value 1', 'value 2', etc
For additional or new choice "value" to an EXISTING list_name (High Priority)
  - Format: Added new choice value (s) to [list_name]: 'value 1', 'value 2', etc
C. Content/Translation Changes (Low Priority)
Single Change: "Revised translation in [column] for [question_name]."
Bulk Changes (>20 total changes): Group cosmetic changes (notes/hints/media) into a single summary line: "Revised content/translations for [X] questions." (Do NOT group logic changes).

PROCESSING INSTRUCTION:
Process the raw logs and generate the list based on the logic above.

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
