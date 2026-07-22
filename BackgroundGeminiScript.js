// ==========================================
// 初期設定
// ==========================================
// 1. このコードを「拡張機能」>「Apps Script」の既存のコードに上書き貼り付けします。
// 2. 以下の `YOUR_GEMINI_API_KEY` の部分を、ご自身のGemini APIキーに置き換えてください。
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY"; // ← ここを書き換える

const SHEET_NAME = "シート1"; // もしスプレッドシートのタブ名が異なる場合はここを変更してください。

// ==========================================
// 1. Webアプリからのリクエスト受け取り (doPost)
// ==========================================
// 本がスキャンされた時、Geminiは呼ばずに即座にシートへ書き込みだけを行います。
function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME) || SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  
  // パラメータ取得
  const p = e.parameter;
  const action = p.action;
  
  if (action === 'updateStatus') {
    // ステータス更新処理
    return updateBookStatus(sheet, p.isbn, p.status);
  } else if (action === 'updateSummary') {
    // 要約の直接更新処理
    return updateBookSummary(sheet, p.isbn, p.summary);
  } else {
    // 新規登録処理 (action=add または未指定時)
    const headers = sheet.getDataRange().getValues()[0];
    const newRow = new Array(headers.length).fill("");
    
    // ヘッダー名に基づいて列のインデックスを取得（大文字小文字を区別せず、部分一致も考慮）
    const getColIndex = (names) => {
      for (const name of names) {
        const idx = headers.findIndex(h => {
           if (!h) return false;
           const strH = String(h).toLowerCase();
           return strH === name.toLowerCase() || strH === name.toLowerCase() + "13";
        });
        if (idx !== -1) return idx;
      }
      return -1;
    };
    
    // 各データを適切な列に配置する
    const cols = {
      timestamp: headers.findIndex(h => String(h) === "Added_Date" || String(h).includes("日時") || String(h) === "Timestamp"),
      title: headers.findIndex(h => String(h) === "Title" || String(h) === "タイトル"),
      author: headers.findIndex(h => String(h) === "Author" || String(h) === "著者"),
      isbn: headers.findIndex(h => String(h) === "ISBN13" || String(h) === "ISBN"),
      status: headers.findIndex(h => String(h) === "Status" || String(h) === "ステータス"),
      summary: headers.findIndex(h => String(h) === "Gemini_Summary" || String(h) === "要約"),
      tags: headers.findIndex(h => String(h) === "Tags" || String(h) === "タグ"),
      publisher: headers.findIndex(h => String(h) === "Publisher" || String(h) === "出版社"),
      year: headers.findIndex(h => String(h) === "Year" || String(h) === "発行年月日"),
      description: headers.findIndex(h => String(h) === "description" || String(h) === "あらすじ")
    };
    
    // タイムスタンプを専用列に入れる
    if (cols.timestamp !== -1) {
       newRow[cols.timestamp] = new Date();
    }
    
    if (cols.title !== -1) newRow[cols.title] = p.title || "";
    if (cols.author !== -1) newRow[cols.author] = p.author || "";
    // ISBNは指数表記を防ぐため引き続きクォートを付ける（これは文字列で完全に問題ないため）
    if (cols.isbn !== -1) newRow[cols.isbn] = p.isbn ? "'" + p.isbn : "";
    if (cols.status !== -1) newRow[cols.status] = p.status || "積読";
    if (cols.summary !== -1) newRow[cols.summary] = "";
    if (cols.tags !== -1) newRow[cols.tags] = p.tags || "";
    if (cols.publisher !== -1) newRow[cols.publisher] = p.publisher || "";
    // 発売日はクォートを付けずにそのまま挿入し、後からセルの書式設定で強制する
    if (cols.year !== -1) newRow[cols.year] = p.year || "";
    if (cols.description !== -1) newRow[cols.description] = p.description || "";
    
    sheet.appendRow(newRow);
    
    // 追加した直後の一番下の行（今追加した本）の表示形式を強制的に書き換える
    const lastRow = sheet.getLastRow();
    if (cols.year !== -1 && p.year) {
      sheet.getRange(lastRow, cols.year + 1).setNumberFormat("yyyy-mm-dd");
    }
    
    // 即座にWebアプリ側に「成功したよ」と返す（タイムアウトしない）
    return ContentService.createTextOutput("success").setMimeType(ContentService.MimeType.TEXT);
  }
}

