let books = JSON.parse(localStorage.getItem("books")) || [];

const stackedBooksEl = document.getElementById("stackedBooks");
const readShelfEl = document.getElementById("readShelf");
const readShelf2El = document.getElementById("readShelf2");
const readShelf3El = document.getElementById("readShelf3");
const bookForm = document.getElementById("bookForm");

const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const modalTitleText = document.getElementById("modalTitleText");
const modalMemo = document.getElementById("modalMemo");
const markReadBtn = document.getElementById("markRead");
const deleteBookBtn = document.getElementById("deleteBook");
const insertDateBtn = document.getElementById('insertDateBtn');

let currentBookId = null;
let memoSaveTimer = null;
const MEMO_DEBOUNCE_MS = 600;
const BOOK_COLOR_PALETTE = [
    '#f8f4e6', // 生成り紙
    '#f2d5b5', // ベージュ
    '#d4b483', // 古書茶
    '#b07d62', // レザー風ブラウン
    '#8a5a44', // 焦げ茶
    '#5d473a', // ダーク木
    '#c9d6af', // くすみオリーブ
    '#6d8b74', // モスグリーン
    '#2f4858', // インク紺
    '#3c6e71', // 青緑
    '#708090', // スレート
    '#b3c1d1', // くすみ水色
    '#e0c3d6', // くすみピンク
    '#9d5c8c', // 古典的ワイン
    '#5a3d5c', // 濃ワイン
    '#d9d9d9', // グレー
    '#ffffff'  // 白
];
// 読了本サイズの推奨範囲 (拡大後)
const READ_WIDTH_MIN = 18;   // 旧 14
const READ_WIDTH_MAX = 26;   // 旧 20
const READ_HEIGHT_MIN = 150; // 旧 115
const READ_HEIGHT_MAX = 182; // 旧 140
// 積読（横置き）用サイズ範囲 (拡大)
const STACK_WIDTH_MIN = 182;   // 旧 140
const STACK_WIDTH_MAX = 220;   // 旧 170
const STACK_THICK_MIN = 23;    // 旧 18
const STACK_THICK_MAX = 34;    // 旧 26
const SIZE_SCALE_FLAG = 'scaled_v2_130'; // ローカルストレージ用フラグ
// 仕切り機能削除

function debounceSaveMemo() {
    if (memoSaveTimer) clearTimeout(memoSaveTimer);
    memoSaveTimer = setTimeout(() => {
        if (!currentBookId) return;
        const book = books.find(b => b.id === currentBookId);
        if (!book) return;
        // 変更がある場合のみ保存
        if (book.memo !== modalMemo.value) {
            book.memo = modalMemo.value;
            localStorage.setItem("books", JSON.stringify(books));
        }
    }, MEMO_DEBOUNCE_MS);
}

function randInt(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }

function ensureSizes(book) {
    let updated = false;
    // サイズ拡大（既存は保持・無ければ新しい範囲）
    if (book.shelfWidth == null) { book.shelfWidth = randInt(READ_WIDTH_MIN, READ_WIDTH_MAX); updated = true; }
    if (book.shelfHeight == null) { book.shelfHeight = randInt(READ_HEIGHT_MIN, READ_HEIGHT_MAX); updated = true; }
    if (book.stackWidth == null) { book.stackWidth = randInt(STACK_WIDTH_MIN, STACK_WIDTH_MAX); updated = true; }
    if (book.stackThickness == null) { book.stackThickness = randInt(STACK_THICK_MIN, STACK_THICK_MAX); updated = true; }
    if (book.stackOffset == null) { book.stackOffset = randInt(-4,4); updated = true; } //横ずれ
    if (book.color == null) { book.color = "#ffffff"; updated = true; }
    return updated;
}

