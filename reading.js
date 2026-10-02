// ===== 经济学人阅读模块 =====
// 数据来源：每日 GitHub Actions 抓取官方 RSS 生成 data/articles.json
// 词典：内置 ECDICT 高频词（data/dict.json，离线可用）

let articlesData = null;
let dictData = null;
let dictLoading = null;
let currentSection = '全部';

const readingPage = document.getElementById('page-reading');
const dictPopup = document.getElementById('dict-popup');

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// 把英文文本切成「单词 + 标点」，单词包上可点击的 span
// data-s 记录所属句子序号，供整句翻译使用
function linkify(text) {
  const sentences = text.split(/(?<=[.!?])\s+/);
  return sentences.map((sent, si) =>
    esc(sent).replace(/[A-Za-z][A-Za-z'’-]*/g, (w) =>
      `<span class="w" data-s="${si}">${w}</span>`)
  ).join(' ');
}

// ===== 加载文章数据 =====
fetch('data/articles.json')
  .then((r) => r.json())
  .then((d) => { articlesData = d; renderReading(); })
  .catch(() => {
    document.getElementById('reading-updated').textContent = '文章加载失败，请检查网络';
  });

function renderReading() {
  const arts = articlesData.articles;
  document.getElementById('reading-updated').textContent =
    `更新于 ${articlesData.updated} · 共 ${arts.length} 篇`;

  // 今日推荐：最新一篇
  const top = arts[0];
  document.getElementById('today-card').innerHTML = top ? `
    <div class="card today-card" data-link="${esc(top.link)}">
      <div class="badge">📌 今日推荐</div>
      <div class="article-title">${esc(top.title)}</div>
      <div class="article-meta">${esc(top.section)} · ${esc(top.date)}</div>
      <p class="article-summary">${esc(top.summary)}</p>
      <div class="hint">点击阅读 · 文中单词可点查</div>
    </div>` : '<div class="card">暂无文章</div>';

  // 版块筛选
  const sections = ['全部', ...new Set(arts.map((a) => a.section))];
  document.getElementById('section-chips').innerHTML = sections.map((s) =>
    `<button class="chip${s === currentSection ? ' active' : ''}" data-section="${esc(s)}">${esc(s)}</button>`
  ).join('');

  // 文章目录
  const list = currentSection === '全部' ? arts : arts.filter((a) => a.section === currentSection);
  document.getElementById('article-list').innerHTML = list.map((a) => `
    <div class="card article-item" data-link="${esc(a.link)}">
      <div class="article-title small">${esc(a.title)}</div>
      <div class="article-meta">${esc(a.section)} · ${esc(a.date)}</div>
    </div>`).join('');
}

// ===== 目录点击 / 版块筛选 =====
readingPage.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (chip) { currentSection = chip.dataset.section; renderReading(); return; }

  const item = e.target.closest('.today-card, .article-item');
  if (item) openReader(item.dataset.link);
});

// ===== 阅读浮层 =====
function openReader(link) {
  const a = articlesData.articles.find((x) => x.link === link);
  if (!a) return;
  document.getElementById('reader-content').innerHTML = `
    <div class="article-meta">${esc(a.section)} · ${esc(a.date)}</div>
    <h2 class="reader-title">${linkify(a.title)}</h2>
    <p class="reader-summary" id="reader-summary">${linkify(a.summary)}</p>
    <a class="btn primary reader-link" href="${esc(a.link)}" target="_blank" rel="noopener">
      阅读原文（economist.com）
    </a>
    <p class="hint center">正文中点击任意单词查词典</p>`;
  document.getElementById('reader').classList.remove('hidden');
}

document.getElementById('reader-close').addEventListener('click', () => {
  document.getElementById('reader').classList.add('hidden');
  hideDict();
});
document.getElementById('reader').addEventListener('click', (e) => {
  if (e.target.id === 'reader') { e.currentTarget.classList.add('hidden'); hideDict(); }
});

// ===== 点词查词典 =====
document.getElementById('reader-content').addEventListener('click', (e) => {
  const w = e.target.closest('.w');
  if (w) lookupWord(w.textContent, Number(w.dataset.s));
});

function loadDict() {
  if (dictData) return Promise.resolve(dictData);
  if (!dictLoading) {
    dictLoading = fetch('data/dict.json').then((r) => r.json()).then((d) => { dictData = d; return d; });
  }
  return dictLoading;
}

function normalize(raw) {
  return raw.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z'-]/g, '').replace(/'s$/, '');
}

function findEntry(word) {
  const d = dictData.dict;
  if (d[word]) return [word, d[word]];
  // 词形变化映射（played → play）
  const lemma = dictData.forms[word];
  if (lemma && d[lemma]) return [lemma, d[lemma]];
  // 简单词干规则兜底
  for (const [suffix, fix] of [['ies', 'y'], ['ied', 'y'], ['es', ''], ['s', ''], ['ed', ''], ['ed', 'e'], ['ing', ''], ['ing', 'e']]) {
    if (word.endsWith(suffix) && word.length > suffix.length + 1) {
      const stem = word.slice(0, -suffix.length) + fix;
      if (d[stem]) return [stem, d[stem]];
    }
  }
  return null;
}

async function lookupWord(raw, sentIndex) {
  const word = normalize(raw);
  if (!word) return;
  dictPopup.innerHTML = '<div class="dict-body">查词中…</div>';
  dictPopup.classList.remove('hidden');
  try {
    await loadDict();
  } catch {
    dictPopup.innerHTML = '<div class="dict-body">词典加载失败</div>';
    return;
  }
  const found = findEntry(word);
  const [phonetic, trans] = found ? found[1] : ['', ''];
  const transHtml = trans ? esc(trans).replace(/\n/g, '<br>') : '';
  dictPopup.innerHTML = `
    <div class="dict-body">
      <div class="dict-head">
        <b>${esc(found ? found[0] : word)}</b>
        ${phonetic ? `<span class="phonetic">/${esc(phonetic)}/</span>` : ''}
        <button class="dict-close">✕</button>
      </div>
      ${transHtml ? `<div class="dict-trans">${transHtml}</div>` : '<div class="dict-trans">内置词典未收录</div>'}
      <button class="btn dict-sentence-btn" data-s="${sentIndex}">翻译整句（在线）</button>
    </div>`;
  dictPopup.querySelector('.dict-close').onclick = hideDict;
  dictPopup.querySelector('.dict-sentence-btn').onclick = (e) =>
    translateSentence(Number(e.target.dataset.s));
}

function hideDict() { dictPopup.classList.add('hidden'); }

// ===== 整句翻译（MyMemory 免费接口）=====
async function translateSentence(sentIndex) {
  const summary = document.getElementById('reader-summary');
  if (!summary) return;
  const text = summary.textContent.split(/(?<=[.!?])\s+/)[sentIndex] || '';
  const btn = dictPopup.querySelector('.dict-sentence-btn');
  btn.disabled = true;
  btn.textContent = '翻译中…';
  try {
    const r = await fetch(
      'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=en|zh-CN');
    const d = await r.json();
    const t = d.responseData && d.responseData.translatedText;
    btn.textContent = t || '翻译失败';
  } catch {
    btn.textContent = '翻译失败，请检查网络';
    btn.disabled = false;
  }
}
