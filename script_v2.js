let allBooks = [];

document.addEventListener('DOMContentLoaded', () => {
    // 既存の設定を読み込む
    const savedUrl = localStorage.getItem('sheetCsvUrl');
    if (savedUrl) {
        document.getElementById('sheetUrlInput').value = savedUrl;
        fetchDataFromUrl(savedUrl);
    }
    const savedGasUrl = localStorage.getItem('gasWebAppUrl');
    if (savedGasUrl) {
        document.getElementById('gasAppUrlInput').value = savedGasUrl;
    }
    const savedEditUrl = localStorage.getItem('sheetEditUrl');
    if (savedEditUrl) {
        document.getElementById('sheetEditUrlInput').value = savedEditUrl;
    }

    // Event Listeners
    document.getElementById('csvFileInput').addEventListener('change', handleFileSelect);
    document.getElementById('searchInput').addEventListener('input', handleSearch);
    
    // Settings Modal logic
    const settingsModal = document.getElementById('settingsModal');
    document.getElementById('settingsBtn').addEventListener('click', () => settingsModal.classList.add('show'));
    document.getElementById('closeSettings').addEventListener('click', () => settingsModal.classList.remove('show'));
    
    document.getElementById('saveSettingsBtn').addEventListener('click', () => {
        const url = document.getElementById('sheetUrlInput').value.trim();
        const gasUrl = document.getElementById('gasAppUrlInput').value.trim();
        const editUrl = document.getElementById('sheetEditUrlInput').value.trim();
        
        if (url) {
            localStorage.setItem('sheetCsvUrl', url);
            fetchDataFromUrl(url);
        }
        if (gasUrl) {
            localStorage.setItem('gasWebAppUrl', gasUrl);
        }
        if (editUrl) {
            localStorage.setItem('sheetEditUrl', editUrl);
            document.getElementById('openSheetBtn').style.display = 'inline-block';
        }
        settingsModal.classList.remove('show');
    });

    // Scanner Modal logic
    const scannerModal = document.getElementById('scannerModal');
    document.getElementById('scanBtn').addEventListener('click', () => {
        document.getElementById('step1Scanning').style.display = 'block';
        document.getElementById('step2Confirm').style.display = 'none';
        document.getElementById('scanResult').innerText = "";
        document.getElementById('manualIsbnInput').value = "";
        scannerModal.classList.add('show');
        startScanner();
    });
    document.getElementById('closeScanner').addEventListener('click', () => {
        scannerModal.classList.remove('show');
        stopScanner();
    });

    // モーダル外クリックで閉じる
    window.addEventListener('click', (e) => {
        if (e.target === settingsModal) settingsModal.classList.remove('show');
        if (e.target === scannerModal) {
            scannerModal.classList.remove('show');
            stopScanner();
        }
    });
});

// --- Native Barcode Scanner Logic ---
let videoStream = null;
let scanInterval = null;
let isScanning = false;

async function startScanner() {
    document.getElementById('scanResult').innerText = "カメラを起動中...";
    const video = document.getElementById('nativeVideo');
    
    // ネイティブのBarcodeDetectorがサポートされているかチェック（Android Chromeは対応）
    if (!('BarcodeDetector' in window)) {
        document.getElementById('scanResult').innerText = "エラー: お使いのブラウザはネイティブ高速スキャン(BarcodeDetector)に未対応です。";
        return;
    }

    try {
        videoStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" }
        });
        video.srcObject = videoStream;
        await video.play();
        
        isScanning = true;
        document.getElementById('scanResult').innerText = "上段のバーコード(978...)を枠内に映してください";
        
        // EAN_13のみを検知するネイティブディテクター（AIチップ直結の爆速処理）
        const detector = new BarcodeDetector({ formats: ['ean_13'] });
        
        let isProcessingFrame = false;
        // 毎秒30回（約33ms間隔）でハードウェア解析を実行
        scanInterval = setInterval(async () => {
            if (!isScanning || isProcessingFrame) return;
            isProcessingFrame = true;
            try {
                const barcodes = await detector.detect(video);
                if (barcodes.length > 0) {
                    for (let barcode of barcodes) {
                        if (barcode.rawValue.startsWith("978")) {
                            onScanSuccess(barcode.rawValue);
                            break;
                        }
                    }
                }
            } catch (e) {
                // Ignore frame errors
            } finally {
                isProcessingFrame = false;
            }
        }, 33);
        
    } catch (err) {
        document.getElementById('scanResult').innerText = "カメラの起動に失敗しました: " + err;
    }
}

