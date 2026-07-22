import re
import csv
import json
import urllib.request
import xml.etree.ElementTree as ET

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
                    pass # Delete and combine
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

input_file = r'C:\Users\senji\Desktop\ツール\Antigravity_workspaces用\自作\あなたには万屋になってもらいます\a.txt'
output_file = r'C:\Users\senji\Desktop\ツール\Antigravity_workspaces用\自作\あなたには万屋になってもらいます\a_cleaned.txt'

with open(input_file, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f, delimiter='\t')
    fieldnames = reader.fieldnames
    rows = list(reader)

for row in rows:
    # Fix Author
    if row.get('Author'):
        row['Author'] = clean_author_name(row['Author'])
    
    # Optional: could also fix bad dates or titles, but user mostly mentioned names.

with open(output_file, 'w', encoding='utf-8', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter='\t')
    writer.writeheader()
    writer.writerows(rows)

print("Done cleaning authors! Wrote to a_cleaned.txt")
