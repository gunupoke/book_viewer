import csv
import json
import urllib.request
import urllib.parse
import time
import io

input_file = r'C:\Users\senji\.gemini\antigravity\brain\c834d4b8-56eb-41ea-87b2-a80db5024466\scratch\a_updated.txt'
output_file = r'C:\Users\senji\.gemini\antigravity\brain\c834d4b8-56eb-41ea-87b2-a80db5024466\scratch\a_final.txt'

APP_ID = '1035987677568160350'
ACC_KEY = 'pk_bQ411n2T0mvoKWg7KI3n4MVac0tEnuRifC6SPakJDyZ'

def fetch_summary_from_rakuten(isbn, title):
    isbn = str(isbn).strip()
    if len(isbn) == 13 and isbn.startswith('978'):
        if isbn.startswith('491'):
            url = f"https://openapi.rakuten.co.jp/services/api/BooksMagazine/Search/20170404?applicationId={APP_ID}&accessKey={ACC_KEY}&jan={isbn}&outOfStockFlag=1"
        else:
            url = f"https://openapi.rakuten.co.jp/services/api/BooksBook/Search/20170404?applicationId={APP_ID}&accessKey={ACC_KEY}&isbn={isbn}&outOfStockFlag=1"
    else:
        # search by title
        encoded_title = urllib.parse.quote(title)
        url = f"https://openapi.rakuten.co.jp/services/api/BooksBook/Search/20170404?applicationId={APP_ID}&accessKey={ACC_KEY}&title={encoded_title}&outOfStockFlag=1"

    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            if data.get('Items') and len(data['Items']) > 0:
                item = data['Items'][0]['Item']
                return item.get('itemCaption', '')
    except Exception as e:
        print(f"Error fetching {title}: {e}")
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
        
        if not summary:
            print(f"Fetching summary for: {title}")
            new_summary = fetch_summary_from_rakuten(isbn, title)
            if new_summary:
                row['Gemini_Summary'] = new_summary
                fetched_count += 1
            time.sleep(1.5) # Rate limiting

    with io.open(output_file, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter='\t', lineterminator='\n')
        writer.writeheader()
        writer.writerows(rows)

    print(f"Done! Fetched {fetched_count} summaries. Saved to a_final.txt")

if __name__ == '__main__':
    main()
