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

  // Load data
  try {
    const [v, m] = await Promise.all([loadVocabulary(), loadMeta()]);
    vocab = v;
    meta = m;
  } catch (e) {
    root.innerHTML = `
      <div class="app-shell">
        <div style="max-width:600px;margin:80px auto;padding:24px;text-align:center">
          <h2 style="margin-bottom:12px">Không thể tải dữ liệu từ vựng</h2>
          <p style="color:var(--text-muted);margin-bottom:20px">${e.message}</p>
          <button class="btn btn-primary" onclick="location.reload()">Thử tải lại trang</button>
          <p style="margin-top:20px;font-size:12px;color:var(--text-light)">Kiểm tra file data/vocabulary.json tồn tại</p>
        </div>
      </div>`;
    console.error(e);
    return;
  }

  progressMap = ensureProgress(loadProgress(), vocab);
  saveProgress(progressMap);
  searchIndex = createSearchIndex(vocab, progressMap, favorites);

  // Theme
  function applyTheme() {
    const theme = prefs.darkMode ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
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

  // Streak logic
  function updateStreak() {
    const today = new Date().toISOString().split('T')[0];
    if (streakData.lastDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      if (streakData.lastDate === yesterday) {
        streakData.current += 1;
      } else if (streakData.lastDate !== today) {
        // If not consecutive, reset to 1 if first session today, else keep?
        // Only increment if there's activity today
        if (!streakData.lastDate) streakData.current = 1;
        else {
          const last = new Date(streakData.lastDate);
          const now = new Date(today);
          const diffDays = Math.floor((now - last) / 86400000);
          if (diffDays === 1) streakData.current += 1;
          else if (diffDays > 1) streakData.current = 1;
        }
      }
      streakData.lastDate = today;
      streakData.longest = Math.max(streakData.longest, streakData.current);
      saveStreak(streakData);
    }
  }

  // Toast
  function showToast(msg, type = 'info') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.className = 'toast';
    div.style.cssText = `position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--bg-card);border:1px solid var(--border);padding:10px 16px;border-radius:8px;box-shadow:var(--shadow-lg);font-size:13px;z-index:100;display:flex;gap:8px;align-items:center`;
    div.textContent = msg;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
  }

  // Render shell
  function renderShell() {
    const stats = calculateStats(progressMap);
    root.innerHTML = `
      <div class="app-shell">
        <header class="header">
          <div class="header-inner">
            <a class="logo" href="#" onclick="event.preventDefault(); navigate('learn')">
              <span class="logo-icon">A</span>
              <span>Chuyên Anh</span>
            </a>
            <div class="header-meta">
              <span title="Tổng từ vựng">${meta ? `${meta.count || vocab.length} từ` : `${vocab.length} từ`}</span>
              <span>•</span>
              <span title="Due today">${stats.due} đến hạn</span>
              <span>•</span>
              <span title="Streak">🔥 ${streakData.current}</span>
            </div>
            <div class="header-actions">
              <button class="btn btn-ghost btn-sm" id="btn-theme" title="Đổi theme">🌓</button>
              <button class="btn btn-ghost btn-sm" id="btn-export" title="Export">⤓</button>
            </div>
          </div>
        </header>
        <div class="main">
          <aside class="sidebar">
            <div class="card">
              <div class="card-padding">
                <nav class="nav" id="nav">
                  <button class="nav-btn ${currentView==='learn'?'active':''}" data-view="learn">
                    <span>📖</span> Học
                    <span class="badge">${stats.due}</span>
                  </button>
                  <button class="nav-btn ${currentView==='dashboard'?'active':''}" data-view="dashboard">
                    <span>📊</span> Dashboard
                  </button>
                  <button class="nav-btn ${currentView==='search'?'active':''}" data-view="search">
                    <span>🔍</span> Tra cứu
                    <span class="badge">${vocab.length}</span>
                  </button>
                  <button class="nav-btn ${currentView==='settings'?'active':''}" data-view="settings">
                    <span>⚙️</span> Cài đặt
                  </button>
                </nav>
              </div>
            </div>
            <div class="card">
              <div class="card-padding">
                <h4 style="font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);margin-bottom:10px">Tiến độ</h4>
                <div class="stats-grid">
                  <div class="stat"><div class="stat-value">${stats.total}</div><div class="stat-label">Tổng</div></div>
                  <div class="stat"><div class="stat-value">${stats.mastered}</div><div class="stat-label">Thành thạo</div></div>
                  <div class="stat"><div class="stat-value">${stats.learning + stats.review}</div><div class="stat-label">Đang học</div></div>
                  <div class="stat"><div class="stat-value">${stats.weak}</div><div class="stat-label">Từ yếu</div></div>
                </div>
                <div style="margin-top:12px">
                  <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);margin-bottom:4px">
                    <span>Độ chính xác</span><span>${stats.accuracy}%</span>
                  </div>
                  <div style="height:6px;background:var(--bg-muted);border-radius:3px;overflow:hidden">
                    <div style="height:100%;width:${stats.accuracy}%;background:var(--primary);border-radius:3px"></div>
                  </div>
                </div>
              </div>
            </div>
            <div class="card">
              <div class="card-padding">
                <h4 style="font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);margin-bottom:8px">Phím tắt</h4>
                <div style="font-size:12px;color:var(--text-muted);display:grid;gap:4px">
                  <div><span class="kbd">1-4</span> Chọn đáp án</div>
                  <div><span class="kbd">Enter</span> Xác nhận / Tiếp</div>
                  <div><span class="kbd">Space</span> Lật thẻ</div>
                  <div><span class="kbd">N</span> Bỏ qua</div>
                  <div><span class="kbd">F</span> Yêu thích</div>
                </div>
              </div>
            </div>
          </aside>
          <main class="content" id="content"></main>
        </div>
        <footer class="footer">
          <div>Vocabulary: ${vocab.length} words • Data updated: ${meta?.updated || 'local'} • Build: ${meta?.commit || 'dev'}</div>
          <div style="margin-top:4px">Frontend-only • localStorage • Spaced repetition • Active recall</div>
        </footer>
      </div>
    `;

    // Attach nav
    root.querySelectorAll('[data-view]').forEach(btn => {
      btn.addEventListener('click', () => navigate(btn.dataset.view));
    });
    root.querySelector('#btn-theme')?.addEventListener('click', () => {
      prefs.darkMode = !prefs.darkMode;
      savePrefs(prefs);
      applyTheme();
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
    });

    renderContent();
  }

  function navigate(view) {
    currentView = view;
    // Re-render shell nav active states quickly
    root.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
    renderContent();
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
        <h1 class="content-title">Học từ vựng</h1>
        <p class="content-subtitle">Chọn phiên học phù hợp. Hệ thống ưu tiên từ yếu và đến hạn để tối ưu ghi nhớ lâu dài.</p>
      </div>
      <div class="session-options">
        <button class="session-card" data-session="due">
          <h4>📅 Đến hạn hôm nay</h4>
          <p>Ôn từ đã đến lúc cần nhớ lại</p>
          <div class="count">${dueCount} từ</div>
        </button>
        <button class="session-card" data-session="weak">
          <h4>⚠️ Từ yếu</h4>
          <p>Tập trung vào từ hay sai</p>
          <div class="count">${weakCount} từ</div>
        </button>
        <button class="session-card" data-session="new">
          <h4>🆕 Từ mới</h4>
          <p>Học từ chưa từng gặp</p>
          <div class="count">${newCount} từ</div>
        </button>
        <button class="session-card" data-session="random">
          <h4>🎲 Ngẫu nhiên</h4>
          <p>Ôn tập đa dạng, interleaving</p>
          <div class="count">${vocab.length} từ</div>
        </button>
        <button class="session-card" data-session="favorites">
          <h4>⭐ Yêu thích</h4>
          <p>Ôn từ đã đánh dấu</p>
          <div class="count">${favCount} từ</div>
        </button>
        <button class="session-card" data-session="quick10">
          <h4>⚡ Nhanh 10 từ</h4>
          <p>Phiên học ngắn, hiệu quả</p>
          <div class="count">10 từ</div>
        </button>
        <button class="session-card" data-session="quick20">
          <h4>⚡ 20 từ</h4>
          <p>Cân bằng thời gian & hiệu quả</p>
          <div class="count">20 từ</div>
        </button>
        <button class="session-card" data-session="quick30">
          <h4>📚 30 từ</h4>
          <p>Phiên học sâu</p>
          <div class="count">30 từ</div>
        </button>
      </div>
      <div class="card card-padding">
        <h3 style="font-size:14px;margin-bottom:8px">Gợi ý học tập</h3>
        <ul style="font-size:13px;color:var(--text-muted);padding-left:18px;display:grid;gap:4px">
          <li><strong>Active recall:</strong> Cố gắng nhớ trước khi chọn đáp án</li>
          <li><strong>Spaced repetition:</strong> Từ sai sẽ xuất hiện lại sớm hơn</li>
          <li><strong>Interleaving:</strong> Các loại từ được trộn lẫn để tăng khả năng phân biệt</li>
          <li><strong>Feedback ngay:</strong> Sau mỗi câu, xem lại nghĩa và ví dụ</li>
        </ul>
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
      showToast('Không có từ nào cho phiên này', 'info');
      return;
    }
    currentSession = session;
    sessionStats = { correct: 0, wrong: 0, startTime: Date.now(), total: session.length, mode };
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
        <div class="progress-bar"><div class="progress-fill" style="width:${percent}%"></div></div>
        <div class="flashcard">
          <div class="flashcard-header">
            <span>${done+1} / ${total} • ${remaining} còn lại</span>
            <div style="display:flex;gap:8px;align-items:center">
              <span class="vocab-state state-${progress.state}">${progress.state}</span>
              <button class="fav-btn ${isFav?'active':''}" id="fav-btn" title="Yêu thích">${isFav?'★':'☆'}</button>
              <button class="btn btn-ghost btn-sm" id="skip-btn" title="Bỏ qua (N)">Bỏ qua</button>
            </div>
          </div>
          <div class="flashcard-body">
            <div class="flashcard-mode">${q.mode} • ${item.vocab.pos}</div>
            <div class="flashcard-prompt">${escapeHtml(q.prompt)}</div>
            ${q.subPrompt ? `<div class="flashcard-sub">${escapeHtml(q.subPrompt)}</div>` : ''}
            <div id="question-area"></div>
            <div id="feedback-area"></div>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:12px;font-size:12px;color:var(--text-muted)">
          <span>Độ khó: ${Math.round((progress.difficulty||0)*100)}% • Sai: ${progress.wrongCount} • Đúng: ${progress.correctCount}</span>
          <span>Nhấn <span class="kbd">1-4</span> để chọn</span>
        </div>
      </div>
    `;

    const questionArea = container.querySelector('#question-area');
    const feedbackArea = container.querySelector('#feedback-area');

    if (q.mode === 'spelling') {
      questionArea.innerHTML = `
        <div class="spelling-input">
          <input type="text" id="spell-input" placeholder="Gõ từ tiếng Anh..." autocomplete="off" spellcheck="false" />
          <button class="btn btn-primary" id="submit-spell">Xác nhận</button>
        </div>
        ${q.hint ? `<div style="font-size:12px;color:var(--text-light);margin-top:6px">Gợi ý: ${escapeHtml(q.hint)}</div>` : ''}
      `;
      const input = questionArea.querySelector('#spell-input');
      const btn = questionArea.querySelector('#submit-spell');
      setTimeout(() => input.focus(), 50);
      const submit = () => handleAnswer(input.value.trim(), feedbackArea, questionArea);
      btn.addEventListener('click', submit);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); submit(); }
      });
    } else {
      // Multiple choice
      const optionsHtml = q.options.map((opt, idx) => `
        <button class="option-btn" data-id="${escapeHtml(opt.id)}" data-index="${idx}">
          <span class="option-index">${idx+1}</span>
          <span>${escapeHtml(opt.text)}</span>
        </button>
      `).join('');
      questionArea.innerHTML = `<div class="flashcard-options">${optionsHtml}</div>`;
      questionArea.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', () => handleAnswer(btn.dataset.id, feedbackArea, questionArea));
      });
    }

    container.querySelector('#fav-btn')?.addEventListener('click', () => {
      if (favorites.has(item.vocab.id)) favorites.delete(item.vocab.id);
      else favorites.add(item.vocab.id);
      saveAll();
      renderFlashcard(container);
    });
    container.querySelector('#skip-btn')?.addEventListener('click', () => {
      // Move current to end
      const skipped = currentSession.shift();
      currentSession.push(skipped);
      nextCard();
      renderFlashcard(container);
    });

    // Keyboard handling is global, but we set flag
    container.dataset.hasQuestion = '1';
  }

  function handleAnswer(userAnswer, feedbackArea, questionArea) {
    if (!currentQuestion || !currentSession) return;
    const item = currentSession[0];
    const correct = checkAnswer(currentQuestion, userAnswer);
    const responseTime = Date.now() - questionStartTime;

    // Disable options
    questionArea.querySelectorAll('button').forEach(b => b.disabled = true);
    const input = questionArea.querySelector('input');
    if (input) input.disabled = true;

    // Highlight correct/wrong
    if (currentQuestion.mode !== 'spelling') {
      questionArea.querySelectorAll('.option-btn').forEach(btn => {
        const opt = currentQuestion.options.find(o => o.id === btn.dataset.id);
        if (opt?.correct) btn.classList.add('correct');
        if (btn.dataset.id === userAnswer && !correct) btn.classList.add('wrong');
      });
    }

    // Update progress
    const newProgress = updateProgress(item.progress, correct, responseTime);
    progressMap[item.vocab.id] = newProgress;
    saveAll();

    if (correct) sessionStats.correct++; else sessionStats.wrong++;

    // Feedback
    const vocab = item.vocab;
    feedbackArea.innerHTML = `
      <div class="feedback ${correct?'correct':'wrong'}">
        <div class="answer">${correct ? '✓ Chính xác!' : `✗ Sai. Đáp án: ${escapeHtml(currentQuestion.answer)}`}</div>
        <div class="detail">
          <div><strong>${escapeHtml(vocab.word)}</strong> (${escapeHtml(vocab.pos)}) — ${escapeHtml(vocab.meaning)}</div>
          ${vocab.examples && vocab.examples.length ? `<div style="margin-top:6px;font-style:italic">VD: ${escapeHtml(vocab.examples[0])}</div>` : ''}
          <div style="margin-top:8px;display:flex;gap:8px">
            <span>Streak: ${newProgress.streak}</span>
            <span>•</span>
            <span>Lần tới: ${formatNextReview(newProgress.nextReview)}</span>
          </div>
        </div>
        <button class="btn btn-primary w-full mt-4" id="next-btn">Tiếp tục <span class="kbd" style="margin-left:8px">Enter</span></button>
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

    // Auto focus next button for keyboard
    setTimeout(() => feedbackArea.querySelector('#next-btn')?.focus(), 100);
  }

  function finishSession() {
    const total = sessionStats.total;
    const correct = sessionStats.correct;
    const wrong = sessionStats.wrong;
    const accuracy = total > 0 ? Math.round(correct/total*100) : 0;
    const durationSec = Math.round((Date.now() - sessionStats.startTime)/1000);

    // Save history
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
      <div style="max-width:600px;margin:0 auto;text-align:center">
        <div class="card card-padding" style="padding:32px">
          <div style="font-size:48px;margin-bottom:12px">🎉</div>
          <h2 style="font-size:24px;margin-bottom:8px">Hoàn thành phiên học!</h2>
          <p style="color:var(--text-muted);margin-bottom:20px">Bạn đã học ${total} từ trong ${durationSec}s</p>
          <div class="dashboard-grid">
            <div class="dashboard-card"><h4>Chính xác</h4><div class="value">${accuracy}%</div></div>
            <div class="dashboard-card"><h4>Đúng</h4><div class="value" style="color:var(--success)">${correct}</div></div>
            <div class="dashboard-card"><h4>Sai</h4><div class="value" style="color:var(--danger)">${wrong}</div></div>
            <div class="dashboard-card"><h4>Thời gian</h4><div class="value">${durationSec}s</div></div>
          </div>
          <div style="display:flex;gap:10px;justify-content:center;margin-top:20px">
            <button class="btn btn-primary" id="continue-btn">Học tiếp</button>
            <button class="btn btn-ghost" id="dashboard-btn">Xem Dashboard</button>
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
        <h1 class="content-title">Dashboard</h1>
        <p class="content-subtitle">Theo dõi tiến độ học tập của bạn</p>
      </div>
      <div class="dashboard-grid">
        <div class="dashboard-card"><h4>Tổng từ</h4><div class="value">${stats.total}</div></div>
        <div class="dashboard-card"><h4>Đã học</h4><div class="value">${stats.learned}</div></div>
        <div class="dashboard-card"><h4>Thành thạo</h4><div class="value">${stats.mastered}</div></div>
        <div class="dashboard-card"><h4>Đến hạn</h4><div class="value" style="color:${stats.due>0?'var(--warning)':'var(--success)'}">${stats.due}</div></div>
        <div class="dashboard-card"><h4>Từ yếu</h4><div class="value" style="color:var(--danger)">${stats.weak}</div></div>
        <div class="dashboard-card"><h4>Độ chính xác</h4><div class="value">${stats.accuracy}%</div></div>
        <div class="dashboard-card"><h4>Streak hiện tại</h4><div class="value">🔥 ${streakData.current}</div></div>
        <div class="dashboard-card"><h4>Streak dài nhất</h4><div class="value">${streakData.longest}</div></div>
      </div>
      <div class="card card-padding">
        <h3 style="font-size:14px;margin-bottom:12px">Lịch sử học</h3>
        ${recent.length===0 ? `<p style="color:var(--text-muted);font-size:13px">Chưa có phiên học nào</p>` : `
          <div style="display:grid;gap:8px">
            ${recent.map(h => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px">
                <span>${new Date(h.date).toLocaleDateString('vi-VN')} ${new Date(h.date).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})} • ${h.mode} • ${h.total} từ</span>
                <span style="font-weight:600;color:${h.accuracy>=80?'var(--success)':h.accuracy>=50?'var(--warning)':'var(--danger)'}">${h.accuracy}%</span>
              </div>
            `).join('')}
          </div>
        `}
      </div>
      <div class="card card-padding mt-4">
        <h3 style="font-size:14px;margin-bottom:12px">Phân bố trạng thái</h3>
        <div style="display:flex;gap:4px;height:24px;border-radius:12px;overflow:hidden;background:var(--bg-muted)">
          <div style="width:${stats.total?stats.new/stats.total*100:0}%;background:#94a3b8" title="New: ${stats.new}"></div>
          <div style="width:${stats.total?stats.learning/stats.total*100:0}%;background:#fbbf24" title="Learning: ${stats.learning}"></div>
          <div style="width:${stats.total?stats.weak/stats.total*100:0}%;background:#f87171" title="Weak: ${stats.weak}"></div>
          <div style="width:${stats.total?stats.review/stats.total*100:0}%;background:#60a5fa" title="Review: ${stats.review}"></div>
          <div style="width:${stats.total?stats.mastered/stats.total*100:0}%;background:#4ade80" title="Mastered: ${stats.mastered}"></div>
        </div>
        <div style="display:flex;gap:12px;margin-top:8px;font-size:11px;color:var(--text-muted);flex-wrap:wrap">
          <span><span style="display:inline-block;width:10px;height:10px;background:#94a3b8;border-radius:2px;margin-right:4px"></span>New ${stats.new}</span>
          <span><span style="display:inline-block;width:10px;height:10px;background:#fbbf24;border-radius:2px;margin-right:4px"></span>Learning ${stats.learning}</span>
          <span><span style="display:inline-block;width:10px;height:10px;background:#f87171;border-radius:2px;margin-right:4px"></span>Weak ${stats.weak}</span>
          <span><span style="display:inline-block;width:10px;height:10px;background:#60a5fa;border-radius:2px;margin-right:4px"></span>Review ${stats.review}</span>
          <span><span style="display:inline-block;width:10px;height:10px;background:#4ade80;border-radius:2px;margin-right:4px"></span>Mastered ${stats.mastered}</span>
        </div>
      </div>
    `;
  }

  function renderSearch(container) {
    container.innerHTML = `
      <div class="content-header">
        <h1 class="content-title">Tra cứu từ vựng</h1>
        <p class="content-subtitle">Tìm kiếm nhanh theo tiếng Anh, tiếng Việt, POS, tag, trạng thái</p>
      </div>
      <div class="search-bar">
        <input type="text" id="search-input" class="search-input" placeholder="Tìm từ, nghĩa, ví dụ..." />
        <button class="btn btn-ghost" id="clear-search">Xóa</button>
      </div>
      <div class="filters">
        <select id="filter-state" class="filter-select">
          <option value="all">Tất cả trạng thái</option>
          <option value="new">New</option>
          <option value="learning">Learning</option>
          <option value="weak">Weak</option>
          <option value="review">Review</option>
          <option value="mastered">Mastered</option>
          <option value="due">Đến hạn</option>
          <option value="favorites">Yêu thích</option>
        </select>
        <select id="filter-sort" class="filter-select">
          <option value="az">A → Z</option>
          <option value="za">Z → A</option>
          <option value="difficulty">Độ khó</option>
          <option value="newest">Mới nhất</option>
          <option value="mostWrong">Sai nhiều nhất</option>
          <option value="dueSoon">Đến hạn sớm</option>
        </select>
        <select id="filter-pos" class="filter-select">
          <option value="all">Tất cả POS</option>
          <option value="n">n</option>
          <option value="v">v</option>
          <option value="adj">adj</option>
          <option value="adv">adv</option>
          <option value="phrase">phrase</option>
          <option value="collocation">collocation</option>
        </select>
      </div>
      <div id="search-results" class="vocab-list"></div>
      <div id="search-pagination" style="margin-top:16px;display:flex;justify-content:center;gap:8px"></div>
    `;

    const input = container.querySelector('#search-input');
    const stateSel = container.querySelector('#filter-state');
    const sortSel = container.querySelector('#filter-sort');
    const posSel = container.querySelector('#filter-pos');
    const resultsDiv = container.querySelector('#search-results');
    const paginationDiv = container.querySelector('#search-pagination');
    let currentPage = 1;
    const pageSize = 50;
    let currentResults = [];

    function doSearch() {
      const q = input.value;
      const filters = {
        state: stateSel.value,
        pos: posSel.value
      };
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

      resultsDiv.innerHTML = `
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">${total} kết quả</div>
        ${pageItems.map(item => `
          <div class="vocab-item" data-id="${item.id}">
            <span class="vocab-word">${escapeHtml(item.word)}</span>
            <span class="vocab-pos">${escapeHtml(item.entry.pos)}</span>
            <span class="vocab-meaning" title="${escapeHtml(item.entry.meaning)}">${escapeHtml(item.entry.meaning)}</span>
            <span class="vocab-state state-${item.state}">${item.state}</span>
            <button class="fav-btn ${item.fav?'active':''}" data-fav="${item.id}">${item.fav?'★':'☆'}</button>
          </div>
        `).join('')}
      `;

      // Pagination
      if (totalPages > 1) {
        let pagHtml = '';
        for (let i = 1; i <= Math.min(totalPages, 10); i++) {
          pagHtml += `<button class="btn ${i===currentPage?'btn-primary':'btn-ghost'} btn-sm" data-page="${i}">${i}</button>`;
        }
        if (totalPages > 10) pagHtml += `<span style="padding:6px">... ${totalPages}</span>`;
        paginationDiv.innerHTML = pagHtml;
        paginationDiv.querySelectorAll('[data-page]').forEach(b => {
          b.addEventListener('click', () => { currentPage = parseInt(b.dataset.page); renderResults(); });
        });
      } else {
        paginationDiv.innerHTML = '';
      }

      resultsDiv.querySelectorAll('[data-fav]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.dataset.fav;
          if (favorites.has(id)) favorites.delete(id); else favorites.add(id);
          saveAll();
          doSearch();
        });
      });
    }

    input.addEventListener('input', debounce(doSearch, 200));
    stateSel.addEventListener('change', doSearch);
    sortSel.addEventListener('change', doSearch);
    posSel.addEventListener('change', doSearch);
    container.querySelector('#clear-search').addEventListener('click', () => { input.value=''; doSearch(); });

    doSearch();
    setTimeout(() => input.focus(), 100);
  }

  function renderSettings(container) {
    container.innerHTML = `
      <div class="content-header">
        <h1 class="content-title">Cài đặt</h1>
        <p class="content-subtitle">Quản lý dữ liệu và tùy chọn</p>
      </div>
      <div style="display:grid;gap:16px;max-width:600px">
        <div class="card card-padding">
          <h3 style="font-size:14px;margin-bottom:12px">Dữ liệu học tập</h3>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-ghost" id="export-btn">⤓ Export progress</button>
            <label class="btn btn-ghost" style="cursor:pointer">
              ⤒ Import progress
              <input type="file" id="import-file" accept=".json" style="display:none" />
            </label>
            <button class="btn btn-ghost" id="reset-btn" style="color:var(--danger);border-color:var(--danger)">Reset tất cả</button>
          </div>
          <p style="font-size:12px;color:var(--text-muted);margin-top:8px">Export ra JSON để backup, import để khôi phục. Dữ liệu lưu trong localStorage.</p>
        </div>
        <div class="card card-padding">
          <h3 style="font-size:14px;margin-bottom:12px">Tùy chọn</h3>
          <div style="display:grid;gap:12px">
            <label style="display:flex;justify-content:space-between;align-items:center;font-size:14px">
              <span>Dark mode</span>
              <input type="checkbox" id="opt-dark" ${prefs.darkMode?'checked':''} />
            </label>
            <label style="display:flex;justify-content:space-between;align-items:center;font-size:14px">
              <span>Phím tắt bàn phím</span>
              <input type="checkbox" id="opt-kb" ${prefs.keyboardShortcuts?'checked':''} />
            </label>
            <label style="display:flex;justify-content:space-between;align-items:center;font-size:14px">
              <span>Số từ mỗi phiên</span>
              <select id="opt-size" class="filter-select">
                <option value="10" ${prefs.sessionSize==10?'selected':''}>10</option>
                <option value="20" ${prefs.sessionSize==20?'selected':''}>20</option>
                <option value="30" ${prefs.sessionSize==30?'selected':''}>30</option>
                <option value="50" ${prefs.sessionSize==50?'selected':''}>50</option>
              </select>
            </label>
          </div>
        </div>
        <div class="card card-padding">
          <h3 style="font-size:14px;margin-bottom:12px">Thông tin</h3>
          <div style="font-size:13px;color:var(--text-muted);display:grid;gap:4px">
            <div>Tổng từ: ${vocab.length}</div>
            <div>Data updated: ${meta?.updated || 'local'}</div>
            <div>Commit: ${meta?.commit || 'dev'}</div>
            <div>Build time: ${meta?.buildTime ? new Date(meta.buildTime).toLocaleString('vi-VN') : 'local'}</div>
            <div>Source: data/vocabulary.json</div>
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
        showToast('Import thành công!');
        renderShell();
      } catch (err) {
        showToast('Import lỗi: ' + err.message, 'error');
      }
    });
    container.querySelector('#reset-btn')?.addEventListener('click', () => {
      if (confirm('Xóa toàn bộ tiến trình? Không thể hoàn tác.')) {
        localStorage.clear();
        progressMap = ensureProgress({}, vocab);
        favorites = new Set();
        history = [];
        streakData = { current:0, longest:0, lastDate:null };
        prefs = { ...prefs, sessionSize:20 };
        saveAll();
        showToast('Đã reset');
        renderShell();
      }
    });
    container.querySelector('#opt-dark')?.addEventListener('change', (e) => {
      prefs.darkMode = e.target.checked;
      savePrefs(prefs);
      applyTheme();
    });
    container.querySelector('#opt-kb')?.addEventListener('change', (e) => {
      prefs.keyboardShortcuts = e.target.checked;
      savePrefs(prefs);
    });
    container.querySelector('#opt-size')?.addEventListener('change', (e) => {
      prefs.sessionSize = parseInt(e.target.value,10);
      savePrefs(prefs);
    });
  }

  // Helpers
  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }
  function formatNextReview(ts) {
    if (!ts) return 'ngay bây giờ';
    const diff = ts - Date.now();
    if (diff <= 0) return 'đến hạn';
    const hours = Math.round(diff/3600000);
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

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (!prefs.keyboardShortcuts) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      // Allow Escape to blur, Enter handled elsewhere
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    const content = document.querySelector('#content');
    if (!content) return;
    const hasQuestion = content.dataset.hasQuestion || content.querySelector('.flashcard');
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
          if (spellBtn) spellBtn.click();
        }
      } else if (e.key.toLowerCase() === 'n') {
        const skip = content.querySelector('#skip-btn');
        if (skip) skip.click();
      } else if (e.key.toLowerCase() === 'f') {
        const fav = content.querySelector('#fav-btn');
        if (fav) fav.click();
      } else if (e.key === ' ') {
        e.preventDefault();
        // Space could flip? For now treat as next if feedback shown else ignore
        const nextBtn = content.querySelector('#next-btn');
        if (nextBtn) nextBtn.click();
      }
    }
  });

  // Initial render
  renderShell();
}
