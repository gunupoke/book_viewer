import os
import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('<body>', '<body>\n    <div style="background: #ef4444; color: white; padding: 15px; text-align: center; font-weight: bold; cursor: pointer; position: sticky; top: 0; z-index: 9999;" id="testTriggerBtn">\n        🚨 【テスト用】ここをタップするとスキャン結果画面（日付不完全パターン）が開きます 🚨\n    </div>')

content = re.sub(r'script_v2\.js\?v=\d+', 'test_script.js', content)

with open('test_ui.html', 'w', encoding='utf-8') as f:
    f.write(content)
