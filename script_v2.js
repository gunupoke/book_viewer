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
    // ISBNは必ず978から始まる（下段の192から始まるバーコードは無視する）
    if (decodedText.startsWith("978")) {
        stopScanner();
        
        // 画面をステップ2（確認画面）に切り替え
        document.getElementById('step1Scanning').style.display = 'none';
        document.getElementById('step2Confirm').style.display = 'block';
        document.getElementById('confirmLoading').style.display = 'block';
        document.getElementById('confirmDetails').style.display = 'none';
        document.getElementById('scanResult').innerText = "";
        
        fetch(`https://api.openbd.jp/v1/get?isbn=${decodedText}`)
            .then(res => res.json())
            .then(data => {
                let title = "";
                let author = "";
                let publisher = "";
                let year = "";
                let officialDescription = "";
                
                if (data && data.length > 0 && data[0]) {
                    if (data[0].summary) {
                        title = data[0].summary.title;
                        author = data[0].summary.author;
                        publisher = data[0].summary.publisher || "";
                        let pubdate = data[0].summary.pubdate || "";
                        if (pubdate.length >= 4) year = pubdate.substring(0, 4);
                    }
                    
                    // 公式のあらすじを取得 (onix.CollateralDetail.TextContent)
                    try {
                        const onix = data[0].onix;
                        if (onix && onix.CollateralDetail && onix.CollateralDetail.TextContent) {
                            const texts = onix.CollateralDetail.TextContent;
                            // TextType "03" (あらすじ) または "02" (短いあらすじ) を優先して探す
                            const desc = texts.find(t => t.TextType === "03" || t.TextType === "02");
                            if (desc) officialDescription = desc.Text;
                        }
                    } catch(e) { console.warn("Failed to extract description from OpenBD"); }
                }
                
                if (title) {
                    showConfirmDetails(title, author, decodedText, publisher, year, officialDescription);
                } else {
                    // OpenBDで見つからなかった場合のみGoogle Books API（クリーンアップ機能つき）
                    fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${decodedText}`)
                        .then(res => res.json())
                        .then(gData => {
                            if (gData.items && gData.items.length > 0) {
                                title = gData.items[0].volumeInfo.title;
                                const authors = gData.items[0].volumeInfo.authors;
                                if (authors) author = authors.join(', ');
                                let pub = gData.items[0].volumeInfo.publisher || "";
                                let pubDate = gData.items[0].volumeInfo.publishedDate || "";
                                let yr = pubDate.length >= 4 ? pubDate.substring(0, 4) : "";
                                showConfirmDetails(title, author, decodedText, pub, yr);
                            } else {
                                document.getElementById('confirmLoading').style.display = 'none';
                                document.getElementById('scanResult').innerText = "エラー: 本の情報が見つかりませんでした (ISBN: " + decodedText + ")";
                            }
                        })
                        .catch(err => {
                            document.getElementById('confirmLoading').style.display = 'none';
                            document.getElementById('scanResult').innerText = "本情報の取得エラー: " + err;
                        });
                }
            })
            .catch(err => {
                document.getElementById('confirmLoading').style.display = 'none';
                document.getElementById('scanResult').innerText = "本情報の取得エラー: " + err;
            });
    }
}

function cleanAuthorName(authorStr) {
    if (!authorStr) return "";
    // カンマで分割し、前後の空白を除去
    let parts = authorStr.split(',').map(p => p.trim());
    // 「数字とハイフン（またはチルダ）」だけで構成されているパーツ（生没年など）を除外
    parts = parts.filter(p => !/^[\d\-〜]+$/.test(p));
    // 日本語の書籍名に倣ってスペースなしで結合する
    return parts.join('').trim();
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
            tagsHtml += `<span class="tag" style="background: rgba(56, 189, 248, 0.2); color: #7dd3fc;">${book.Status}</span>`;
        }

        const summary = book.Gemini_Summary || "（要約未生成）";
        const rec = '';
        
        // 書影のURL。精度の高いOpenBDをメインにし、失敗したらNDLにフォールバック。それでもダメなら非表示にして下のテキストを見せる
        const openbdUrl = `https://cover.openbd.jp/${book.ISBN13}.jpg`;
        const ndlUrl = `https://ndlsearch.ndl.go.jp/thumbnail/${book.ISBN13}.jpg`;
        
        const fallbackScript = `this.onerror=null; this.src='${ndlUrl}'; this.onerror=function(){this.style.display='none';}`;
        const coverUrl = book.ISBN13 ? openbdUrl : 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        const imgTag = book.ISBN13 ? `<img src="${openbdUrl}" alt="書影" style="width: 100%; height: 100%; object-fit: cover; box-shadow: 0 4px 6px rgba(0,0,0,0.3); position: relative; z-index: 1; background: #1e293b;" onerror="${fallbackScript}">` : '';

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
    document.getElementById('detailStatus').value = book.Status || '積読';
    
    document.getElementById('detailSummary').innerText = summary;
    document.getElementById('detailRec').innerHTML = rec;
    
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