// 起動時に既存分へサイズ付与
(function migrateSizes(){
    let changed = false;
    books.forEach(b => { if (ensureSizes(b)) changed = true; });
    // 既存サイズを一括スケール（未実行時のみ）
    if (!localStorage.getItem(SIZE_SCALE_FLAG)) {
        books.forEach(b => {
            // 旧サイズ領域を想定して 1.3 倍、範囲へクランプ
            if (b.shelfWidth)  b.shelfWidth  = Math.max(READ_WIDTH_MIN, Math.min(READ_WIDTH_MAX, Math.round(b.shelfWidth * 1.3)));
            if (b.shelfHeight) b.shelfHeight = Math.max(READ_HEIGHT_MIN, Math.min(READ_HEIGHT_MAX, Math.round(b.shelfHeight * 1.3)));
            if (b.stackWidth)  b.stackWidth  = Math.max(STACK_WIDTH_MIN, Math.min(STACK_WIDTH_MAX, Math.round(b.stackWidth * 1.3)));
            if (b.stackThickness) b.stackThickness = Math.max(STACK_THICK_MIN, Math.min(STACK_THICK_MAX, Math.round(b.stackThickness * 1.3)));
            changed = true;
        });
        localStorage.setItem(SIZE_SCALE_FLAG, '1');
    }
    if (changed) localStorage.setItem("books", JSON.stringify(books));
})();

function createTsundokuElement(book, animate = true, delay = 0) {
    ensureSizes(book);
    const bookEl = document.createElement("div");
    bookEl.title = book.title;
    bookEl.classList.add("book-horizontal");
    bookEl.dataset.id = book.id;
    bookEl.style.width = book.stackWidth + "px";
    bookEl.style.height = book.stackThickness + "px";
    bookEl.style.left = book.stackOffset + "px"; // 追加: 横オフセット固定
    applyColor(bookEl, book);
    // 背表紙タイトル（横向き）
    const span = document.createElement("span");
    span.className = "spine-title horizontal";
    span.textContent = truncateTitle(book.title, 18);
    adjustFontSize(span, bookEl, false);
    bookEl.appendChild(span);
    // ツールチップ
    bookEl.appendChild(makeTooltip(book.title));
    if (animate) {
        bookEl.style.animationDelay = `${delay}s`;
    } else {
        bookEl.style.animation = "none";
        bookEl.style.opacity = "1";
        bookEl.style.transform = "translateY(0)";
    }
    bookEl.addEventListener("click", () => openModal(book.id));
    return bookEl;
}

function createReadElement(book) {
    ensureSizes(book);
    const bookEl = document.createElement("div");
    bookEl.title = book.title;
    bookEl.classList.add("book");
    bookEl.dataset.id = book.id;
    bookEl.style.width = book.shelfWidth + "px";
    bookEl.style.height = book.shelfHeight + "px";
    applyColor(bookEl, book);
    // 縦書き背表紙タイトル
    const span = document.createElement("span");
    span.className = "spine-title vertical";
    // 回転無しの縦書き表示
    span.textContent = truncateTitle(book.title, Math.floor(book.shelfHeight / 12));
    adjustFontSize(span, bookEl, true);
    bookEl.appendChild(span);
    bookEl.appendChild(makeTooltip(book.title));
    bookEl.addEventListener("click", () => openModal(book.id));
    return bookEl;
}

function initialRender() {
    stackedBooksEl.innerHTML = "";
    readShelfEl.innerHTML = "";
    const tsundoku = books.filter(b=>b.status==="積読");
    tsundoku.forEach((book, idx) => {
        stackedBooksEl.appendChild(createTsundokuElement(book, true, idx*0.08));
    });
    books.filter(b=>b.status==="読了").forEach(b=>{
        readShelfEl.appendChild(createReadElement(b));
    });
}

