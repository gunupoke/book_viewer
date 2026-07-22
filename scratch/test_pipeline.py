import re

testCases = [
    'リップグリップ岩永 [著]',
    '水田,ケンジ 5pb ニトロプラス',
    '5pb ニトロプラス 明時,士栄',
    '吉田, 糺 たきもと, まさし, 1966- 林, 直孝',
    '吉田, 糺 MAGES ニトロプラス',
    '5pb ニトロプラス 海羽, 超史郎',
    '山田太郎, 鈴木花子',
    '山田 太郎, 鈴木 花子',
    'J.K.ローリング, ジョン・スミス',
    '長谷川, 町子',
    '原哲夫, 武論尊',
    'TYPE-MOON / FGO PROJECT',
    '鳥山明・桂正和'
]

def clean(author_str):
    if not author_str: return ""
    
    # 1. 役割や生没年を削除
    author_str = re.sub(r'[\/／\s\[\(]*?(著|編|訳|原作|作画|原案)[\]\)]?', '', author_str)
    author_str = re.sub(r',?\s*\d{4}-?\s*', ' ', author_str)
    
    # 2. スラッシュや中黒の周りのスペースを削除
    author_str = re.sub(r'\s*([\/／・])\s*', r'\1', author_str)
    
    def replacer(match):
        last = match.group(2)
        first = match.group(3)
        kanji_count = len(re.findall(r'[\u4E00-\u9FFF]', last))
        if kanji_count <= 2 and len(last) <= 4:
            return match.group(1) + last + first + match.group(4)
        else:
            return match.group(0)
            
    # 3. First Pass Last, First Merger
    regex = r'(^|[\s\/／・])([\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FFA-Za-z]{1,4})\s*,\s*([\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FFA-Za-z]{1,4})($|[\s\/／・,])'
    author_str = re.sub(regex, replacer, author_str)
    author_str = re.sub(regex, replacer, author_str)
    
    # 4. 全てのスペースや読点をカンマに変換
    author_str = re.sub(r'[\s、，]+', ', ', author_str)
    author_str = re.sub(r'(,\s*)+', ', ', author_str)
    
    # 5. Second Pass Last, First Merger
    author_str = re.sub(regex, replacer, author_str)
    author_str = re.sub(regex, replacer, author_str)
    
    # 6. 中黒・スラッシュの処理
    tokens = re.split(r'([,・\/／])', author_str)
    authors = []
    curr = ""
    for token in tokens:
        token = token.strip()
        if not token: continue
        if token == ',':
            if curr: authors.append(curr); curr = ""
        elif token in ['・', '/', '／']:
            if re.search(r'[A-Za-z\u30A0-\u30FF]', curr):
                curr += token
            else:
                if curr: authors.append(curr); curr = ""
        else:
            curr += token
            
    if curr: authors.append(curr)
    
    return ', '.join(x.strip() for x in authors if x.strip())

for t in testCases:
    print("IN :", t)
    print("OUT:", clean(t))
    print("-")
