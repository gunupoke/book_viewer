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
function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME) || SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  
  const p = e.parameter;
  const action = p.action;
  
  if (action === 'updateStatus') {
    return updateBookStatus(sheet, p.isbn, p.status);
  } else if (action === 'updateSummary') {
    return updateBookSummary(sheet, p.isbn, p.summary);
  } else {
    // 新規登録処理
    const headers = sheet.getDataRange().getValues()[0];
    const newRow = new Array(headers.length).fill("");
    
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
    
    if (cols.timestamp !== -1) newRow[cols.timestamp] = new Date();
    if (cols.title !== -1) newRow[cols.title] = p.title || "";
    if (cols.author !== -1) newRow[cols.author] = p.author || "";
    if (cols.isbn !== -1) newRow[cols.isbn] = p.isbn ? "'" + p.isbn : "";
    if (cols.status !== -1) newRow[cols.status] = p.status || "積読";
    
    // 【要約は自動生成を待ちます】
    if (cols.summary !== -1) newRow[cols.summary] = "（AIが要約を作成中です。数分後にリロードすると表示されます）";
    
    // ※ ジャンルやおすすめの自動生成は廃止
    if (cols.tags !== -1) newRow[cols.tags] = p.tags || "";
    if (cols.publisher !== -1) newRow[cols.publisher] = p.publisher || "";
    if (cols.year !== -1) newRow[cols.year] = p.year || "";
    if (cols.description !== -1) newRow[cols.description] = p.description || "";
    
    sheet.appendRow(newRow);
    
    const lastRow = sheet.getLastRow();
    if (cols.year !== -1 && p.year) {
      sheet.getRange(lastRow, cols.year + 1).setNumberFormat("yyyy-mm-dd");
    }
    
    return ContentService.createTextOutput("success").setMimeType(ContentService.MimeType.TEXT);
  }
}

// ==========================================
// 2. バックグラウンド要約生成処理 (processMissingSummaries)
// ==========================================
// ジャンルや紹介文（おすすめ）は除外！「客観的な要約」のみを生成します
function processMissingSummaries() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME) || SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const summaryColIndex = headers.findIndex(h => String(h) === "Gemini_Summary" || String(h) === "要約");
  const titleColIndex = headers.findIndex(h => String(h) === "Title" || String(h) === "タイトル");
  const authorColIndex = headers.findIndex(h => String(h) === "Author" || String(h) === "著者");
  const descColIndex = headers.findIndex(h => String(h) === "description" || String(h) === "あらすじ");
  
  if (summaryColIndex === -1) return;
  
  let processedCount = 0;
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const summary = row[summaryColIndex];
    
    if (!summary || summary === "（要約未生成）" || String(summary).includes("作成中")) {
      const title = titleColIndex !== -1 ? row[titleColIndex] : "";
      const author = authorColIndex !== -1 ? row[authorColIndex] : "";
      const officialDesc = descColIndex !== -1 ? row[descColIndex] : "";
      
      // 【完全要約特化プロンプト】ジャンルや主観的おすすめを排除
      const prompt = `以下の本の「あらすじ」や「テーマ」のみを客観的にまとめた短い要約（50文字程度）を作成してください。
【厳守事項】
- 主観的な評価（おすすめ、必読、傑作など）は一切書かないこと。
- ジャンル名やカテゴリ名は出力しないこと。事実と内容のみを抽出すること。
- 出力は必ず1文のみで完結させること。

書名: ${title}
著者: ${author}
公式あらすじ: ${officialDesc}`;
      
      try {
        const generatedSummary = callGeminiAPI(prompt);
        sheet.getRange(i + 1, summaryColIndex + 1).setValue(generatedSummary);
      } catch (error) {
        console.error("行 " + (i + 1) + " の要約取得エラー: " + error.message);
        if (error.message.toLowerCase().includes("quota") || error.message.toLowerCase().includes("429")) {
           console.log("Gemini API制限到達。一時中断します。");
           return; 
        }
      } finally {
        processedCount++;
      }
      
      Utilities.sleep(8000); // APIレートリミット回避
      
      if (processedCount >= 30) break; 
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
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  const payload = { "contents": [{ "parts": [{"text": prompt}] }] };
  const options = { "method": "post", "contentType": "application/json", "payload": JSON.stringify(payload), "muteHttpExceptions": true };
  
  const response = UrlFetchApp.fetch(url, options);
  const json = JSON.parse(response.getContentText());
  if (json.error) throw new Error(json.error.message);
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
  if (isbnColIndex === -1 || statusColIndex === -1) return ContentService.createTextOutput("error").setMimeType(ContentService.MimeType.TEXT);
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][isbnColIndex]) === String(targetIsbn)) {
      sheet.getRange(i + 1, statusColIndex + 1).setValue(newStatus);
      return ContentService.createTextOutput("success").setMimeType(ContentService.MimeType.TEXT);
    }
  }
  return ContentService.createTextOutput("not found").setMimeType(ContentService.MimeType.TEXT);
}