// ==========================================
// 2. バックグラウンド要約処理 (processMissingSummaries)
// ==========================================
// トリガー（時計マーク）から「5分に1回」などの設定で自動実行される関数です。
function processMissingSummaries() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME) || SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  
  // シートの全データを取得
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  // ヘッダーから必要な列のインデックスを探す
  const summaryColIndex = headers.findIndex(h => h === "Gemini_Summary");
  const titleColIndex = headers.findIndex(h => h === "Title");
  const authorColIndex = headers.findIndex(h => h === "Author");
  const descColIndex = headers.findIndex(h => h === "description"); // 追加されたあらすじ列
  
  if (summaryColIndex === -1) {
    console.error("Gemini_Summary列が見つかりません。");
    return;
  }
  
  // 処理した件数をカウント
  let processedCount = 0;
  
  // 2行目から下に向かって順番にチェック
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const summary = row[summaryColIndex];
    
    // 空欄、または「未生成」の表記があれば処理対象
    if (!summary || summary === "（要約未生成）" || summary.includes("作成中")) {
      
      const title = titleColIndex !== -1 ? row[titleColIndex] : "";
      const author = authorColIndex !== -1 ? row[authorColIndex] : "";
      const officialDesc = descColIndex !== -1 ? row[descColIndex] : "";
      
      // Geminiに依頼する文章
      const prompt = `あなたは書店やECサイトで本の魅力を一言で伝えるプロのライターです。
対象書籍について、無駄を極限まで削ぎ落とした「極めて短い紹介文」を作成してください。

【厳守事項】
1. 長さ：長く語らないこと。「必ず1文のみ（長くても50〜60文字程度）」で完結させてください。
2. 体裁：挨拶や前置きは一切禁止。いきなり内容の核心から書き始めてください。可能であれば「〜な指南書。」「〜な第X巻。」などの体言止め（名詞）で締めくくると理想的です。改行は使わず1行で出力してください。
3. シリーズ物：2巻目以降の場合、1巻目の基本設定は完全に省略し、「その巻固有の展開や見どころ」のみを鋭く抜き出してください。
4. 正確性：あらすじが空欄の場合は必ずWeb検索を利用し、事実のみを書いてください。想像での補完（ハルシネーション）は厳禁です。

【出力イメージ】
×悪い例：「本作はプロ野球を愛する女子たちを描いたコメディです。第2巻となる今回は、ビジター応援の悲哀などが描かれた一冊となっています。」
〇良い例1（実用書）：「『推し』への熱い思いや感動を、語彙力を駆使して相手に的確に伝わるように言語化するための実践的な指南書。」
〇良い例2（マンガ2巻）：「ビジター応援の悲哀や球団マスコットへの偏愛など、プロ野球ファン納得の『あるある』ネタが炸裂する日常コメディ第2巻。」

書名: ${title}
著者: ${author}
あらすじ: ${officialDesc}`;
      
      try {
        // Gemini APIを呼び出し
        const generatedSummary = callGeminiAPI(prompt);
        
        // スプレッドシートに書き込む（行番号は i + 1、列番号はインデックス + 1）
        sheet.getRange(i + 1, summaryColIndex + 1).setValue(generatedSummary);
        
      } catch (error) {
        console.error("行 " + (i + 1) + " の要約取得エラー: " + error.message);
        // クォータ（制限）やAPI側の高負荷（High Demand）の場合は、これ以上続けてもエラーになるため即座に強制終了する
        const errMsg = error.message.toLowerCase();
        if (errMsg.includes("quota") || errMsg.includes("429") || errMsg.includes("high demand") || errMsg.includes("503")) {
           console.log("AIサーバーが混雑しているか制限に達したため一時中断します。5分後に自動で再開されます。");
           return; 
        }
      } finally {
        // 成功でも失敗でもカウントを進める（無限ループによるタイムアウトを防ぐため）
        processedCount++;
      }
      
      // 3.5 Flashの無料枠（1分間15回まで）に合わせて8秒待機する
      Utilities.sleep(8000);
      
      // GASは1回の実行時間が「最大6分」というルールのための安全策
      // 1回の実行で最大「30件」まで処理したら終了して次回に持ち越す
      if (processedCount >= 30) {
        console.log("一度に処理できる上限に達したため、残りは次回の実行に持ち越します。");
        break; 
      }
    }
  }
}

// ==========================================
// 3. Gemini API通信用関数
// ==========================================
function callGeminiAPI(prompt) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY") {
    throw new Error("APIキーが設定されていません。");
  }
  
  // Proモデルが無料枠で使用不可（limit:0）だったため、最新かつ軽量・無料枠の広い 3.5 Flash を使用
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  const payload = {
    "contents": [{
      "parts": [{"text": prompt}]
    }]
  };
  
  const options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const json = JSON.parse(response.getContentText());
  
  if (json.error) {
    throw new Error(json.error.message);
  }
  
  return json.candidates[0].content.parts[0].text.trim();
}

