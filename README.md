# SurveyCTO Version Control (with AI Agent)
Tired of manual tracking for your changes to SurveyCTO forms? This tool supercharges your SurveyCTO Google Sheets deployment with awesome version control and even AI-powered summaries of changes you made! It makes sure every form version is perfectly logged, locked down, and clearly explained, so you always know what's changed.

## Key Features

### 🚀 One-Click Deployment
Deploy your form directly from Google Sheets to the SurveyCTO server or console.
- **Version Locking**: The tool freezes the version number in your `settings` sheet to prevent version misalignment between the deployed form version and the version in the version history sheet.
- **History Logging**: Records every deployment in the **Version History** sheet by typing the changes you made.

### 🧠 Intelligent Agent Mode
Don't want to write deployment logs manually? Let the AI Agent do it.
- **"Ask Agent to Summarize"**: Click this button in the deployment popup.
- **Auto-Detection**: The Agent compares your current SurveyCTO form  against the last deployed version.
- **Smart Summaries**: The Agent writes a professional, human-readable summary of exactly what changed (e.g., "The label for the "gps" question changed: before "GPS Coordinates Take at stall/vendor location " -> now: "GPS Coordinates [Lets see if Agent will catch this change] Take at stall/vendor location").

### 📋 Version Control
- **Version History**: A dedicated sheet tracks `Version`, `Deployed By`, `Timestamp`, and `Message` for every single deploy.
- **Snapshots**: The system quietly keeps track of your form's state so it knows exactly what changed next time.

## How to Use

1.  Open your SurveyCTO form spreadsheet.
2.  Click the **SurveyCTO Version Control** menu > **🚀 Deploy Form**.
3.  **Choose your mode**:
    *   **Manual**: Type your own message and hit Enter.
    *   **Agent**: Click **✨ Ask Agent to Summarize** and watch it generate the log for you.
4.  Click **Proceed to SurveyCTO** to finish the actual deployment in the SurveyCTO server.