function stopScanner() {
    isScanning = false;
    if (scanInterval) {
        clearInterval(scanInterval);
        scanInterval = null;
    }
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
}

let pendingBookData = null;

function onScanSuccess(decodedText, decodedResult) {
    // ISBNは必ず978から始まる、雑誌のJANコードは491から始まる
    if (decodedText.startsWith("978") || decodedText.startsWith("491")) {
        stopScanner();
        
        // 画面をステップ２（確認画面）に切替
        document.getElementById('step1Scanning').style.display = 'none';
        document.getElementById('step2Confirm').style.display = 'block';
        document.getElementById('confirmLoading').style.display = 'block';
        document.getElementById('confirmDetails').style.display = 'none';
        document.getElementById('scanResult').innerText = "";
        
        let isMagazine = decodedText.startsWith("491");
        
        async function fetchBookData() {
            let title = "", author = "", publisher = "", year = "", officialDescription = "";
            try {
                if (!isMagazine) {
                    const obdRes = await fetch(`https://api.openbd.jp/v1/get?isbn=${decodedText}`);
                    const obdData = await obdRes.json();
                    if (obdData && obdData.length > 0 && obdData[0]) {
                        if (obdData[0].summary) {
                            title = obdData[0].summary.title;
                            author = obdData[0].summary.author;
                            publisher = obdData[0].summary.publisher || "";
                            year = normalizeDate(obdData[0].summary.pubdate || "");
                        }
                        try {
                            const onix = obdData[0].onix;
                            if (onix && onix.CollateralDetail && onix.CollateralDetail.TextContent) {
                                const texts = onix.CollateralDetail.TextContent;
                                const desc = texts.find(t => t.TextType === "03" || t.TextType === "02");
                                if (desc) officialDescription = desc.Text;
                            }
                        } catch(e) {}
                    }
                }
                
                // NDL SRU API Fallback
                if (!title) {
                    const ndlQuery = isMagazine ? `any=${decodedText}` : `isbn=${decodedText}`;
                    const ndlRes = await fetch(`https://ndlsearch.ndl.go.jp/api/sru?operation=searchRetrieve&recordPacking=xml&query=${ndlQuery}`);
                    const xmlStr = await ndlRes.text();
                    
                    const titleMatch = xmlStr.match(/<dc:title>([\s\S]*?)<\/dc:title>/);
                    if (titleMatch) {
                        const creatorMatch = xmlStr.match(/<dc:creator>([\s\S]*?)<\/dc:creator>/);
                        const pubMatch = xmlStr.match(/<dc:publisher>([\s\S]*?)<\/dc:publisher>/);
                        const dateMatch = xmlStr.match(/<dc:date>([\s\S]*?)<\/dc:date>/);
                        
                        const decodeHtml = (html) => {
                            const txt = document.createElement("textarea");
                            txt.innerHTML = html;
                            return txt.value;
                        };
                        
                        title = decodeHtml(titleMatch[1]);
                        author = creatorMatch ? decodeHtml(creatorMatch[1]) : "";
                        publisher = pubMatch ? decodeHtml(pubMatch[1]) : "";
                        year = dateMatch ? normalizeDate(dateMatch[1]) : "";
                    }
                }
                
                // Google Books API Fallback
                if (!title && !isMagazine) {
                    const gbRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${decodedText}`);
                    if (gbRes.ok) {
                        const gbData = await gbRes.json();
                        if (gbData.items && gbData.items.length > 0) {
                            const info = gbData.items[0].volumeInfo;
                            title = info.title || "";
                            author = info.authors ? info.authors.join(", ") : "";
                            publisher = info.publisher || "";
                            year = normalizeDate(info.publishedDate || "");
                            officialDescription = info.description || "";
                        }
                    }
                }

                if (title) {
                    showConfirmDetails(title, author, decodedText, publisher, year, officialDescription);
                } else {
                    document.getElementById('confirmLoading').style.display = 'none';
                    document.getElementById('scanResult').innerText = "エラー: 本の情報が見つかりませんでした (コード: " + decodedText + ")";
                }
            } catch (err) {
                document.getElementById('confirmLoading').style.display = 'none';
                document.getElementById('scanResult').innerText = "API通信エラー: " + err;
            }
        }
        
        fetchBookData();
    }
}

function cleanAuthorName(authorStr) {
    if (!authorStr) return "";
    
    // 1. 役割や生没年を削除
    authorStr = authorStr.replace(/[\/／\s\[\(]*?(著|編|訳|原作|作画|原案)[\]\)]?/g, '');
    authorStr = authorStr.replace(/,?\s*\d{4}-?\s*/g, ' '); // remove years
    
    // 2. スラッシュ・中黒の周りのスペースを削除
    authorStr = authorStr.replace(/\s*([\/／・])\s*/g, "$1");
    
    // 3. 英語同士のスペースを保護 (FGO PROJECT 等)
    authorStr = authorStr.replace(/([A-Za-z0-9\.\-])\s+([A-Za-z0-9\.\-])/g, "$1__SPACE__$2");
    
    // 4. First Pass Last, First Merger (NDL対策)
    const replacer = (match, p1, p2, p3, p4) => {
        let last = p2;
        let first = p3;
        let kanjiMatch = last.match(/[\u4E00-\u9FFF]/g);
        let kanjiCount = kanjiMatch ? kanjiMatch.length : 0;
        if (kanjiCount <= 2 && last.length <= 4) {
            return p1 + last + first;
        }
        return match;
    };
    
    // 先読みアサーション (?=$|[\s\/／・,]) を使用して、再帰的結合を防止
    let regex = /(^|[\s\/／・])([\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FFA-Za-z]{1,4})\s*,\s*([\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FFA-Za-z]{1,4}[^\s,]*)(?=$|[\s\/／・,])/g;
    authorStr = authorStr.replace(regex, replacer);
    
    // 5. 残ったスペースと読点をカンマに変換（複数著者の区切り）
    authorStr = authorStr.replace(/[\s、，]+/g, ', ');
    
    // 6. 保護した英語スペースを戻す
    authorStr = authorStr.replace(/__SPACE__/g, ' ');
    
    // 重複カンマを整理
    authorStr = authorStr.replace(/(,\s*)+/g, ', ');
    
    // 7. Second Pass Last, First Merger (スペースがカンマに変わった後に再結合)
    authorStr = authorStr.replace(regex, replacer);
    
    // 8. 中黒・スラッシュの処理 (カタカナ・英語なら結合、漢字なら分離)
    let tokens = authorStr.split(/([,・\/／])/);
    let authors = [];
    let curr = "";
    
    for (let i = 0; i < tokens.length; i++) {
        let token = tokens[i].trim();
        if (!token) continue;
        
        if (token === ',') {
            if (curr) { authors.push(curr); curr = ""; }
        } else if (token === '・' || token === '/' || token === '／') {
            if (/[A-Za-z\u30A0-\u30FF]/.test(curr) || (i + 1 < tokens.length && /[A-Za-z\u30A0-\u30FF]/.test(tokens[i+1]))) {
                curr += token;
            } else {
                if (curr) { authors.push(curr); curr = ""; }
            }
        } else {
            curr += token;
        }
    }
    if (curr) authors.push(curr);
    
    return authors.map(a => a.trim()).filter(a => a).join(', ');
}

function normalizeDate(dateStr) {
    if (!dateStr) return "";
    let s = dateStr.replace(/[^\d\-]/g, '');
    if (/^\d{8}$/.test(s)) {
        return `${s.substring(0,4)}-${s.substring(4,6)}-${s.substring(6,8)}`;
    }
    if (/^\d{6}$/.test(s)) {
        return `${s.substring(0,4)}-${s.substring(4,6)}`;
    }
    return s;
}

function getAmazonCoverUrl(isbn13) {
    if (!isbn13) return '';
    let asin = isbn13;
    if (isbn13.startsWith('978') && isbn13.length === 13) {
        const base = isbn13.substring(3, 12);
        let sum = 0;
        for (let i = 0; i < 9; i++) {
            sum += parseInt(base[i]) * (10 - i);
        }
        const check = 11 - (sum % 11);
        const checkDigit = check === 10 ? 'X' : (check === 11 ? '0' : check.toString());
        asin = base + checkDigit;
    }
    return `https://images-na.ssl-images-amazon.com/images/P/${asin}.09.LZZZZZZZ.jpg`;
}

function showConfirmDetails(title, author, isbn, publisher, year, officialDescription = "") {
    // 著者名を綺麗に整形する
    const cleanedAuthor = cleanAuthorName(author);
    
    pendingBookData = { title, author: cleanedAuthor, isbn, publisher, year, officialDescription };
    
    document.getElementById('confirmLoading').style.display = 'none';
    document.getElementById('confirmDetails').style.display = 'block';
    
    document.getElementById('confirmTitle').innerText = title;
    document.getElementById('confirmAuthor').innerText = cleanedAuthor || "著者不明";
}

function sendToGas(title, author, isbn, publisher, year, status, officialDescription = "") {
    // UIを隠して送信中メッセージを表示
    document.getElementById('confirmDetails').style.display = 'none';
    document.getElementById('scanResult').innerText = `【${title}】\nスプレッドシートへ送信中...`;
    
    // GAS Web Appに送信
    const gasUrl = localStorage.getItem('gasWebAppUrl');
    if(!gasUrl) {
        document.getElementById('scanResult').innerText = 'エラー: 設定画面から「GAS WebアプリのURL」を保存してください！';
        return;
    }
    
    // スマホブラウザのセキュリティ（ITPやCORSブロック）を完全に回避するため、
    // fetchではなく見えないフォーム（iframe）を使ってPOST送信する
    if (!document.getElementById('hidden_iframe')) {
        const iframe = document.createElement('iframe');
        iframe.name = 'hidden_iframe';
        iframe.id = 'hidden_iframe';
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
    }
    
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = gasUrl;
    form.target = 'hidden_iframe';
    
    const fields = { title, author, isbn, status, publisher, year, description: officialDescription };
    for (let key in fields) {
        if (fields[key]) {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = fields[key];
            form.appendChild(input);
        }
    }
    
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
    
    // 送信は一瞬で終わるので完了メッセージを表示
    document.getElementById('scanResult').innerText = `追加完了: ${title}\n\n※Geminiが要約を生成して追記しました。\n(画面を更新します)`;
    
    // Googleスプレッドシートの「ウェブに公開(CSV)」は、Google側のサーバー仕様で
    // 反映までに最大5分ほどのタイムラグが発生します。
    // その遅延をごまかすため、画面上（メモリ上）だけ先に本を追加して表示します。
    const newBook = {
        Title: title,
        Author: author,
        Status: status,
        Gemini_Summary: "（AIが要約を作成中です。数分後にリロードすると表示されます）",
        Tags: ""
    };
    
    setTimeout(() => {
        document.getElementById('scannerModal').classList.remove('show');
        document.getElementById('scanResult').innerText = "";
        
        // メモリ上の配列の先頭（新着順）に追加して再描画
        allBooks.unshift(newBook);
        renderBooks(allBooks);
        
        // 裏で一応CSVの再取得もリクエストしておく
        const sheetUrl = localStorage.getItem('sheetCsvUrl');
        if (sheetUrl) fetchDataFromUrl(sheetUrl);
    }, 3000);
}

function onScanFailure(error) {
    // ignore
}

// ボタンアクション
document.getElementById('confirmAddBtn').addEventListener('click', () => {
    if (pendingBookData) {
        const status = document.getElementById('statusSelect').value;
        sendToGas(pendingBookData.title, pendingBookData.author, pendingBookData.isbn, pendingBookData.publisher, pendingBookData.year, status, pendingBookData.officialDescription);
    }
});

document.getElementById('cancelAddBtn').addEventListener('click', () => {
    document.getElementById('step2Confirm').style.display = 'none';
    document.getElementById('step1Scanning').style.display = 'block';
    startScanner();
});

// 手動入力用
document.getElementById('manualIsbnBtn').addEventListener('click', () => {
    const input = document.getElementById('manualIsbnInput').value.trim();
    if (input.length >= 10) {
        onScanSuccess(input, null);
    } else {
        alert("正しいISBNを入力してください");
    }
});
// -----------------------------

function handleFileSelect(evt) {
    const file = evt.target.files[0];
    if (!file) return;

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            // 新着順（下に追加されたもの）を一番上にするために配列を反転
            allBooks = results.data.reverse();
            renderBooks(allBooks);
        }
    });
}

function fetchDataFromUrl(url) {
    document.getElementById('bookGrid').innerHTML = '<div class="empty-state"><p>データを読み込み中...</p></div>';
    
    if (url.includes('/edit')) {
        document.getElementById('bookGrid').innerHTML = '<div class="empty-state" style="color: #fca5a5;"><p>⚠️ エラー: URLが間違っています</p><p class="sub-text">ブラウザの上のURL（/edit...）ではなく、「ファイル」＞「共有」＞「ウェブに公開」で発行された <strong>/pub?output=csv</strong> で終わるURLを入力してください。</p></div>';
        return;
    }

    if (url.includes('/pubhtml')) {
        url = url.replace('/pubhtml', '/pub');
        if (!url.includes('output=csv')) {
            url += url.includes('?') ? '&output=csv' : '?output=csv';
        }
    }
    
    // キャッシュ回避のためのパラメータを追加
    const fetchUrl = url + (url.includes('?') ? '&' : '?') + 't=' + new Date().getTime();

    fetch(fetchUrl, { cache: 'no-store' })
        .then(response => {
            if (!response.ok) throw new Error(`HTTPエラー ${response.status}`);
            return response.text();
        })
        .then(csvText => {
            if (csvText.trim().startsWith('<!DOCTYPE') || csvText.trim().startsWith('<html')) {
                throw new Error('CSVではなくウェブページが返されました。「ウェブページ」ではなく「CSV」形式で公開されているか確認してください。');
            }
            
            Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                complete: function(results) {
                    // 全データに対して最新の自動整形（著者名・日付など）を適用
                    results.data.forEach(book => {
                        if (book.Author) book.Author = cleanAuthorName(book.Author);
                        if (book.Title) book.Title = book.Title.trim();
                        if (book.Year) book.Year = normalizeDate(book.Year);
                    });

                    // 新着順にするために配列を反転
                    allBooks = results.data.reverse();
                    renderBooks(allBooks);
                },
                error: function(err) {
                    throw new Error('CSVの解析に失敗しました: ' + err.message);
                }
            });
        })
        .catch(err => {
            let errorMsg = err.message;
            if (errorMsg === 'Failed to fetch' || errorMsg.includes('NetworkError')) {
                errorMsg = 'ネットワークエラーが発生しました。URLが正しいか、セキュリティでブロックされていないか確認してください。';
            }
            document.getElementById('bookGrid').innerHTML = `<div class="empty-state" style="color: #fca5a5;"><p>⚠️ エラーが発生しました: ${errorMsg}</p></div>`;
        });
}

