import json
import datetime

path = r'C:\Users\senji\.gemini\antigravity\brain\c834d4b8-56eb-41ea-87b2-a80db5024466\.system_generated\logs\transcript.jsonl'
with open(path, 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        try:
            data = json.loads(line)
            if data.get('type') in ('USER_INPUT', 'PLANNER_RESPONSE'):
                content = data.get('content', '')
                if 'イリヤの空' in content or '発行日' in content or '工夫' in content:
                    print(f"[{i}] [{data.get('type')}] {content[:500]}...")
        except Exception as e:
            pass
