import json, csv, urllib.request, re

json_path = r'C:\Users\senji\.gemini\antigravity\brain\c834d4b8-56eb-41ea-87b2-a80db5024466\artifacts\all_correct_dates.json'
csv_path = r'C:\Users\senji\.gemini\antigravity\brain\c834d4b8-56eb-41ea-87b2-a80db5024466\deploy\books_v2_final.csv'

with open(json_path, 'r', encoding='utf-8') as f:
    raw_memory = json.load(f)

memory_dict = {k: v.replace('/', '-') for k, v in raw_memory.items()}

with open(csv_path, 'r', encoding='utf-8') as f:
    rows = list(csv.reader(f))

print(f'=== Testing Audit Logic on {len(rows)-1} Rows ===')

match_count = 0
success_count = 0
retained_count = 0

for i in range(1, len(rows)):
    row = rows[i]
    if len(row) < 3:
        continue
    title = row[0]
    raw_isbn = row[2].replace("'", "").strip()
    current_year = row[14].strip() if len(row) > 14 else ""
    
    exact_date = None
    source = ''
    
    if raw_isbn in memory_dict:
        exact_date = memory_dict[raw_isbn]
        source = 'Memory'
        
    if not exact_date:
        try:
            url = f'https://api.openbd.jp/v1/get?isbn={raw_isbn}'
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            res = urllib.request.urlopen(req, timeout=3)
            data = json.loads(res.read().decode('utf-8'))
            if data and data[0] and data[0].get('summary', {}).get('pubdate'):
                digits = re.sub(r'\D', '', str(data[0]['summary']['pubdate']))
                if len(digits) == 8:
                    exact_date = f"{digits[0:4]}-{digits[4:6]}-{digits[6:8]}"
                    source = 'OpenBD'
        except Exception:
            pass

    if exact_date:
        if current_year == exact_date:
            match_count += 1
            # print(f'Row {i+1} [{title[:12]}...]: Perfect Match ({exact_date}) [{source}]')
        else:
            success_count += 1
            # print(f'Row {i+1} [{title[:12]}...]: FIX {current_year} -> {exact_date} [{source}]')
    else:
        retained_count += 1
        # print(f'Row {i+1} [{title[:12]}...]: RETAINED/SKIPPED (Incomplete date ignored)')

print('\n=== AUDIT TEST RESULTS SUMMARY ===')
print(f'Total Books Tested: {len(rows)-1}')
print(f'Already Exact (YYYY-MM-DD): {match_count}')
print(f'Successfully Fixed to Exact Date: {success_count}')
print(f'Retained/Skipped (Prevented Incomplete Update): {retained_count}')
