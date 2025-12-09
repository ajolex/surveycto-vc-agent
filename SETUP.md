# Setup Instructions

Follow these steps to configure the SurveyCTO Version Control Agent for your Google Sheet.

## 1. Prerequisites
*   A Google Sheet containing your SurveyCTO form definitions (specifically `survey`, `choices`, and `settings` sheets).
*   A Google Cloud Project (standard for Apps Script) or simply the Apps Script editor.
*   A **Gemini API Key** from Google AI Studio or ask @AJolex to help you get one.

## 2. Install Scripts
(If you haven't already)
1.  Open your Google Sheet.
2.  Go to **Extensions** > **Apps Script**.
3.  Copy the provided `.gs` and `.html` files into the editor.

## 3. Configure API Key
The Agent requires a Gemini API Key to generating summaries. **Do not put this key in the code.**

1.  In the Apps Script Editor, click the **Project Settings** (gear icon ⚙️) on the left sidebar.
2.  Scroll down to **Script Properties**.
3.  Click **Add script property**.
4.  **Property**: `LLM_API_KEY`
5.  **Value**: Paste your actual Gemini API key (e.g., `AIzaSy...`).
6.  Click **Save script properties**.

## 4. First Run
1.  Refresh your Google Sheet to see the new **SurveyCTO Version Control** menu.
2.  Click **🚀 Deploy Form**.
3.  The first time you run the Agent, it will not find a previous history.
    *   It will display: *"Agent detected no history: Initial deployment or first time in Agent Mode."*
    *   This establishes the baseline for all future comparisons.
