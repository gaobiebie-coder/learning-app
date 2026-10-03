// ===== 生词本模块 =====
// 阅读页查过的单词自动收藏到这里，并接入首页单词卡循环复习。
// 数据存在 localStorage（键 vocab-book），不上传服务器。

const Vocab = (() => {
  const KEY = 'vocab-book';
  let items = [];
  try { items = JSON.parse(localStorage.getItem(KEY)) || []; } catch { items = []; }

  function save() { localStorage.setItem(KEY, JSON.stringify(items)); }

  // 收藏单词；已存在则返回 false
  function add(w, p, t, source) {
    if (!w || !t) return false;
    if (items.some((i) => i.w === w)) return false;
    items.unshift({
      w, p, t,
      source: source || '',
      added: new Date().toISOString().slice(0, 10),
      reviews: 0,
    });
    save();
    renderVocabUI();
    return true;
  }

  function remove(w) {
    items = items.filter((i) => i.w !== w);
    save();
    renderVocabUI();
  }

  // 复习一次（首页单词卡点"学会了"时调用），复习少的排前面
  function markReviewed(w) {
    const it = items.find((i) => i.w === w);
    if (it) { it.reviews++; save(); }
  }

  function queue() { return [...items].sort((a, b) => a.reviews - b.reviews); }
  function count() { return items.length; }
  function all() { return items; }

  return { add, remove, markReviewed, queue, count, all };
})();

// ===== 生词本界面 =====
function renderVocabUI() {
  const countEl = document.getElementById('vocab-count');
  if (countEl) {
    countEl.textContent = Vocab.count() > 0
      ? `已收藏 ${Vocab.count()} 个生词`
      : '阅读查词自动收藏';
  }
  const list = document.getElementById('vocab-list');
  if (!list) return;
  if (Vocab.count() === 0) {
    list.innerHTML = '<p class="hint center">还没有生词<br>去「阅读」页点文章里的单词查词典，会自动收藏到这里</p>';
    return;
  }
  list.innerHTML = Vocab.all().map((i) => `
    <div class="vocab-item">
      <div class="vocab-word">
        <b>${esc(i.w)}</b>
        ${i.p ? `<span class="phonetic">/${esc(i.p)}/</span>` : ''}
        <span class="vocab-reviews">复习 ${i.reviews} 次</span>
      </div>
      <div class="vocab-trans">${esc(i.t.split('\\n')[0])}</div>
      ${i.source ? `<div class="vocab-src">出自：${esc(i.source)}</div>` : ''}
      <button class="vocab-del" data-w="${esc(i.w)}" title="删除">✕</button>
    </div>`).join('');
}

document.getElementById('vocab-card').addEventListener('click', () => {
  renderVocabUI();
  document.getElementById('vocab-overlay').classList.remove('hidden');
});
document.getElementById('vocab-close').addEventListener('click', () => {
  document.getElementById('vocab-overlay').classList.add('hidden');
});
document.getElementById('vocab-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'vocab-overlay') e.currentTarget.classList.add('hidden');
});
document.getElementById('vocab-list').addEventListener('click', (e) => {
  const del = e.target.closest('.vocab-del');
  if (del) Vocab.remove(del.dataset.w);
});

renderVocabUI();
