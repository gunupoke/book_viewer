// ==========================================
// 1. Webアプリからのリクエスト受け取り (doPost)
// ==========================================
// 本がスキャンされた時、シートへ書き込みだけを行います。
// ※自動要約機能は廃止されました
function doPost(e) {
  const SHEET_NAME = "シート1"; // もしスプレッドシートのタブ名が異なる場合はここを変更してください。
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME) || SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  
  // パラメータ取得
  const p = e.parameter;
  const action = p.action;
  
  if (action === 'updateStatus') {
    // ステータス更新処理
    return updateBookStatus(sheet, p.isbn, p.status);
  } else {
    // 新規登録処理 (action=add または未指定時)
    const headers = sheet.getDataRange().getValues()[0];
    const newRow = new Array(headers.length).fill("");
    
    // ヘッダー名に基づいて列のインデックスを取得
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
    if (cols.summary !== -1) newRow[cols.summary] = ""; // 要約は常に空欄
    if (cols.tags !== -1) newRow[cols.tags] = p.tags || "";
    if (cols.publisher !== -1) newRow[cols.publisher] = p.publisher || "";
    if (cols.year !== -1) newRow[cols.year] = p.year || "";
    if (cols.description !== -1) newRow[cols.description] = p.description || "";
    
    sheet.appendRow(newRow);
    
    // 追加した直後の一番下の行の表示形式を強制的に書き換える
    const lastRow = sheet.getLastRow();
    if (cols.year !== -1 && p.year) {
      sheet.getRange(lastRow, cols.year + 1).setNumberFormat("yyyy-mm-dd");
    }
    
    return ContentService.createTextOutput("success").setMimeType(ContentService.MimeType.TEXT);
  }
}

// ==========================================
// 2. ステータス更新用ヘルパー関数
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
    if (String(data[i][isbnColIndex]) === String(targetIsbn)) {
      sheet.getRange(i + 1, statusColIndex + 1).setValue(newStatus);
      return ContentService.createTextOutput("success").setMimeType(ContentService.MimeType.TEXT);
    }
  }
  return ContentService.createTextOutput("not found").setMimeType(ContentService.MimeType.TEXT);
}

// ==========================================
// 3. 過去データ（223行目以降）の発行日を一括で正確な日付に修正する関数
// ==========================================
function fixRetroactiveDates() {
  const SHEET_NAME = "シート1"; // もしスプレッドシートのタブ名が異なる場合はここを変更してください。
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME) || SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const isbnCol = headers.findIndex(h => String(h).toLowerCase().includes("isbn"));
  const titleCol = headers.findIndex(h => String(h) === "Title" || String(h) === "タイトル");
  const yearCol = headers.findIndex(h => String(h) === "Year" || String(h) === "発行年月日");
  
  if (isbnCol === -1 || yearCol === -1) {
    console.error("ISBN列またはYear列が見つかりません。");
    return;
  }
  
  const appId = 'eaf0a411-9192-4746-b9ed-ac0364bc6426';
  const accKey = 'pk_bQ411n2T0mvoKWg7KI3n4MVac0tEnuRifC6SPakJDyZ';
  
  // 223行目から開始 (配列のインデックスは0始まりなので 222)
  const START_ROW = 223;
  let updatedCount = 0;
  
  // 6分間ルール対策: 開始時間を記録し、5分経過で安全に停止する
  const startTime = new Date().getTime();
  const MAX_RUNTIME_MS = 5 * 60 * 1000; 
  
  for (let i = START_ROW - 1; i < data.length; i++) {
    // 時間制限チェック
    if (new Date().getTime() - startTime > MAX_RUNTIME_MS) {
      console.log(`安全のため5分で自動停止しました。現在 ${i + 1} 行目まで完了しています。`);
      console.log("続きを処理するには、定数 START_ROW を " + (i + 1) + " に書き換えて再度「実行」してください。");
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
      // 1. Rakuten API
      if (isMagazine) {
        let res = UrlFetchApp.fetch(`https://openapi.rakuten.co.jp/services/api/BooksMagazine/Search/20170404?applicationId=${appId}&accessKey=${accKey}&jan=${isbn}&outOfStockFlag=1`, {muteHttpExceptions: true});
        let rData = JSON.parse(res.getContentText());
        if (!rData.Items || rData.Items.length === 0) {
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
      
      // 2. OpenBD (Fallback for books)
      if (!newDate && !isMagazine) {
         let res = UrlFetchApp.fetch(`https://api.openbd.jp/v1/get?isbn=${isbn}`, {muteHttpExceptions: true});
         let oData = JSON.parse(res.getContentText());
         if (oData && oData.length > 0 && oData[0] && oData[0].summary && oData[0].summary.pubdate) {
            newDate = normalizeDateGAS(oData[0].summary.pubdate);
         }
      }
      
    } catch (e) {
      console.error(`行 ${i + 1} (${isbn}) の取得エラー: ${e.message}`);
    }
    
    // API利用制限対策 (1秒待機)
    Utilities.sleep(1000);
    
    // 既存の日付より正確な場合、または古いバグ(1905など)の場合に更新
    if (newDate && newDate.length > 4 && currentYear !== newDate) {
      const cell = sheet.getRange(i + 1, yearCol + 1);
      cell.setValue(newDate);
      cell.setNumberFormat("yyyy-mm-dd"); 
      console.log(`行 ${i + 1} (${title}) の日付を更新: ${currentYear} -> ${newDate}`);
      updatedCount++;
    }
  }
  
  console.log(`処理完了！ 合計 ${updatedCount} 冊の日付を修正しました。`);
}

function normalizeDateGAS(dateStr) {
    if (!dateStr) return "";
    let s = String(dateStr).replace(/[\.\/]/g, '-').replace(/[^\d\-]/g, '');
    if (/^\d{8}$/.test(s)) return `${s.substring(0,4)}-${s.substring(4,6)}-${s.substring(6,8)}`;
    if (/^\d{6}$/.test(s)) return s.substring(0,4); // 不完全な日付は年のみ
    if (/^\d{4}-\d{1,2}$/.test(s)) return s.split('-')[0];
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
        let parts = s.split('-');
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    return s;
}
