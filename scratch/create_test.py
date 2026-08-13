import os
import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('<body>', '<body>\n    <div style="background: #ef4444; color: white; padding: 15px; text-align: center; font-weight: bold; cursor: pointer; position: sticky; top: 0; z-index: 9999;" id="testTriggerBtn">\n        🚨 【テスト用】ここをタップするとスキャン結果画面（日付不完全パターン）が開きます 🚨\n    </div>')
content = re.sub(r'script_v2\.js\?v=\d+', 'test_script.js', content)

with open('test_ui.html', 'w', encoding='utf-8') as f:
    f.write(content)

with open('script_v2.js', 'r', encoding='utf-8') as f:
    script_content = f.read()

script_content += '''
document.getElementById('testTriggerBtn').addEventListener('click', () => {
    document.getElementById('scannerModal').classList.add('show');
    document.getElementById('step1Scanning').style.display = 'none';
    document.getElementById('step2Confirm').style.display = 'block';
    showConfirmDetails('映像の原則', '富野由悠季', '9784873767369', 'キネマ旬報社', '2011-09', '映像の原則についての詳細な解説...');
});
'''

with open('test_script.js', 'w', encoding='utf-8') as f:
    f.write(script_content)
