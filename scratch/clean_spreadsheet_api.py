import re
import csv
import json
import urllib.request
import time

def normalize_date(date_str):
    if not date_str: return ""
    d = re.sub(r'[年月/]', '-', date_str)
    d = d.replace('日', '')
    parts = d.split('-')
    if len(parts) >= 2:
        return f"{parts[0]}-{parts[1].zfill(2)}" + (f"-{parts[2].zfill(2)}" if len(parts) > 2 and parts[2] else "")
    return date_str

def clean_author_name(author_str):
    if not author_str: return ""
    author_str = re.sub(r'[\/／\s]*(著|編|訳|原作|作画|原案)$', '', author_str)
    author_str = re.sub(r'[、]', ',', author_str)
    author_str = re.sub(r'([一-龯ぁ-ん])[\s　]+([一-龯ぁ-ん])', r'\1\2', author_str)
    
    tokens = re.split(r'([,，・\/／])', author_str)
    authors = []
    current_author = ""
    
    for i in range(len(tokens)):
        token = tokens[i].strip()
        if not token: continue
        if re.match(r'^[,，・\/／]$', token):
            next_token = tokens[i+1].strip() if i+1 < len(tokens) else ""
            has_katakana = bool(re.search(r'[ァ-ヶA-Za-z]', current_author) or re.search(r'[ァ-ヶA-Za-z]', next_token))
            
            if has_katakana:
                if re.match(r'^[・\/／]$', token):
                    current_author += token
                else:
                    authors.append(current_author)
                    current_author = ""
            else:
                if len(current_author) > 0 and len(next_token) > 0 and (len(current_author) + len(next_token) <= 5):
                    pass
                else:
                    authors.append(current_author)
                    current_author = ""
        else:
            current_author += token
            
    if current_author:
        authors.append(current_author)
        
    final_authors = []
    for a in authors:
        if re.search(r'[ァ-ヶA-Za-z]', a):
            final_authors.append(a)
        else:
            final_authors.append(re.sub(r'[\s　]+', '', a))
            
    return ', '.join(f for f in final_authors if f)

def fetch_safe(url):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as res:
            return res.read().decode('utf-8')
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return None

def fetch_book_data(isbn):
    title, author, publisher, year = "", "", "", ""
    
    # 1. OpenBD
    obd = fetch_safe(f"https://api.openbd.jp/v1/get?isbn={isbn}")
    if obd:
        try:
            data = json.loads(obd)
            if data and data[0]:
                if "summary" in data[0]:
                    title = data[0]["summary"].get("title", "")
                    author = data[0]["summary"].get("author", "")
                    publisher = data[0]["summary"].get("publisher", "")
                    year = data[0]["summary"].get("pubdate", "")
                    if year: year = normalize_date(year)
                elif "onix" in data[0]:
                    try:
                        title = data[0]["onix"]["DescriptiveDetail"]["TitleDetail"]["TitleElement"]["TitleText"]["content"]
                    except: pass
        except: pass

    # 2. NDL
    if not title:
        ndl = fetch_safe(f"https://ndlsearch.ndl.go.jp/api/sru?operation=searchRetrieve&recordPacking=xml&query=isbn={isbn}")
        if ndl:
            title_match = re.search(r'<dc:title>([\s\S]*?)</dc:title>', ndl)
            if title_match:
                title = title_match.group(1).replace('&amp;', '&')
                creator_match = re.search(r'<dc:creator>([\s\S]*?)</dc:creator>', ndl)
                pub_match = re.search(r'<dc:publisher>([\s\S]*?)</dc:publisher>', ndl)
                date_match = re.search(r'<dc:date>([\s\S]*?)</dc:date>', ndl)
                
                if creator_match: author = creator_match.group(1).replace('&amp;', '&')
                if pub_match: publisher = pub_match.group(1).replace('&amp;', '&')
                if date_match: year = normalize_date(date_match.group(1))

    # 3. Google Books
    if not title:
        gb = fetch_safe(f"https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}")
        if gb:
            try:
                data = json.loads(gb)
                if "items" in data and len(data["items"]) > 0:
                    info = data["items"][0]["volumeInfo"]
                    title = info.get("title", "")
                    author = ", ".join(info.get("authors", []))
                    publisher = info.get("publisher", "")
                    year = info.get("publishedDate", "")
                    if year: year = normalize_date(year)
            except: pass

    return title, author, publisher, year

input_file = r'C:\Users\senji\Desktop\ツール\Antigravity_workspaces用\自作\あなたには万屋になってもらいます\a.txt'
output_file = r'C:\Users\senji\Desktop\ツール\Antigravity_workspaces用\自作\あなたには万屋になってもらいます\a_cleaned.txt'

with open(input_file, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f, delimiter='\t')
    fieldnames = reader.fieldnames
    rows = list(reader)

fixed_count = 0
for row in rows:
    isbn = row.get('ISBN13', '').strip()
    title = row.get('Title', '').strip()
    author = row.get('Author', '').strip()
    
    # 欠損やエラー表記があれば再取得
    if isbn and (not title or title == 'タイトル不明' or not author or author == '著者不明' or author == 'Unknown'):
        print(f"Fetching missing data for ISBN: {isbn} (Title: {title}, Author: {author})")
        t, a, p, y = fetch_book_data(isbn)
        if t: row['Title'] = t
        if a: row['Author'] = a
        if p and not row.get('Publisher'): row['Publisher'] = p
        if y and not row.get('Year'): row['Year'] = y
        time.sleep(0.5)
        fixed_count += 1
        
    # 著者名の表記揺れ補正
    if row.get('Author'):
        row['Author'] = clean_author_name(row['Author'])
        
    # タイトルの前後の空白などを除去
    if row.get('Title'):
        row['Title'] = row['Title'].strip()

    # 日付のフォーマット補正 (YYYY-MM-DD)
    if row.get('Year'):
        row['Year'] = normalize_date(row['Year'])

with open(output_file, 'w', encoding='utf-8', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter='\t')
    writer.writeheader()
    writer.writerows(rows)

print(f"Done! Cleaned {len(rows)} books. Fetched missing APIs for {fixed_count} books. Wrote enriched TSV to a_cleaned.txt")
