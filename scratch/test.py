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

def clean(s):
    if not s: return ""
    # 1. Strip roles
    s = re.sub(r'[\/／\s\[\(]*?(著|編|訳|原作|作画|原案)[\]\)]?', '', s)
    s = re.sub(r',?\s*\d{4}-?\s*', ' ', s) # remove years
    
    # 2. Merge Last, First
    # Must be 1~4 chars on both sides.
    # We want to match: Start or Space -> Word -> , -> Word -> End or Space
    def rep(m):
        return m.group(1) + m.group(2) + m.group(3) + m.group(4)
        
    s = re.sub(r'(^|[\s\/／・])([一-龯ぁ-んァ-ヶA-Za-z]{1,4})\s*,\s*([一-龯ぁ-んァ-ヶA-Za-z]{1,4})($|[\s\/／・])', rep, s)
    s = re.sub(r'(^|[\s\/／・])([一-龯ぁ-んァ-ヶA-Za-z]{1,4})\s*,\s*([一-龯ぁ-んァ-ヶA-Za-z]{1,4})($|[\s\/／・])', rep, s)
    
    # Just tokenizing
    tokens = re.split(r'([\s,，・\/／]+)', s)
    authors = []
    curr = ""
    for token in tokens:
        if not token.strip():
            # it's a separator
            if ',' in token or '，' in token:
                if curr: authors.append(curr); curr = ""
            elif '/' in token or '／' in token or '・' in token:
                if re.search(r'[A-Za-zァ-ヶ]', curr):
                    curr += token.strip()
                else:
                    if curr: authors.append(curr); curr = ""
            elif token == ' ' or token == '　':
                # Space
                # Does a space separate authors? Yes! e.g. "5pb ニトロプラス"
                if curr: authors.append(curr); curr = ""
        else:
            curr += token
            
    if curr: authors.append(curr)
    
    return ', '.join(x for x in authors if x)

for t in testCases:
    print("IN :", t)
    print("OUT:", clean(t))
    print("-")
