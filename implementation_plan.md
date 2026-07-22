# スプレッドシート直接書き込みの自動化プラン

私（Antigravity）からスプレッドシートへ直接「要約の修正結果」を上書き保存できるようにするための改修プランです。

## User Review Required
現在の私の権限では、あなたのGoogleアカウント内にあるスプレッドシートを勝手に書き換えることができません。
しかし、現在バーコードアプリ用に稼働している**「GASのWebアプリ（URL）」**を経由すれば、私から直接データを送り込んでスプレッドシートを上書きすることが可能になります！

これを実現するためには、GASのプログラムに「要約の上書き機能」を追加し、再度Webアプリとしてデプロイし直していただく必要があります。よろしいでしょうか？

## Proposed Changes

### [MODIFY] [BackgroundGeminiScript.js](file:///C:/Users/senji/.gemini/antigravity/brain/c834d4b8-56eb-41ea-87b2-a80db5024466/BackgroundGeminiScript.js)
1. `doPost` 関数内に `action === 'updateSummary'` の分岐を追加します。
2. スプレッドシート内の該当ISBNを検索し、要約（Gemini_Summary）列を上書きする関数 `updateBookSummary` を追加します。

## Verification Plan
1. ご了承いただけましたら、私がコードを書き換えます。
2. あなたにコードをコピペし、「新しいバージョン」としてWebアプリを再デプロイしていただきます。
3. デプロイ後のWebアプリURL（https://script.google.com/...）を私に教えていただきます。
4. 私がテストとして、先ほど保留になっていた『火車』と『ラーメンと瞑想』の新しい要約文を、そのURL経由でスプレッドシートに直接書き込みます！