function handleSearch(evt) {
    const term = evt.target.value.toLowerCase();
    const filtered = allBooks.filter(book => {
        const title = (book.Title || "").toLowerCase();
        const author = (book.Author || "").toLowerCase();
        const tags = (book.Tags || "").toLowerCase();
        return title.includes(term) || author.includes(term) || tags.includes(term);
    });
    renderBooks(filtered);
}

function renderBooks(books) {
    const grid = document.getElementById('bookGrid');
    grid.innerHTML = '';

    if (books.length === 0) {
        grid.innerHTML = '<div class="empty-state"><p>本が見つかりません</p></div>';
        return;
    }

    books.forEach(book => {
        if (!book.Title) return;

        const card = document.createElement('div');
        card.className = 'book-card';

        let tagsHtml = '';
        if (book.Status) {
            let displayStatus = book.Status;
            if (displayStatus === '読書中') displayStatus = 'いま読んでる';
            
            let bg = 'rgba(56, 189, 248, 0.2)';
            let color = '#7dd3fc';
            if (displayStatus === '読み終わった') { bg = 'rgba(52, 211, 153, 0.2)'; color = '#6ee7b7'; }      // 緑系
            else if (displayStatus === 'いま読んでる') { bg = 'rgba(56, 189, 248, 0.2)'; color = '#7dd3fc'; } // 青系
            else if (displayStatus === '積読') { bg = 'rgba(251, 191, 36, 0.2)'; color = '#fcd34d'; }        // 黄系
            else if (displayStatus === '読みたい') { bg = 'rgba(192, 132, 252, 0.2)'; color = '#d8b4fe'; }    // 紫系
            else if (displayStatus === '手放した') { bg = 'rgba(156, 163, 175, 0.2)'; color = '#d1d5db'; }    // 灰系
            
            tagsHtml += `<span class="tag" style="background: ${bg}; color: ${color};">${displayStatus}</span>`;
        }

        const summary = book.Gemini_Summary || "（要約未生成）";
        const rec = '';
        
        // 書影のURL。精度の高いAmazon(ASIN)をメインにし、失敗したらOpenBDにフォールバック
        const amazonUrl = getAmazonCoverUrl(book.ISBN13);
        const openbdUrl = `https://cover.openbd.jp/${book.ISBN13}.jpg`;
        
        // どちらも失敗した場合は非表示にする
        const fallbackScript = `this.onerror=null; this.src='${openbdUrl}'; this.onerror=function(){this.style.display='none';}`;
        const onloadScript = `if(this.naturalWidth <= 1) { this.onload=null; this.src='${openbdUrl}'; }`;
        const coverUrl = book.ISBN13 ? amazonUrl : 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        // 背景色を透明にすることで、Amazonの1x1透明GIFが返ってきた場合でも下のテキストが見えるようにする
        const imgTag = book.ISBN13 ? `<img src="${amazonUrl}" alt="書影" style="width: 100%; height: 100%; object-fit: cover; box-shadow: 0 4px 6px rgba(0,0,0,0.3); position: relative; z-index: 1; background: transparent;" onload="${onloadScript}" onerror="${fallbackScript}">` : '';

        // 書影を表示するためのフレックスレイアウトを追加
        card.style.display = 'flex';
        card.style.gap = '15px';
        
        card.innerHTML = `
            <div style="flex-shrink: 0; width: 80px; position: relative; background: #1e293b; border-radius: 4px; overflow: hidden; display: flex; align-items: center; justify-content: center; min-height: 115px;" class="cover-wrapper">
                <span style="position: absolute; font-size: 0.65em; color: #cbd5e1; text-align: center; padding: 4px; line-height: 1.3; word-break: break-all; z-index: 0;">${escapeHtml(book.Title)}</span>
                ${imgTag}
            </div>
            <div style="flex-grow: 1; min-width: 0;" class="book-details">
                <div class="book-title">${escapeHtml(book.Title)}</div>
                <div class="book-author">${escapeHtml(book.Author || '著者不明')}</div>
                <div class="book-tags">${tagsHtml}</div>
            </div>
        `;
        
        // カードクリックで詳細モーダルを開く
        card.addEventListener('click', () => {
            openDetailModal(book, coverUrl, summary, rec);
        });

        grid.appendChild(card);
    });
}

