import re

# Update index.html
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Remove confirmDesc element completely
html = re.sub(r'<p id="confirmDesc".*?</p>', '', html)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

# Update script_v2.js
with open('script_v2.js', 'r', encoding='utf-8') as f:
    script = f.read()

script = script.replace('''    document.getElementById('confirmDesc').innerText = officialDescription || "あらすじがありません。";
    document.getElementById('confirmDesc').style.display = officialDescription ? 'block' : 'none';''', '')

with open('script_v2.js', 'w', encoding='utf-8') as f:
    f.write(script)
