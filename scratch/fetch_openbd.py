import csv
import json
import urllib.request
import time
import io

input_file = r'C:\Users\senji\.gemini\antigravity\brain\c834d4b8-56eb-41ea-87b2-a80db5024466\scratch\a_updated.txt'
output_file = r'C:\Users\senji\.gemini\antigravity\brain\c834d4b8-56eb-41ea-87b2-a80db5024466\scratch\a_final.txt'

def fetch_summary_from_openbd(isbn):
    isbn = str(isbn).strip()
    if len(isbn) != 13 or not isbn.startswith('978'):
        return ""
    
    url = f"https://api.openbd.jp/v1/get?isbn={isbn}"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            if data and data[0]:
                onix = data[0].get('onix', {})
                collateral = onix.get('CollateralDetail', {})
                text_contents = collateral.get('TextContent', [])
                for tc in text_contents:
                    if tc.get('TextType') in ['02', '03']: # 02 is short description, 03 is description
                        return tc.get('Text', '')
    except Exception as e:
        print(f"Error fetching {isbn}: {e}")
    return ""

def main():
    rows = []
    with open(input_file, encoding='utf-8') as f:
        reader = csv.DictReader(f, delimiter='\t')
        fieldnames = list(reader.fieldnames)
        
        # Remove Gemini_Genre if it exists
        if 'Gemini_Genre' in fieldnames:
            fieldnames.remove('Gemini_Genre')
            
        for row in reader:
            if 'Gemini_Genre' in row:
                del row['Gemini_Genre']
            rows.append(row)

    fetched_count = 0
    for i, row in enumerate(rows):
        summary = row.get('Gemini_Summary', '').strip()
        title = row.get('Title', '')
        isbn = row.get('ISBN13', '')
        
        if not summary and isbn:
            print(f"Fetching summary for: {title}")
            new_summary = fetch_summary_from_openbd(isbn)
            if new_summary:
                row['Gemini_Summary'] = new_summary
                fetched_count += 1
            time.sleep(0.5)

    with io.open(output_file, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter='\t', lineterminator='\n')
        writer.writeheader()
        writer.writerows(rows)

    print(f"Done! Fetched {fetched_count} summaries. Saved to a_final.txt")

if __name__ == '__main__':
    main()
