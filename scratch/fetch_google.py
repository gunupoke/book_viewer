import csv
import json
import urllib.request
import time
import io

input_file = r'C:\Users\senji\.gemini\antigravity\brain\c834d4b8-56eb-41ea-87b2-a80db5024466\scratch\a_final.txt'
output_file = r'C:\Users\senji\.gemini\antigravity\brain\c834d4b8-56eb-41ea-87b2-a80db5024466\scratch\a_final_2.txt'

def fetch_summary_from_google(isbn, title):
    isbn = str(isbn).strip()
    if len(isbn) >= 10:
        url = f"https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}"
    else:
        encoded_title = urllib.parse.quote(title)
        url = f"https://www.googleapis.com/books/v1/volumes?q=intitle:{encoded_title}"
        
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            if data.get('items') and len(data['items']) > 0:
                volume_info = data['items'][0].get('volumeInfo', {})
                return volume_info.get('description', '')
    except Exception as e:
        print(f"Error fetching {title}: {e}")
    return ""

def main():
    rows = []
    with open(input_file, encoding='utf-8') as f:
        reader = csv.DictReader(f, delimiter='\t')
        fieldnames = list(reader.fieldnames)
        for row in reader:
            rows.append(row)

    fetched_count = 0
    for i, row in enumerate(rows):
        summary = row.get('Gemini_Summary', '').strip()
        title = row.get('Title', '')
        isbn = row.get('ISBN13', '')
        
        if not summary:
            print(f"Fetching summary for: {title}")
            new_summary = fetch_summary_from_google(isbn, title)
            if new_summary:
                row['Gemini_Summary'] = new_summary
                fetched_count += 1
            time.sleep(0.5)

    with io.open(output_file, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter='\t', lineterminator='\n')
        writer.writeheader()
        writer.writerows(rows)

    print(f"Done! Fetched {fetched_count} summaries. Saved to a_final_2.txt")

if __name__ == '__main__':
    main()
