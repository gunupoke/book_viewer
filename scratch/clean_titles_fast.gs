function cleanEnglishTitlesFast() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  // L列（タイトル）のデータだけを一気に取得する（処理を軽くするため）
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return; // データがない場合は終了
  
  // getRange(開始行, 開始列, 行数, 列数) -> L列は12列目
  const range = sheet.getRange(2, 12, lastRow - 1, 1);
  const titles = range.getValues();
  
  let updatedCount = 0;
  
  // 取得したデータをメモリ上で書き換える
  for (let i = 0; i < titles.length; i++) {
    let originalTitle = String(titles[i][0]).trim();
    
    if (originalTitle && originalTitle.includes("=")) {
      let cleanTitle = originalTitle.replace(/\s*=\s*[A-Za-z\s\.\-&:]+(?=\d+$)/, ' ').trim();
      cleanTitle = cleanTitle.replace(/\s*=\s*[A-Za-z\s\.\-&:]+$/, '').trim();
      
      if (cleanTitle !== originalTitle) {
        titles[i][0] = cleanTitle;
        updatedCount++;
      }
    }
  }
  
  // 変更があった場合のみ、シートに一括で書き戻す（超高速）
  if (updatedCount > 0) {
    range.setValues(titles);
    SpreadsheetApp.getUi().alert(updatedCount + " 件の不要な英訳タイトルを削除し、綺麗に修正しました！（高速版）");
  } else {
    SpreadsheetApp.getUi().alert("修正が必要な英訳タイトルは見つかりませんでした。");
  }
}
