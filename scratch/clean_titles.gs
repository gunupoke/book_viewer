function cleanEnglishTitles() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  
  let updatedCount = 0;
  
  for (let i = 1; i < data.length; i++) {
    // L列 (インデックス11) のタイトルを取得
    let originalTitle = String(data[i][11]).trim();
    
    if (originalTitle && originalTitle.includes("=")) {
      // 「= 英語名. 巻数」のパターンを修正 (例: スノウボールアース = SNOW BALL EARTH. 1 -> スノウボールアース 1)
      let cleanTitle = originalTitle.replace(/\s*=\s*[A-Za-z\s\.\-&:]+(?=\d+$)/, ' ').trim();
      
      // 末尾の「= 英語名」のパターンを修正 (例: タイトル = Title -> タイトル)
      cleanTitle = cleanTitle.replace(/\s*=\s*[A-Za-z\s\.\-&:]+$/, '').trim();
      
      // タイトルに変化があった場合のみシートに書き込む
      if (cleanTitle !== originalTitle) {
        sheet.getRange(i + 1, 12).setValue(cleanTitle);
        updatedCount++;
      }
    }
  }
  
  if (updatedCount > 0) {
    SpreadsheetApp.getUi().alert(updatedCount + " 件の不要な英訳タイトルを削除し、綺麗に修正しました！");
  } else {
    SpreadsheetApp.getUi().alert("修正が必要な英訳タイトルは見つかりませんでした。");
  }
}
