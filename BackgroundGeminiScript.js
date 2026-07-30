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
    } catch (e) {
      console.warn(`行 ${i + 1} Rakuten APIエラー: ${e.message}`);
    }
    
    // 2. OpenBD APIから検索 (楽天で見つからなかった場合、またはエラーだった場合)
    if (!newDate && !isMagazine) {
      try {
         let res = UrlFetchApp.fetch(`https://api.openbd.jp/v1/get?isbn=${isbn}`, {muteHttpExceptions: true});
         let oData = JSON.parse(res.getContentText());
         if (oData && oData.length > 0 && oData[0] && oData[0].summary && oData[0].summary.pubdate) {
            newDate = normalizeDateGAS(oData[0].summary.pubdate);
         }
      } catch (e) {
         console.warn(`行 ${i + 1} OpenBD APIエラー: ${e.message}`);
      }
    }
    
    // 3. 国立国会図書館(NDL)から検索 (それでも見つからなかった場合)
    if (!newDate && !isMagazine) {
       try {
         let res = UrlFetchApp.fetch(`https://iss.ndl.go.jp/api/opensearch?isbn=${isbn}`, {muteHttpExceptions: true});
         let text = res.getContentText();
         let match = text.match(/<dc:date>([^<]+)<\/dc:date>/);
         if (match && match[1]) {
             newDate = normalizeDateGAS(match[1]);
         }
       } catch (e) {
         console.warn(`行 ${i + 1} NDL APIエラー: ${e.message}`);
       }
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


// ==========================================
// 6. 過去のスクレイピングデータから正確な日付を復元する
// ==========================================
function fixRetroactiveDatesFromMemory() {
  const memoryDates = {
    "9784087711196": "2017/10/26",
    "9784864291279": "2012/04/20",
    "9784884754327": "1989/09/18",
    "9784884754549": "1990/05/31",
    "9784884755058": "1991/04/19",
    "9784884755751": "1992/04/24",
    "9784884754310": "1990/02/27",
    "9784473047069": "2026/03/21",
    "9784396618551": "2025/11/05",
    "9784478109687": "2020/09/29",
    "4912044390466": "2026/03/03",
    "9784334108199": "2025/12/17",
    "9784152098702": "2019/07/04",
    "9784101050416": "2020/10/28",
    "9784150310479": "2011/09/09",
    "9784569860176": "2025/11/14",
    "9784101035413": "2021/12/23",
    "9784065399750": "2025/09/18",
    "9784326851966": "2018/12/26",
    "9784816369780": "2021/02/08",
    "9784163919096": "2024/11/08",
    "9784799330838": "2024/07/31",
    "9784907188672": "2025/12/18",
    "9784865541120": "2017/09/25",
    "9784865540208": "2015/04/23",
    "9784906866212": "2014/08/25",
    "9784884755744": "1992/04/24",
    "9784884756208": "1992/12/09",
    "9784884756734": "1993/09/29",
    "9784884757236": "1994/06/27",
    "9784884757991": "1995/04/17",
    "9784812450055": "1996/01/25",
    "9784812451380": "1997/07/10",
    "9784591190135": "2026/06/24",
    "9784121508614": "2026/02/09",
    "9784065399644": "2025/07/17",
    "9784799331422": "2025/04/18",
    "9784909044570": "2025/05/02",
    "9784041154397": "2024/11/29",
    "9784041107928": "2020/11/25",
    "9784044292126": "2011/06/15",
    "9784044292010": "2003/06/06",
    "9784044292027": "2003/09/30",
    "9784044292034": "2003/12/27",
    "9784044292041": "2004/07/31",
    "9784044292058": "2004/09/30",
    "9784044292065": "2005/03/31",
    "9784044292072": "2005/08/31",
    "9784044292089": "2006/04/28",
    "9784044292096": "2007/03/31",
    "9784044292102": "2011/05/25",
    "9784065274859": "2022/03/16",
    "9784480076717": "2025/02/07",
    "9784794974198": "2024/05/24",
    "4910164590483": "2018/02/28",
    "9784160070646": "2023/04/06",
    "9784160070837": "2024/04/22",
    "9784160070509": "2022/07/12",
    "9784160070189": "2020/12/03",
    "9784160086999": "2019/11/28",
    "9784160071261": "2026/05/15",
    "9784835635859": "2019/02/12",
    "9784041091043": "2020/04/03",
    "9784041091036": "2020/04/03",
    "9784041072899": "2019/02/04",
    "9784049123197": "2018/11/30",
    "9784041072882": "2018/09/04",
    "9784041065532": "2018/05/02",
    "9784041065525": "2018/04/03",
    "9784758009010": "2016/06/25",
    "9784048921039": "2016/05/27",
    "9784048657990": "2016/03/31",
    "9784047302228": "2015/02/14",
    "9784088900322": "2014/11/19",
    "9784041100264": "2011/11/30",
    "9784041100257": "2011/10/27",
    "9784047263741": "2010/02/26",
    "9784101369181": "1998/01/30",
    "9784098611874": "2021/11/30",
    "9784098611072": "2021/07/30",
    "9784845924233": "2025/03/26",
    "9784198615543": "2002/09/30",
    "9784091856814": "2000/05/30",
    "9784091856821": "2000/07/29",
    "9784091856838": "2000/11/30",
    "9784091856845": "2001/03/30",
    "9784091856852": "2001/06/30",
    "9784091856869": "2001/11/30",
    "9784091856876": "2001/12/25",
    "9784778315924": "2017/11/01",
    "9784834254044": "2025/07/25",
    "9784426119812": "2015/08/26",
    "9784087213126": "2024/04/17",
    "9784309617503": "2023/04/27",
    "9784839953690": "2014/10/23",
    "9784778320515": "2007/12/27",
    "9784861829345": "2022/10/31",
    "9784166615070": "2025/09/19",
    "9784763141880": "2025/01/24",
    "9784863133013": "2014/12/18",
    "9784778340049": "2024/12/16",
    "9784787273925": "2016/10/31",
    "9784868010456": "2024/12/16",
    "9784469214000": "2024/11/08",
    "9784845910564": "2010/10/22",
    "9784909474797": "2024/03/22",
    "9784861997600": "2015/02/20",
    "9784832249448": "2018/04/26",
    "9784832270985": "2019/05/27",
    "9784832272040": "2020/07/27",
    "9784832272910": "2021/07/27",
    "9784065204993": "2020/07/29",
    "9784434145384": "2010/06/01",
    "9784396762971": "2003/04/08",
    "9784800242389": "2015/06/10",
    "9784838721412": "2010/07/29",
    "9784063287356": "2001/01/22",
    "9784063287783": "2001/10/20",
    "9784063288636": "2003/01/23",
    "9784063289374": "2004/02/21",
    "9784910413167": "2024/12/16",
    "9784758063715": "2013/04/19",
    "9784758065290": "2015/07/27",
    "9784758066266": "2016/10/27",
    "9784758068604": "2020/04/28",
    "9784758069540": "2021/12/20",
    "9784758067515": "2018/07/27",
    "9784758084666": "2024/01/26",
    "9784063880588": "2015/05/22",
    "9784063881257": "2016/02/23",
    "9784065179246": "2019/12/23",
    "9784063882148": "2016/11/22",
    "9784063882889": "2017/09/22",
    "9784065119839": "2018/07/23",
    "9784065148372": "2019/03/22",
    "9784065211076": "2020/10/23",
    "9784065265482": "2022/01/21",
    "9784065351406": "2024/04/23",
    "9784065396117": "2025/06/23",
    "9784829145937": "2010/08/20",
    "9784789773461": "2022/09/29",
    "9784789772495": "2016/05/09",
    "9784789772365": "2015/08/08",
    "9784657258014": "2025/05/26",
    "9784065394212": "2025/04/02",
    "9784797395389": "2019/09/24",
    "9784834253788": "2023/11/24",
    "9784907108465": "2019/12/20",
    "9784800314550": "2018/04/28",
    "9784822289980": "2019/11/15",
    "9784768312797": "2020/01/06",
    "9784905033318": "2023/07/14",
    "9784103549512": "2023/03/17",
    "9784103549529": "2024/01/24",
    "9784575237320": "2011/07/06",
    "9784575236934": "2010/06/16",
    "9784575237115": "2010/12/08",
    "9784309029160": "2020/09/11",
    "9784768458402": "2018/11/20",
    "9784768457399": "2014/09/01",
    "9784344035768": "2020/02/20",
    "9784832241190": "2012/02/27",
    "9784832242692": "2013/02/27",
    "9784832244207": "2014/03/27",
    "9784832246171": "2015/09/26",
    "9784832247345": "2016/08/27",
    "9784832248946": "2017/11/09",
    "9784832249905": "2018/11/07",
    "9784832271197": "2019/09/27",
    "9784832272378": "2020/12/25",
    "9784832273337": "2021/12/25",
    "9784832274389": "2023/02/22",
    "9784758005760": "2010/07/24",
    "9784758006514": "2012/02/25",
    "9784758007474": "2013/04/25",
    "9784047264816": "2010/04/24",
    "9784047265790": "2010/07/24",
    "9784758006286": "2011/06/25",
    "9784047277663": "2011/12/24",
    "9784047280083": "2012/07/25",
    "9784047285798": "2012/11/24",
    "9784047267749": "2011/04/25",
    "9784832244146": "2014/02/27",
    "9784832245464": "2015/03/27",
    "9784832246560": "2016/01/27",
    "9784832247208": "2016/07/27",
    "9784832247215": "2016/07/27",
    "9784832248472": "2017/06/27",
    "9784832249295": "2018/03/27",
    "9784832271012": "2019/06/27",
    "9784832271531": "2020/01/27",
    "9784832272095": "2020/08/27",
    "9784832272620": "2021/03/26",
    "9784832273061": "2021/09/27",
    "9784829146101": "2011/03/19",
    "9784041003053": "2012/05/31",
    "9784044748456": "2011/06/30",
    "9784044748531": "2011/10/29",
    "9784041001431": "2012/01/31",
    "9784041002636": "2012/04/28",
    "9784048661805": "2014/04/10",
    "9784047290280": "2013/07/13",
    "9784047296831": "2014/05/15",
    "9784829147238": "2013/04/20",
    "9784047157170": "2011/06/25",
    "9784041204399": "2012/09/26",
    "9784861277603": "2010/08/10",
    "9784861278471": "2011/04/09",
    "9784861279034": "2011/10/08",
    "9784840133289": "2010/06/19",
    "9784840153201": "2013/09/30",
    "9784840153218": "2013/09/30",
    "9784759101737": "2025/06/04",
    "9784840224314": "2003/08/10",
    "9784840221733": "2002/09/10",
    "9784840219730": "2001/11/10",
    "9784087210149": "2017/12/15"
};

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
