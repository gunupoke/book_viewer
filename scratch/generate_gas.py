import json

data = json.load(open('memory_dict_utf8.txt', encoding='utf-8'))
dict_str = json.dumps(data, ensure_ascii=False, indent=2)

gas_script = f"""// ==========================================
// 【原因特定版・全件テスト用】ISBNの読み取り結果と通信結果をログ表示するスクリプト (書き換えなし)
// ==========================================
function testAuditAndFixAllPublicationDates() {{
  const sheet = SpreadsheetApp.getActiveSheet(); // 現在開いているシート全体を対象
  const data = sheet.getDataRange().getValues(); 

  const memoryDict = {dict_str};

  let matchCount = 0;
  let fixedCount = 0;
  let retainedCount = 0;

  console.log(`=== 全 ${{data.length - 1}} 件の出版日一斉チェックを開始します ===`);

  // 1行目はヘッダーなので i=1 からスタート
  for (let i = 1; i < data.length; i++) {{
    const row = data[i];
    if (row.length < 3) continue;

    const title = String(row[0]);
    let rawIsbn = String(row[2]).replace(/'/g, "").trim();
    const currentYear = String(row[14] || "").trim(); 

    let exactDate = null;
    let source = "";

    if (memoryDict[rawIsbn]) {{
      exactDate = memoryDict[rawIsbn];
      source = "Memory";
    }}

    // Memoryにない場合、OpenBDでAPI検索
    if (!exactDate) {{
      try {{
        const url = "https://api.openbd.jp/v1/get?isbn=" + rawIsbn;
        const res = UrlFetchApp.fetch(url, {{ muteHttpExceptions: true }});
        if (res.getResponseCode() === 200) {{
          const json = JSON.parse(res.getContentText());
          if (json && json[0] && json[0].summary && json[0].summary.pubdate) {{
            const pubdate = String(json[0].summary.pubdate).replace(/[^0-9]/g, "");
            if (pubdate.length === 8) {{
              exactDate = `${{pubdate.substring(0, 4)}}-${{pubdate.substring(4, 6)}}-${{pubdate.substring(6, 8)}}`;
              source = "OpenBD";
            }}
          }}
        }}
      }} catch (e) {{
        // APIエラーは無視
      }}
    }}

    // 完全な日付(YYYY-MM-DD)が取得できた場合のみ判定
    if (exactDate) {{
      if (currentYear === exactDate) {{
        matchCount++;
      }} else {{
        fixedCount++;
        console.log(`Row ${{i + 1}} [${{title.substring(0, 15)}}...]: 【修正候補】${{currentYear || '空欄'}} -> ${{exactDate}} (取得元: ${{source}})`);
      }}
    }} else {{
      retainedCount++;
    }}
  }}

  console.log("=== テスト結果レポート ===");
  console.log(`チェック対象: ${{data.length - 1}} 冊`);
  console.log(`既に正確な日付 (YYYY-MM-DD): ${{matchCount}} 冊`);
  console.log(`修正される予定の件数: ${{fixedCount}} 冊`);
  console.log(`不完全・取得不可でスキップ（現状維持）: ${{retainedCount}} 冊`);
  console.log("※このスクリプトはテスト用のため、実際のシートデータは一切変更していません。");
}}
"""

with open('gas_test_script.js', 'w', encoding='utf-8') as f:
    f.write(gas_script)
