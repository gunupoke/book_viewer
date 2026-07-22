import re

def replacer(match):
    last = match.group(2)
    first = match.group(3)
    kanji_count = len(re.findall(r'[\u4E00-\u9FFF]', last))
    if kanji_count <= 2 and len(last) <= 4:
        return match.group(1) + last + first
    else:
        return match.group(0)

s = '林, 修, 伊沢, 拓司(QuizKnok)'
regex = r'(^|[\s\/／・])([\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FFA-Za-z]{1,4})\s*,\s*([\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FFA-Za-z]{1,4}[^\s,]*)(?=$|[\s\/／・,])'

print("0:", s)
s = re.sub(regex, replacer, s)
print("1:", s)
