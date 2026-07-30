# 万屋の書庫 - 永続メモリ (Yorozuya Memory)

このファイルは、万屋の書庫システムを運用する上でのユーザー固有の設定、APIキー、過去のトラブルシューティングの経緯などを記録し、AIアシスタントが記憶を失わないようにするためのものです。
AIアシスタントが初期化された際も、このファイルを読むことでこれまでの文脈を即座に復元できます。

## 1. 楽天API (OpenAPI Proxy) 設定
通常の楽天ウェブサービス（19桁の数字ID）とは異なる形式（UUID形式など）のキーを使用しています。

- **API Endpoint Base**: `https://openapi.rakuten.co.jp/services/api/`
- **Application ID**: `eaf0a411-9192-4746-b9ed-ac0364bc6426`
- **Access Key**: `pk_bQ411n2T0mvoKWg7KI3n4MVac0tEnuRifC6SPakJDyZ`

> **注意点 (Troubleshooting):**
> このAPIエンドポイントはブラウザ側（`script_v2.js` 等）からの `fetch` では動作しますが、Google Apps Script側（`BackgroundGeminiScript.js` 等の `UrlFetchApp`）から直接叩こうとすると `Address unavailable` やHTTPエラーでブロックされることがあります（GASサーバーのIP弾きやReferer制限などの影響）。
> そのため、GAS側での大規模な検索処理には、以前スクレイピング等で取得した「確定版日付のハードコード辞書 (`all_correct_dates.json`)」を用いる方針としています。

## 2. 過去のデータ復元・処理方針
- **Google Books の発売日は不正確なため原則使用しない**:
  Google Booksは「2012年4月」といった曖昧なデータを返すことが多く、スプレッドシート上で強制的に「〇年〇月1日」にされてしまいます。そのため、Google BooksのAPIからは「発売日」は絶対に取得せず、OpenBD、NDL、楽天API（またはハードコードされた辞書データ）から取得する方針です。
- **レトロアクティブ（遡及的）な日付復元**:
  古いライトノベル等（イリヤの空、エヴァなど）は、OpenBD等でも正確な「日」まで返ってきません。この問題に対処するため、過去にスクレイピングで取得した218冊分の「正確な日付辞書」をGASの `fixRetroactiveDatesFromMemory` に組み込み、それを使って直接復元しました。

## 3. その他の設定・ルール
- リポジトリやコードの更新はユーザーが行うのではなく、すべてAIアシスタント側でGitHub等（または該当ファイル）へ上書き更新する。
- OneDriveのフォルダは同期トラブルの原因となるため絶対に使用しない。
