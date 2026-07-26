import csv
import json

old_csv = r'C:\Users\senji\.gemini\antigravity\brain\c834d4b8-56eb-41ea-87b2-a80db5024466\deploy\books_v2.csv'
new_csv = r'C:\Users\senji\Desktop\ツール\Antigravity_workspaces用\自作\あなたには万屋になってもらいます\yorozuya ver3.5 - books_v2_final_k.csv'
out_path = r'C:\Users\senji\.gemini\antigravity\brain\c834d4b8-56eb-41ea-87b2-a80db5024466\deploy\gas_updater_v2.js'

old_rows = list(csv.DictReader(open(old_csv, 'r', encoding='utf-8-sig')))
new_rows = list(csv.DictReader(open(new_csv, 'r', encoding='utf-8-sig')))

update_map = {} # Maps OLD title to {new_summary, new_title (optional)}

# Build mapping using ISBN first, or order if ISBN is empty
for old, new in zip(old_rows, new_rows):
    old_title = old.get('Title', '').strip()
    new_title = new.get('Title', '').strip()
    new_summary = new.get('Gemini_Summary', '').strip()
    
    if old_title and new_summary:
        update_map[old_title] = {
            'summary': new_summary,
            'title': new_title if new_title != old_title else None
        }

gas_code = """function updateMySheetV2() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  
  const updateMap = """ + json.dumps(update_map, ensure_ascii=False, indent=2) + """;
  
  let updatedCount = 0;
  for (let i = 1; i < data.length; i++) {
    let title = String(data[i][11]).trim(); // L列 (Title)
    
    if (updateMap[title]) {
      const updateData = updateMap[title];
      
      // R列 (Gemini_Summary) は 18番目の列 (インデックス17)
      sheet.getRange(i + 1, 18).setValue(updateData.summary);
      
      // タイトルも変更されている場合は更新
      if (updateData.title) {
        sheet.getRange(i + 1, 12).setValue(updateData.title); // L列
      }
      
      updatedCount++;
    }
  }
  
  SpreadsheetApp.getUi().alert(updatedCount + " 件の書籍の要約（およびタイトル）を更新しました！");
}
"""

with open(out_path, 'w', encoding='utf-8') as f:
    f.write(gas_code)

print('Created gas_updater_v2.js')
