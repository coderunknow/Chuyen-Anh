import { loadVocabulary, loadMeta } from './lib/vocab.js';
import { STATES, ensureProgress, updateProgress, selectSession, calculateStats, isDue, createInitialProgress } from './lib/scheduler.js';
import { loadProgress, saveProgress, loadPrefs, savePrefs, loadFavorites, saveFavorites, loadHistory, saveHistory, loadStreak, saveStreak, exportAll, importAll } from './lib/storage.js';
import { createSearchIndex, search, sortResults } from './lib/search.js';
import { generateQuestion, checkAnswer, MODES } from './lib/modes.js';

export async function createApp(root) {
  let vocab = [];
  let meta = null;
  let progressMap = {};
  let prefs = loadPrefs();
  let favorites = loadFavorites();
  let history = loadHistory();
  let streakData = loadStreak();
  let searchIndex = [];
  let currentView = 'learn';
  let currentSession = null;
  let currentQuestion = null;
  let sessionStats = { correct: 0, wrong: 0, startTime: null };
  let questionStartTime = null;
  let isAnswered = false;

  // Load data
  try {
    const [v, m] = await Promise.all([loadVocabulary(), loadMeta()]);
    vocab = v;
    meta = m;
  } catch (e) {
    root.innerHTML = `
      <div class="app-shell">
        <div style="max-width:600px;margin:80px auto;padding:32px;text-align:center">
          <div style="width:64px;height:64px;margin:0 auto 16px;background:var(--danger-light);border-radius:50%;display:grid;place-items:center;font-size:28px">⚠️</div>
          <h2 style="margin-bottom:12px;font-weight:800">Không thể tải dữ liệu từ vựng</h2>
          <p style="color:var(--text-muted);margin-bottom:24px;font-size:14px">${e.message}</p>
          <button class="btn btn-primary" onclick="location.reload()">Thử tải lại trang</button>
          <p style="margin-top:20px;font-size:12px;color:var(--text-light)">Kiểm tra file data/vocabulary.json tồn tại và đúng định dạng</p>
        </div>
      </div>`;
    console.error(e);
    return;
  }

  progressMap = ensureProgress(loadProgress(), vocab);
  saveProgress(progressMap);
  searchIndex = createSearchIndex(vocab, progressMap, favorites);

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', prefs.darkMode ? 'dark' : 'light');
  }
  applyTheme();

  function saveAll() {
    try {
      saveProgress(progressMap);
      saveFavorites(favorites);
      saveHistory(history);
      saveStreak(streakData);
      savePrefs(prefs);
      searchIndex = createSearchIndex(vocab, progressMap, favorites);
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  function updateStreak() {
    const today = new Date().toISOString().split('T')[0];
    if (streakData.lastDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      if (streakData.lastDate === yesterday) {
        streakData.current += 1;
      } else if (!streakData.lastDate) {
        streakData.current = 1;
      } else {
        const last = new Date(streakData.lastDate);
        const now = new Date(today);
        const diffDays = Math.floor((now - last) / 86400000);
        if (diffDays === 1) streakData.current += 1;
        else if (diffDays > 1) streakData.current = 1;
      }
      streakData.lastDate = today;
      streakData.longest = Math.max(streakData.longest, streakData.current);
      saveStreak(streakData);
    }
  }

  function showToast(msg, type = 'info') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.className = 'toast';
    div.innerHTML = `<span>${type === 'error' ? '⚠️' : type === 'success' ? '✅' : '💡'}</span><span>${escapeHtml(msg)}</span>`;
    document.body.appendChild(div);
    setTimeout(() => {
      div.style.opacity = '0';
      div.style.transform = 'translateX(-50%) translateY(10px)';
      setTimeout(() => div.remove(), 200);
    }, 3000);
  }

  function renderShell() {
    const stats = calculateStats(progressMap);
    root.innerHTML = `
      <div class="app-shell">
        <header class="header">
          <div class="header-inner">
            <a class="logo" href="#" aria-label="Trang chủ" onclick="event.preventDefault(); navigate('learn')">
              <span class="logo-icon">CA</span>
              <span class="logo-text">
                <span class="logo-title">Chuyên Anh</span>
                <span class="logo-sub">Flashcard • ${vocab.length} từ</span>
              </span>
            </a>
            <div class="header-meta">
              <span>📚 ${meta ? `${meta.count || vocab.length}` : vocab.length} từ</span>
              <span class="dot"></span>
              <span title="Đến hạn">⏰ ${stats.due}</span>
              <span class="dot"></span>
              <span title="Streak">🔥 ${streakData.current}</span>
            </div>
            <div class="header-actions">
              <button class="btn btn-ghost btn-sm" id="btn-theme" title="Đổi giao diện (Dark/Light)" aria-label="Đổi theme">🌓</button>
              <button class="btn btn-ghost btn-sm" id="btn-export" title="Xuất dữ liệu" aria-label="Export">⤓ Export</button>
            </div>
          </div>
        </header>
        <div class="main">
          <aside class="sidebar">
            <div class="card">
              <div class="card-header"><h3>Điều hướng</h3></div>
              <div class="card-padding" style="padding:10px">
                <nav class="nav" id="nav" role="navigation" aria-label="Main navigation">
                  <button class="nav-btn ${currentView==='learn'?'active':''}" data-view="learn" aria-current="${currentView==='learn'?'page':''}">
                    <span class="nav-icon">📖</span><span>Học</span><span class="badge">${stats.due}</span>
                  </button>
                  <button class="nav-btn ${currentView==='dashboard'?'active':''}" data-view="dashboard">
                    <span class="nav-icon">📊</span><span>Dashboard</span>
                  </button>
                  <button class="nav-btn ${currentView==='search'?'active':''}" data-view="search">
                    <span class="nav-icon">🔍</span><span>Tra cứu</span><span class="badge">${vocab.length}</span>
                  </button>
                  <button class="nav-btn ${currentView==='settings'?'active':''}" data-view="settings">
                    <span class="nav-icon">⚙️</span><span>Cài đặt</span>
                  </button>
                </nav>
              </div>
            </div>
            <div class="card">
              <div class="card-header"><h3>Tiến độ tổng quan</h3><span style="font-size:11px;color:var(--text-muted)">${stats.accuracy}% chính xác</span></div>
              <div class="card-padding">
                <div class="stats-grid">
                  <div class="stat"><div class="stat-value">${stats.total}</div><div class="stat-label">Tổng</div></div>
                  <div class="stat"><div class="stat-value">${stats.mastered}</div><div class="stat-label">Thành thạo</div></div>
                  <div class="stat"><div class="stat-value">${stats.learning + stats.review}</div><div class="stat-label">Đang học</div></div>
                  <div class="stat"><div class="stat-value">${stats.weak}</div><div class="stat-label">Từ yếu</div></div>
                </div>
                <div style="margin-top:14px">
                  <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);margin-bottom:6px">
                    <span>Độ chính xác</span><span style="font-weight:700;color:var(--text)">${stats.accuracy}%</span>
                  </div>
                  <div style="height:8px;background:var(--bg-muted);border-radius:99px;overflow:hidden;border:1px solid var(--border)">
                    <div style="height:100%;width:${stats.accuracy}%;background:var(--primary-gradient);border-radius:99px;transition:width 0.5s var(--ease)"></div>
                  </div>
                </div>
                <div style="margin-top:12px;display:flex;gap:6px;height:22px;border-radius:99px;overflow:hidden;background:var(--bg-muted);border:1px solid var(--border);padding:2px">
                  <div style="flex:${stats.new||0.5};background:#94a3b8;border-radius:99px" title="New: ${stats.new}"></div>
                  <div style="flex:${stats.learning||0.5};background:#fbbf24;border-radius:99px" title="Learning: ${stats.learning}"></div>
                  <div style="flex:${stats.weak||0.5};background:#f87171;border-radius:99px" title="Weak: ${stats.weak}"></div>
                  <div style="flex:${stats.review||0.5};background:#60a5fa;border-radius:99px" title="Review: ${stats.review}"></div>
                  <div style="flex:${stats.mastered||0.5};background:#4ade80;border-radius:99px" title="Mastered: ${stats.mastered}"></div>
                </div>
              </div>
            </div>
            <div class="card">
              <div class="card-header"><h3>Phím tắt</h3></div>
              <div class="card-padding">
                <div style="font-size:12px;color:var(--text-muted);display:grid;gap:8px">
                  <div style="display:flex;justify-content:space-between;align-items:center"><span>Chọn đáp án</span><span class="kbd">1-4</span></div>
                  <div style="display:flex;justify-content:space-between;align-items:center"><span>Xác nhận / Tiếp</span><span class="kbd">Enter</span></div>
                  <div style="display:flex;justify-content:space-between;align-items:center"><span>Tiếp tục</span><span class="kbd">Space</span></div>
                  <div style="display:flex;justify-content:space-between;align-items:center"><span>Bỏ qua</span><span class="kbd">N</span></div>
                  <div style="display:flex;justify-content:space-between;align-items:center"><span>Yêu thích</span><span class="kbd">F</span></div>
                </div>
              </div>
            </div>
          </aside>
          <main class="content" id="content" role="main"></main>
        </div>
        <footer class="footer">
          <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:12px;align-items:center">
            <span>📚 Vocabulary: ${vocab.length} words</span>
            <span style="width:4px;height:4px;background:var(--border-strong);border-radius:50%"></span>
            <span>🔄 Updated: ${meta?.updated || 'local'}</span>
            <span style="width:4px;height:4px;background:var(--border-strong);border-radius:50%"></span>
            <span>🔨 Build: ${meta?.commit || 'dev'}</span>
          </div>
          <div style="margin-top:8px;opacity:0.8">Frontend-only • localStorage • Spaced repetition • Active recall • Interleaving</div>
        </footer>
      </div>
    `;

    root.querySelectorAll('[data-view]').forEach(btn => {
      btn.addEventListener('click', () => navigate(btn.dataset.view));
    });
    root.querySelector('#btn-theme')?.addEventListener('click', () => {
      prefs.darkMode = !prefs.darkMode;
      savePrefs(prefs);
      applyTheme();
      showToast(prefs.darkMode ? 'Đã bật Dark mode' : 'Đã bật Light mode', 'success');
    });
    root.querySelector('#btn-export')?.addEventListener('click', () => {
      const data = exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `flashcard-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Đã xuất dữ liệu', 'success');
    });

    renderContent();
  }

  function navigate(view) {
    currentView = view;
    root.querySelectorAll('.nav-btn').forEach(btn => {
      const isActive = btn.dataset.view === view;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-current', isActive ? 'page' : '');
    });
    renderContent();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderContent() {
    const content = root.querySelector('#content');
    if (!content) return;
    if (currentView === 'learn') renderLearn(content);
    else if (currentView === 'dashboard') renderDashboard(content);
    else if (currentView === 'search') renderSearch(content);
    else if (currentView === 'settings') renderSettings(content);
  }

  function renderLearn(container) {
    if (currentSession && currentSession.length > 0) {
      renderFlashcard(container);
      return;
    }

    const stats = calculateStats(progressMap);
    const dueCount = stats.due;
    const newCount = stats.new;
    const weakCount = stats.weak;
    const favCount = favorites.size;

    container.innerHTML = `
      <div class="content-header">
        <h1 class="content-title">Học từ vựng Chuyên Anh</h1>
        <p class="content-subtitle">Hệ thống học thông minh ưu tiên từ yếu và đến hạn, áp dụng active recall, spaced repetition và interleaving để tối ưu ghi nhớ lâu dài.</p>
      </div>
      <div class="session-options">
        <button class="session-card" data-session="due" aria-label="Học từ đến hạn">
          <div class="session-card-icon">📅</div>
          <h4>Đến hạn hôm nay</h4>
          <p>Ôn từ đã đến lúc cần nhớ lại để củng cố trí nhớ dài hạn</p>
          <div class="count">⏰ ${dueCount} từ</div>
        </button>
        <button class="session-card" data-session="weak" aria-label="Học từ yếu">
          <div class="session-card-icon">⚠️</div>
          <h4>Từ yếu</h4>
          <p>Tập trung vào từ hay sai, tăng tần suất xuất hiện</p>
          <div class="count">🎯 ${weakCount} từ</div>
        </button>
        <button class="session-card" data-session="new" aria-label="Học từ mới">
          <div class="session-card-icon">🆕</div>
          <h4>Từ mới</h4>
          <p>Khám phá từ chưa từng gặp, bắt đầu hành trình ghi nhớ</p>
          <div class="count">✨ ${newCount} từ</div>
        </button>
        <button class="session-card" data-session="random" aria-label="Học ngẫu nhiên">
          <div class="session-card-icon">🎲</div>
          <h4>Ngẫu nhiên</h4>
          <p>Ôn tập đa dạng, trộn lẫn các loại từ để tăng phân biệt</p>
          <div class="count">🔀 ${vocab.length} từ</div>
        </button>
        <button class="session-card" data-session="favorites" aria-label="Học từ yêu thích">
          <div class="session-card-icon">⭐</div>
          <h4>Yêu thích</h4>
          <p>Ôn lại những từ bạn đã đánh dấu quan trọng</p>
          <div class="count">💛 ${favCount} từ</div>
        </button>
        <button class="session-card" data-session="quick10" aria-label="Học nhanh 10 từ">
          <div class="session-card-icon">⚡</div>
          <h4>Nhanh 10 từ</h4>
          <p>Phiên học siêu tốc, phù hợp giờ giải lao</p>
          <div class="count">⚡ 10 từ</div>
        </button>
        <button class="session-card" data-session="quick20" aria-label="Học 20 từ">
          <div class="session-card-icon">📚</div>
          <h4>20 từ</h4>
          <p>Cân bằng thời gian và hiệu quả, khuyến nghị hàng ngày</p>
          <div class="count">📖 20 từ</div>
        </button>
        <button class="session-card" data-session="quick30" aria-label="Học 30 từ">
          <div class="session-card-icon">🚀</div>
          <h4>30 từ</h4>
          <p>Phiên học sâu, thử thách trí nhớ</p>
          <div class="count">🔥 30 từ</div>
        </button>
      </div>
      <div class="card">
        <div class="card-header"><h3>💡 Gợi ý học tập hiệu quả</h3></div>
        <div class="card-padding">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px">
            <div style="display:flex;gap:12px"><div style="width:32px;height:32px;background:var(--primary-light);border-radius:8px;display:grid;place-items:center;flex-shrink:0">🧠</div><div><div style="font-weight:700;font-size:13px">Active Recall</div><div style="font-size:12px;color:var(--text-muted);margin-top:2px">Cố gắng nhớ trước khi chọn đáp án, não hoạt động mạnh hơn khi tự truy xuất</div></div></div>
            <div style="display:flex;gap:12px"><div style="width:32px;height:32px;background:#d1fae5;border-radius:8px;display:grid;place-items:center;flex-shrink:0">⏱️</div><div><div style="font-weight:700;font-size:13px">Spaced Repetition</div><div style="font-size:12px;color:var(--text-muted);margin-top:2px">Từ sai xuất hiện lại sớm, từ đúng được giãn cách để tối ưu đường cong quên</div></div></div>
            <div style="display:flex;gap:12px"><div style="width:32px;height:32px;background:#fef3c7;border-radius:8px;display:grid;place-items:center;flex-shrink:0">🔀</div><div><div style="font-weight:700;font-size:13px">Interleaving</div><div style="font-size:12px;color:var(--text-muted);margin-top:2px">Các loại từ trộn lẫn giúp phân biệt tốt hơn so với học theo cụm</div></div></div>
            <div style="display:flex;gap:12px"><div style="width:32px;height:32px;background:#dbeafe;border-radius:8px;display:grid;place-items:center;flex-shrink:0">💬</div><div><div style="font-weight:700;font-size:13px">Feedback ngay</div><div style="font-size:12px;color:var(--text-muted);margin-top:2px">Xem lại nghĩa, ví dụ và lỗi sai ngay sau mỗi câu để điều chỉnh</div></div></div>
          </div>
        </div>
      </div>
    `;

    container.querySelectorAll('[data-session]').forEach(btn => {
      btn.addEventListener('click', () => startSession(btn.dataset.session));
    });
  }

  function startSession(type) {
    let mode = 'due';
    let size = prefs.sessionSize || 20;
    if (type === 'due') { mode = 'due'; size = 20; }
    else if (type === 'weak') { mode = 'weak'; size = 20; }
    else if (type === 'new') { mode = 'new'; size = 20; }
    else if (type === 'random') { mode = 'random'; size = 20; }
    else if (type === 'favorites') { mode = 'favorites'; size = 20; }
    else if (type === 'quick10') { mode = 'due'; size = 10; }
    else if (type === 'quick20') { mode = 'due'; size = 20; }
    else if (type === 'quick30') { mode = 'due'; size = 30; }

    const session = selectSession(vocab, progressMap, { size, mode, favorites });
    if (session.length === 0) {
      showToast(type === 'favorites' ? 'Chưa có từ yêu thích nào. Hãy đánh dấu ⭐ ở trang tra cứu!' : 'Không có từ nào cho phiên này. Thử chế độ khác nhé!', 'info');
      return;
    }
    currentSession = session;
    sessionStats = { correct: 0, wrong: 0, startTime: Date.now(), total: session.length, mode };
    isAnswered = false;
    nextCard();
    renderContent();
    updateStreak();
  }

  function nextCard() {
    if (!currentSession || currentSession.length === 0) {
      finishSession();
      return;
    }
    const item = currentSession[0];
    currentQuestion = generateQuestion(item, vocab, item.progress);
    questionStartTime = Date.now();
    isAnswered = false;
  }

  function renderFlashcard(container) {
    if (!currentSession || currentSession.length === 0) {
      renderLearn(container);
      return;
    }
    const item = currentSession[0];
    const q = currentQuestion;
    const progress = item.progress;
    const remaining = currentSession.length;
    const total = sessionStats.total;
    const done = total - remaining;
    const percent = total > 0 ? Math.round(done / total * 100) : 0;
    const isFav = favorites.has(item.vocab.id);

    container.innerHTML = `
      <div class="flashcard-container">
        <div class="progress-bar" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill" style="width:${percent}%"></div></div>
        <div class="flashcard">
          <div class="flashcard-header">
            <span style="display:flex;align-items:center;gap:8px"><span style="background:var(--bg-muted);border:1px solid var(--border);padding:3px 10px;border-radius:99px;font-weight:700;font-size:12px">${done+1} / ${total}</span><span style="color:var(--text-muted)">• ${remaining} còn lại</span></span>
            <div style="display:flex;gap:8px;align-items:center">
              <span class="vocab-state state-${progress.state}" title="Trạng thái: ${progress.state}">${progress.state}</span>
              <button class="fav-btn ${isFav?'active':''}" id="fav-btn" title="Yêu thích (F)" aria-label="Yêu thích">${isFav?'★':'☆'}</button>
              <button class="btn btn-ghost btn-sm" id="skip-btn" title="Bỏ qua (N)">Bỏ qua ⏭️</button>
            </div>
          </div>
          <div class="flashcard-body">
            <div class="flashcard-mode">${q.mode} • ${escapeHtml(item.vocab.pos)} • ${escapeHtml(item.vocab.word.length + ' chữ')}</div>
            <div class="flashcard-prompt">${escapeHtml(q.prompt)}</div>
            ${q.subPrompt ? `<div class="flashcard-sub">${escapeHtml(q.subPrompt)}</div>` : ''}
            <div id="question-area"></div>
            <div id="feedback-area"></div>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:14px;font-size:12px;color:var(--text-muted);flex-wrap:wrap;gap:8px">
          <span style="display:flex;gap:12px;flex-wrap:wrap">
            <span>🔥 Khó: ${Math.round((progress.difficulty||0)*100)}%</span>
            <span>❌ Sai: ${progress.wrongCount}</span>
            <span>✅ Đúng: ${progress.correctCount}</span>
            <span>⚡ Streak: ${progress.streak}</span>
          </span>
          <span>Nhấn <span class="kbd">1-4</span> để chọn • <span class="kbd">Enter</span> để tiếp</span>
        </div>
      </div>
    `;

    const questionArea = container.querySelector('#question-area');
    const feedbackArea = container.querySelector('#feedback-area');

    if (q.mode === 'spelling') {
      questionArea.innerHTML = `
        <div class="spelling-input">
          <input type="text" id="spell-input" placeholder="Gõ từ tiếng Anh..." autocomplete="off" spellcheck="false" aria-label="Nhập từ tiếng Anh" />
          <button class="btn btn-primary" id="submit-spell">Xác nhận ↵</button>
        </div>
        ${q.hint ? `<div style="font-size:12px;color:var(--text-light);margin-top:8px;display:flex;gap:6px;align-items:center"><span>💡 Gợi ý:</span><code style="background:var(--bg-muted);padding:2px 8px;border-radius:99px;border:1px solid var(--border);font-family:var(--font-mono)">${escapeHtml(q.hint)}</code></div>` : ''}
      `;
      const input = questionArea.querySelector('#spell-input');
      const btn = questionArea.querySelector('#submit-spell');
      setTimeout(() => input.focus(), 80);
      const submit = () => {
        if (isAnswered) return;
        handleAnswer(input.value.trim(), feedbackArea, questionArea);
      };
      btn.addEventListener('click', submit);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); submit(); }
      });
    } else {
      const optionsHtml = q.options.map((opt, idx) => `
        <button class="option-btn" data-id="${escapeHtml(opt.id)}" data-index="${idx}" aria-label="Lựa chọn ${idx+1}: ${escapeHtml(opt.text)}">
          <span class="option-index">${idx+1}</span>
          <span style="flex:1">${escapeHtml(opt.text)}</span>
        </button>
      `).join('');
      questionArea.innerHTML = `<div class="flashcard-options" role="radiogroup">${optionsHtml}</div>`;
      questionArea.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (isAnswered) return;
          handleAnswer(btn.dataset.id, feedbackArea, questionArea);
        });
      });
    }

    container.querySelector('#fav-btn')?.addEventListener('click', () => {
      if (favorites.has(item.vocab.id)) {
        favorites.delete(item.vocab.id);
        showToast('Đã bỏ yêu thích', 'info');
      } else {
        favorites.add(item.vocab.id);
        showToast('Đã thêm vào yêu thích ⭐', 'success');
      }
      saveAll();
      renderFlashcard(container);
    });
    container.querySelector('#skip-btn')?.addEventListener('click', () => {
      const skipped = currentSession.shift();
      currentSession.push(skipped);
      nextCard();
      renderFlashcard(container);
      showToast('Đã bỏ qua, sẽ gặp lại cuối phiên', 'info');
    });

    container.dataset.hasQuestion = '1';
  }

  function handleAnswer(userAnswer, feedbackArea, questionArea) {
    if (!currentQuestion || !currentSession || isAnswered) return;
    isAnswered = true;
    const item = currentSession[0];
    const correct = checkAnswer(currentQuestion, userAnswer);
    const responseTime = Date.now() - questionStartTime;

    questionArea.querySelectorAll('button').forEach(b => b.disabled = true);
    const input = questionArea.querySelector('input');
    if (input) input.disabled = true;

    if (currentQuestion.mode !== 'spelling') {
      questionArea.querySelectorAll('.option-btn').forEach(btn => {
        const opt = currentQuestion.options.find(o => o.id === btn.dataset.id);
        if (opt?.correct) btn.classList.add('correct');
        if (btn.dataset.id === userAnswer && !correct) btn.classList.add('wrong');
      });
    }

    const newProgress = updateProgress(item.progress, correct, responseTime);
    progressMap[item.vocab.id] = newProgress;
    saveAll();

    if (correct) sessionStats.correct++; else sessionStats.wrong++;

    const vocabEntry = item.vocab;
    feedbackArea.innerHTML = `
      <div class="feedback ${correct?'correct':'wrong'}" role="alert">
        <div class="answer">${correct ? '✅ Chính xác! Tuyệt vời!' : `❌ Chưa đúng. Đáp án: <strong>${escapeHtml(currentQuestion.answer)}</strong>`}</div>
        <div class="detail">
          <div style="font-size:14px;margin:8px 0"><strong style="font-size:16px">${escapeHtml(vocabEntry.word)}</strong> <span style="background:var(--bg-muted);padding:2px 8px;border-radius:99px;font-size:11px;border:1px solid var(--border)">${escapeHtml(vocabEntry.pos)}</span> — ${escapeHtml(vocabEntry.meaning)}</div>
          ${vocabEntry.examples && vocabEntry.examples.length ? `<div style="margin-top:8px;padding:10px;background:rgba(0,0,0,0.03);border-radius:8px;border-left:3px solid var(--border-strong)"><span style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);font-weight:700">Ví dụ</span><div style="font-style:italic;margin-top:4px">${escapeHtml(vocabEntry.examples[0])}</div></div>` : ''}
          <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;font-size:11px">
            <span style="background:var(--bg-muted);padding:4px 10px;border-radius:99px;border:1px solid var(--border)">🔥 Streak: ${newProgress.streak}</span>
            <span style="background:var(--bg-muted);padding:4px 10px;border-radius:99px;border:1px solid var(--border)">⏰ Lần tới: ${formatNextReview(newProgress.nextReview)}</span>
            <span style="background:var(--bg-muted);padding:4px 10px;border-radius:99px;border:1px solid var(--border)">📊 Khó: ${Math.round(newProgress.difficulty*100)}%</span>
          </div>
        </div>
        <button class="btn btn-primary w-full mt-4" id="next-btn" style="margin-top:16px">Tiếp tục <span class="kbd" style="margin-left:8px;background:rgba(255,255,255,0.2);border-color:rgba(255,255,255,0.2);color:white">Enter</span></button>
      </div>
    `;

    feedbackArea.querySelector('#next-btn')?.addEventListener('click', () => {
      currentSession.shift();
      if (currentSession.length === 0) finishSession();
      else {
        nextCard();
        const content = document.querySelector('#content');
        if (content) renderFlashcard(content);
      }
    });

    setTimeout(() => feedbackArea.querySelector('#next-btn')?.focus(), 120);
  }

  function finishSession() {
    const total = sessionStats.total;
    const correct = sessionStats.correct;
    const wrong = sessionStats.wrong;
    const accuracy = total > 0 ? Math.round(correct/total*100) : 0;
    const durationSec = Math.round((Date.now() - sessionStats.startTime)/1000);

    history.push({
      date: new Date().toISOString(),
      total,
      correct,
      wrong,
      accuracy,
      durationSec,
      mode: sessionStats.mode
    });
    saveHistory(history);

    const content = document.querySelector('#content');
    if (!content) return;
    content.innerHTML = `
      <div style="max-width:640px;margin:0 auto;text-align:center">
        <div class="card" style="padding:36px 28px;overflow:visible">
          <div style="width:80px;height:80px;margin:0 auto 20px;background:var(--success-light);border-radius:50%;display:grid;place-items:center;font-size:40px;border:3px solid var(--success);animation:correctPop 0.6s var(--ease-spring)">🎉</div>
          <h2 style="font-size:28px;font-weight:800;letter-spacing:-0.02em;margin-bottom:8px">Hoàn thành xuất sắc!</h2>
          <p style="color:var(--text-muted);margin-bottom:24px;font-size:14px">Bạn đã học ${total} từ trong ${durationSec}s • Chế độ: ${sessionStats.mode}</p>
          <div class="dashboard-grid" style="grid-template-columns:1fr 1fr 1fr 1fr">
            <div class="dashboard-card" style="padding:16px"><h4>Chính xác</h4><div class="value" style="font-size:24px;color:${accuracy>=80?'var(--success)':accuracy>=50?'var(--warning)':'var(--danger)'}">${accuracy}%</div></div>
            <div class="dashboard-card" style="padding:16px"><h4>Đúng</h4><div class="value" style="font-size:24px;color:var(--success)">${correct}</div></div>
            <div class="dashboard-card" style="padding:16px"><h4>Sai</h4><div class="value" style="font-size:24px;color:var(--danger)">${wrong}</div></div>
            <div class="dashboard-card" style="padding:16px"><h4>Thời gian</h4><div class="value" style="font-size:24px">${durationSec}s</div></div>
          </div>
          <div style="margin-top:20px;padding:14px;background:var(--bg-muted);border-radius:var(--radius-sm);border:1px dashed var(--border);font-size:13px;color:var(--text-muted)">
            ${accuracy>=90 ? '🌟 Xuất sắc! Bạn đang làm rất tốt, hãy duy trì streak!' : accuracy>=70 ? '💪 Khá tốt! Ôn lại từ sai để cải thiện thêm nhé.' : '📚 Cố gắng! Từ yếu sẽ được ưu tiên ở phiên sau.'}
          </div>
          <div style="display:flex;gap:12px;justify-content:center;margin-top:24px;flex-wrap:wrap">
            <button class="btn btn-primary" id="continue-btn">📖 Học tiếp</button>
            <button class="btn btn-ghost" id="dashboard-btn">📊 Xem Dashboard</button>
          </div>
        </div>
      </div>
    `;
    content.querySelector('#continue-btn')?.addEventListener('click', () => {
      currentSession = null;
      currentQuestion = null;
      navigate('learn');
    });
    content.querySelector('#dashboard-btn')?.addEventListener('click', () => {
      currentSession = null;
      currentQuestion = null;
      navigate('dashboard');
    });
    currentSession = null;
    currentQuestion = null;
  }

  function renderDashboard(container) {
    const stats = calculateStats(progressMap);
    const recent = history.slice(-10).reverse();

    container.innerHTML = `
      <div class="content-header">
        <h1 class="content-title">Dashboard tiến độ</h1>
        <p class="content-subtitle">Theo dõi hành trình học tập, streak và lịch sử ôn tập của bạn</p>
      </div>
      <div class="dashboard-grid">
        <div class="dashboard-card"><h4>📚 Tổng từ</h4><div class="value">${stats.total}</div><div style="font-size:11px;color:var(--text-muted);margin-top:6px">Toàn bộ kho từ vựng</div></div>
        <div class="dashboard-card"><h4>✅ Đã học</h4><div class="value">${stats.learned}</div><div style="font-size:11px;color:var(--text-muted);margin-top:6px">${stats.total?Math.round(stats.learned/stats.total*100):0}% tổng số</div></div>
        <div class="dashboard-card"><h4>🏆 Thành thạo</h4><div class="value">${stats.mastered}</div><div style="font-size:11px;color:var(--text-muted);margin-top:6px">${stats.total?Math.round(stats.mastered/stats.total*100):0}% • ≥21 ngày</div></div>
        <div class="dashboard-card"><h4>⏰ Đến hạn</h4><div class="value" style="color:${stats.due>0?'var(--warning)':'var(--success)'}">${stats.due}</div><div style="font-size:11px;color:var(--text-muted);margin-top:6px">Cần ôn hôm nay</div></div>
        <div class="dashboard-card"><h4>⚠️ Từ yếu</h4><div class="value" style="color:var(--danger)">${stats.weak}</div><div style="font-size:11px;color:var(--text-muted);margin-top:6px">Sai nhiều, cần chú ý</div></div>
        <div class="dashboard-card"><h4>🎯 Chính xác</h4><div class="value">${stats.accuracy}%</div><div style="font-size:11px;color:var(--text-muted);margin-top:6px">${stats.correct} đúng / ${stats.wrong} sai</div></div>
        <div class="dashboard-card"><h4>🔥 Streak</h4><div class="value">🔥 ${streakData.current}</div><div style="font-size:11px;color:var(--text-muted);margin-top:6px">Ngày liên tiếp</div></div>
        <div class="dashboard-card"><h4>🏅 Dài nhất</h4><div class="value">${streakData.longest}</div><div style="font-size:11px;color:var(--text-muted);margin-top:6px">Kỷ lục cá nhân</div></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
        <div class="card">
          <div class="card-header"><h3>📈 Phân bố trạng thái</h3></div>
          <div class="card-padding">
            <div style="display:flex;gap:4px;height:28px;border-radius:99px;overflow:hidden;background:var(--bg-muted);border:1px solid var(--border);padding:3px">
              <div style="flex:${stats.new||0.5};background:#94a3b8;border-radius:99px;transition:all 0.5s" title="New: ${stats.new}"></div>
              <div style="flex:${stats.learning||0.5};background:#fbbf24;border-radius:99px;transition:all 0.5s" title="Learning: ${stats.learning}"></div>
              <div style="flex:${stats.weak||0.5};background:#f87171;border-radius:99px;transition:all 0.5s" title="Weak: ${stats.weak}"></div>
              <div style="flex:${stats.review||0.5};background:#60a5fa;border-radius:99px;transition:all 0.5s" title="Review: ${stats.review}"></div>
              <div style="flex:${stats.mastered||0.5};background:#4ade80;border-radius:99px;transition:all 0.5s" title="Mastered: ${stats.mastered}"></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px;font-size:11px">
              <div style="display:flex;align-items:center;gap:8px"><span style="width:10px;height:10px;background:#94a3b8;border-radius:50%"></span>New ${stats.new}</div>
              <div style="display:flex;align-items:center;gap:8px"><span style="width:10px;height:10px;background:#fbbf24;border-radius:50%"></span>Learning ${stats.learning}</div>
              <div style="display:flex;align-items:center;gap:8px"><span style="width:10px;height:10px;background:#f87171;border-radius:50%"></span>Weak ${stats.weak}</div>
              <div style="display:flex;align-items:center;gap:8px"><span style="width:10px;height:10px;background:#60a5fa;border-radius:50%"></span>Review ${stats.review}</div>
              <div style="display:flex;align-items:center;gap:8px"><span style="width:10px;height:10px;background:#4ade80;border-radius:50%"></span>Mastered ${stats.mastered}</div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>📅 Lịch sử học</h3><span style="font-size:11px;color:var(--text-muted)">${history.length} phiên</span></div>
          <div class="card-padding" style="max-height:240px;overflow:auto">
            ${recent.length===0 ? `<div class="empty-state" style="padding:24px"><div class="empty-state-icon">📭</div><h3>Chưa có phiên học</h3><p>Bắt đầu học để xem lịch sử ở đây</p></div>` : `
              <div style="display:grid;gap:10px">
                ${recent.map(h => `
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--bg-muted);border-radius:10px;border:1px solid var(--border)">
                    <div><div style="font-weight:600;font-size:13px">${new Date(h.date).toLocaleDateString('vi-VN')} • ${h.mode} • ${h.total} từ</div><div style="font-size:11px;color:var(--text-muted)">${new Date(h.date).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})} • ${h.durationSec}s</div></div>
                    <span style="font-weight:800;font-size:13px;padding:4px 10px;border-radius:99px;background:${h.accuracy>=80?'var(--success-light)':h.accuracy>=50?'var(--warning-light)':'var(--danger-light)'};color:${h.accuracy>=80?'var(--success)':h.accuracy>=50?'var(--warning)':'var(--danger)'};border:1px solid ${h.accuracy>=80?'rgba(5,150,105,0.2)':h.accuracy>=50?'rgba(217,119,6,0.2)':'rgba(220,38,38,0.2)'}">${h.accuracy}%</span>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }

  function renderSearch(container) {
    container.innerHTML = `
      <div class="content-header">
        <h1 class="content-title">Tra cứu từ vựng</h1>
        <p class="content-subtitle">Tìm kiếm nhanh theo tiếng Anh, tiếng Việt, POS, tag, trạng thái học • ${vocab.length} từ</p>
      </div>
      <div class="search-bar">
        <input type="text" id="search-input" class="search-input" placeholder="Tìm từ, nghĩa, ví dụ... (VD: meticulous, tỉ mỉ)" aria-label="Tìm kiếm từ vựng" />
        <button class="btn btn-ghost" id="clear-search">✕ Xóa</button>
      </div>
      <div class="filters">
        <select id="filter-state" class="filter-select" aria-label="Lọc theo trạng thái">
          <option value="all">📚 Tất cả trạng thái</option>
          <option value="new">🆕 New</option>
          <option value="learning">📖 Learning</option>
          <option value="weak">⚠️ Weak</option>
          <option value="review">🔄 Review</option>
          <option value="mastered">🏆 Mastered</option>
          <option value="due">⏰ Đến hạn</option>
          <option value="favorites">⭐ Yêu thích</option>
        </select>
        <select id="filter-sort" class="filter-select" aria-label="Sắp xếp">
          <option value="az">🔤 A → Z</option>
          <option value="za">🔤 Z → A</option>
          <option value="difficulty">🔥 Độ khó</option>
          <option value="newest">🆕 Mới nhất</option>
          <option value="mostWrong">❌ Sai nhiều nhất</option>
          <option value="dueSoon">⏰ Đến hạn sớm</option>
        </select>
        <select id="filter-pos" class="filter-select" aria-label="Lọc theo từ loại">
          <option value="all">🏷️ Tất cả POS</option>
          <option value="n">n - danh từ</option>
          <option value="v">v - động từ</option>
          <option value="adj">adj - tính từ</option>
          <option value="adv">adv - trạng từ</option>
          <option value="phrase">phrase</option>
          <option value="collocation">collocation</option>
        </select>
      </div>
      <div id="search-results" class="vocab-list"></div>
      <div id="search-pagination" style="margin-top:20px;display:flex;justify-content:center;gap:8px;flex-wrap:wrap"></div>
      <div id="word-modal" class="hidden"></div>
    `;

    const input = container.querySelector('#search-input');
    const stateSel = container.querySelector('#filter-state');
    const sortSel = container.querySelector('#filter-sort');
    const posSel = container.querySelector('#filter-pos');
    const resultsDiv = container.querySelector('#search-results');
    const paginationDiv = container.querySelector('#search-pagination');
    const modalDiv = container.querySelector('#word-modal');
    let currentPage = 1;
    const pageSize = 50;
    let currentResults = [];

    function doSearch() {
      const q = input.value;
      const filters = { state: stateSel.value, pos: posSel.value };
      let res = search(searchIndex, q, filters);
      res = sortResults(res, sortSel.value);
      currentResults = res;
      currentPage = 1;
      renderResults();
    }

    function renderResults() {
      const total = currentResults.length;
      const totalPages = Math.ceil(total / pageSize);
      const start = (currentPage - 1) * pageSize;
      const pageItems = currentResults.slice(start, start + pageSize);

      if (total === 0) {
        resultsDiv.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔍</div><h3>Không tìm thấy kết quả</h3><p>Thử từ khóa khác hoặc đổi bộ lọc</p></div>`;
        paginationDiv.innerHTML = '';
        return;
      }

      resultsDiv.innerHTML = `
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;display:flex;justify-content:space-between;align-items:center">
          <span>📊 ${total} kết quả • Trang ${currentPage}/${totalPages}</span>
          <span>Hiển thị ${pageItems.length} từ</span>
        </div>
        ${pageItems.map(item => `
          <div class="vocab-item" data-id="${item.id}" role="button" tabindex="0" aria-label="Xem chi tiết ${escapeHtml(item.word)}">
            <span class="vocab-word">${escapeHtml(item.word)}</span>
            <span class="vocab-pos">${escapeHtml(item.entry.pos)}</span>
            <span class="vocab-meaning" title="${escapeHtml(item.entry.meaning)}">${escapeHtml(item.entry.meaning)}</span>
            <span class="vocab-state state-${item.state}">${item.state}</span>
            <button class="fav-btn ${item.fav?'active':''}" data-fav="${item.id}" aria-label="${item.fav?'Bỏ yêu thích':'Yêu thích'}">${item.fav?'★':'☆'}</button>
          </div>
        `).join('')}
      `;

      if (totalPages > 1) {
        let pagHtml = '';
        const maxShow = 7;
        let startPage = Math.max(1, currentPage - Math.floor(maxShow/2));
        let endPage = Math.min(totalPages, startPage + maxShow - 1);
        if (endPage - startPage + 1 < maxShow) startPage = Math.max(1, endPage - maxShow + 1);
        if (startPage > 1) pagHtml += `<button class="btn btn-ghost btn-sm" data-page="1">1</button><span style="padding:6px">...</span>`;
        for (let i = startPage; i <= endPage; i++) {
          pagHtml += `<button class="btn ${i===currentPage?'btn-primary':'btn-ghost'} btn-sm" data-page="${i}">${i}</button>`;
        }
        if (endPage < totalPages) pagHtml += `<span style="padding:6px">...</span><button class="btn btn-ghost btn-sm" data-page="${totalPages}">${totalPages}</button>`;
        paginationDiv.innerHTML = pagHtml;
        paginationDiv.querySelectorAll('[data-page]').forEach(b => {
          b.addEventListener('click', () => { currentPage = parseInt(b.dataset.page); renderResults(); window.scrollTo({top:0,behavior:'smooth'}); });
        });
      } else {
        paginationDiv.innerHTML = '';
      }

      resultsDiv.querySelectorAll('[data-fav]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.dataset.fav;
          if (favorites.has(id)) {
            favorites.delete(id);
            showToast('Đã bỏ yêu thích', 'info');
          } else {
            favorites.add(id);
            showToast('Đã thêm yêu thích ⭐', 'success');
          }
          saveAll();
          doSearch();
        });
      });

      resultsDiv.querySelectorAll('.vocab-item').forEach(el => {
        const showDetail = () => showWordDetail(el.dataset.id);
        el.addEventListener('click', (e) => {
          if (e.target.closest('[data-fav]')) return;
          showDetail();
        });
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showDetail(); }
        });
      });
    }

    function showWordDetail(id) {
      const entry = vocab.find(v => v.id === id);
      const prog = progressMap[id];
      if (!entry) return;
      const isFav = favorites.has(id);
      modalDiv.innerHTML = `
        <div class="modal-overlay" id="modal-overlay">
          <div class="modal" role="dialog" aria-modal="true" aria-label="Chi tiết từ ${escapeHtml(entry.word)}">
            <div class="modal-header">
              <h3 style="font-weight:800;font-size:16px">${escapeHtml(entry.word)} <span style="font-weight:500;color:var(--text-muted);font-size:12px">${escapeHtml(entry.pos)}</span></h3>
              <button class="btn btn-ghost btn-sm" id="close-modal" aria-label="Đóng">✕</button>
            </div>
            <div class="modal-body">
              <div style="font-size:14px;margin-bottom:16px"><strong>Nghĩa:</strong> ${escapeHtml(entry.meaning)}</div>
              ${entry.examples && entry.examples.length ? `<div style="margin-bottom:16px"><div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);font-weight:700;margin-bottom:6px">Ví dụ</div><div style="font-style:italic;background:var(--bg-muted);padding:12px;border-radius:10px;border:1px solid var(--border)">${escapeHtml(entry.examples[0])}</div></div>` : '<div style="font-size:12px;color:var(--text-light);margin-bottom:16px">Chưa có ví dụ</div>'}
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
                <div style="background:var(--bg-muted);padding:10px;border-radius:10px;border:1px solid var(--border)"><div style="font-size:10px;text-transform:uppercase;color:var(--text-muted);font-weight:700">Trạng thái</div><div style="font-weight:700;margin-top:2px"><span class="vocab-state state-${prog?.state||'new'}">${prog?.state||'new'}</span></div></div>
                <div style="background:var(--bg-muted);padding:10px;border-radius:10px;border:1px solid var(--border)"><div style="font-size:10px;text-transform:uppercase;color:var(--text-muted);font-weight:700">Độ khó</div><div style="font-weight:700;margin-top:2px">${Math.round((prog?.difficulty||0)*100)}%</div></div>
                <div style="background:var(--bg-muted);padding:10px;border-radius:10px;border:1px solid var(--border)"><div style="font-size:10px;text-transform:uppercase;color:var(--text-muted);font-weight:700">Đúng / Sai</div><div style="font-weight:700;margin-top:2px">${prog?.correctCount||0} / ${prog?.wrongCount||0}</div></div>
                <div style="background:var(--bg-muted);padding:10px;border-radius:10px;border:1px solid var(--border)"><div style="font-size:10px;text-transform:uppercase;color:var(--text-muted);font-weight:700">Streak</div><div style="font-weight:700;margin-top:2px">${prog?.streak||0}</div></div>
              </div>
              <div style="display:flex;gap:10px">
                <button class="btn ${isFav?'btn-ghost':'btn-primary'} flex-1" id="modal-fav" style="flex:1">${isFav?'☆ Bỏ yêu thích':'★ Yêu thích'}</button>
                <button class="btn btn-ghost" id="modal-study" style="flex:1">📖 Học từ này</button>
              </div>
            </div>
          </div>
        </div>
      `;
      modalDiv.classList.remove('hidden');
      const close = () => { modalDiv.classList.add('hidden'); modalDiv.innerHTML = ''; };
      modalDiv.querySelector('#close-modal')?.addEventListener('click', close);
      modalDiv.querySelector('#modal-overlay')?.addEventListener('click', (e) => { if (e.target.id === 'modal-overlay') close(); });
      modalDiv.querySelector('#modal-fav')?.addEventListener('click', () => {
        if (favorites.has(id)) favorites.delete(id); else favorites.add(id);
        saveAll();
        doSearch();
        close();
        showToast(favorites.has(id) ? 'Đã thêm yêu thích ⭐' : 'Đã bỏ yêu thích', 'success');
      });
      modalDiv.querySelector('#modal-study')?.addEventListener('click', () => {
        close();
        const singleSession = [{ vocab: entry, progress: progressMap[id] }];
        currentSession = singleSession;
        sessionStats = { correct: 0, wrong: 0, startTime: Date.now(), total: 1, mode: 'single' };
        nextCard();
        navigate('learn');
      });
      document.addEventListener('keydown', function esc(e) {
        if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
      });
    }

    input.addEventListener('input', debounce(doSearch, 180));
    stateSel.addEventListener('change', doSearch);
    sortSel.addEventListener('change', doSearch);
    posSel.addEventListener('change', doSearch);
    container.querySelector('#clear-search').addEventListener('click', () => { input.value=''; doSearch(); input.focus(); });

    doSearch();
    setTimeout(() => input.focus(), 100);
  }

  function renderSettings(container) {
    container.innerHTML = `
      <div class="content-header">
        <h1 class="content-title">Cài đặt & Dữ liệu</h1>
        <p class="content-subtitle">Quản lý tiến trình học, backup và tùy chọn cá nhân</p>
      </div>
      <div style="display:grid;gap:18px;max-width:720px">
        <div class="card">
          <div class="card-header"><h3>💾 Dữ liệu học tập</h3><span style="font-size:11px;background:var(--bg-muted);padding:4px 10px;border-radius:99px;border:1px solid var(--border)">${Object.keys(progressMap).length} từ đã khởi tạo</span></div>
          <div class="card-padding">
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
              <button class="btn btn-ghost" id="export-btn">⤓ Export progress</button>
              <label class="btn btn-ghost" style="cursor:pointer">
                ⤒ Import progress
                <input type="file" id="import-file" accept=".json" style="display:none" />
              </label>
              <button class="btn btn-ghost" id="reset-btn" style="color:var(--danger);border-color:rgba(220,38,38,0.2);background:var(--danger-light)">🗑️ Reset tất cả</button>
            </div>
            <div style="background:var(--bg-muted);padding:12px;border-radius:10px;border:1px dashed var(--border);font-size:12px;color:var(--text-muted);line-height:1.5">
              <div>• <strong>Export:</strong> Tải file JSON chứa toàn bộ tiến trình, yêu thích, streak, lịch sử</div>
              <div>• <strong>Import:</strong> Khôi phục từ file backup, sẽ ghi đè dữ liệu hiện tại sau khi validate</div>
              <div>• <strong>Reset:</strong> Xóa toàn bộ localStorage, không thể hoàn tác</div>
              <div style="margin-top:6px">Dữ liệu lưu trong <code style="background:var(--bg-card);padding:2px 6px;border-radius:4px;border:1px solid var(--border)">localStorage</code> trình duyệt, không gửi lên server</div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>🎨 Tùy chọn giao diện</h3></div>
          <div class="card-padding">
            <div style="display:grid;gap:16px">
              <label style="display:flex;justify-content:space-between;align-items:center;font-size:14px;font-weight:500;cursor:pointer">
                <span style="display:flex;align-items:center;gap:10px"><span style="width:32px;height:32px;background:var(--bg-muted);border-radius:8px;display:grid;place-items:center">🌓</span> Dark mode</span>
                <input type="checkbox" id="opt-dark" ${prefs.darkMode?'checked':''} style="width:20px;height:20px;accent-color:var(--primary)" />
              </label>
              <label style="display:flex;justify-content:space-between;align-items:center;font-size:14px;font-weight:500;cursor:pointer">
                <span style="display:flex;align-items:center;gap:10px"><span style="width:32px;height:32px;background:var(--bg-muted);border-radius:8px;display:grid;place-items:center">⌨️</span> Phím tắt bàn phím</span>
                <input type="checkbox" id="opt-kb" ${prefs.keyboardShortcuts?'checked':''} style="width:20px;height:20px;accent-color:var(--primary)" />
              </label>
              <label style="display:flex;justify-content:space-between;align-items:center;font-size:14px;font-weight:500">
                <span style="display:flex;align-items:center;gap:10px"><span style="width:32px;height:32px;background:var(--bg-muted);border-radius:8px;display:grid;place-items:center">📊</span> Số từ mỗi phiên</span>
                <select id="opt-size" class="filter-select" style="min-width:100px">
                  <option value="10" ${prefs.sessionSize==10?'selected':''}>10 từ</option>
                  <option value="20" ${prefs.sessionSize==20?'selected':''}>20 từ</option>
                  <option value="30" ${prefs.sessionSize==30?'selected':''}>30 từ</option>
                  <option value="50" ${prefs.sessionSize==50?'selected':''}>50 từ</option>
                </select>
              </label>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>ℹ️ Thông tin hệ thống</h3></div>
          <div class="card-padding">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px">
              <div style="background:var(--bg-muted);padding:12px;border-radius:10px;border:1px solid var(--border)"><div style="font-size:10px;text-transform:uppercase;color:var(--text-muted);font-weight:700">Tổng từ</div><div style="font-weight:800;font-size:16px;margin-top:2px">${vocab.length}</div></div>
              <div style="background:var(--bg-muted);padding:12px;border-radius:10px;border:1px solid var(--border)"><div style="font-size:10px;text-transform:uppercase;color:var(--text-muted);font-weight:700">Data updated</div><div style="font-weight:700;margin-top:2px">${meta?.updated || 'local'}</div></div>
              <div style="background:var(--bg-muted);padding:12px;border-radius:10px;border:1px solid var(--border)"><div style="font-size:10px;text-transform:uppercase;color:var(--text-muted);font-weight:700">Commit</div><div style="font-weight:700;font-family:var(--font-mono);font-size:12px;margin-top:2px">${meta?.commit || 'dev'}</div></div>
              <div style="background:var(--bg-muted);padding:12px;border-radius:10px;border:1px solid var(--border)"><div style="font-size:10px;text-transform:uppercase;color:var(--text-muted);font-weight:700">Build time</div><div style="font-weight:500;font-size:11px;margin-top:2px">${meta?.buildTime ? new Date(meta.buildTime).toLocaleString('vi-VN') : 'local'}</div></div>
            </div>
            <div style="margin-top:14px;padding:12px;background:var(--primary-light);border-radius:10px;border:1px solid rgba(79,70,229,0.15);font-size:12px;color:var(--text-muted)">
              <div style="font-weight:700;color:var(--text);margin-bottom:4px">📂 Source of truth: <code>data/vocabulary.json</code></div>
              Thêm từ mới vào file này, merge PR vào main → GitHub Actions tự validate → build → deploy. Không cần sửa code frontend.
            </div>
          </div>
        </div>
      </div>
    `;

    container.querySelector('#export-btn')?.addEventListener('click', () => {
      const data = exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `flashcard-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Đã xuất backup', 'success');
    });
    container.querySelector('#import-file')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        importAll(json);
        progressMap = ensureProgress(loadProgress(), vocab);
        favorites = loadFavorites();
        history = loadHistory();
        streakData = loadStreak();
        prefs = loadPrefs();
        saveAll();
        showToast('Import thành công! Đã khôi phục tiến trình', 'success');
        renderShell();
      } catch (err) {
        showToast('Import lỗi: ' + err.message, 'error');
      }
    });
    container.querySelector('#reset-btn')?.addEventListener('click', () => {
      if (confirm('⚠️ Xóa toàn bộ tiến trình học? Hành động này không thể hoàn tác!\n\nBạn nên Export backup trước khi reset.')) {
        if (confirm('Xác nhận lần 2: Bạn chắc chắn muốn reset?')) {
          localStorage.clear();
          progressMap = ensureProgress({}, vocab);
          favorites = new Set();
          history = [];
          streakData = { current:0, longest:0, lastDate:null };
          prefs = { ...prefs, sessionSize:20 };
          saveAll();
          showToast('Đã reset toàn bộ dữ liệu', 'success');
          renderShell();
        }
      }
    });
    container.querySelector('#opt-dark')?.addEventListener('change', (e) => {
      prefs.darkMode = e.target.checked;
      savePrefs(prefs);
      applyTheme();
      showToast(prefs.darkMode ? 'Dark mode ON 🌙' : 'Light mode ON ☀️', 'success');
    });
    container.querySelector('#opt-kb')?.addEventListener('change', (e) => {
      prefs.keyboardShortcuts = e.target.checked;
      savePrefs(prefs);
      showToast(prefs.keyboardShortcuts ? 'Đã bật phím tắt ⌨️' : 'Đã tắt phím tắt', 'info');
    });
    container.querySelector('#opt-size')?.addEventListener('change', (e) => {
      prefs.sessionSize = parseInt(e.target.value,10);
      savePrefs(prefs);
      showToast(`Đặt ${prefs.sessionSize} từ/phiên`, 'success');
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }
  function formatNextReview(ts) {
    if (!ts) return 'ngay bây giờ';
    const diff = ts - Date.now();
    if (diff <= 0) return 'đến hạn';
    const hours = Math.round(diff/3600000);
    if (hours < 1) return 'vài phút nữa';
    if (hours < 24) return `${hours} giờ nữa`;
    const days = Math.round(hours/24);
    return `${days} ngày nữa`;
  }
  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  document.addEventListener('keydown', (e) => {
    if (!prefs.keyboardShortcuts) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    const content = document.querySelector('#content');
    if (!content) return;
    if (currentView === 'learn' && currentSession && currentQuestion) {
      if (e.key >= '1' && e.key <= '4') {
        const idx = parseInt(e.key,10)-1;
        const btns = content.querySelectorAll('.option-btn');
        if (btns[idx] && !btns[idx].disabled) btns[idx].click();
      } else if (e.key === 'Enter') {
        const nextBtn = content.querySelector('#next-btn');
        if (nextBtn) nextBtn.click();
        else {
          const spellBtn = content.querySelector('#submit-spell');
          if (spellBtn && !spellBtn.disabled) spellBtn.click();
        }
      } else if (e.key.toLowerCase() === 'n') {
        const skip = content.querySelector('#skip-btn');
        if (skip) skip.click();
      } else if (e.key.toLowerCase() === 'f') {
        const fav = content.querySelector('#fav-btn');
        if (fav) fav.click();
      } else if (e.key === ' ') {
        e.preventDefault();
        const nextBtn = content.querySelector('#next-btn');
        if (nextBtn) nextBtn.click();
      }
    }
  });

  renderShell();
}
