function fixDatesInSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;
  
  // O列（発行年）はインデックス14
  const range = sheet.getRange(2, 15, lastRow - 1, 1);
  const dates = range.getValues();
  let updatedCount = 0;
  
  for (let i = 0; i < dates.length; i++) {
    // 既存の日付を取得。Dateオブジェクトになっている場合は文字列に変換して判定
    let rawDate = dates[i][0];
    if (!rawDate) continue;
    
    // スプレッドシート上で「〜年〜月1日」のように見えても、裏側ではDate型になっています
    // yyyy/MM/dd形式の文字列に変換してチェック
    let dateStr = "";
    if (rawDate instanceof Date) {
      // タイムゾーンのズレを防ぐための簡単な文字列化
      let y = rawDate.getFullYear();
      let m = ("0" + (rawDate.getMonth() + 1)).slice(-2);
      let d = ("0" + rawDate.getDate()).slice(-2);
      dateStr = `${y}/${m}/${d}`;
    } else {
      dateStr = String(rawDate).trim();
    }
    
    // 「XXXX/XX/01」のような文字列、または「年」などの漢字を含む文字列から年を抽出
    // 特に「〜月1日」になっているものは「不十分な日付情報」とみなし、年(4桁)だけに変換する
    if (dateStr.endsWith("/01") || dateStr.match(/\d{4}年\d{1,2}月1日/)) {
      let yearMatch = dateStr.match(/^(\d{4})/);
      if (yearMatch) {
        // スプレッドシートが再度日付として解釈しないよう、文字列として書き込む
        // 必要に応じてアポストロフィ(')をつける手もありますが、数字4桁なら通常は数値(年)として扱われます
        dates[i][0] = yearMatch[1]; 
        updatedCount++;
      }
    }
  }
  
  if (updatedCount > 0) {
    range.setValues(dates);
    SpreadsheetApp.getUi().alert(updatedCount + " 件の不自然な「1日」の日付を、年のみ（4桁）に修正しました！");
  } else {
    SpreadsheetApp.getUi().alert("修正が必要な日付は見つかりませんでした。");
  }
}
