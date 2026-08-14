// ==========================================
// 注文メール自動抽出＆書庫登録スクリプト
// ==========================================

function processOrderEmails() {
  const DRY_RUN = false; // テスト時は true にしてスプレッドシートへの書き込みとラベル付与を無効化します
  
  const PROCESSED_LABEL_NAME = '書庫登録済(テスト)';
  const SKIPPED_LABEL_NAME = '書庫登録対象外(テスト)'; // 本が含まれていないメール用
  let processedLabel, skippedLabel;
  
  if (!DRY_RUN) {
    processedLabel = GmailApp.getUserLabelByName(PROCESSED_LABEL_NAME);
    if (!processedLabel) {
      processedLabel = GmailApp.createLabel(PROCESSED_LABEL_NAME);
    }
    skippedLabel = GmailApp.getUserLabelByName(SKIPPED_LABEL_NAME);
    if (!skippedLabel) {
      skippedLabel = GmailApp.createLabel(SKIPPED_LABEL_NAME);
    }
  }
  
  // テスト時 (DRY_RUN=true) はラベルを除外せず、最近の注文メールを何度でもテストできるようにします
  const query = DRY_RUN 
      ? '(from:auto-confirm@amazon.co.jp OR from:digital-no-reply@amazon.co.jp OR from:send_only@value-books.jp OR from:info@bookoffonline.jp)'
      : '(from:auto-confirm@amazon.co.jp OR from:digital-no-reply@amazon.co.jp OR from:send_only@value-books.jp OR from:info@bookoffonline.jp) -label:' + PROCESSED_LABEL_NAME + ' -label:' + SKIPPED_LABEL_NAME;
      
  const threads = GmailApp.search(query, 0, 10);
  
  if (threads.length === 0) {
    Logger.log("新しい注文メールはありませんでした。");
    return;
  }
  
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('テスト用');
  
  // 重複登録を防ぐため、現在のシートに登録されているタイトルとISBNを取得
  const dataRange = sheet.getDataRange();
  const existingValues = dataRange.getValues();
  let existingIsbns = [];
  let existingNormalizedTitles = [];
  // 1行目はヘッダ想定でスキップ (インデックス1から開始)
  for (let r = 1; r < existingValues.length; r++) {
     let t = existingValues[r][11]; // L列: タイトル
     let i = existingValues[r][2];  // C列: ISBN
     if (t) existingNormalizedTitles.push(normalizeTitle(t.toString()));
     if (i) existingIsbns.push(i.toString().replace(/-/g, '').trim());
  }
  
  for (let i = 0; i < threads.length; i++) {
    const thread = threads[i];
    const messages = thread.getMessages();
    let addedCount = 0;
    let totalBooksFound = 0; // スレッド内のすべてのメッセージで見つかった本の合計数
    
    for (let j = 0; j < messages.length; j++) {
      const msg = messages[j];
      const sender = msg.getFrom();
      const body = msg.getPlainBody();
      let htmlBody = msg.getBody();
      
      let books = []; // { title: '', isbn: '', skipNdlCheck: false }
      
      // ==========================================
      // 1. Amazon (紙 ＆ Kindle)
      // ==========================================
      if (sender.indexOf('amazon.co.jp') !== -1) {
        let isDigital = (sender.indexOf('digital-no-reply') !== -1);
        let orderedTitles = [];
        let lines = body.split('\n');
        
        // プレーンテキストから実際に「注文された」タイトルだけを抽出
        for (let l = 0; l < lines.length; l++) {
          let line = lines[l].trim();
          
          if (line.match(/^商品名\s*[:：]/)) {
             let title = line.replace(/^商品名\s*[:：]/, '').replace(/\(Kindle版\)/gi, '').replace(/^\*\s*/, '').trim();
             if (title && orderedTitles.indexOf(title) === -1) orderedTitles.push(title);
             continue;
          }
          
          if (line.match(/^数量\s*[:：]\s*\d+/) || line.match(/^販売\s*[:：]/)) {
             for (let prev = l - 1; prev >= Math.max(0, l - 3); prev--) {
               let prevLine = lines[prev].trim();
               if (prevLine && !prevLine.match(/^[=\-]+$/) && prevLine.indexOf('商品名') === -1) {
                 // Amazonが付ける行頭のアスタリスクを除去
                 prevLine = prevLine.replace(/^\*\s*/, '').trim();
                 if (orderedTitles.indexOf(prevLine) === -1) orderedTitles.push(prevLine);
                 break;
               }
             }
          }
        }
        
        if (orderedTitles.length === 0) {
           let subj = msg.getSubject();
           let m1 = subj.match(/注文済み:\s*「(.*?)」/);
           if (m1) orderedTitles.push(m1[1]);
           else {
             let m2 = subj.match(/ご注文:\s*(.*?)(?:\(|とさらに|$)/);
             if (m2) orderedTitles.push(m2[1].trim());
           }
        }
        
        // HTMLからASINを順番に抽出 (重複排除)
        const asinRegex = /(?:dp|product|ASIN)(?:\/|%2F)([A-Z0-9]{10})/gi;
        let asins = [];
        let match;
        while ((match = asinRegex.exec(htmlBody)) !== null) {
          if (asins.indexOf(match[1]) === -1) asins.push(match[1]);
        }
        
        Logger.log("Amazonメールを処理: " + msg.getSubject() + (isDigital ? " [デジタル]" : " [物理]"));
        
        // タイトルとASINを出現順にペアリングする
        for (let t = 0; t < orderedTitles.length; t++) {
          let title = orderedTitles[t];
          let asin = asins[t] || '';
          
          if (isDigital) {
            Logger.log(" -> Kindle本として抽出: " + title + " (ASIN: " + asin + ")");
            books.push({ isbn: asin ? 'ASIN:' + asin : '', title: title, skipNdlCheck: true });
          } else {
            // ISBN-10は末尾がXになる場合もあるため対応
            if (asin.match(/^4[0-9]{8}[0-9X]$/i)) {
              Logger.log(" -> 紙の本として抽出: " + title + " (ASIN: " + asin + ")");
              books.push({ isbn: convertIsbn10To13(asin), title: title, skipNdlCheck: false });
            } else {
              Logger.log(" -> [除外] 本以外の物理商品(Tシャツ/家電等): " + title + " (ASIN: " + asin + ")");
            }
          }
        }
      }
      
      // ==========================================
      // 2. バリューブックス
      // ==========================================
      else if (sender.indexOf('value-books.jp') !== -1) {
        let inOrderList = false;
        const lines = body.split('\n');
        for (let l = 0; l < lines.length; l++) {
          let line = lines[l].trim();
          if (line === 'ご注文商品') {
            inOrderList = true;
            continue;
          }
          if (inOrderList) {
            if (line.indexOf('※') === 0 || line === '商品配送先') break;
            if (line === '') continue; // 空行は無視
            let cleanTitle = line.replace(/全\d+巻.*セット/g, '').replace(/【中古】/g, '').trim();
            if (cleanTitle) books.push({ title: cleanTitle, isbn: '', skipNdlCheck: false });
          }
        }
      }
      
      // ==========================================
      // 3. ブックオフオンライン
      // ==========================================
      else if (sender.indexOf('bookoffonline.jp') !== -1) {
        const lines = body.split('\n');
        for (let l = 0; l < lines.length; l++) {
          let line = lines[l].trim();
          if (line.indexOf('【中古】') !== -1 && line.indexOf('ご注文点数') !== -1) {
            let cleanTitle = line.replace(/【中古】/g, '')
                                 .replace(/\(￥[0-9,]+\).*$/g, '')
                                 .trim();
            if (cleanTitle) books.push({ title: cleanTitle, isbn: '', skipNdlCheck: false });
          }
        }
      }
      
      // ==========================================
      // 抽出した本をNDLで検索してシートに登録
      // ==========================================
      if (books.length === 0) {
        Logger.log(" -> [スキップ] 本の注文が含まれていないと判断したためスキップしました: " + msg.getSubject());
      }
      
      totalBooksFound += books.length; // メッセージ内の本の数を合計に加算
      
      for (let k = 0; k < books.length; k++) {
        let b = books[k];
        let ndlData = searchNdlForEmail(b.isbn, b.title);
        
        // メールの元のタイトルを優先する
        let finalTitle = b.title || ndlData.title;
        
        // 余分なフォーマット文字列（(単行本)など）が含まれていれば除去する
        if (finalTitle) {
           finalTitle = finalTitle.replace(/\s*\([^\)]*(単行本|文庫|ハードカバー|新書)[^\)]*\)/g, '').trim();
        }
        
        let finalAuthor = ndlData.author || '';
        let finalPub = ndlData.publisher || '';
        let finalYear = ndlData.year || '';
        let finalIsbn = ndlData.isbn || b.isbn || '';
        
        if (b.skipNdlCheck || ndlData.found || b.isbn) {
          
          // 重複チェック
          let isDuplicate = false;
          if (finalIsbn) {
             // ISBNが存在する場合は、完全にISBNだけで重複判定を行う
             if (existingIsbns.indexOf(finalIsbn) !== -1) {
                isDuplicate = true;
             }
          } else {
             // KindleなどISBNが存在しない場合は、表記揺れを吸収したタイトルで判定を行う
             let normTitle = normalizeTitle(finalTitle);
             if (normTitle && existingNormalizedTitles.indexOf(normTitle) !== -1) {
                isDuplicate = true;
             }
          }
          
          if (isDuplicate) {
             Logger.log(" -> [重複スキップ] すでにシートに登録済みのため追加しませんでした: " + finalTitle);
          } else {
             if (!DRY_RUN) {
                // スクリーンショットの構成に合わせて配列を作成 (A列からO列までの15列分)
                // C列(2): ISBN, F列(5): 読書状況, J列(9): 登録日時, L列(11): タイトル, M列(12): 著者, N列(13): 出版社, O列(14): 発行日
                let rowData = new Array(15).fill('');
                rowData[2] = finalIsbn;
                rowData[5] = '読みたい';
                rowData[9] = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy/MM/dd H:mm");
                rowData[11] = finalTitle;
                rowData[12] = finalAuthor;
                rowData[13] = finalPub;
                rowData[14] = finalYear;
                
                sheet.appendRow(rowData);
                
                // 今回追加したデータも配列に入れて、同一実行内の重複も防ぐ
                if (finalIsbn) existingIsbns.push(finalIsbn);
                if (finalTitle) existingNormalizedTitles.push(normalizeTitle(finalTitle));
             }
             addedCount++;
             Logger.log("書庫に追加しました: " + finalTitle + (DRY_RUN ? " (※テストモード)" : ""));
          }
        } else {
          Logger.log(" -> [スキップ] NDLに情報が存在せず、ISBNもないため除外: " + b.title);
        }
      }
    }
    
    // 処理が完了したスレッドにラベルを付けて次回からスキップする
    if (!DRY_RUN) {
      if (addedCount > 0 || totalBooksFound > 0) {
        // 1冊でも追加された、もしくは重複として処理された本がある場合は「処理済」
        thread.addLabel(processedLabel);
      } else {
        // 本が1冊も含まれていなかった場合（Tシャツのみ等）は「対象外」
        thread.addLabel(skippedLabel);
      }
    }
    Logger.log("スレッド処理完了 (追加数: " + addedCount + ")\n------------------------");
  }
}

