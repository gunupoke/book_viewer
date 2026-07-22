const testCases = [
    'リップグリップ岩永 [著]',
    '水田,ケンジ 5pb ニトロプラス',
    '5pb ニトロプラス 明時,士栄',
    '吉田, 糺 たきもと, まさし, 1966- 林, 直孝',
    '吉田, 糺 MAGES ニトロプラス',
    '5pb ニトロプラス 海羽, 超史郎',
    '山田太郎, 鈴木花子',
    'J.K.ローリング, ジョン・スミス',
    '長谷川, 町子',
    '原哲夫, 武論尊'
];

function cleanAuthorName(authorStr) {
    if (!authorStr) return "";
    
    // 1. 役割や生没年を削除 (角括弧も対応)
    authorStr = authorStr.replace(/[\/／\s\[\(]*?(著|編|訳|原作|作画|原案)[\]\)]?/g, '');
    authorStr = authorStr.replace(/,?\s*\d{4}-?\s*/g, ' '); // 1966- 等の年を削除
    authorStr = authorStr.replace(/[、]/g, ',');
    
    // 2. Last, First の結合
    // NDLなどで見られる「姓,名」を結合する。条件: カンマの前後が1〜4文字の漢字/ひらがな/カタカナ
    // 前後にスペースが含まれていてもよい
    authorStr = authorStr.replace(/(^|[\s\/／・])([一-龯ぁ-んァ-ヶ]{1,4})\s*,\s*([一-龯ぁ-んァ-ヶ]{1,4})($|[\s\/／・])/g, (match, p1, p2, p3, p4) => {
        return p1 + p2 + p3 + p4;
    });
    // 上の正規表現は重複マッチができないので、もう一度かける
    authorStr = authorStr.replace(/(^|[\s\/／・])([一-龯ぁ-んァ-ヶ]{1,4})\s*,\s*([一-龯ぁ-んァ-ヶ]{1,4})($|[\s\/／・])/g, (match, p1, p2, p3, p4) => {
        return p1 + p2 + p3 + p4;
    });

    // 3. もし「原哲夫, 武論尊」が「原哲夫武論尊」になってしまうのを防ぎたいが、
    // ここで結合されてしまった場合、実は「原哲夫」が3文字、「武論尊」が3文字なので結合されてしまう。
    // NDLは「Last, First」でスペース区切りの著者リストを返す。
    // そのため、スペース区切りで複数人いる場合はカンマに変換する。
    
    // 単純なトークン化（スペース、スラッシュ、中黒、カンマ）
    let tokens = authorStr.split(/([\s,，・\/／]+)/);
    
    let authors = [];
    let currentAuthor = "";
    
    for (let i = 0; i < tokens.length; i++) {
        let token = tokens[i].trim();
        if (!token) {
            // 区切り文字トークン（スペースのみ、など）
            let sep = tokens[i];
            if (sep.includes(',') || sep.includes('，')) {
                if (currentAuthor) {
                    authors.push(currentAuthor);
                    currentAuthor = "";
                }
            } else if (sep.includes('・') || sep.includes('/') || sep.includes('／')) {
                // カタカナ・英語が含まれていれば結合（TYPE-MOON / FGO PROJECT）
                // そうでなければ分割？
                currentAuthor += sep.trim(); // 保留
            } else if (sep.trim() === '') {
                // スペース区切りの場合。
                // NDLでは著者と著者の間はスペース。
                // もし currentAuthor があれば分割するか？
                // J.K.ローリング や 5pb のような名前の途中のスペースはどうするか？
                if (currentAuthor) {
                    authors.push(currentAuthor);
                    currentAuthor = "";
                }
            }
        } else {
            currentAuthor += token;
        }
    }
    if (currentAuthor) authors.push(currentAuthor);
    
    return authors.filter(a => a).join(', ');
}

testCases.forEach(t => {
    console.log(`[IN]  ${t}`);
    console.log(`[OUT] ${cleanAuthorName(t)}`);
    console.log("-");
});
