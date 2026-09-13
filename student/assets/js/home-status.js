/* ============================================
   GANIT SETU - TODAY'S TEST STATUS + SUMMARY
   Data connection remains through the existing RPC.
   UI is compact 3-column dashboard.
   ============================================ */
(function () {
  function getEl(id) { return document.getElementById(id); }

  function todayIST() {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
  }

  function resultDateIST(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(d);
  }

  function getChapterNumber(row) {
    const direct = Number(row?.chapter_from ?? row?.chapter_number ?? row?.chapter);
    if (Number.isFinite(direct) && direct > 0) return direct;
    const text = String(row?.test_title || row?.title || row?.test_name || '');
    const match = text.match(/(?:chapter|अध्याय)\s*[-:]?\s*(\d+)/i);
    return match ? Number(match[1]) : null;
  }

  function normalizeRow(row) {
    const submitted = row?.submitted_at || row?.created_at || row?.test_time ||
      (row?.test_date ? `${row.test_date}T00:00:00` : null);
    return {
      ...row,
      test_type: String(row?.test_type || '').toLowerCase(),
      submitted_at: submitted,
      test_title: row?.test_title || row?.title || row?.test_name || ''
    };
  }

  function isSubmitted(row) {
    const status = String(row?.status || '').toLowerCase();
    return status === 'submitted' || !!row?.submitted_at;
  }

  function classLevel() {
    const value = Number(sessionStorage.getItem('ganit_setu_student_class'));
    return value === 9 || value === 10 ? value : 10;
  }

  function maxChapters() { return classLevel() === 9 ? 12 : 14; }

  function setState(cardId, badgeId, markId, done, badgeText, mark) {
    const card = getEl(cardId);
    const badgeEl = getEl(badgeId);
    const markEl = getEl(markId);
    if (card) {
      card.classList.toggle('is-done', !!done);
      card.classList.toggle('is-pending', !done);
    }
    if (badgeEl) badgeEl.textContent = badgeText;
    if (markEl) markEl.textContent = mark;
  }

  function renderChapterDots(completed) {
    const wrap = getEl('chapterDots');
    if (!wrap) return;
    const total = maxChapters();
    wrap.innerHTML = '';
    for (let n = 1; n <= total; n++) {
      const dot = document.createElement('span');
      const done = completed.has(n);
      dot.className = `chapter-dot ${done ? 'done' : 'pending'}`;
      dot.textContent = n;
      dot.title = `अध्याय ${n} — ${done ? 'टेस्ट दिया' : 'टेस्ट बाकी'}`;
      wrap.appendChild(dot);
    }
    const doneEl = getEl('chapterDoneCount');
    const pendingEl = getEl('chapterPendingCount');
    if (doneEl) doneEl.textContent = completed.size;
    if (pendingEl) pendingEl.textContent = Math.max(0, total - completed.size);
  }

  function renderStatus(rows) {
    const normalized = (Array.isArray(rows) ? rows : []).map(normalizeRow);
    const today = todayIST();
    const todayRows = normalized.filter(row => isSubmitted(row) && resultDateIST(row.submitted_at) === today);

    const courseRows = todayRows.filter(row => row.test_type === 'course_progress');
    const chapterRows = todayRows.filter(row => row.test_type === 'chapter_practice');
    const dailyRows = todayRows.filter(row => row.test_type === 'daily');

    const chapters = new Set();
    chapterRows.forEach(row => {
      const n = getChapterNumber(row);
      if (Number.isInteger(n) && n >= 1 && n <= maxChapters()) chapters.add(n);
    });

    const courseDone = courseRows.length > 0;
    const chapterDone = chapters.size > 0;
    const dailyDone = dailyRows.length > 0;

    setState('courseStatusCard', 'courseStatusBadge', 'courseStatusMark', courseDone, courseDone ? 'पूरा किया' : 'बाकी है', courseDone ? '✓' : '!');
    setState('chapterStatusCard', 'chapterStatusBadge', 'chapterStatusMark', chapterDone, chapterDone ? 'आंशिक रूप से किया' : 'अभी नहीं किया', chapterDone ? '✓' : '!');
    setState('dailyStatusCard', 'dailyStatusBadge', 'dailyStatusMark', dailyDone, dailyDone ? 'पूरा किया' : 'आज नहीं किया', dailyDone ? '✓' : '×');

    const courseText = getEl('courseStatusText');
    if (courseText) {
      courseText.innerHTML = courseDone
        ? '<div class="home-status-big">✓ <b>पूरा किया</b></div>'
        : '<div class="home-status-big">अभी बाकी है</div>';
    }

    const courseProgress = getEl('courseProgressText');
    if (courseProgress) courseProgress.textContent = courseDone ? 'आज पूर्ण' : 'आज बाकी';

    renderChapterDots(chapters);
    const chapterNote = getEl('chapterStatusText');
    if (chapterNote) chapterNote.textContent = chapterDone ? `${chapters.size}/${maxChapters()} अध्याय किए` : `0/${maxChapters()} अध्याय किए`;

    const dailyText = getEl('dailyStatusText');
    const dailyAction = getEl('dailyActionText');
    if (dailyText) dailyText.innerHTML = dailyDone ? '<strong>✓ आज का टेस्ट पूरा</strong>' : '<strong>आज का टेस्ट अभी बाकी है</strong>';
    if (dailyAction) dailyAction.textContent = dailyDone ? 'बहुत अच्छा!' : 'आज ही दें →';
  }

  function renderSummary(rows) {
    const submitted = (Array.isArray(rows) ? rows : []).map(normalizeRow).filter(isSubmitted);
    const totalTests = submitted.length;
    const correct = submitted.reduce((sum, r) => sum + (Number(r.correct_answers) || 0), 0);
    const wrong = submitted.reduce((sum, r) => sum + (Number(r.wrong_answers) || 0), 0);
    const percentages = submitted.map(r => Number(r.percentage)).filter(Number.isFinite);
    const average = percentages.length ? percentages.reduce((a, b) => a + b, 0) / percentages.length : 0;

    const totalEl = getEl('summaryTotalTests');
    const correctEl = getEl('summaryCorrect');
    const wrongEl = getEl('summaryWrong');
    const avgEl = getEl('summaryAverage');
    if (totalEl) totalEl.textContent = totalTests;
    if (correctEl) correctEl.textContent = correct;
    if (wrongEl) wrongEl.textContent = wrong;
    if (avgEl) avgEl.textContent = `${average.toFixed(0)}%`;
  }

  async function loadTodayStatus() {
    if (typeof supabaseClient === 'undefined') return;
    const studentCode = sessionStorage.getItem('ganit_setu_student_id');
    if (!studentCode) return;

    try {
      const result = await supabaseClient.rpc('get_ganit_student_results', {
        p_student_code: studentCode
      });
      if (result.error) throw result.error;
      const rows = result.data || [];
      renderStatus(rows);
      renderSummary(rows);
    } catch (error) {
      console.error('Home test status load error:', error);
      const msg = 'जानकारी नहीं मिली';
      ['courseStatusText', 'chapterStatusText', 'dailyStatusText'].forEach(id => {
        const el = getEl(id);
        if (el) el.textContent = msg;
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadTodayStatus, { once: true });
  } else {
    loadTodayStatus();
  }
})();
