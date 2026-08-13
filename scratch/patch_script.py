import os

with open('script_v2.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace showConfirmDetails
old_func = '''function showConfirmDetails(title, author, isbn, publisher, year, officialDescription = "") {
    // 著者名を綺麗に整形する
    const cleanedAuthor = cleanAuthorName(author);
    
    pendingBookData = { title, author: cleanedAuthor, isbn, publisher, year, officialDescription };
    
    document.getElementById('confirmLoading').style.display = 'none';
    document.getElementById('confirmDetails').style.display = 'block';
    
    document.getElementById('confirmTitle').innerText = title;
    document.getElementById('confirmAuthor').innerText = cleanedAuthor || "著者不明";
}'''

new_func = '''function showConfirmDetails(title, author, isbn, publisher, year, officialDescription = "") {
    // 著者名を綺麗に整形する
    const cleanedAuthor = cleanAuthorName(author);
    
    pendingBookData = { title, author: cleanedAuthor, isbn, publisher, year, officialDescription };
    
    document.getElementById('confirmLoading').style.display = 'none';
    document.getElementById('confirmDetails').style.display = 'block';
    
    document.getElementById('confirmTitle').innerText = title;
    document.getElementById('confirmAuthor').innerText = cleanedAuthor || "著者不明";
    document.getElementById('confirmDesc').innerText = officialDescription || "あらすじがありません。";
    document.getElementById('confirmDesc').style.display = officialDescription ? 'block' : 'none';
    
    // 出版社
    document.getElementById('confirmPublisher').value = publisher || "";
    
    // 発行日の処理（不完全な日付の警告）
    const dateInput = document.getElementById('confirmDate');
    const dateWarning = document.getElementById('confirmDateWarning');
    dateInput.value = "";
    dateWarning.style.display = 'none';
    
    if (year) {
        if (year.length >= 8) {
            // 完全な日付（例: 2011-09-01）
            dateInput.value = year;
        } else {
            // 不完全な日付（例: 2011-09, 2011）
            dateInput.value = year.length === 7 ? year + "-01" : year + "-01-01";
            dateWarning.style.display = 'inline';
            dateInput.style.borderColor = '#fbbf24';
        }
    } else {
        dateWarning.style.display = 'inline';
        dateInput.style.borderColor = '#fbbf24';
    }
    
    // 書影の表示
    const coverWrapper = document.getElementById('confirmCover');
    const openbdUrl = `https://cover.openbd.jp/${isbn}.jpg`;
    const ndlUrl = `https://ndlsearch.ndl.go.jp/thumbnail/${isbn}.jpg`;
    const fallbackScript = `this.onerror=null; this.src='${ndlUrl}'; this.onerror=function(){this.style.display='none';}`;
    const imgTag = isbn ? `<img src="${openbdUrl}" alt="書影" style="max-height: 100%; max-width: 100%; object-fit: contain; box-shadow: 0 4px 6px rgba(0,0,0,0.3); border-radius: 4px;" onerror="${fallbackScript}">` : '';
    coverWrapper.innerHTML = imgTag || '<div style="color: #64748b; font-size: 0.9em;">NO IMAGE</div>';
}'''
content = content.replace(old_func, new_func)

# Replace confirmAddBtn listener
old_btn = '''document.getElementById('confirmAddBtn').addEventListener('click', () => {
    if (pendingBookData) {
        const status = document.getElementById('statusSelect').value;
        sendToGas(pendingBookData.title, pendingBookData.author, pendingBookData.isbn, pendingBookData.publisher, pendingBookData.year, status, pendingBookData.officialDescription);
    }
});'''
new_btn = '''document.getElementById('confirmAddBtn').addEventListener('click', () => {
    if (pendingBookData) {
        const status = document.getElementById('statusSelect').value;
        const editedPublisher = document.getElementById('confirmPublisher').value.trim();
        const editedDate = document.getElementById('confirmDate').value;
        sendToGas(pendingBookData.title, pendingBookData.author, pendingBookData.isbn, editedPublisher, editedDate, status, pendingBookData.officialDescription);
    }
});

document.getElementById('searchDateBtn').addEventListener('click', () => {
    if (pendingBookData && pendingBookData.title) {
        const query = pendingBookData.title + " 発売日";
        window.open(`https://www.google.com/search?q=${query}`, '_blank');
    }
});'''
content = content.replace(old_btn, new_btn)

with open('script_v2.js', 'w', encoding='utf-8') as f:
    f.write(content)