function escapeHtml(unsafe) {
    return (unsafe || "")
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

// ソート機能のロジック
document.getElementById('sortSelect').addEventListener('change', (e) => {
    const sortType = e.target.value;
    let sortedBooks = [...allBooks]; // コピーを作成してソート

    if (sortType === 'newest') {
        // 何もしない（allBooksは元々新着順）
    } else if (sortType === 'oldest') {
        sortedBooks.reverse();
    } else if (sortType === 'release_newest') {
        sortedBooks.sort((a, b) => (b.Year || "").localeCompare(a.Year || ""));
    } else if (sortType === 'release_oldest') {
        sortedBooks.sort((a, b) => (a.Year || "").localeCompare(b.Year || ""));
    } else if (sortType === 'title') {
        sortedBooks.sort((a, b) => (a.Title || "").localeCompare(b.Title || "", 'ja'));
    } else if (sortType === 'author') {
        sortedBooks.sort((a, b) => (a.Author || "").localeCompare(b.Author || "", 'ja'));
    }

    renderBooks(sortedBooks);
});

// CSVエクスポート機能
document.getElementById('exportCsvBtn').addEventListener('click', () => {
    if (allBooks.length === 0) return alert('エクスポートするデータがありません。');
    
    // 元の並び順（シートと同じ古い順）に戻してエクスポート
    const exportData = [...allBooks].reverse();
    const csv = Papa.unparse(exportData);
    // BOM付きのCSVファイルを作成（Excelでの文字化け防止）
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `万屋の書庫_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
});

// シートを開く機能
document.getElementById('openSheetBtn').addEventListener('click', () => {
    const editUrl = localStorage.getItem('sheetEditUrl');
    if (editUrl) {
        window.open(editUrl, '_blank');
    } else {
        alert("設定画面から「③ スプレッドシート編集用URL」を登録してください。");
    }
});

// 初期化時にシートURLがあれば「シートを開く」ボタンを表示
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('sheetEditUrl')) {
        document.getElementById('openSheetBtn').style.display = 'inline-block';
    }
});

// ==========================================
// リスト・グリッド表示切り替え
// ==========================================
document.getElementById('viewListBtn').addEventListener('click', (e) => {
    e.target.classList.add('active');
    document.getElementById('viewGridBtn').classList.remove('active');
    document.getElementById('bookGrid').classList.remove('grid-view');
});
document.getElementById('viewGridBtn').addEventListener('click', (e) => {
    e.target.classList.add('active');
    document.getElementById('viewListBtn').classList.remove('active');
    document.getElementById('bookGrid').classList.add('grid-view');
});

// ==========================================
// 詳細モーダルとステータス更新
// ==========================================
let currentDetailBook = null;
const detailModal = document.getElementById('detailModal');
document.getElementById('closeDetail').addEventListener('click', () => detailModal.classList.remove('show'));

function openDetailModal(book, coverUrl, summary, rec) {
    currentDetailBook = book;
    const detailCover = document.getElementById('detailCover');
    detailCover.src = coverUrl;
    detailCover.style.display = 'block';
    if (book.ISBN13) {
        detailCover.onerror = function() {
            this.onerror = null;
            this.src = `https://ndlsearch.ndl.go.jp/thumbnail/${book.ISBN13}.jpg`;
            this.onerror = function() { this.style.display = 'none'; };
        };
    } else {
        detailCover.onerror = function() { this.style.display = 'none'; };
    }
    
    document.getElementById('detailTitle').innerText = book.Title || 'タイトル不明';
    document.getElementById('detailAuthor').innerText = book.Author || '著者不明';
    
    let pubInfo = [];
    if (book.Publisher) pubInfo.push(book.Publisher);
    if (book.Year) pubInfo.push(`${book.Year}年`);
    document.getElementById('detailPublisher').innerText = pubInfo.join(' / ');
    
    document.getElementById('detailType').innerText = book.Type ? `[${book.Type}]` : '';
    let currentStatus = book.Status || '積読';
    if (currentStatus === '読書中') currentStatus = 'いま読んでる';
    document.getElementById('detailStatus').value = currentStatus;
    
    document.getElementById('detailSummary').innerText = summary;
    
    detailModal.classList.add('show');
}

