/**
 * THE DIFF ENGINE
 * Compares current sheet state vs. hidden snapshots.
 */

function generateTechnicalDiff() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var changes = [];

  // 1. Compare Survey (Key: 'name')
  try {
    changes = changes.concat(compareSheets(ss, 'survey', '_snapshot_survey', 'name'));
  } catch (e) {
    console.warn("Error comparing survey sheet: " + e.message);
  }

  // 2. Compare Choices (Key: 'list_name' + 'value')
  // Note: For choices, we need a composite key usually, but let's stick to the plan's 'choice_key' concept
  // or default to 'value' if 'choice_key' isn't explicitly there. 
  // Ideally, choice uniqueness is list_name + value.
  try {
    changes = changes.concat(compareSheets(ss, 'choices', '_snapshot_choices', 'value'));
  } catch (e) {
    console.warn("Error comparing choices sheet: " + e.message);
  }

  return changes; // Returns Array of strings
}

// --- Core Comparison Logic ---
function compareSheets(ss, currentName, snapshotName, keyCol) {
  var current = ss.getSheetByName(currentName);
  var snapshot = ss.getSheetByName(snapshotName);

  // Handle First Run
  if (!snapshot) return ["First run: Initializing snapshots (no historical data to compare)."];

  var curMap = getDataMap(current, keyCol);
  var snapMap = getDataMap(snapshot, keyCol);
  var diffs = [];

  // Detect Modifications & Additions
  for (var key in curMap) {
    if (!snapMap[key]) {
      diffs.push(`ADDED row in [${currentName}]: ID '${key}'`);
    } else {
      var rowDiffs = getRowDifferences(curMap[key], snapMap[key]);
      if (rowDiffs.length > 0) {
        // If too many columns changed, maybe just say "Modified X columns"
        var changeDesc = rowDiffs.length > 3 ? rowDiffs.slice(0, 3).join(", ") + "..." : rowDiffs.join(", ");
        diffs.push(`MODIFIED row '${key}' in [${currentName}]: changed (${changeDesc})`);
      }
    }
  }

  // Detect Deletions
  for (var key in snapMap) {
    if (!curMap[key]) {
      diffs.push(`DELETED row from [${currentName}]: ID '${key}'`);
    }
  }

  return diffs;
}

// --- Helpers ---
function getDataMap(sheet, keyName) {
  if (!sheet) return {};
  var dataRange = sheet.getDataRange();
  if (dataRange.getLastRow() < 2) return {}; // Empty or just header
  
  var data = dataRange.getValues();
  var headers = data[0];
  var map = {};

  // Find key index
  var keyIdx = headers.indexOf(keyName);
  
  // Smart fallback if specific key not found
  if (keyIdx === -1) {
     if (headers.indexOf('name') > -1) keyIdx = headers.indexOf('name');
     else if (headers.indexOf('value') > -1) keyIdx = headers.indexOf('value');
  }

  if (keyIdx === -1) return {};

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    // Create a robust key
    var keyVal = row[keyIdx];
    
    // For choices, if we use 'value', we might have duplicates across different lists.
    // If the sheet has 'list_name', we should prepend it to make the key unique.
    var listNameIdx = headers.indexOf('list_name');
    if (listNameIdx > -1 && keyName === 'value') {
       keyVal = row[listNameIdx] + '::' + row[keyIdx];
    }

    var rowObj = {};
    headers.forEach((h, x) => rowObj[h] = row[x]);
    map[keyVal] = rowObj;
  }
  return map;
}

function getRowDifferences(newRow, oldRow) {
  var diffs = [];
  var ignore = ['label']; // We handle label separately or ignore if you want
  
  for (var k in newRow) {
    if (k === 'name' || k === 'value' || k === 'list_name') continue; // Don't flag the ID itself
    if (String(newRow[k]) !== String(oldRow[k])) {
      diffs.push(`${k} (was: "${oldRow[k]}" -> now: "${newRow[k]}")`);
    }
  }
  return diffs;
}

function updateSnapshots() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  copySheetData(ss, 'survey', '_snapshot_survey');
  copySheetData(ss, 'choices', '_snapshot_choices');
}

function copySheetData(ss, sourceName, targetName) {
  var src = ss.getSheetByName(sourceName);
  if (!src) return; 

  var tgt = ss.getSheetByName(targetName);
  if (!tgt) { 
    tgt = ss.insertSheet(targetName); 
    tgt.hideSheet(); 
  }
  tgt.clear();
  
  var range = src.getDataRange();
  if (range.getLastRow() > 0) {
    var vals = range.getValues();
    tgt.getRange(1,1,vals.length, vals[0].length).setValues(vals);
  }
}
