import urllib.request
import json
import xml.etree.ElementTree as ET

isbn = "9784042224314"

# OpenBD
try:
    req = urllib.request.urlopen(f"https://api.openbd.jp/v1/get?isbn={isbn}")
    data = json.loads(req.read())
    if data[0]:
        print("OpenBD PublishingDate:", data[0].get("summary", {}).get("pubdate"))
    else:
        print("OpenBD: Not found")
except Exception as e:
    print("OpenBD error:", e)

# NDL
try:
    req = urllib.request.urlopen(f"https://ndlsearch.ndl.go.jp/api/opensearch?isbn={isbn}")
    tree = ET.fromstring(req.read())
    # Find all dc:date
    dates = []
    for elem in tree.iter():
        if 'date' in elem.tag:
            dates.append(elem.text)
    print("NDL dates:", dates)
except Exception as e:
    print("NDL error:", e)