function updateBookSummary(sheet, targetIsbn, newSummary) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const isbnColIndex = headers.findIndex(h => String(h).toLowerCase().includes("isbn"));
  const summaryColIndex = headers.findIndex(h => String(h).toLowerCase() === "gemini_summary" || String(h) === "要約");
  if (isbnColIndex === -1 || summaryColIndex === -1) return ContentService.createTextOutput("error").setMimeType(ContentService.MimeType.TEXT);
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][isbnColIndex]) === String(targetIsbn)) {
      sheet.getRange(i + 1, summaryColIndex + 1).setValue(newSummary);
      return ContentService.createTextOutput("success").setMimeType(ContentService.MimeType.TEXT);
    }
  }
  return ContentService.createTextOutput("not found").setMimeType(ContentService.MimeType.TEXT);
}

// ==========================================
// 5. 【一括修正機能】223行目以降の既存データの発行日を正確なものへ更新する
// ==========================================
function fixRetroactiveDates() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME) || SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const isbnCol = headers.findIndex(h => String(h).toLowerCase().includes("isbn"));
  const titleCol = headers.findIndex(h => String(h) === "Title" || String(h) === "タイトル");
  const yearCol = headers.findIndex(h => String(h) === "Year" || String(h) === "発行年月日");
  if (isbnCol === -1 || yearCol === -1) return;
  
  const appId = 'eaf0a411-9192-4746-b9ed-ac0364bc6426';
  const accKey = 'pk_bQ411n2T0mvoKWg7KI3n4MVac0tEnuRifC6SPakJDyZ';
  
  const START_ROW = 223;
  let updatedCount = 0;
  
  const startTime = new Date().getTime();
  const TIME_LIMIT_MS = 5 * 60 * 1000;
  
  for (let i = START_ROW - 1; i < data.length; i++) {
    if (new Date().getTime() - startTime > TIME_LIMIT_MS) {
      console.log(`【タイムアウト防止】5分経過したため一時停止しました。行 ${i + 1} の前で止まっています。`);
      break;
    }

    const row = data[i];
    let isbn = String(row[isbnCol]).replace(/'/g, "").trim();
    let title = String(row[titleCol]).trim();
    let currentYear = String(row[yearCol]).trim();
    
    if (!isbn) continue;
    
    let newDate = null;
    let isMagazine = isbn.startsWith("491");
    
    try {
      if (isMagazine) {
        let res = UrlFetchApp.fetch(`https://openapi.rakuten.co.jp/services/api/BooksMagazine/Search/20170404?applicationId=${appId}&accessKey=${accKey}&jan=${isbn}&outOfStockFlag=1`, {muteHttpExceptions: true});
        let rData = JSON.parse(res.getContentText());
        if ((!rData.Items || rData.Items.length === 0) && title) {
           let encTitle = encodeURIComponent(title);
           res = UrlFetchApp.fetch(`https://openapi.rakuten.co.jp/services/api/BooksMagazine/Search/20170404?applicationId=${appId}&accessKey=${accKey}&title=${encTitle}&outOfStockFlag=1`, {muteHttpExceptions: true});
           rData = JSON.parse(res.getContentText());
        }
        if (rData.Items && rData.Items.length > 0 && rData.Items[0].Item.salesDate) {
          newDate = normalizeDateGAS(rData.Items[0].Item.salesDate);
        }
      } else {
        let res = UrlFetchApp.fetch(`https://openapi.rakuten.co.jp/services/api/BooksBook/Search/20170404?applicationId=${appId}&accessKey=${accKey}&isbn=${isbn}&outOfStockFlag=1`, {muteHttpExceptions: true});
        let rData = JSON.parse(res.getContentText());
        if (rData.Items && rData.Items.length > 0 && rData.Items[0].Item.salesDate) {
          newDate = normalizeDateGAS(rData.Items[0].Item.salesDate);
        }
      }
      
      if (!newDate && !isMagazine) {
         let res = UrlFetchApp.fetch(`https://api.openbd.jp/v1/get?isbn=${isbn}`, {muteHttpExceptions: true});
         let oData = JSON.parse(res.getContentText());
         if (oData && oData.length > 0 && oData[0] && oData[0].summary && oData[0].summary.pubdate) {
            newDate = normalizeDateGAS(oData[0].summary.pubdate);
         }
      }
    } catch (e) {
      console.error(`行 ${i + 1} のAPI取得エラー: ${e.message}`);
    }
    
    if (newDate && newDate.length > 4 && currentYear !== newDate) {
      const cell = sheet.getRange(i + 1, yearCol + 1);
      cell.setValue(newDate);
      cell.setNumberFormat("yyyy-mm-dd");
      console.log(`【更新】行 ${i + 1} : ${currentYear} -> ${newDate}`);
      updatedCount++;
    }
    
    Utilities.sleep(1500);
  }
  
  console.log(`処理完了！ 合計 ${updatedCount} 冊の日付を修正しました。`);
}

function normalizeDateGAS(dateStr) {
    if (!dateStr) return "";
    let s = String(dateStr).replace(/[\.\/]/g, '-').replace(/[^\d\-]/g, '');
    if (/^\d{8}$/.test(s)) return `${s.substring(0,4)}-${s.substring(4,6)}-${s.substring(6,8)}`;
    if (/^\d{6}$/.test(s)) return s.substring(0,4);
    if (/^\d{4}-\d{1,2}$/.test(s)) return s.split('-')[0];
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
        let parts = s.split('-');
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    return s;
}
