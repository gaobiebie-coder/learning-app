// ===== 数据 =====
const WORDS = [
  { word: 'persistence', meaning: 'n. 坚持；毅力', example: 'Persistence is the key to success.' },
  { word: 'curious', meaning: 'adj. 好奇的', example: 'Stay curious, keep learning.' },
  { word: 'achieve', meaning: 'v. 实现；达成', example: 'You can achieve your goals.' },
  { word: 'habit', meaning: 'n. 习惯', example: 'Learning is a daily habit.' },
  { word: 'progress', meaning: 'n. 进步', example: 'Small progress every day.' },
  { word: 'focus', meaning: 'v./n. 专注', example: 'Focus on one thing at a time.' },
  { word: 'review', meaning: 'v. 复习', example: 'Review what you learned today.' },
  { word: 'challenge', meaning: 'n. 挑战', example: 'Every challenge makes you stronger.' },
  { word: 'wisdom', meaning: 'n. 智慧', example: 'Books are the ladder of wisdom.' },
  { word: 'journey', meaning: 'n. 旅程', example: 'Learning is a lifelong journey.' },
];

const GOAL = 20;
const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  },
  set(key, val) { localStorage.setItem(key, JSON.stringify(val)); },
};

const today = () => new Date().toISOString().slice(0, 10);

// ===== 状态（按日期持久化）=====
let state = store.get('learning-state', null);
if (!state || state.date !== today()) {
  state = { date: today(), learned: 0, wordIndex: 0, checkedIn: false };
}
let streak = store.get('learning-streak', { count: 0, lastCheckIn: null });

function save() { store.set('learning-state', state); store.set('learning-streak', streak); }

// ===== 首页：进度 =====
function renderProgress() {
  document.getElementById('progress-bar').style.width = (state.learned / GOAL * 100) + '%';
  document.getElementById('progress-text').textContent = `已学 ${state.learned} / ${GOAL} 个单词`;
}

// ===== 首页：单词卡 =====
// 生词本有词时优先循环复习生词（复习少的排前面），否则用内置词库
let flipped = false;

function cardQueue() {
  if (window.Vocab && Vocab.count() > 0) {
    return Vocab.queue().map((i) => ({
      word: i.w,
      meaning: i.t.split('\\n')[0],
      example: i.p ? '/' + i.p + '/' : '',
    }));
  }
  return WORDS;
}

function renderWord() {
  const q = cardQueue();
  const w = q[state.wordIndex % q.length];
  document.getElementById('word-text').textContent = w.word;
  document.getElementById('meaning-text').textContent = w.meaning;
  document.getElementById('example-text').textContent = w.example;
  document.getElementById('word-front').classList.toggle('hidden', flipped);
  document.getElementById('word-back').classList.toggle('hidden', !flipped);
}

document.getElementById('word-card').addEventListener('click', () => {
  flipped = !flipped;
  renderWord();
});

document.getElementById('btn-next').addEventListener('click', () => {
  const q = cardQueue();
  if (window.Vocab && Vocab.count() > 0) {
    Vocab.markReviewed(q[state.wordIndex % q.length].word);
  }
  if (state.learned < GOAL) state.learned++;
  state.wordIndex++;
  flipped = false;
  save();
  renderProgress();
  renderWord();
});

// ===== 我的：打卡 =====
function renderCheckin() {
  document.getElementById('streak-days').textContent = streak.count + ' 天';
  const btn = document.getElementById('btn-checkin');
  if (state.checkedIn) { btn.disabled = true; btn.textContent = '今日已打卡 ✅'; }
}

document.getElementById('btn-checkin').addEventListener('click', () => {
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  streak.count = (streak.lastCheckIn === yesterday) ? streak.count + 1 : 1;
  streak.lastCheckIn = today();
  state.checkedIn = true;
  save();
  renderCheckin();
});

// ===== 底部导航 =====
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('page-' + tab.dataset.page).classList.add('active');
    if (tab.dataset.page === 'home') renderWord(); // 生词本更新后刷新单词卡
  });
});

// ===== 初始化 =====
renderProgress();
renderWord();
renderCheckin();

// ===== 注册 Service Worker（离线可用 + 后台静默更新）=====
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
  // 新版本部署后，Service Worker 在后台完成更新并接管，
  // 此时自动刷新一次页面加载新代码，无需手动清缓存
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    location.reload();
  });
}
