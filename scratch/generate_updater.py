import csv
import json

path = r'C:\Users\senji\.gemini\antigravity\brain\c834d4b8-56eb-41ea-87b2-a80db5024466\deploy\books_v2_final.csv'
out_path = r'C:\Users\senji\.gemini\antigravity\brain\c834d4b8-56eb-41ea-87b2-a80db5024466\deploy\gas_updater.js'

update_map = {}
with open(path, 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        title = row.get('Title', '').strip()
        summary = row.get('Gemini_Summary', '').strip()
        if title and summary:
            update_map[title] = summary

gas_code = """function updateMySheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  
  const updateMap = """ + json.dumps(update_map, ensure_ascii=False, indent=2) + """;
  
  let updatedCount = 0;
  for (let i = 1; i < data.length; i++) {
    let title = String(data[i][11]).trim(); // L列 (Title)
    
    // 現在のスプレッドシートに英語名が混ざっている場合、取り除く
    let cleanTitle = title.replace(/\\s*=\\s*[A-Za-z\\s\\.\\-&:]+(?=\\d+$)/, ' ').trim();
    cleanTitle = cleanTitle.replace(/\\s*=\\s*[A-Za-z\\s\\.\\-&:]+$/, '').trim();
    
    if (updateMap[cleanTitle] || updateMap[title]) {
      const newSummary = updateMap[cleanTitle] || updateMap[title];
      // R列 (Gemini_Summary) は 18番目の列 (インデックス17)
      sheet.getRange(i + 1, 18).setValue(newSummary);
      
      // タイトルの英訳部分を取り除く
      if (cleanTitle !== title) {
        sheet.getRange(i + 1, 12).setValue(cleanTitle); // L列
      }
      
      updatedCount++;
    }
  }
  
  SpreadsheetApp.getUi().alert(updatedCount + " 件の書籍の要約（およびタイトル）を更新しました！");
}
"""

with open(out_path, 'w', encoding='utf-8') as f:
    f.write(gas_code)

print('Created gas_updater.js')
