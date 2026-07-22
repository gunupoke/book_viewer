import csv
import urllib.request
import xml.etree.ElementTree as ET
import json
import re
import time
import os

csv_path = r"C:\Users\senji\Desktop\ツール\Antigravity_workspaces用\自作\あなたには万屋になってもらいます\yorozuya ver3.5 - シート1.csv"
output_gas = r"C:\Users\senji\.gemini\antigravity\brain\c834d4b8-56eb-41ea-87b2-a80db5024466\artifacts\correct_dates.txt"

bad_books = []
with open(csv_path, "r", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        year = row.get("Year", "")
        # Match dates ending in /01 or -01 or just YYYY-MM
        if re.search(r'(-01|/01)$', year) or re.search(r'^20\d\d-[01]\d$', year):
            isbn = row.get("ISBN13", "")
            title = row.get("Title", "")
            if isbn:
                bad_books.append({"isbn": isbn, "title": title, "old_year": year})

print(f"Found {len(bad_books)} books to fix.")

correct_dates = {}
ns = {'dc': 'http://purl.org/dc/elements/1.1/', 'dcterms': 'http://purl.org/dc/terms/'}

for b in bad_books:
    isbn = b["isbn"]
    best_date = None
    
    # 1. Try NDL API
    url = f"https://ndlsearch.ndl.go.jp/api/opensearch?isbn={isbn}"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        xml_data = urllib.request.urlopen(req).read()
        root = ET.fromstring(xml_data)
        
        for item in root.findall('.//item'):
            # Check dc:description for 初版
            desc_elements = item.findall('.//dc:description', ns)
            for desc in desc_elements:
                if desc.text and "初版：" in desc.text:
                    m = re.search(r'初版：(\d{4})[．\.](\d{1,2})[．\.](\d{1,2})', desc.text)
                    if m:
                        best_date = f"{m.group(1)}/{int(m.group(2)):02d}/{int(m.group(3)):02d}"
                        break
            if best_date: break
            
            # Check dc:date
            date_el = item.find('.//dc:date', ns)
            if date_el is not None and date_el.text:
                m = re.search(r'^(\d{4})-(\d{2})-(\d{2})$', date_el.text)
                if m and m.group(3) != '01':
                    best_date = f"{m.group(1)}/{m.group(2)}/{m.group(3)}"
                    break
    except Exception as e:
        pass
        
    # 2. Try OpenBD API if NDL failed
    if not best_date:
        openbd_url = f"https://api.openbd.jp/v1/get?isbn={isbn}"
        openbd_req = urllib.request.Request(openbd_url, headers={'User-Agent': 'Mozilla/5.0'})
        try:
            openbd_data = json.loads(urllib.request.urlopen(openbd_req).read())
            if openbd_data and openbd_data[0]:
                pubdate = openbd_data[0].get("summary", {}).get("pubdate", "")
                if pubdate and len(pubdate) == 8:
                    best_date = f"{pubdate[:4]}/{pubdate[4:6]}/{pubdate[6:8]}"
        except Exception:
            pass

    if best_date:
        correct_dates[isbn] = best_date
        print(f"OK {b['title']}: {best_date}")
    else:
        print(f"NG {b['title']}: Not found")
        
    time.sleep(1) # Be nice to APIs

# Generate JS object
os.makedirs(os.path.dirname(output_gas), exist_ok=True)
with open(output_gas, "w", encoding="utf-8") as f:
    f.write("const correctDates = {\n")
    for isbn, date in correct_dates.items():
        f.write(f'  "{isbn}": "{date}",\n')
    f.write("};\n")
    
print("Finished!")
