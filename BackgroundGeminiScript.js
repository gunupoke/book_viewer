// ==========================================
// 初期設定
// ==========================================
// 1. このコードを「拡張機能」>「Apps Script」の既存のコードに上書き貼り付けします。
const SHEET_NAME = "シート1"; // もしスプレッドシートのタブ名が異なる場合はここを変更してください。

// ==========================================
// 1. Webアプリからのリクエスト受け取り (doPost)
// ==========================================
function doPost(e) {
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
    if (cols.summary !== -1) newRow[cols.summary] = ""; // 要約機能は廃止したため空欄
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
    // スプレッドシート側のISBNが数値になっている場合も考慮してStringで比較
    if (String(data[i][isbnColIndex]) === String(targetIsbn)) {
      sheet.getRange(i + 1, statusColIndex + 1).setValue(newStatus);
      return ContentService.createTextOutput("success").setMimeType(ContentService.MimeType.TEXT);
    }
  }
  return ContentService.createTextOutput("not found").setMimeType(ContentService.MimeType.TEXT);
}

// ==========================================
// 3. 【一括修正機能】223行目以降の既存データの発行日を正確なものへ更新する
// ==========================================
function fixRetroactiveDates() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME) || SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const isbnCol = headers.findIndex(h => String(h).toLowerCase().includes("isbn"));
  const titleCol = headers.findIndex(h => String(h) === "Title" || String(h) === "タイトル");
  const yearCol = headers.findIndex(h => String(h) === "Year" || String(h) === "発行年月日");
  
  if (isbnCol === -1 || yearCol === -1) {
    console.error("エラー: ISBN列またはYear列が見つかりません。");
    return;
  }
  
  const appId = 'eaf0a411-9192-4746-b9ed-ac0364bc6426';
  const accKey = 'pk_bQ411n2T0mvoKWg7KI3n4MVac0tEnuRifC6SPakJDyZ';
  
  // 223行目から処理を開始 (インデックスは0から始まるため 222 を指定)
  const START_ROW = 223;
  let updatedCount = 0;
  
  // 開始時間を記録（6分制限のタイムアウトを防ぐため）
  const startTime = new Date().getTime();
  const TIME_LIMIT_MS = 5 * 60 * 1000; // 5分（300,000ミリ秒）
  
  for (let i = START_ROW - 1; i < data.length; i++) {
    // 5分経過したら安全のために強制終了し、続きは次回に持ち越す
    if (new Date().getTime() - startTime > TIME_LIMIT_MS) {
      console.log(`【タイムアウト防止】5分経過したため一時停止しました。行 ${i + 1} の前で止まっています。もう一度「実行」を押すと続きから始まります。`);
      break;
    }

    const row = data[i];
    let isbn = String(row[isbnCol]).replace(/'/g, "").trim();
    let title = String(row[titleCol]).trim();
    let currentYear = String(row[yearCol]).trim();
    
    if (!isbn) continue; // ISBNがない行はスキップ
    
    let newDate = null;
    let isMagazine = isbn.startsWith("491");
    
    try {
      // 1. 楽天APIから検索
      if (isMagazine) {
        let res = UrlFetchApp.fetch(`https://openapi.rakuten.co.jp/services/api/BooksMagazine/Search/20170404?applicationId=${appId}&accessKey=${accKey}&jan=${isbn}&outOfStockFlag=1`, {muteHttpExceptions: true});
        let rData = JSON.parse(res.getContentText());
        // 雑誌はJANで見つからなければタイトルでも再検索
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
      
      // 2. OpenBD APIから検索 (楽天で見つからなかった場合)
      if (!newDate && !isMagazine) {
         let res = UrlFetchApp.fetch(`https://api.openbd.jp/v1/get?isbn=${isbn}`, {muteHttpExceptions: true});
         let oData = JSON.parse(res.getContentText());
         if (oData && oData.length > 0 && oData[0] && oData[0].summary && oData[0].summary.pubdate) {
            newDate = normalizeDateGAS(oData[0].summary.pubdate);
         }
      }
      
    } catch (e) {
      console.error(`行 ${i + 1} (${title}) のAPI取得エラー: ${e.message}`);
    }
    
    // 現在の日付より詳細（文字数が長い）場合、または1905などおかしな値から更新する場合
    // ※ 1905年始まりのバグデータも文字長比較で基本上書き対象になります
    if (newDate && newDate.length > 4 && currentYear !== newDate) {
      const cell = sheet.getRange(i + 1, yearCol + 1);
      cell.setValue(newDate);
      cell.setNumberFormat("yyyy-mm-dd"); // セルの表示形式を年月日に強制
      console.log(`【更新】行 ${i + 1} の日付: ${currentYear} -> ${newDate} (${title})`);
      updatedCount++;
    }
    
    // 楽天APIなどの利用制限（スパム判定）を回避するため、必ず1.5秒待機する
    Utilities.sleep(1500);
  }
  
  console.log(`処理完了！ 合計 ${updatedCount} 冊の日付を修正しました。`);
}

// 日付フォーマットの正規化ヘルパー関数
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
