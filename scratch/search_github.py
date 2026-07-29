import json
path = r"C:\Users\senji\.gemini\antigravity\brain\c834d4b8-56eb-41ea-87b2-a80db5024466\.system_generated\logs\transcript_full.jsonl"
try:
    with open(path, 'r', encoding='utf-8') as f:
        for i, line in enumerate(f):
            try:
                data = json.loads(line)
                if data.get('type') in ('USER_INPUT', 'PLANNER_RESPONSE'):
                    content = data.get('content', '')
                    if 'git push' in content or 'Git' in content or 'github' in content.lower():
                        print(f"[{i}] [{data.get('type')}] {content[:500]}...")
            except:
                pass
except Exception as e:
    print(e)
