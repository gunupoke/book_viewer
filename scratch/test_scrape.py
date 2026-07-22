import urllib.request
import re

isbn = "9784840224314"
url = f"https://honto.jp/netstore/search.html?k={isbn}"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    html = urllib.request.urlopen(req).read().decode('utf-8')
    # honto usually has format: 2003年08月
    match = re.search(r'(\d{4}年\d{1,2}月\d{1,2}日)', html)
    if match:
        print("Honto:", match.group(1))
    else:
        print("Honto: No exact date found")
except Exception as e:
    print("Error:", e)
