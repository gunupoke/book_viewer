import csv
import codecs
import json
import os
import urllib.request
import time

API_KEY = os.environ.get('GEMINI_API_KEY')

def get_gemini_metadata(title, author):
    if not API_KEY:
        return "", "", ""
    
    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key={API_KEY}'
    
    prompt = f"""
以下の本について、「要約（100字程度）」「ジャンル」「おすすめポイント（一言）」を出力してください。
本: {title} (著者: {author})

JSON形式で出力してください。
キーは "summary", "genre", "recommendation" としてください。
"""
    
    data = {
        "contents": [{"parts":[{"text": prompt}]}]
    }
    
    req = urllib.request.Request(url, json.dumps(data).encode(), {'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode())
            text = result['candidates'][0]['content']['parts'][0]['text']
            if text.startswith('```json'):
                text = text[7:-3]
            elif text.startswith('```'):
                text = text[3:-3]
            parsed = json.loads(text)
            return parsed.get("summary", ""), parsed.get("genre", ""), parsed.get("recommendation", "")
    except Exception as e:
        print(f"Error fetching for {title}: {e}")
        return "", "", ""

def main():
    input_file = 'c:/Users/Public/Desktop/ツール/Antigravity_workspaces用/自作/あなたには万屋になってもらいます/booklog20260707020330.csv'
    output_file = 'C:/Users/senji/.gemini/antigravity/brain/c834d4b8-56eb-41ea-87b2-a80db5024466/scratch/enriched_books.csv'
    
    print(f"Reading {input_file}...")
    
    headers = ['Service_ID', 'Item_ID', 'ISBN13', 'Category', 'Rating', 'Status', 'Review', 'Tags', 'Memo', 'Added_Date', 'Read_Date', 'Title', 'Author', 'Publisher', 'Year', 'Type', 'Pages']
    
    try:
        with open(input_file, 'r', encoding='cp932', errors='replace') as f, open(output_file, 'w', encoding='utf-8-sig', newline='') as out:
            reader = csv.reader(f)
            writer = csv.writer(out)
            
            writer.writerow(headers + ['Gemini_Summary', 'Gemini_Genre', 'Gemini_Recommendation'])
            
            count = 0
            for row in reader:
                if len(row) < 13:
                    continue
                title = row[11]
                author = row[12]
                
                # To avoid hitting API limits and save time, let's process slowly
                if API_KEY:
                    print(f"Processing {count+1}: {title}...")
                    summary, genre, rec = get_gemini_metadata(title, author)
                    time.sleep(5) # avoid rate limit (15 requests per minute for free tier)ing
                else:
                    summary, genre, rec = "", "", ""
                
                writer.writerow(row + [summary, genre, rec])
                count += 1
                
        print(f"Successfully processed {count} books. Saved to {output_file}")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == '__main__':
    main()
