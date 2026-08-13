import json

data = json.load(open('memory_dict_utf8.txt', encoding='utf-8'))
dict_str = json.dumps(data, ensure_ascii=False, indent=2)

gas_script = f"""// ==========================================
// 【原因特定版・全件テスト用】ログ詳細表示版 (スキップ理由も表示)
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

    // 判定結果のログ出力
    if (exactDate) {{
      // GAS側で日付型として認識されている場合、文字列変換でフォーマットが変わるため、Dateオブジェクトかどうかも考慮（念のため）
      let formattedCurrentYear = currentYear;
      if (Object.prototype.toString.call(row[14]) === '[object Date]') {{
        const d = row[14];
        const m = ('0' + (d.getMonth() + 1)).slice(-2);
        const day = ('0' + d.getDate()).slice(-2);
        formattedCurrentYear = `${{d.getFullYear()}}-${{m}}-${{day}}`;
      }}

      if (formattedCurrentYear === exactDate) {{
        matchCount++;
        console.log(`Row ${{i + 1}} [${{title.substring(0, 15)}}...]: 【スキップ:既に正確】${{exactDate}}`);
      }} else {{
        fixedCount++;
        console.log(`Row ${{i + 1}} [${{title.substring(0, 15)}}...]: 【修正候補】${{formattedCurrentYear || '空欄'}} -> ${{exactDate}} (取得元: ${{source}})`);
      }}
    }} else {{
      retainedCount++;
      console.log(`Row ${{i + 1}} [${{title.substring(0, 15)}}...]: 【スキップ:取得不可】不完全なデータ、または情報なしのため現状維持`);
    }}
  }}

  console.log("=== テスト結果レポート ===");
  console.log(`チェック対象: ${{data.length - 1}} 冊`);
  console.log(`既に正確な日付 (YYYY-MM-DD)のためスキップ: ${{matchCount}} 冊`);
  console.log(`不完全・取得不可でスキップ（現状維持）: ${{retainedCount}} 冊`);
  console.log(`修正される予定の件数: ${{fixedCount}} 冊`);
  console.log("※このスクリプトはテスト用のため、実際のシートデータは一切変更していません。");
}}
"""

with open('gas_test_script_verbose.js', 'w', encoding='utf-8') as f:
    f.write(gas_script)
