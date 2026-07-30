import json
import os

path = r'C:\Users\senji\.gemini\antigravity\brain\c834d4b8-56eb-41ea-87b2-a80db5024466\artifacts\all_correct_dates.json'
with open(path, 'r', encoding='utf-8') as f:
    dates = json.load(f)

js_code = """

// ==========================================
// 6. 過去のスクレイピングデータから正確な日付を復元する
// ==========================================
function fixRetroactiveDatesFromMemory() {
  const memoryDates = """ + json.dumps(dates, indent=4) + """;

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  // getDisplayValues() を使うことで、日付オブジェクトの自動変換を防ぎ、画面の見た目通り（YYYY-MM-DD等）の文字列として取得できます
  const data = sheet.getDataRange().getDisplayValues();
  let updatedCount = 0;

  for (let i = 1; i < data.length; i++) {
    // スプレッドシート上で数値が文字列として扱われる際のシングルクォート(')を除去
    let isbn = String(data[i][2]).replace(/'/g, "").trim();
    if (!isbn) continue;

    if (memoryDates[isbn]) {
      let currentYear = String(data[i][14]).trim();
      let correctDateStr = memoryDates[isbn].replace(/\//g, "-");

      if (currentYear !== correctDateStr) {
        // 更新する場合は setValue に戻すため、シートのRangeオブジェクトを取得
        sheet.getRange(i + 1, 15).setValue(correctDateStr).setNumberFormat("yyyy-mm-dd");
        console.log(`【更新】行 ${i + 1} : ${currentYear} -> ${correctDateStr}`);
        updatedCount++;
      }
    }
  }
  SpreadsheetApp.getUi().alert(`${updatedCount} 件の日付をメモリ（過去ログ）から正確に復元しました！`);
}
"""

bg_path = r'C:\Users\senji\.gemini\antigravity\brain\c834d4b8-56eb-41ea-87b2-a80db5024466\BackgroundGeminiScript.js'
with open(bg_path, 'r', encoding='utf-8') as f:
    content = f.read()

if 'fixRetroactiveDatesFromMemory' not in content:
    with open(bg_path, 'a', encoding='utf-8') as f:
        f.write(js_code)
    print('Appended successfully')
else:
    # 既存の関数を上書き置換する
    import re
    new_content = re.sub(r'// ==========================================\n// 6\. 過去のスクレイピングデータから正確な日付を復元する\n// ==========================================\nfunction fixRetroactiveDatesFromMemory\(\) \{.*?\}\n', js_code, content, flags=re.DOTALL)
    if new_content == content:
        # 万が一正規表現がマッチしなかった場合（一部書き換わっているなど）
        print("Function exists but could not be replaced cleanly. Skipping.")
    else:
        with open(bg_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print("Replaced existing function successfully")
