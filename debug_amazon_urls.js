function debugAmazonUrls() {
  const threads = GmailApp.search('from:auto-confirm@amazon.co.jp subject:"注文済み:"', 0, 1);
  if (threads.length === 0) {
    Logger.log("該当するメールが見つかりませんでした。");
    return;
  }
  
  const msg = threads[0].getMessages()[0];
  Logger.log("Subject: " + msg.getSubject());
  
  const body = msg.getBody(); // HTML本文
  
  // URLっぽいものをすべて抽出
  const urlRegex = /https?:\/\/[a-zA-Z0-9\.\/\-_=%&\?]+/gi;
  const urls = body.match(urlRegex);
  
  if (urls) {
    Logger.log("=== メール内のURL一覧 ===");
    let uniqueUrls = [];
    for (let i = 0; i < urls.length; i++) {
      if (uniqueUrls.indexOf(urls[i]) === -1) {
        uniqueUrls.push(urls[i]);
      }
    }
    for (let i = 0; i < uniqueUrls.length; i++) {
      Logger.log(uniqueUrls[i]);
    }
  } else {
    Logger.log("URLが見つかりませんでした。");
  }
}
