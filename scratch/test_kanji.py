import re

testCases = [
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
]

def clean(author_str):
    if not author_str: return ""
    
    author_str = re.sub(r'[\/／\s\[\(]*?(著|編|訳|原作|作画|原案)[\]\)]?', '', author_str)
    author_str = re.sub(r',?\s*\d{4}-?\s*', ' ', author_str)
    
    def replacer(match):
        last = match.group(2)
        first = match.group(3)
        
        kanji_count = len(re.findall(r'[一-龯]', last))
        
        if kanji_count <= 2 and len(last) <= 4:
            return match.group(1) + last + first + match.group(4)
        else:
            return match.group(0)
            
    author_str = re.sub(r'(^|[\s\/／・])([一-龯ぁ-んァ-ヶA-Za-z]{1,4})\s*,\s*([一-龯ぁ-んァ-ヶA-Za-z]{1,4})($|[\s\/／・,])', replacer, author_str)
    author_str = re.sub(r'(^|[\s\/／・])([一-龯ぁ-んァ-ヶA-Za-z]{1,4})\s*,\s*([一-龯ぁ-んァ-ヶA-Za-z]{1,4})($|[\s\/／・,])', replacer, author_str)
    
    tokens = re.split(r'([\s,，・\/／]+)', author_str)
    authors = []
    curr = ""
    for token in tokens:
        if not token.strip():
            sep = token
            if ',' in sep or '，' in sep:
                if curr: authors.append(curr); curr = ""
            elif '・' in sep or '/' in sep or '／' in sep:
                if re.search(r'[A-Za-zァ-ヶ]', curr):
                    curr += sep.strip()
                else:
                    if curr: authors.append(curr); curr = ""
            elif ' ' in sep or '　' in sep:
                if curr: authors.append(curr); curr = ""
        else:
            curr += token
            
    if curr: authors.append(curr)
    
    return ', '.join(x for x in authors if x)

for t in testCases:
    print("IN :", t)
    print("OUT:", clean(t))
    print("-")
