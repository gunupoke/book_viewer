// Google Apps Script (GAS) 用のコードです。
// スプレッドシートの「拡張機能」＞「Apps Script」に貼り付けてください。

const BOOKLOG_RSS_URL = 'https://booklog.jp/users/【あなたのブクログID】/feed';
const GEMINI_API_KEY = '【あなたのGemini APIキー】';

function checkBooklogRSSAndAppend() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  // 過去に追加したアイテムのURLを記録しておくプロパティ
  const props = PropertiesService.getScriptProperties();
  const lastProcessedUrl = props.getProperty('lastProcessedUrl');
  
  try {
    const response = UrlFetchApp.fetch(BOOKLOG_RSS_URL);
    const xml = response.getContentText();
    const document = XmlService.parse(xml);
    const root = document.getRootElement();
    // RSS 1.0 or 2.0 handling
    const namespace = root.getNamespace();
    const items = root.getChildren('item', namespace);
    
    if (items.length === 0) return;
    
    // 最新のアイテムURL
    const latestUrl = items[0].getChildText('link', namespace) || items[0].getChildText('link');
    
    if (latestUrl === lastProcessedUrl) {
      // 新しい本はない
      return;
    }
    
    // 新しい本を追加する（簡易版として最新1件だけ処理する例）
    const title = items[0].getChildText('title', namespace) || items[0].getChildText('title');
    const author = ""; // RSSからは抽出が難しいため省略、またはタイトルからパース
    
    // Geminiでメタデータを生成
    const geminiData = getGeminiMetadata(title, author);
    
    // スプレッドシートの最終行に追加
    // (Service_ID, Item_ID, ISBN13, ..., Title, ..., Gemini_Summary, Gemini_Genre, Gemini_Recommendation)
    // 列の構成に合わせて空配列を作ります（全20列の想定）
    let newRow = new Array(20).fill('');
    newRow[9] = new Date().toISOString(); // Added Date
    newRow[11] = title;
    newRow[17] = geminiData.summary;
    newRow[18] = geminiData.genre;
    newRow[19] = geminiData.recommendation;
    
    sheet.appendRow(newRow);
    
    // 今回処理したURLを保存
    props.setProperty('lastProcessedUrl', latestUrl);
    
  } catch(e) {
    console.error("RSS Error: " + e);
  }
}

function getGeminiMetadata(title, author) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  const prompt = `以下の本について、「要約（100字程度）」「ジャンル」「おすすめポイント（一言）」を出力してください。\n本: ${title}\nJSON形式で出力してください。キーは "summary", "genre", "recommendation" としてください。`;
  
  const payload = {
    "contents": [{"parts":[{"text": prompt}]}]
  };
  
  const options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };
  
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
        recommendation: parsed.recommendation || ""
      };
    }
  } catch(e) {
    console.error("Gemini Error: " + e);
  }
  return {summary: "", genre: "", recommendation: ""};
}
