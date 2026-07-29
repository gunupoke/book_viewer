import os
import json

path = r'C:\Users\senji\.gemini\antigravity\brain\c834d4b8-56eb-41ea-87b2-a80db5024466\.system_generated\logs\transcript.jsonl'
if os.path.exists(path):
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            if 'USER_INPUT' in line:
                try:
                    data = json.loads(line)
                    content = data.get('content', '')
                    if '分' in content or 'エラー' in content or '制限' in content or 'タイムアウト' in content or 'GAS' in content or 'gas' in content.lower():
                        print(f"USER: {content.strip()}")
                except:
                    pass
