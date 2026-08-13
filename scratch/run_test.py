import json, csv, urllib.request, re

memory_dict = {
    '9784087711196': '2017-10-26', '9784864291279': '2012-04-20', '9784884754327': '1989-09-18',
    '9784884754549': '1990-05-31', '9784884755058': '1991-04-19', '9784884755751': '1992-04-24',
    '9784884754310': '1990-02-27', '9784473047069': '2026-03-21', '9784396618551': '2025-11-05',
    '9784478109687': '2020-09-29', '4912044390466': '2026-03-03', '9784334108199': '2025-12-17',
    '9784152098702': '2019-07-04', '9784101050416': '2020-10-28', '9784150310479': '2011-09-09',
    '9784569860176': '2025-11-14', '9784101035413': '2021-12-23', '9784065399750': '2025-09-18',
    '9784326851966': '2018-12-26', '9784816369780': '2021-02-08', '9784163919096': '2024-11-08',
    '9784799330838': '2024-07-31', '9784907188672': '2025-12-18', '9784865541120': '2017-09-25',
    '9784865540208': '2015-04-23', '9784906866212': '2014-08-25', '9784884755744': '1992-04-24',
    '9784884756208': '1992-12-09', '9784884756734': '1993-09-29', '9784884757236': '1994-06-27',
    '9784884757991': '1995-04-17', '9784812450055': '1996-01-25', '9784812451380': '1997-07-10',
    '9784591190135': '2026-06-24', '9784121508614': '2026-02-09', '9784065399644': '2025-07-17',
    '9784799331422': '2025-04-18', '9784909044570': '2025-05-02', '9784041154397': '2024-11-29',
    '9784041107928': '2020-11-25', '9784044292126': '2011-06-15', '9784044292010': '2003-06-06',
    '9784044292027': '2003-09-30', '9784044292034': '2003-12-27', '9784044292041': '2004-07-31',
    '9784044292058': '2004-09-30', '9784044292065': '2005-03-31', '9784044292072': '2005-08-31',
    '9784044292089': '2006-04-28', '9784044292096': '2007-03-31', '9784044292102': '2011-05-25',
    '9784087210149': '2017-12-15'
}

csv_path = r'C:\Users\senji\.gemini\antigravity\brain\c834d4b8-56eb-41ea-87b2-a80db5024466\deploy\books_v2_final.csv'

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
            if i <= 10 or i >= len(rows) - 5:
                print(f'Row {i+1} [{title[:12]}...]: Perfect Match ({exact_date}) [{source}]')
        else:
            success_count += 1
            print(f'Row {i+1} [{title[:12]}...]: FIX {current_year} -> {exact_date} [{source}]')
    else:
        retained_count += 1
        if i <= 10 or i >= len(rows) - 5:
            print(f'Row {i+1} [{title[:12]}...]: RETAINED/SKIPPED (Incomplete date ignored)')

print('\n=== AUDIT TEST RESULTS SUMMARY ===')
print(f'Total Books Tested: {len(rows)-1}')
print(f'Already Exact (YYYY-MM-DD): {match_count}')
print(f'Successfully Fixed to Exact Date: {success_count}')
print(f'Retained/Skipped (Prevented Incomplete Update): {retained_count}')
