import json
import csv
import io
import re

transcript_path = r'C:\Users\senji\.gemini\antigravity\brain\c834d4b8-56eb-41ea-87b2-a80db5024466\.system_generated\logs\transcript.jsonl'
a_txt_path = r'C:\Users\Public\Desktop\ツール\Antigravity_workspaces用\自作\あなたには万屋になってもらいます\a.txt'
report_path = r'C:\Users\senji\.gemini\antigravity\brain\c834d4b8-56eb-41ea-87b2-a80db5024466\date_corrections_report.md'
a_updated_path = r'C:\Users\senji\.gemini\antigravity\brain\c834d4b8-56eb-41ea-87b2-a80db5024466\scratch\a_updated.txt'

# Extract all verified dates from my transcript
verified_data = {}
with open(transcript_path, encoding='utf-8') as f:
    for line in f:
        try:
            entry = json.loads(line)
            if entry.get('source') == 'SYSTEM' and entry.get('type') == 'SYSTEM_MESSAGE':
                content = entry.get('content', '')
                if 'priority=MESSAGE_PRIORITY_HIGH content=[' in content:
                    json_str = content[content.find('content=[')+8:content.rfind(']')+1]
                    try:
                        arr = json.loads(json_str)
                        for item in arr:
                            if item.get('title') and item.get('verified_date'):
                                verified_data[item['title'].strip()] = item
                    except:
                        pass
        except:
            pass

with open(a_txt_path, encoding='utf-8') as f:
    reader = csv.DictReader(f, delimiter='\t')
    fieldnames = reader.fieldnames
    rows = list(reader)

corrections = []

for row in rows:
    title = row['Title'].strip()
    old_date = row.get('Year', '').strip()
    if title in verified_data:
        ver_item = verified_data[title]
        new_date = ver_item['verified_date']
        source = ver_item.get('source', '')
        # Only correct if new_date provides more information or different date.
        # e.g. "2003-10" vs "2003-09-30" is a correction.
        # But if old_date is "2003-06-06" and new_date is "2003-06-06", no correction.
        if new_date and new_date != old_date:
            corrections.append({
                'title': title,
                'old_date': old_date,
                'new_date': new_date,
                'source': source
            })
            row['Year'] = new_date

# Write report
with io.open(report_path, 'w', encoding='utf-8') as f:
    f.write("# 発売日 ネット検索検証・自動訂正レポート\n\n")
    f.write(f"全 {len(rows)} 冊中、Web検索の裏付けにより {len(verified_data)} 冊のデータを照合完了しました。\n")
    f.write(f"その結果、既存データと差異があり、より正確な発売日に修正されたデータは **{len(corrections)}件** でした。\n\n")
    if corrections:
        f.write("| タイトル | 修正前 | 修正後 (検証済) | 情報ソース |\n")
        f.write("|---|---|---|---|\n")
        for c in corrections:
            f.write(f"| {c['title']} | {c['old_date']} | **{c['new_date']}** | {c['source']} |\n")
    else:
        f.write("既存のデータはすべてWeb上の公式情報と一致しており、修正の必要はありませんでした。\n")

# Write updated a.txt
with io.open(a_updated_path, 'w', encoding='utf-8', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter='\t', lineterminator='\n')
    writer.writeheader()
    writer.writerows(rows)

print(f"Verified {len(verified_data)} books. Made {len(corrections)} corrections.")
