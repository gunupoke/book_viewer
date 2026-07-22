// 新しいアーキテクチャ用の Google Apps Script (GAS) コード
// ① Webアプリとしてデプロイし、スキャン機能からのデータを受け取る
// ② Gmailを定期監視し、Amazonの購入履歴を自動追加する

const GEMINI_API_KEY = '【あなたのGemini APIキー】';

// ==========================================
// 1. Webアプリの受け口 (スマホからスキャンしたデータを受け取る)
// ==========================================
function doPost(e) {
  try {
    const action = e.parameter.action || "";
    const title = e.parameter.title || "";
    const isbn = e.parameter.isbn || "";
    const status = e.parameter.status || "積読";
    
    if (action === "updateStatus") {
      updateBookStatus(isbn, title, status);
    } else {
      const author = e.parameter.author || "";
      const publisher = e.parameter.publisher || "";
      const year = e.parameter.year || "";
      const description = e.parameter.description || "";
      // スプレッドシートへ追加処理
      processAndAppendBook(title, author, isbn, status, publisher, year, description);
    }
    
    return ContentService.createTextOutput(JSON.stringify({status: "success"}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({status: "error", message: err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// OPTIONSリクエストへの対応（CORSエラー回避用）
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}


// ==========================================
// 2. Gmail監視用 (Amazon購入メールを定期チェック)
// ==========================================
function checkAmazonEmails() {
  const props = PropertiesService.getScriptProperties();
  const lastProcessedTime = props.getProperty('lastAmazonMailTime') || (new Date(Date.now() - 24*60*60*1000)).getTime().toString();
  
  const query = 'from:auto-confirm@amazon.co.jp subject:"ご注文の確認" newer_than:1d';
  const threads = GmailApp.search(query);
  
  let latestTime = parseInt(lastProcessedTime);
  
  for (let i = threads.length - 1; i >= 0; i--) {
    const messages = threads[i].getMessages();
    for (let j = 0; j < messages.length; j++) {
      const msg = messages[j];
      const msgTime = msg.getDate().getTime();
      
      if (msgTime <= parseInt(lastProcessedTime)) continue;
      
      const body = msg.getPlainBody();
      const extracted = extractBookInfoFromEmail(body);
      
      if (extracted.title) {
        processAndAppendBook(extracted.title, extracted.author, "", "積読", "Amazon", "");
      }
      
      if (msgTime > latestTime) latestTime = msgTime;
    }
  }
  
  props.setProperty('lastAmazonMailTime', latestTime.toString());
}

function extractBookInfoFromEmail(emailBody) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  const prompt = `以下のAmazonの注文確認メールから、購入された「本」のタイトルと著者を抽出してください。\n本以外の注文（家電など）の場合は空白にしてください。\nJSON形式で出力してください。キーは "title", "author" としてください。\n\nメール本文:\n${emailBody.substring(0, 1500)}`;
  
  const payload = { "contents": [{"parts":[{"text": prompt}]}] };
  const options = { "method": "post", "contentType": "application/json", "payload": JSON.stringify(payload), "muteHttpExceptions": true };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const json = JSON.parse(response.getContentText());
    if (json.candidates && json.candidates[0]) {
      let text = json.candidates[0].content.parts[0].text;
      if (text.startsWith('```json')) text = text.slice(7, -3);
      else if (text.startsWith('```')) text = text.slice(3, -3);
      const parsed = JSON.parse(text);
      return { title: parsed.title || "", author: parsed.author || "" };
    }
  } catch(e) { console.error("Extract Error: " + e); }
  return { title: "", author: "" };
}


// ==========================================
// 3. 共通処理 (スプレッドシートへの追記とGemini要約)
// ==========================================
function processAndAppendBook(title, author, isbn, statusStr, publisherStr, yearStr, officialDescription) {
  if (!title) return;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  const geminiData = getGeminiMetadata(title, author, officialDescription);
  
  let newRow = new Array(20).fill('');
  
  // 各項目の割り当て（CSVの列インデックスに対応）
  newRow[2] = isbn || ""; // ISBN13
  newRow[5] = statusStr || "積読"; // Status
  newRow[9] = Utilities.formatDate(new Date(), "JST", "yyyy-MM-dd HH:mm:ss"); // Added_Date (JST)
  newRow[11] = title; // Title
  newRow[12] = author; // Author
  
  // 出版社や西暦は、OpenBDから取得できていればそれを使い、なければGeminiの推測を使う
  newRow[13] = publisherStr || geminiData.publisher || ""; // Publisher
  newRow[14] = yearStr || geminiData.year || ""; // Year
  newRow[15] = geminiData.type || ""; // Type (本/雑誌/マンガ)
  newRow[16] = geminiData.pages || ""; // Pages
  
  newRow[17] = geminiData.summary || ""; // Gemini_Summary
  newRow[18] = geminiData.genre || ""; // Gemini_Genre
  newRow[19] = geminiData.recommendation || ""; // Gemini_Recommendation
  
  sheet.appendRow(newRow);
}

function getGeminiMetadata(title, author, officialDescription) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  let prompt = `以下の本について、情報を抽出しJSONで返してください。
キーは以下の通りです。
"summary": 100字程度の要約。※もし「公式のあらすじ」が提供されている場合は、それを最優先でそのまま利用（または要約）してください。
"genre": ジャンル
"recommendation": おすすめポイント（一言）
"publisher": 出版社名（不明なら空白）
"year": 出版年（西暦4桁の数字のみ。不明なら空白）
"type": 本の種類（例: 単行本、文庫、新書、雑誌、マンガ、写真集、画集、図鑑など。最も適切なものを記述）
"pages": 公式に確認できる正確なページ数（数字のみ。推測は絶対にせず、正確なページ数が不明な場合は必ず空白にすること）

本: ${title} (${author})
出力形式は必ずJSONのみにしてください。`;
  
  const payload = { "contents": [{"parts":[{"text": prompt}]}] };
  const options = { "method": "post", "contentType": "application/json", "payload": JSON.stringify(payload), "muteHttpExceptions": true };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const json = JSON.parse(response.getContentText());
    if (json.candidates && json.candidates[0]) {
      let text = json.candidates[0].content.parts[0].text;
      if (text.startsWith('```json')) text = text.slice(7, -3);
      else if (text.startsWith('```')) text = text.slice(3, -3);
      const parsed = JSON.parse(text);
      return { 
        summary: parsed.summary || "", 
        genre: parsed.genre || "", 
        recommendation: parsed.recommendation || "",
        publisher: String(parsed.publisher || ""),
        year: String(parsed.year || ""),
        type: String(parsed.type || ""),
        pages: String(parsed.pages || "")
      };
    }
  } catch(e) { console.error("Gemini Error: " + e); }
  return {summary: "", genre: "", recommendation: "", publisher: "", year: "", type: "", pages: ""};
}

// ==========================================
// 4. 既存の本に要約を一括追加するバッチ処理
// ==========================================
function fillMissingSummaries() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  
  // 見出し行をスキップして2行目から処理
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const title = row[11]; // L列 (インデックス11): Title
    const author = row[12]; // M列 (インデックス12): Author
    let summary = row[17]; // R列 (インデックス17): Gemini_Summary
    
    // タイトルが存在し、かつ要約が空の場合のみGeminiで生成
    if (title && (!summary || summary.trim() === '')) {
      Logger.log(`Generating summary for: ${title}`);
      
      // Gemini APIを呼び出し
      const geminiData = getGeminiMetadata(title, author, '');
      
      if (geminiData.summary) {
        // R列 (Gemini_Summary)
        sheet.getRange(i + 1, 18).setValue(geminiData.summary);
        
        // S列 (Gemini_Genre)
        if (!row[18] && geminiData.genre) sheet.getRange(i + 1, 19).setValue(geminiData.genre);
        
        // T列 (Gemini_Recommendation)
        if (!row[19] && geminiData.recommendation) sheet.getRange(i + 1, 20).setValue(geminiData.recommendation);
        
        // P列 (Type)
        if (!row[15] && geminiData.type) sheet.getRange(i + 1, 16).setValue(geminiData.type);
        
        // 連続でAPIを叩きすぎないよう、1.5秒待機
        Utilities.sleep(1500);
      }
    }
  }
  Logger.log('処理が完了しました！');
}

// ==========================================
// ステータス更新処理
// ==========================================
function updateBookStatus(isbn, title, status) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  
  // 後ろから検索して最新の登録を優先する
  for (let i = data.length - 1; i > 0; i--) {
    const row = data[i];
    const rowIsbn = String(row[2]).trim();
    const rowTitle = String(row[11]).trim();
    
    // ISBNが一致、もしくはISBNがない場合はタイトルが一致
    if ((isbn && rowIsbn === String(isbn).trim()) || (!isbn && title && rowTitle === String(title).trim())) {
      // F列 (インデックス5): Status を更新
      sheet.getRange(i + 1, 6).setValue(status);
      Logger.log(`Status updated for: ${title || isbn} -> ${status}`);
      return;
    }
  }
}