bookForm.addEventListener("submit", e => {
    e.preventDefault();
    const title = document.getElementById("title").value.trim();
    if (!title) return;
    const newBook = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2,9)}`,
        title,
        memo: "",
        status: "積読"
    };
    ensureSizes(newBook);
    books.push(newBook);
    localStorage.setItem("books", JSON.stringify(books));
    addSingleTsundoku(newBook);
    bookForm.reset();
});

function addSingleTsundoku(book) {
    const el = createTsundokuElement(book, true, 0);
    stackedBooksEl.firstChild
        ? stackedBooksEl.insertBefore(el, stackedBooksEl.firstChild)
        : stackedBooksEl.appendChild(el);
}

function moveToRead(book) {
    const target = stackedBooksEl.querySelector(`[data-id="${book.id}"]`);
    if (target) target.remove();
    // 遅延なし即時配置（アニメーション省略）
    placeReadBook(book);
}

function renderBooks() {
    stackedBooksEl.innerHTML = "";
    readShelfEl.innerHTML = "";
    if (readShelf2El) readShelf2El.innerHTML = "";
    if (readShelf3El) readShelf3El.innerHTML = "";
    const tsundoku = books.filter(b => b.status === "積読").sort((a,b)=> b.id - a.id);
    tsundoku.forEach((book, idx) => stackedBooksEl.appendChild(createTsundokuElement(book, true, idx*0.08)));
    books.filter(b=>b.status==='読了').forEach(b=> placeReadBook(b));
}

function openModal(id) {
    // 既存タイマーをクリア
    if (memoSaveTimer) clearTimeout(memoSaveTimer);
    const book = books.find(b => b.id === id);
    if (!book) return;
    currentBookId = id;
    if (modalTitleText) modalTitleText.textContent = book.title;
    modalMemo.value = book.memo || "";
    // パレット反映
    const paletteContainer = document.getElementById('coverColorChoices');
    if (paletteContainer && !paletteContainer.dataset.rendered) {
        renderColorPalette(paletteContainer);
    }
    highlightSelectedColor(book.color || '#ffffff');
    modal.style.display = "flex";
    // 読了済みなら読了ボタン非表示
    if (book.status === "読了") {
        markReadBtn.style.display = "none";
    } else {
        markReadBtn.style.display = "inline-block";
    }
}

function closeModalFunc() {
    // 閉じる直前に強制保存
    if (currentBookId) {
        const book = books.find(b => b.id === currentBookId);
        if (book && book.memo !== modalMemo.value) {
            book.memo = modalMemo.value;
            localStorage.setItem("books", JSON.stringify(books));
        }
    }
    modal.style.display = "none";
}

bookForm.addEventListener("submit", e => {
    e.preventDefault();
    const title = document.getElementById("title").value.trim();
    if (!title) return;

    const newBook = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title,
        memo: "",
        status: "積読"
    };
    books.push(newBook);
    localStorage.setItem("books", JSON.stringify(books));
    addSingleTsundoku(newBook); // 全再描画しない
    bookForm.reset();
});

markReadBtn.addEventListener("click", () => {
    markCurrentBookRead();
});

deleteBookBtn.addEventListener("click", () => {
    const idx = books.findIndex(b => b.id === currentBookId);
    if (idx === -1) return;
    const book = books[idx];
    const ok = window.confirm(`『${book.title}』を削除しますか？\nこの操作は取り消せません。`);
    if (!ok) return; // キャンセル
    // DOM から除去
    const el1 = stackedBooksEl.querySelector(`[data-id="${book.id}"]`);
    if (el1) el1.remove();
    const el2 = readShelfEl.querySelector(`[data-id="${book.id}"]`);
    if (el2) el2.remove();
    books.splice(idx,1);
    localStorage.setItem("books", JSON.stringify(books));
    closeModalFunc();
});

// メモの自動保存 (debounce)
modalMemo.addEventListener("input", debounceSaveMemo);

// 現在の本を読了にする共通関数
function markCurrentBookRead() {
    if (!currentBookId) return;
    const book = books.find(b => b.id === currentBookId);
    if (!book) return;
    if (book.status === "読了") { // 既に読了なら閉じるだけ
        closeModalFunc();
        return;
    }
    // 入力中のメモを即保存
    if (memoSaveTimer) clearTimeout(memoSaveTimer);
    book.memo = modalMemo.value;
    book.status = "読了";
    localStorage.setItem("books", JSON.stringify(books));
    moveToRead(book);
    closeModalFunc();
}

// Escapeキーで読了（または既読なら閉じる）
window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.style.display === "flex") {
        markCurrentBookRead();
    }
});

(document.getElementById("closeModal")).addEventListener("click", closeModalFunc);
window.addEventListener("click", e => {
    if (e.target === modal) closeModalFunc();
});

// Prevent modal from closing when clicking inside modal-content
document.querySelector('.modal-content').addEventListener('click', function(e) {
    e.stopPropagation();
});

initialRender();

// タイトルを適度に省略
function truncateTitle(str, max) {
    if (!str) return "";
    if (str.length <= max) return str;
    return str.slice(0, max - 1) + "…";
}
// 仕切り関連コード削除済み

// ---------- 本のドラッグ並び替え ----------
function enableBookDrag(container){
    [...container.querySelectorAll('.book')].forEach(el => {
        el.draggable = true;
        if (el.dataset.dragBound) return;
        el.addEventListener('dragstart', onDragStart);
        el.addEventListener('dragover', onDragOver);
        el.addEventListener('drop', onDrop);
    el.addEventListener('dragend', onDragEnd);
        el.dataset.dragBound = '1';
    });
    container.addEventListener('dragover', e => e.preventDefault());
}
let dragSrcId = null;
function onDragStart(e){
    dragSrcId = e.currentTarget.dataset.id;
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('dragging');
}
function onDragOver(e){
    e.preventDefault();
    const target = e.currentTarget;
    if (!dragSrcId || dragSrcId === target.dataset.id) return;
    const rect = target.getBoundingClientRect();
    const before = (e.clientX - rect.left) < rect.width/2;
    const srcEl = document.querySelector(`.book[data-id="${dragSrcId}"]`);
    if (!srcEl) return;
    if (before) target.parentNode.insertBefore(srcEl, target); else target.parentNode.insertBefore(srcEl, target.nextSibling);
}
function onDrop(e){
    e.preventDefault();
    if (!dragSrcId) return;
    // 複数棚対応: 全棚内の book 要素順序を連結
    const orderedIds = [...document.querySelectorAll('#readShelf .book, #readShelf2 .book, #readShelf3 .book')].map(el=>el.dataset.id);
    const readBooks = books.filter(b=>b.status==='読了');
    const others = books.filter(b=>b.status!=='読了');
    readBooks.sort((a,b)=> orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id));
    books = [...others, ...readBooks];
    localStorage.setItem('books', JSON.stringify(books));
    dragSrcId = null;
    document.querySelectorAll('.dragging').forEach(el=>el.classList.remove('dragging'));
}

function onDragEnd(){
    // ドロップされなかった場合でも透過解除
    document.querySelectorAll('.dragging').forEach(el=>el.classList.remove('dragging'));
    dragSrcId = null;
}

// 仕切りドラッグ/追加関連削除

// 色適用
function applyColor(el, book) {
    const c = book.color || "#ffffff";
    const border = shadeColor(c, -25);
    el.style.setProperty('--book-bg', c);
    el.style.setProperty('--book-border', border);
    // 明度で文字色変える
    const luminance = getLuminance(c);
    el.style.setProperty('--spine-color', luminance < 0.45 ? '#f8f8f8' : '#222');
}

// フォントサイズ調整
function adjustFontSize(span, bookEl, vertical) {
    const maxIterations = 6;
    // 初期フォントサイズ拡大
    let size = vertical ? 22 : 23;
    span.style.setProperty('--spine-font-size', size + 'px');
    for (let i=0;i<maxIterations;i++) {
        if (vertical) {
            if (span.scrollHeight <= bookEl.clientHeight - 4) break;
        } else {
            if (span.scrollWidth <= bookEl.clientWidth - 6) break;
        }
        size -= 1;
        if (size < 7) { size = 7; break; }
        span.style.setProperty('--spine-font-size', size + 'px');
    }
}

// HEX -> 相対明度
function getLuminance(hex) {
    const {r,g,b} = parseHex(hex);
    const srgb = [r,g,b].map(v=>{
        v/=255; return v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055,2.4);
    });
    return 0.2126*srgb[0]+0.7152*srgb[1]+0.0722*srgb[2];
}

function shadeColor(hex, percent){
    const {r,g,b} = parseHex(hex);
    const t = percent<0?0:255;
    const p = Math.abs(percent)/100;
    const nr = Math.round((t - r)*p + r);
    const ng = Math.round((t - g)*p + g);
    const nb = Math.round((t - b)*p + b);
    return `rgb(${nr},${ng},${nb})`;
}

function parseHex(hex){
    let h = hex.replace('#','');
    if (h.length===3) h = h.split('').map(x=>x+x).join('');
    const num = parseInt(h,16);
    return {r:(num>>16)&255,g:(num>>8)&255,b:num&255};
}

// カラー変更
document.getElementById('coverColor')?.addEventListener('input', (e)=>{
    // (旧 color input 対応) 何もしない
});

function renderColorPalette(container) {
    container.innerHTML = '';
    BOOK_COLOR_PALETTE.forEach(col => {
        const sw = document.createElement('div');
        sw.className = 'swatch';
        sw.style.background = col;
        sw.dataset.color = col;
        sw.addEventListener('click', () => {
            if (!currentBookId) return;
            const book = books.find(b=>b.id===currentBookId);
            if (!book) return;
            book.color = col;
            localStorage.setItem('books', JSON.stringify(books));
            const el = document.querySelector(`[data-id="${book.id}"]`);
            if (el) applyColor(el, book);
            highlightSelectedColor(col);
        });
        container.appendChild(sw);
    });
    container.dataset.rendered = '1';
}

function highlightSelectedColor(col) {
    const container = document.getElementById('coverColorChoices');
    if (!container) return;
    [...container.querySelectorAll('.swatch')].forEach(s=>{
        s.classList.toggle('selected', s.dataset.color.toLowerCase() === col.toLowerCase());
    });
}

// 読了本配置（上段満杯なら下段へ）
function placeReadBook(book){
    const el = createReadElement(book);
    const shelves = [readShelfEl, readShelf2El, readShelf3El].filter(Boolean);
    for (let i=0;i<shelves.length;i++) {
        const shelf = shelves[i];
        const maxWidth = shelf.clientWidth - 10;
        let used = 0;
        [...shelf.querySelectorAll('.book')].forEach(bEl => used += bEl.offsetWidth + 2);
        if (used + book.shelfWidth + 4 <= maxWidth || i === shelves.length-1) {
            shelf.appendChild(el);
            break;
        }
    }
    shelves.forEach(s => enableBookDrag(s));
}

// 日付挿入ボタン
if (insertDateBtn) {
    insertDateBtn.addEventListener('click', ()=>{
        const now = new Date();
        const pad = n=> String(n).padStart(2,'0');
        const stamp = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
        const cursorPos = modalMemo.selectionStart ?? modalMemo.value.length;
        const before = modalMemo.value.slice(0, cursorPos);
        const after = modalMemo.value.slice(cursorPos);
        // 直前の 2 行までを見て既に同じ日付行がある時はそのまま末尾へ追記しない
        const lastChunk = before.split(/\n/).slice(-1)[0];
        // 直前が空でなければ改行、連続押下時は直前が日付行なら 1 改行、それ以外なら 2 改行で区切る
        let neededBreaks = '';
        if (before.length === 0) {
            neededBreaks = '';
        } else if (/^\s*$/.test(lastChunk)) {
            neededBreaks = '';
        } else if (/^\[[0-9]{4}-[0-9]{2}-[0-9]{2}\]/.test(lastChunk)) {
            neededBreaks = '\n';
        } else {
            neededBreaks = '\n\n';
        }
        const insertion = `${neededBreaks}[${stamp}] `;
        modalMemo.value = before + insertion + after;
        const newPos = (before + insertion).length;
        modalMemo.selectionStart = modalMemo.selectionEnd = newPos;
        modalMemo.focus();
        debounceSaveMemo();
    });
}

// --- 積読スタックのドラッグ並び替え（縦方向） ---
function enableStackDrag(){
    [...stackedBooksEl.querySelectorAll('.book-horizontal')].forEach(el=>{
        el.draggable = true;
        if (el.dataset.stackDragBound) return;
        el.addEventListener('dragstart', stackDragStart);
        el.addEventListener('dragover', stackDragOver);
        el.addEventListener('drop', stackDragDrop);
        el.addEventListener('dragend', ()=> el.classList.remove('dragging'));
        el.dataset.stackDragBound = '1';
    });
    stackedBooksEl.addEventListener('dragover', e=>e.preventDefault());
}
let stackDragSrcId = null;
function stackDragStart(e){
    stackDragSrcId = e.currentTarget.dataset.id;
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('dragging');
}
function stackDragOver(e){
    e.preventDefault();
    const target = e.currentTarget;
    if (!stackDragSrcId || stackDragSrcId === target.dataset.id) return;
    const rect = target.getBoundingClientRect();
    const before = (e.clientY - rect.top) < rect.height/2;
    const srcEl = stackedBooksEl.querySelector(`.book-horizontal[data-id="${stackDragSrcId}"]`);
    if (!srcEl) return;
    if (before) target.parentNode.insertBefore(srcEl, target); else target.parentNode.insertBefore(srcEl, target.nextSibling);
}
function stackDragDrop(e){
    e.preventDefault();
    if (!stackDragSrcId) return;
    const orderedIds = [...stackedBooksEl.querySelectorAll('.book-horizontal')].map(el=>el.dataset.id);
    const tsundoku = books.filter(b=>b.status==='積読');
    const others = books.filter(b=>b.status!=='積読');
    tsundoku.sort((a,b)=> orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id));
    books = [...tsundoku, ...others];
    localStorage.setItem('books', JSON.stringify(books));
    stackDragSrcId = null;
    document.querySelectorAll('.book-horizontal.dragging').forEach(el=>el.classList.remove('dragging'));
}

// 初期化後に積読ドラッグ有効化
setTimeout(enableStackDrag, 50);

// 単体追加時も付与
const _origAddSingleTsundoku = addSingleTsundoku;
addSingleTsundoku = function(book){
    _origAddSingleTsundoku(book);
    enableStackDrag();
};

// --- 検索フィルタ ---
const searchInput = document.getElementById('searchTsundoku');
if (searchInput) {
    searchInput.addEventListener('input', ()=>{
        const q = searchInput.value.trim().toLowerCase();
        const all = [
            ...document.querySelectorAll('.book-horizontal'),
            ...document.querySelectorAll('.book')
        ];
        all.forEach(el=>{
            const title = (el.getAttribute('title')||'').toLowerCase();
            if (!q) {
                el.classList.remove('filtered-out','search-hit');
            } else if (title.includes(q)) {
                el.classList.remove('filtered-out');
                el.classList.add('search-hit');
            } else {
                el.classList.add('filtered-out');
                el.classList.remove('search-hit');
            }
        });
    });
}

// ツールチップ生成
function makeTooltip(text){
    const tip = document.createElement('div');
    tip.className = 'book-tooltip';
    tip.textContent = text;
    return tip;
}