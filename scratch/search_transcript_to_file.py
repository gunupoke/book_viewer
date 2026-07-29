import os
import json

path = r'C:\Users\senji\.gemini\antigravity\brain\c834d4b8-56eb-41ea-87b2-a80db5024466\.system_generated\logs\transcript.jsonl'
out_path = r'C:\Users\senji\.gemini\antigravity\brain\c834d4b8-56eb-41ea-87b2-a80db5024466\scratch\search_results.txt'

with open(out_path, 'w', encoding='utf-8') as out_f:
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            for line in f:
                if 'USER_INPUT' in line:
                    try:
                        data = json.loads(line)
                        content = data.get('content', '')
                        if '6分' in content or 'GAS' in content or '制限' in content or 'API' in content:
                            out_f.write(f"USER: {content.strip()}\n------------------\n")
                    except Exception as e:
                        out_f.write(str(e) + "\n")