// ==========================================
// 4. ステータス更新用ヘルパー関数
// ==========================================
function updateBookStatus(sheet, targetIsbn, newStatus) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const isbnColIndex = headers.findIndex(h => h.toLowerCase().includes("isbn"));
  const statusColIndex = headers.findIndex(h => h === "Status");
  
  if (isbnColIndex === -1 || statusColIndex === -1) {
    return ContentService.createTextOutput("error: columns not found").setMimeType(ContentService.MimeType.TEXT);
  }
  
  for (let i = 1; i < data.length; i++) {
    // スプレッドシート側のISBNが数値になっている場合も考慮してStringで比較
    if (String(data[i][isbnColIndex]) === String(targetIsbn)) {
      sheet.getRange(i + 1, statusColIndex + 1).setValue(newStatus);
      return ContentService.createTextOutput("success").setMimeType(ContentService.MimeType.TEXT);
    }
  }
  return ContentService.createTextOutput("not found").setMimeType(ContentService.MimeType.TEXT);
}

// ==========================================
// 5. 【トラブルシューティング用】トリガー重複の解消
// ==========================================
// 重複して作られてしまったトリガーを全て消去し、正しい1つだけを作り直します
function fixDuplicateTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "processMissingSummaries") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  
  ScriptApp.newTrigger("processMissingSummaries")
           .timeBased()
           .everyMinutes(5)
           .create();
  console.log("古いトリガーを全て削除し、正しい5分ごとのトリガーを1つだけ作成しました！");
}

// ==========================================
// 8. 要約更新用ヘルパー関数（パトロール用）
// ==========================================
function updateBookSummary(sheet, targetIsbn, newSummary) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const isbnColIndex = headers.findIndex(h => {
    if (!h) return false;
    const strH = String(h).toLowerCase();
    return strH === "isbn13" || strH === "isbn";
  });
  const summaryColIndex = headers.findIndex(h => {
    if (!h) return false;
    const strH = String(h).toLowerCase();
    return strH === "gemini_summary" || strH === "要約";
  });
  
  if (isbnColIndex === -1 || summaryColIndex === -1) {
    return ContentService.createTextOutput("error: columns not found").setMimeType(ContentService.MimeType.TEXT);
  }
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][isbnColIndex]) === String(targetIsbn)) {
      sheet.getRange(i + 1, summaryColIndex + 1).setValue(newSummary);
      return ContentService.createTextOutput("success").setMimeType(ContentService.MimeType.TEXT);
    }
  }
  return ContentService.createTextOutput("not found").setMimeType(ContentService.MimeType.TEXT);
}

// ==========================================
// 6. 【特別機能】指定した書籍の発売日を一括で上書き修正する
// ==========================================
function updateSpecificDates() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME) || SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  // 見出しからISBN列と日付列を探す
  const isbnColIndex = headers.findIndex(h => String(h).toLowerCase() === "isbn13" || String(h).toLowerCase() === "isbn");
  const yearColIndex = headers.findIndex(h => String(h) === "Year" || String(h) === "発行年月日");
  
  if (isbnColIndex === -1 || yearColIndex === -1) {
    console.error("ISBN列または日付列が見つかりません。");
    return;
  }
  
  // 私（AI）が調査した正しい日付のリスト
  const correctDates = {
    "9784840224314": "2003/08/10", // イリヤの空、UFOの夏 その4
    "9784840221733": "2002/09/10", // イリヤの空、UFOの夏 その3
    "9784840219730": "2001/11/10"  // イリヤの空、UFOの夏 その2
  };
  
  let updatedCount = 0;
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    // ISBNは文字列として比較（スプレッドシート上のクォート記号「'」が含まれていれば除去）
    const isbnRaw = String(row[isbnColIndex]).replace(/'/g, "").trim();
    
    if (correctDates[isbnRaw]) {
      const correctDate = correctDates[isbnRaw];
      const cell = sheet.getRange(i + 1, yearColIndex + 1);
      
      // セルに正しい日付を書き込み、表示形式を年月日に強制する
      cell.setValue(correctDate);
      cell.setNumberFormat("yyyy/mm/dd");
      
      console.log(`行 ${i + 1} の日付を ${correctDate} に修正しました。（ISBN: ${isbnRaw}）`);
      updatedCount++;
    }
  }
  
  console.log(`完了しました！合計 ${updatedCount} 冊の日付を修正しました。`);
}


