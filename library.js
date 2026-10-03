// ===== 书架模块：本地 epub 阅读器 =====
// epub 文件只保存在浏览器 IndexedDB 里，不上传、不发布到任何服务器。
// 点词翻译 / 整句翻译 / 整段翻译 / 生词本与阅读页共用词典模块（reading.js）。

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

// 部分 epub 实体被双重编码（&amp; → 显示成 &），解析时还原
function decodeEntities(t) {
  return t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

// 章节内容解析为块：[{text, heading}]
function xhtmlToBlocks(text) {
  const doc = new DOMParser().parseFromString(text, 'text/html');
  doc.querySelectorAll('script,style').forEach((n) => n.remove());
  const blocks = doc.querySelectorAll('p,h1,h2,h3,h4,h5,h6,blockquote,li');
  let out = [...blocks]
    .map((b) => ({
      text: decodeEntities(b.textContent.replace(/\s+/g, ' ').trim()),
      heading: /^H[1-6]$/.test(b.tagName),
    }))
    .filter((b) => b.text.length > 0);
  if (!out.length) {
    const t = doc.body ? decodeEntities(doc.body.textContent.replace(/\s+/g, ' ').trim()) : '';
    out = t ? [{ text: t, heading: false }] : [];
  }
  return out;
}

async function loadChapters(zip, info) {
  const chapters = [];
  for (const idref of info.spine) {
    const f = zip.file(info.opfDir + decodeURI(info.manifest[idref].href));
    if (!f) continue;
    try {
      const blocks = xhtmlToBlocks(await f.async('text'));
      if (blocks.map((b) => b.text).join('').length >= 200) chapters.push(blocks);
    } catch { /* 跳过坏章节 */ }
  }
  return chapters;
}

// 章节名：第一个短标题块，否则"第 X 章"
function chapterTitle(blocks, idx) {
  const h = blocks.find((b) => b.heading && b.text.length <= 60);
  return h ? h.text : `第 ${idx + 1} 章`;
}

// ---------- 书架界面 ----------
const bookGrid = document.getElementById('book-grid');
const bookOverlay = document.getElementById('book-overlay');
const bookCache = new Map();

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

// ---------- 字号 ----------
let fontSize = Number(localStorage.getItem('reader-font-size')) || 17;
function applyFontSize() {
  document.getElementById('book-content').style.fontSize = fontSize + 'px';
  localStorage.setItem('reader-font-size', fontSize);
}
document.getElementById('font-dec').addEventListener('click', () => {
  fontSize = Math.max(13, fontSize - 1); applyFontSize();
});
document.getElementById('font-inc').addEventListener('click', () => {
  fontSize = Math.min(26, fontSize + 1); applyFontSize();
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

function renderChapter() {
  const { info, chapters, idx } = curBook;
  const blocks = chapters[idx];
  const sentences = [];
  const html = blocks.map((b, bi) => {
    const parts = b.text.split(/(?<=[.!?])\s+/);
    const inner = parts.map((s) => {
      const si = sentences.length;
      sentences.push(s);
      return linkifyWords(s, si); // reading.js 提供的切词+转义函数
    }).join(' ');
    const tag = b.heading ? 'h3' : 'p';
    return `<div class="parablock"><${tag}>${inner}</${tag}>`
      + (b.heading ? '' : `<button class="p-trans" data-p="${bi}">译</button>`)
      + `</div>`;
  }).join('');
  currentSentences = sentences;

  document.getElementById('book-title').textContent = chapterTitle(blocks, idx);
  const pct = Math.round((idx + 1) / chapters.length * 100);
  document.getElementById('book-chapter-info').textContent =
    `${info.title} · ${idx + 1}/${chapters.length} · ${pct}%`;
  document.getElementById('book-content').innerHTML = html;
  document.getElementById('book-prev').disabled = idx === 0;
  document.getElementById('book-next').disabled = idx === chapters.length - 1;
  document.getElementById('book-content').scrollTop = 0;
  applyFontSize();
  setProgress(curBook.id, idx);
  renderMarkBtn();
}

// ---------- 书签 ----------
function getBookmarks(id) {
  try { return (JSON.parse(localStorage.getItem('book-bookmarks')) || {})[id] || []; }
  catch { return []; }
}
function saveBookmarks(id, list) {
  const all = JSON.parse(localStorage.getItem('book-bookmarks') || '{}');
  all[id] = list;
  localStorage.setItem('book-bookmarks', JSON.stringify(all));
}
function renderMarkBtn() {
  const btn = document.getElementById('book-mark-btn');
  const marked = curBook && getBookmarks(curBook.id).some((b) => b.chapter === curBook.idx);
  btn.textContent = marked ? '🔖' : '☆';
  btn.classList.toggle('active', !!marked);
}
document.getElementById('book-mark-btn').addEventListener('click', () => {
  if (!curBook) return;
  const list = getBookmarks(curBook.id);
  const i = list.findIndex((b) => b.chapter === curBook.idx);
  if (i >= 0) {
    list.splice(i, 1);
  } else {
    list.push({
      chapter: curBook.idx,
      title: chapterTitle(curBook.chapters[curBook.idx], curBook.idx),
      time: Date.now(),
    });
  }
  saveBookmarks(curBook.id, list);
  renderMarkBtn();
});

async function openBook(id) {
  document.getElementById('book-title').textContent = '';
  document.getElementById('book-chapter-info').textContent = '';
  document.getElementById('book-content').innerHTML = '<p class="hint center">加载中…</p>';
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
    currentArticleTitle = info.title; // 生词本出处
    renderChapter();
  } catch (err) {
    document.getElementById('book-content').innerHTML =
      '<p class="hint center">打开失败：' + esc(err.message || '未知错误') + '</p>';
  }
}

// ---------- 目录 / 书签面板 ----------
let tocMode = 'chapters';

function renderTocList() {
  const list = document.getElementById('toc-list');
  document.querySelectorAll('.toc-tab').forEach((t) =>
    t.classList.toggle('active', t.dataset.toc === tocMode));
  if (tocMode === 'chapters') {
    list.innerHTML = curBook.chapters.map((blocks, i) =>
      `<button class="toc-item${i === curBook.idx ? ' active' : ''}" data-i="${i}">${esc(chapterTitle(blocks, i))}</button>`
    ).join('');
  } else {
    const marks = getBookmarks(curBook.id).sort((a, b) => a.chapter - b.chapter);
    list.innerHTML = marks.length
      ? marks.map((m) =>
        `<button class="toc-item" data-i="${m.chapter}">🔖 ${esc(m.title)}<span class="toc-meta">第 ${m.chapter + 1} 章</span></button>`
      ).join('')
      : '<p class="hint center">还没有书签<br>阅读时点顶栏 ☆ 收藏当前章节</p>';
  }
}

document.getElementById('book-toc-btn').addEventListener('click', () => {
  if (!curBook) return;
  renderTocList();
  document.getElementById('toc-overlay').classList.remove('hidden');
});
// 底部导航栏的目录按钮（手机上拇指可及，与顶栏按钮同功能）
document.getElementById('book-toc-btn2').addEventListener('click', () => {
  if (!curBook) return;
  renderTocList();
  document.getElementById('toc-overlay').classList.remove('hidden');
});
document.getElementById('toc-close').addEventListener('click', () => {
  document.getElementById('toc-overlay').classList.add('hidden');
});
document.querySelectorAll('.toc-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    tocMode = tab.dataset.toc;
    renderTocList();
  });
});
document.getElementById('toc-list').addEventListener('click', (e) => {
  const item = e.target.closest('.toc-item');
  if (!item || !curBook) return;
  curBook.idx = Number(item.dataset.i);
  renderChapter();
  document.getElementById('toc-overlay').classList.add('hidden');
});

