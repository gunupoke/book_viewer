import json

data = json.load(open('memory_dict_utf8.txt', encoding='utf-8'))
dict_str = json.dumps(data, ensure_ascii=False, indent=2)

gas_script = f"""// ==========================================
// 【原因特定版・全件テスト用】ログ詳細表示＆複数APIフォールバック版
// ==========================================
function testAuditAndFixAllPublicationDates() {{
  const sheet = SpreadsheetApp.getActiveSheet(); 
  const data = sheet.getDataRange().getValues(); 

  const memoryDict = {dict_str};

  let matchCount = 0;
  let fixedCount = 0;
  let retainedCount = 0;

  console.log(`=== 全 ${{data.length - 1}} 件の出版日一斉チェックを開始します ===`);

  // 日付文字列を「YYYY-MM-DD」形式に正規化する関数（不完全なものはnullを返す）
  function parseAndNormalizeDate(dateVal) {{
    if (!dateVal) return null;
    
    // Dateオブジェクトの場合
    if (Object.prototype.toString.call(dateVal) === '[object Date]') {{
      const d = dateVal;
      if (isNaN(d.getTime())) return null;
      const m = ('0' + (d.getMonth() + 1)).slice(-2);
      const day = ('0' + d.getDate()).slice(-2);
      return `${{d.getFullYear()}}-${{m}}-${{day}}`;
    }}

    let s = String(dateVal).trim();

    // 8桁の数字 (YYYYMMDD)
    if (/^\d{{8}}$/.test(s)) {{
      return s.substring(0, 4) + "-" + s.substring(4, 6) + "-" + s.substring(6, 8);
    }}

    // YYYY/MM/DD, YYYY-MM-DD, YYYY年MM月DD日
    const m = s.match(/^(\d{{4}})[-\/年](\d{{1,2}})[-\/月](\d{{1,2}})日?$/);
    if (m) {{
      let month = ('0' + m[2]).slice(-2);
      let day = ('0' + m[3]).slice(-2);
      return `${{m[1]}}-${{month}}-${{day}}`;
    }}

    return null; // YYYY-MMなどの不完全なデータや解読不能なものはnull
  }}

  for (let i = 1; i < data.length; i++) {{
    const row = data[i];
    if (row.length < 3) continue;

    const title = String(row[0]);
    let rawIsbn = String(row[2]).replace(/'/g, "").trim();
    const currentYearVal = row[14]; 

    // セルの現在の値を文字列化して記録（ログ表示用）
    let currentYearStr = "";
    if (Object.prototype.toString.call(currentYearVal) === '[object Date]') {{
      const d = currentYearVal;
      if (!isNaN(d.getTime())) {{
         const m = ('0' + (d.getMonth() + 1)).slice(-2);
         const day = ('0' + d.getDate()).slice(-2);
         currentYearStr = `${{d.getFullYear()}}/${{m}}/${{day}}`; // 元の値をわかりやすく表現
      }} else {{
         currentYearStr = String(currentYearVal);
      }}
    }} else {{
      currentYearStr = String(currentYearVal || "").trim();
    }}

    let exactDate = null;
    let source = "";

    // 1. まず、現在のシートの値が既に完全な日付(YYYY-MM-DD等)かどうかをチェック
    let cellNormalized = parseAndNormalizeDate(currentYearVal);
    if (cellNormalized) {{
      exactDate = cellNormalized;
      source = "既存セル値の正規化";
    }}

    // 2. セルの値が不完全な場合、Memoryから探す
    if (!exactDate && memoryDict[rawIsbn]) {{
      exactDate = memoryDict[rawIsbn];
      source = "Memory";
    }}

    // 3. OpenBD API
    if (!exactDate && rawIsbn.length >= 10) {{
      try {{
        const url = "https://api.openbd.jp/v1/get?isbn=" + rawIsbn;
        const res = UrlFetchApp.fetch(url, {{ muteHttpExceptions: true }});
        if (res.getResponseCode() === 200) {{
          const json = JSON.parse(res.getContentText());
          if (json && json[0] && json[0].summary && json[0].summary.pubdate) {{
            let parsed = parseAndNormalizeDate(json[0].summary.pubdate.replace(/[^0-9]/g, ""));
            if (parsed) {{ exactDate = parsed; source = "OpenBD"; }}
          }}
        }}
      }} catch (e) {{}}
    }}

    // 4. NDL (国立国会図書館) API
    if (!exactDate && rawIsbn.length >= 10) {{
      try {{
        const url = "https://ndlsearch.ndl.go.jp/api/opensearch?isbn=" + rawIsbn;
        const res = UrlFetchApp.fetch(url, {{ muteHttpExceptions: true }});
        if (res.getResponseCode() === 200) {{
          const xml = res.getContentText();
          const match = xml.match(/<dc:date[^>]*>([^<]+)<\/dc:date>/);
          if (match && match[1]) {{
            let parsed = parseAndNormalizeDate(match[1]);
            if (parsed) {{ exactDate = parsed; source = "NDL(国会図書館)"; }}
          }}
        }}
      }} catch(e) {{}}
    }}

    // 5. Google Books API
    if (!exactDate && rawIsbn.length >= 10) {{
      try {{
        const url = "https://www.googleapis.com/books/v1/volumes?q=isbn:" + rawIsbn;
        const res = UrlFetchApp.fetch(url, {{ muteHttpExceptions: true }});
        if (res.getResponseCode() === 200) {{
          const json = JSON.parse(res.getContentText());
          if (json.items && json.items.length > 0 && json.items[0].volumeInfo.publishedDate) {{
            let parsed = parseAndNormalizeDate(json.items[0].volumeInfo.publishedDate);
            if (parsed) {{ exactDate = parsed; source = "GoogleBooks"; }}
          }}
        }}
      }} catch(e) {{}}
    }}

    // 6. Rakuten Books API (Public Endpoint)
    if (!exactDate && rawIsbn.length >= 10) {{
      try {{
        // Rakuten's Application ID used as public fallback
        const appId = '1021443831826620560'; 
        const url = `https://app.rakuten.co.jp/services/api/BooksBook/Search/20170404?format=json&isbn=${{rawIsbn}}&applicationId=${{appId}}`;
        const res = UrlFetchApp.fetch(url, {{ muteHttpExceptions: true }});
        if (res.getResponseCode() === 200) {{
          const json = JSON.parse(res.getContentText());
          if (json.Items && json.Items.length > 0 && json.Items[0].Item.salesDate) {{
            // format is usually "2020年08月10日" or "2020年08月"
            let salesDate = json.Items[0].Item.salesDate;
            let parsed = parseAndNormalizeDate(salesDate);
            if (parsed) {{ exactDate = parsed; source = "楽天ブックス"; }}
          }}
        }}
      }} catch(e) {{}}
    }}

    // 判定結果のログ出力
    if (exactDate) {{
      if (currentYearStr === exactDate || (source === "既存セル値の正規化" && currentYearStr.replace(/[\/\-]/g, "") === exactDate.replace(/-/g, ""))) {{
        // 厳密にはハイフン区切りでなくても、実質同じならスキップ扱いにしたいが、
        // 「正規化(YYYY-MM-DD)」を統一するために上書きすべきか？
        // ユーザーが「意味は大体同じなのにスキップされてしまう」と言っていたため、
        // 書式を統一する「修正候補」として扱うのが正しい。
        // ただし、すでに完全に一致している(YYYY-MM-DD)なら真のスキップ。
        if (currentYearStr === exactDate) {{
          matchCount++;
          console.log(`Row ${{i + 1}} [${{title.substring(0, 15)}}...]: 【スキップ:既に正確】${{exactDate}}`);
        }} else {{
          fixedCount++;
          console.log(`Row ${{i + 1}} [${{title.substring(0, 15)}}...]: 【書式統一(修正候補)】${{currentYearStr}} -> ${{exactDate}} (理由: ${{(source === '既存セル値の正規化') ? '書式の正規化' : source}})`);
        }}
      }} else {{
        fixedCount++;
        console.log(`Row ${{i + 1}} [${{title.substring(0, 15)}}...]: 【修正候補】${{currentYearStr || '空欄'}} -> ${{exactDate}} (取得元: ${{source}})`);
      }}
    }} else {{
      retainedCount++;
      console.log(`Row ${{i + 1}} [${{title.substring(0, 15)}}...]: 【スキップ:取得不可】不完全データまたは情報なし`);
    }}
  }}

  console.log("=== テスト結果レポート ===");
  console.log(`チェック対象: ${{data.length - 1}} 冊`);
  console.log(`既に正確な書式(YYYY-MM-DD)のためスキップ: ${{matchCount}} 冊`);
  console.log(`不完全・取得不可でスキップ（現状維持）: ${{retainedCount}} 冊`);
  console.log(`修正される予定の件数(書式の統一含む): ${{fixedCount}} 冊`);
  console.log("※このスクリプトはテスト用のため、実際のシートデータは一切変更していません。");
}}
"""

with open('gas_test_script_advanced.js', 'w', encoding='utf-8') as f:
    f.write(gas_script)