document.getElementById('detailStatus').addEventListener('change', async (e) => {
    const newStatus = e.target.value;
    if (!currentDetailBook) return;
    
    const gasUrl = localStorage.getItem('gasWebAppUrl');
    if (!gasUrl) {
        alert("ステータスを更新するには、設定から「② データ書き込み用URL」を登録してください。");
        e.target.value = currentDetailBook.Status;
        return;
    }
    
    const originalStatus = currentDetailBook.Status;
    currentDetailBook.Status = newStatus;
    
    // UI上ですぐに変更を反映（ローカルキャッシュの更新）
    renderBooks(allBooks);
    
    // GASへ送信
    const formData = new FormData();
    formData.append('action', 'updateStatus');
    formData.append('isbn', currentDetailBook.ISBN13 || '');
    formData.append('title', currentDetailBook.Title || '');
    formData.append('status', newStatus);
    
    try {
        const response = await fetch(gasUrl, {
            method: 'POST',
            body: formData,
            mode: 'no-cors' // Google Apps Scriptの仕様上 no-cors
        });
        console.log("Status update request sent.");
    } catch (err) {
        console.error(err);
        alert('ステータスの更新通信に失敗しました。');
        currentDetailBook.Status = originalStatus;
        renderBooks(allBooks);
    }
});