// ---------- 整段翻译 ----------
async function translateLong(text) {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks = [];
  let cur = '';
  for (const s of sentences) {
    if (cur && (cur + ' ' + s).length > 400) { chunks.push(cur); cur = s; }
    else { cur = cur ? cur + ' ' + s : s; }
  }
  if (cur) chunks.push(cur);
  const out = [];
  for (const c of chunks) {
    const r = await fetch(
      'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(c) + '&langpair=en|zh-CN');
    const d = await r.json();
    out.push((d.responseData && d.responseData.translatedText) || '');
  }
  return out.join(' ');
}

async function translateParagraph(btn) {
  const blockEl = btn.closest('.parablock');
  const existing = blockEl.querySelector('.trans-zh');
  if (existing) { existing.remove(); btn.textContent = '译'; return; } // 再点收起
  const text = curBook.chapters[curBook.idx][Number(btn.dataset.p)].text;
  if (text.length < 3) return;
  btn.disabled = true;
  btn.textContent = '…';
  try {
    const zh = await translateLong(text);
    const div = document.createElement('div');
    div.className = 'trans-zh';
    div.textContent = zh;
    blockEl.appendChild(div);
    btn.textContent = '收起';
  } catch {
    btn.textContent = '失败';
  }
  btn.disabled = false;
}

// ---------- 事件 ----------
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
document.getElementById('book-prev').addEventListener('click', () => {
  if (curBook && curBook.idx > 0) { curBook.idx--; renderChapter(); }
});
document.getElementById('book-next').addEventListener('click', () => {
  if (curBook && curBook.idx < curBook.chapters.length - 1) { curBook.idx++; renderChapter(); }
});

// 正文点击：单词 → 词典；译 → 整段翻译
document.getElementById('book-content').addEventListener('click', (e) => {
  const transBtn = e.target.closest('.p-trans');
  if (transBtn) { translateParagraph(transBtn); return; }
  const w = e.target.closest('.w');
  if (w) lookupWord(w.textContent, Number(w.dataset.s));
});

// ---------- 摘抄卡片 ----------
const excerptFab = document.getElementById('excerpt-fab');
let lastExcerptText = '';

// 选中正文文字时，显示"生成摘录卡片"按钮。
// 注意：手机上点按钮的瞬间系统会先清空选区，所以选中文本要在此时就存好
document.addEventListener('selectionchange', () => {
  const sel = window.getSelection();
  const content = document.getElementById('book-content');
  const show = !bookOverlay.classList.contains('hidden')
    && sel && !sel.isCollapsed
    && sel.toString().trim().length >= 10
    && content.contains(sel.anchorNode);
  if (show) {
    lastExcerptText = sel.toString().replace(/\s+/g, ' ').trim().slice(0, 280);
  }
  excerptFab.classList.toggle('hidden', !show);
});

excerptFab.addEventListener('click', () => {
  const text = lastExcerptText; // 用选区变化时存好的文本，而不是现场读选区
  window.getSelection().removeAllRanges();
  excerptFab.classList.add('hidden');
  lastExcerptText = '';
  if (text) makeExcerptCard(text);
});

document.getElementById('excerpt-close').addEventListener('click', () => {
  document.getElementById('excerpt-overlay').classList.add('hidden');
});

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapLines(ctx, text, maxWidth) {
  const tokens = text.split(/(\s+)/);
  const lines = [];
  let line = '';
  for (const t of tokens) {
    if (line && ctx.measureText(line + t).width > maxWidth) {
      lines.push(line.trimEnd());
      line = t.trimStart();
    } else {
      line += t;
    }
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

function makeExcerptCard(text) {
  const W = 750, H = 1000;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // 蓝粉渐变背景 + 装饰
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#E6F3FA');
  bg.addColorStop(1, '#FDE8F0');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = '#A8D4EC';
  ctx.beginPath(); ctx.arc(70, 110, 95, 0, 7); ctx.fill();
  ctx.fillStyle = '#F5B8D4';
  ctx.beginPath(); ctx.arc(710, 900, 120, 0, 7); ctx.fill();
  ctx.fillStyle = '#FAECC7';
  ctx.beginPath(); ctx.arc(660, 90, 45, 0, 7); ctx.fill();
  ctx.globalAlpha = 1;

  // 白色卡片
  const cx = 70, cy = 110, cw = W - 140, ch = H - 220;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.10)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = '#ffffff';
  roundRectPath(ctx, cx, cy, cw, ch, 32);
  ctx.fill();
  ctx.restore();

  // 大引号
  ctx.fillStyle = '#8EC4DE';
  ctx.font = 'bold 110px Georgia, serif';
  ctx.fillText('“', cx + 44, cy + 128);

  // 摘录正文（最多 9 行）
  ctx.fillStyle = '#1F2937';
  ctx.font = '29px Georgia, "Times New Roman", serif';
  const lines = wrapLines(ctx, text, cw - 130).slice(0, 9);
  let y = cy + 195;
  for (const l of lines) { ctx.fillText(l, cx + 62, y); y += 54; }

  // 分割线
  const fy = cy + ch - 155;
  ctx.strokeStyle = '#E8EAED';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx + 60, fy);
  ctx.lineTo(cx + cw - 60, fy);
  ctx.stroke();

  // 书名 · 作者 · 日期
  ctx.fillStyle = '#1F2937';
  ctx.font = 'bold 27px Georgia, serif';
  ctx.fillText(curBook ? curBook.info.title : '', cx + 62, fy + 58);
  ctx.fillStyle = '#6B7280';
  ctx.font = '22px -apple-system, "PingFang SC", sans-serif';
  const dateStr = new Date().toISOString().slice(0, 10);
  ctx.fillText((curBook ? curBook.info.author : '') + '  ·  ' + dateStr, cx + 62, fy + 98);
  ctx.fillStyle = '#9CA3AF';
  ctx.font = '20px -apple-system, "PingFang SC", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('每日学习 · 摘抄', cx + cw - 62, fy + 98);
  ctx.textAlign = 'left';

  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    document.getElementById('excerpt-img').src = url;
    document.getElementById('excerpt-download').href = url;
    document.getElementById('excerpt-overlay').classList.remove('hidden');
  }, 'image/png');
}

renderShelf();
