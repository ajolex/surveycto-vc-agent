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

  // Cap the diffs to avoid token limits if massive changes
  var diffText = technicalDiffs.slice(0, 50).join("\n");
  if (technicalDiffs.length > 50) diffText += `\n...[${technicalDiffs.length - 50} more changes truncated]`;

  // 1. Prepare the Prompt
  var prompt = `
You are a direct, technical deployment logger for SurveyCTO form definition programmed in Google spreadsheet.
Your goal is to write a clean, bulleted list of changes based on the raw logs below.

RULES:
1. NO conversational filler (No "Hi RAs", "Please check", "Thanks").
2. Start directly with the bullet points.
3. IF there are 5 or fewer unique changes:
   - Be extremely specific.
   - Include the exact "before" and "after" logic if provided in the logs.
   - Format: "* The [field] for [question] changed: before [old] -> now [new]"
   - For changes in the choices sheet use "list_name" to reference the changes instead of "IDs"
   - Do NOT escape underscores (e.g., write "test_var", NOT "test\_var").
4. IF there are MORE than 5 unique changes:
   - Generalize the changes to avoid overwhelming text but List the specific questions/modules that changed.(e.g., "Updated skip logic for 12 questions: var1, var2, var3, var4, var5, var6, var7, var8, var9, var10, var11, var12").
   - Do NOT list every single value for massive updates.

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
