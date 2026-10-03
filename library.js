// ===== 书架模块：本地 epub 阅读器 =====
// epub 文件只保存在浏览器 IndexedDB 里，不上传、不发布到任何服务器。
// 点词翻译 / 整句翻译 / 生词本与阅读页共用同一套词典模块（reading.js）。

// ---------- IndexedDB ----------
function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('learning-library', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('books', { keyPath: 'id' });
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

function idbReq(req) {
  return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
}

async function dbPut(book) { const db = await openDB(); return idbReq(db.transaction('books', 'readwrite').objectStore('books').put(book)); }
async function dbAll() { const db = await openDB(); return idbReq(db.transaction('books').objectStore('books').getAll()); }
async function dbGet(id) { const db = await openDB(); return idbReq(db.transaction('books').objectStore('books').get(id)); }
async function dbDel(id) { const db = await openDB(); return idbReq(db.transaction('books', 'readwrite').objectStore('books').delete(id)); }

// ---------- epub 解析 ----------
function blobToDataUrl(blob) {
  return new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.readAsDataURL(blob);
  });
}

async function parseEpub(zip) {
  const container = await zip.file('META-INF/container.xml').async('text');
  const m = /full-path="([^"]+)"/.exec(container);
  if (!m) throw new Error('不是有效的 epub 文件');
  const opfPath = m[1];
  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const opf = new DOMParser().parseFromString(await zip.file(opfPath).async('text'), 'text/xml');

  const titleEl = opf.getElementsByTagNameNS('*', 'title')[0];
  const authorEl = opf.getElementsByTagNameNS('*', 'creator')[0];
  const manifest = {};
  opf.querySelectorAll('manifest > item').forEach((it) => {
    manifest[it.getAttribute('id')] = {
      href: it.getAttribute('href'),
      props: it.getAttribute('properties') || '',
    };
  });
  const spine = [...opf.querySelectorAll('spine > itemref')]
    .map((ir) => ir.getAttribute('idref'))
    .filter((id) => manifest[id]);

  // 封面（可选）
  let cover = null;
  const metaCover = opf.querySelector('meta[name="cover"]');
  const coverEntry = Object.values(manifest).find((x) => x.props.includes('cover-image'))
    || (metaCover && manifest[metaCover.getAttribute('content')]);
  if (coverEntry) {
    try {
      const f = zip.file(opfDir + decodeURI(coverEntry.href));
      if (f) cover = await blobToDataUrl(await f.async('blob'));
    } catch { /* 无封面就用文字 tile */ }
  }

  return {
    title: titleEl ? titleEl.textContent : '未命名书籍',
    author: authorEl ? authorEl.textContent : '',
    cover, opfDir, manifest, spine,
  };
}

function xhtmlToParagraphs(text) {
  const doc = new DOMParser().parseFromString(text, 'text/html');
  doc.querySelectorAll('script,style').forEach((n) => n.remove());
  const blocks = doc.querySelectorAll('p,h1,h2,h3,h4,h5,h6,blockquote,li');
  let paras = [...blocks]
    .map((b) => b.textContent.replace(/\s+/g, ' ').trim())
    .filter((t) => t.length > 0);
  if (!paras.length) {
    const t = doc.body ? doc.body.textContent.replace(/\s+/g, ' ').trim() : '';
    paras = t ? [t] : [];
  }
  return paras;
}

async function loadChapters(zip, info) {
  const chapters = [];
  for (const idref of info.spine) {
    const f = zip.file(info.opfDir + decodeURI(info.manifest[idref].href));
    if (!f) continue;
    try {
      const paras = xhtmlToParagraphs(await f.async('text'));
      if (paras.join('').length >= 200) chapters.push(paras); // 跳过封面/扉页等碎片
    } catch { /* 跳过坏章节 */ }
  }
  return chapters;
}

// ---------- 书架界面 ----------
const bookGrid = document.getElementById('book-grid');
const bookOverlay = document.getElementById('book-overlay');
const bookCache = new Map(); // id -> { info, chapters }

async function renderShelf() {
  const books = (await dbAll()).sort((a, b) => b.added - a.added);
  if (!books.length) {
    bookGrid.innerHTML = '<p class="hint center">书架空空如也<br>点击上方按钮导入 epub 电子书</p>';
    return;
  }
  bookGrid.innerHTML = books.map((b) => `
    <div class="book-tile" data-id="${esc(b.id)}">
      ${b.cover
        ? `<img class="book-cover" src="${b.cover}" alt="">`
        : `<div class="book-cover book-cover-text">${esc(b.title.slice(0, 1))}</div>`}
      <div class="book-name">${esc(b.title)}</div>
      <div class="book-author">${esc(b.author)}</div>
      <button class="book-del" data-id="${esc(b.id)}" title="删除">✕</button>
    </div>`).join('');
}

