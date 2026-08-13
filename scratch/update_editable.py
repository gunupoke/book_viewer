import re

# UPDATE INDEX.HTML
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

old_title_author = '''<h3 id="confirmTitle" style="font-size: 1.2em; margin-bottom: 10px; line-height: 1.4;"></h3>
                    <p id="confirmAuthor" style="color: #94a3b8; margin-bottom: 15px;"></p>'''

new_title_author = '''<div style="margin-bottom: 10px;">
                        <label style="display: block; color: #94a3b8; font-size: 0.85em; margin-bottom: 5px;">タイトル</label>
                        <input type="text" id="confirmTitle" style="width: 100%; padding: 8px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 4px; font-size: 1.1em; font-weight: bold;">
                    </div>
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; color: #94a3b8; font-size: 0.85em; margin-bottom: 5px;">著者名</label>
                        <input type="text" id="confirmAuthor" style="width: 100%; padding: 8px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 4px; font-size: 0.95em;">
                    </div>'''
html = html.replace(old_title_author, new_title_author)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

# UPDATE SCRIPT_V2.JS
with open('script_v2.js', 'r', encoding='utf-8') as f:
    script = f.read()

old_script_set = '''    document.getElementById('confirmTitle').innerText = title;
    document.getElementById('confirmAuthor').innerText = cleanedAuthor || "著者不明";'''
new_script_set = '''    document.getElementById('confirmTitle').value = title || "";
    document.getElementById('confirmAuthor').value = cleanedAuthor || "";'''
script = script.replace(old_script_set, new_script_set)

old_btn_listener = '''        const status = document.getElementById('statusSelect').value;
        const editedPublisher = document.getElementById('confirmPublisher').value.trim();
        const editedDate = document.getElementById('confirmDate').value;
        sendToGas(pendingBookData.title, pendingBookData.author, pendingBookData.isbn, editedPublisher, editedDate, status, pendingBookData.officialDescription);'''
new_btn_listener = '''        const status = document.getElementById('statusSelect').value;
        const editedTitle = document.getElementById('confirmTitle').value.trim();
        const editedAuthor = document.getElementById('confirmAuthor').value.trim();
        const editedPublisher = document.getElementById('confirmPublisher').value.trim();
        const editedDate = document.getElementById('confirmDate').value;
        sendToGas(editedTitle, editedAuthor, pendingBookData.isbn, editedPublisher, editedDate, status, pendingBookData.officialDescription);'''
script = script.replace(old_btn_listener, new_btn_listener)

# Fix search query to use edited title
old_search_listener = '''document.getElementById('searchDateBtn').addEventListener('click', () => {
    if (pendingBookData && pendingBookData.title) {
        const query = pendingBookData.title + " 発売日";
        window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
    }
});'''
new_search_listener = '''document.getElementById('searchDateBtn').addEventListener('click', () => {
    const currentTitle = document.getElementById('confirmTitle').value.trim() || pendingBookData.title;
    if (currentTitle) {
        const query = currentTitle + " 発売日";
        window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
    }
});'''
script = script.replace(old_search_listener, new_search_listener)

with open('script_v2.js', 'w', encoding='utf-8') as f:
    f.write(script)
