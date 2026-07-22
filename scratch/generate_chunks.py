import csv
import json
import io

def main():
    file_path = r'C:\Users\Public\Desktop\ツール\Antigravity_workspaces用\自作\あなたには万屋になってもらいます\a.txt'
    with open(file_path, encoding='utf-8') as f:
        reader = csv.DictReader(f, delimiter='\t')
        data = list(reader)
    
    # Filter out empty rows if any
    books = [row for row in data if row['Title'].strip()]
    
    chunk_size = 5
    chunks = [books[i:i + chunk_size] for i in range(0, len(books), chunk_size)]
    
    subagents = []
    for i, chunk in enumerate(chunks):
        prompt_lines = ["Please find the official release date for the following books:\n"]
        for book in chunk:
            prompt_lines.append(f"- Title: {book['Title']}")
            if book.get('Author'):
                prompt_lines.append(f"  Author: {book['Author']}")
            if book.get('Publisher'):
                prompt_lines.append(f"  Publisher: {book['Publisher']}")
        
        prompt = "\n".join(prompt_lines)
        
        subagents.append({
            "TypeName": "DateVerifier",
            "Role": f"Date Verifier Chunk {i+1}",
            "Prompt": prompt
        })
    
    with io.open(r'C:\Users\senji\.gemini\antigravity\brain\c834d4b8-56eb-41ea-87b2-a80db5024466\scratch\chunks.json', 'w', encoding='utf-8') as f:
        json.dump(subagents, f, ensure_ascii=False, indent=2)

if __name__ == '__main__':
    main()