// ---------- 导入 ----------
document.getElementById('btn-import').addEventListener('click', () => {
  document.getElementById('file-input').click();
});

document.getElementById('file-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const btn = document.getElementById('btn-import');
  btn.disabled = true;
  btn.textContent = '导入中…';
  try {
    const buf = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buf);
    const info = await parseEpub(zip);
    await dbPut({
      id: file.name + '_' + buf.byteLength,
      title: info.title,
      author: info.author,
      cover: info.cover,
      added: Date.now(),
      blob: buf,
    });
    await renderShelf();
  } catch (err) {
    alert('导入失败：' + (err.message || '文件无法解析'));
  }
  btn.disabled = false;
  btn.textContent = '＋ 导入 epub 电子书';
});

// ---------- 阅读器 ----------
let curBook = null; // { id, info, chapters, idx }

function getProgress(id) {
  try { return (JSON.parse(localStorage.getItem('book-progress')) || {})[id] || 0; }
  catch { return 0; }
}
function setProgress(id, idx) {
  const p = JSON.parse(localStorage.getItem('book-progress') || '{}');
  p[id] = idx;
  localStorage.setItem('book-progress', JSON.stringify(p));
}

function linkifyChapter(paras) {
  const sentences = [];
  const html = paras.map((p) => {
    const parts = p.split(/(?<=[.!?])\s+/);
    return '<p>' + parts.map((s) => {
      const si = sentences.length;
      sentences.push(s);
      return esc(s).replace(/[A-Za-z][A-Za-z'’-]*/g, (w) =>
        `<span class="w" data-s="${si}">${w}</span>`);
    }).join(' ') + '</p>';
  }).join('');
  return { html, sentences };
}

function renderChapter() {
  const { info, chapters, idx } = curBook;
  const { html, sentences } = linkifyChapter(chapters[idx]);
  currentSentences = sentences; // 共享给整句翻译（reading.js）
  document.getElementById('book-title').textContent = info.title;
  document.getElementById('book-chapter-info').textContent =
    `第 ${idx + 1} / ${chapters.length} 章`;
  document.getElementById('book-content').innerHTML = html;
  document.getElementById('book-prev').disabled = idx === 0;
  document.getElementById('book-next').disabled = idx === chapters.length - 1;
  document.querySelector('.book-panel').scrollTop = 0;
  setProgress(curBook.id, idx);
}

async function openBook(id) {
  document.getElementById('book-content').innerHTML = '<p class="hint center">加载中…</p>';
  document.getElementById('book-title').textContent = '';
  document.getElementById('book-chapter-info').textContent = '';
  bookOverlay.classList.remove('hidden');
  try {
    if (!bookCache.has(id)) {
      const rec = await dbGet(id);
      const zip = await JSZip.loadAsync(rec.blob);
      const info = await parseEpub(zip);
      const chapters = await loadChapters(zip, info);
      if (!chapters.length) throw new Error('未找到正文');
      bookCache.set(id, { info, chapters });
    }
    const { info, chapters } = bookCache.get(id);
    curBook = { id, info, chapters, idx: Math.min(getProgress(id), chapters.length - 1) };
    renderChapter();
  } catch (err) {
    document.getElementById('book-content').innerHTML =
      '<p class="hint center">打开失败：' + esc(err.message || '未知错误') + '</p>';
  }
}

bookGrid.addEventListener('click', async (e) => {
  const del = e.target.closest('.book-del');
  if (del) {
    if (confirm('从书架删除这本书？')) {
      await dbDel(del.dataset.id);
      bookCache.delete(del.dataset.id);
      renderShelf();
    }
    return;
  }
  const tile = e.target.closest('.book-tile');
  if (tile) openBook(tile.dataset.id);
});

document.getElementById('book-close').addEventListener('click', () => {
  bookOverlay.classList.add('hidden');
  hideDict();
});
bookOverlay.addEventListener('click', (e) => {
  if (e.target.id === 'book-overlay') { bookOverlay.classList.add('hidden'); hideDict(); }
});
document.getElementById('book-prev').addEventListener('click', () => {
  if (curBook && curBook.idx > 0) { curBook.idx--; renderChapter(); }
});
document.getElementById('book-next').addEventListener('click', () => {
  if (curBook && curBook.idx < curBook.chapters.length - 1) { curBook.idx++; renderChapter(); }
});

// 点词查词典（复用 reading.js 的 lookupWord / 词典弹窗）
document.getElementById('book-content').addEventListener('click', (e) => {
  const w = e.target.closest('.w');
  if (w) lookupWord(w.textContent, Number(w.dataset.s));
});

renderShelf();