// ---------------------------------------------------
// ヘルパー関数群
// ---------------------------------------------------

// 比較用に全角半角や空白などの表記揺れをなくした文字列を生成する
function normalizeTitle(title) {
  if (!title) return '';
  return title
    .replace(/[（）]/g, function(m) { return m === '（' ? '(' : ')'; }) // 全角括弧を半角に
    .replace(/[　\s]/g, '') // 全角半角の空白を削除
    .replace(/[！!？?]/g, '') // 感嘆符や疑問符を削除
    .toLowerCase(); // 英字を小文字に
}

function convertIsbn10To13(isbn10) {
  if (isbn10.length !== 10) return isbn10;
  var isbn13 = "978" + isbn10.substring(0, 9);
  var sum = 0;
  for (var i = 0; i < 12; i++) {
    sum += parseInt(isbn13.charAt(i)) * (i % 2 === 0 ? 1 : 3);
  }
  var checkDigit = (10 - (sum % 10)) % 10;
  return isbn13 + checkDigit;
}

function searchNdlForEmail(isbn, title) {
  var result = { title: '', author: '', publisher: '', year: '', isbn: '', found: false };
  var query = isbn ? "isbn=" + isbn : "title=\"" + encodeURIComponent(title) + "\"";
  var url = "https://ndlsearch.ndl.go.jp/api/sru?operation=searchRetrieve&recordPacking=xml&query=" + query;
  
  try {
    var res = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
    if (res.getResponseCode() === 200) {
      var xmlStr = res.getContentText();
      var titleMatch = xmlStr.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/);
      var creatorMatch = xmlStr.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/);
      var pubMatch = xmlStr.match(/<dc:publisher[^>]*>([^<]+)<\/dc:publisher>/);
      var dateMatch = xmlStr.match(/<dc:date[^>]*>([^<]+)<\/dc:date>/);
      var identifierMatch = xmlStr.match(/<dc:identifier[^>]*xsi:type="dcndl:ISBN"[^>]*>([^<]+)<\/dc:identifier>/);
      
      if (titleMatch || identifierMatch) {
        result.found = true;
      }
      
      if (titleMatch) result.title = titleMatch[1];
      if (creatorMatch) result.author = creatorMatch[1];
      if (pubMatch) result.publisher = pubMatch[1];
      
      if (dateMatch) {
        // 簡単な日付正規化 (YYYY-MM-DD)
        let d = dateMatch[1].replace(/[^0-9]/g, "");
        if (d.length === 8) result.year = d.substring(0,4) + "-" + d.substring(4,6) + "-" + d.substring(6,8);
        else if (d.length === 6) result.year = d.substring(0,4) + "-" + d.substring(4,6);
        else if (d.length === 4) result.year = d;
      }
      
      if (identifierMatch) {
         var fetchedIsbn = identifierMatch[1].replace(/-/g, '');
         if (fetchedIsbn.length === 13) result.isbn = fetchedIsbn;
      }
    }
  } catch(e) { }
  
  return result;
}
