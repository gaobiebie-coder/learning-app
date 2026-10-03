// ===== 雅思核心 4000 词模块 =====
// 数据：data/ielts.json（ECDICT 雅思标签词，按词频排序）
// 功能：浏览、搜索、收藏到生词本；经济学人入口跳转阅读页

let ieltsData = null;
let ieltsLoading = null;

function loadIELTS() {
  if (ieltsData) return Promise.resolve(ieltsData);
  if (!ieltsLoading) {
    ieltsLoading = fetch('data/ielts.json')
      .then((r) => r.json())
      .then((d) => { ieltsData = d; return d; });
  }
  return ieltsLoading;
}

const MAX_SHOW = 200;

function renderIeltsList() {
  const keyword = document.getElementById('ielts-search').value.trim().toLowerCase();
  const list = document.getElementById('ielts-list');
  if (!ieltsData) { list.innerHTML = '<p class="hint center">词库加载中…</p>'; return; }

  const matches = keyword
    ? ieltsData.filter(([w]) => w.includes(keyword))
    : ieltsData;

  const shown = matches.slice(0, MAX_SHOW);
  list.innerHTML = shown.map(([w, p, t]) => {
    const inVocab = window.Vocab && Vocab.all().some((i) => i.w === w);
    return `
    <div class="vocab-item">
      <div class="vocab-word">
        <b>${esc(w)}</b>
        ${p ? `<span class="phonetic">/${esc(p)}/</span>` : ''}
      </div>
      <div class="vocab-trans">${esc(t.split('\\n')[0])}</div>
      <button class="ielts-star" data-w="${esc(w)}" ${inVocab ? 'disabled' : ''}>
        ${inVocab ? '✅' : '☆ 加入生词本'}
      </button>
    </div>`;
  }).join('') + (matches.length > MAX_SHOW
    ? `<p class="hint center">共 ${matches.length} 个结果，仅显示前 ${MAX_SHOW} 个，请搜索缩小范围</p>`
    : `<p class="hint center">共 ${matches.length} 词</p>`);
}

document.getElementById('ielts-card').addEventListener('click', () => {
  document.getElementById('ielts-overlay').classList.remove('hidden');
  renderIeltsList();
  loadIELTS().then(renderIeltsList);
});
document.getElementById('ielts-close').addEventListener('click', () => {
  document.getElementById('ielts-overlay').classList.add('hidden');
});
document.getElementById('ielts-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'ielts-overlay') e.currentTarget.classList.add('hidden');
});
document.getElementById('ielts-search').addEventListener('input', renderIeltsList);

// 收藏到生词本
document.getElementById('ielts-list').addEventListener('click', (e) => {
  const btn = e.target.closest('.ielts-star');
  if (!btn || btn.disabled || !window.Vocab) return;
  const entry = ieltsData.find(([w]) => w === btn.dataset.w);
  if (!entry) return;
  const added = Vocab.add(entry[0], entry[1], entry[2], '雅思核心词');
  if (added) { btn.disabled = true; btn.textContent = '✅'; }
});

// 经济学人入口 → 切到阅读页
document.getElementById('econ-card').addEventListener('click', () => {
  document.querySelector('.tab[data-page="reading"]').click();
});
