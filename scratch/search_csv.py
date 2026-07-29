import csv
path = r'C:\Users\senji\.gemini\antigravity\brain\c834d4b8-56eb-41ea-87b2-a80db5024466\deploy\books_v2.csv'
try:
    with open(path, 'r', encoding='utf-8-sig') as f:
        for i, row in enumerate(csv.DictReader(f)):
            if 'イリヤ' in row.get('Title', ''):
                print(f"Row {i+2}: Title: {row.get('Title')} / Year: {row.get('Year')} / Added: {row.get('Added_Date')}")
except Exception as e:
    print(e)
