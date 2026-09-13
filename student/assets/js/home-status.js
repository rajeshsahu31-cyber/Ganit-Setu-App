/* ============================================
   GANIT SETU - TODAY'S TEST STATUS
   Home Page के 3 existing status cards को Supabase
   से वास्तविक attempt data से भरना।

   IMPORTANT:
   - Existing Home Page HTML/design को नहीं बदला गया।
   - Dynamic Banner / Ranking को नहीं छेड़ा गया।
   - RPC: get_ganit_student_results ही उपयोग किया गया है।
   ============================================ */

(function () {
  function getEl(id) { return document.getElementById(id); }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, function (c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c];
    });
  }

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
    let match = text.match(/(?:chapter|अध्याय)\s*[-:]?\s*(\d+)/i);
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
    // RPC में status न आए तो submitted_at होने को completed मानें।
    return status === 'submitted' || !!row?.submitted_at;
  }

  function setCard(cardId, textId, done, body) {
    const card = getEl(cardId);
    const text = getEl(textId);
    if (!card || !text) return;

    card.classList.toggle('is-done', !!done);
    card.classList.toggle('is-pending', !done);
    text.innerHTML = body;
  }

  function renderStatus(rows) {
    const normalized = (Array.isArray(rows) ? rows : []).map(normalizeRow);
    const today = todayIST();

    const todayRows = normalized.filter(function (row) {
      return isSubmitted(row) && resultDateIST(row.submitted_at) === today;
    });

    // Course Test
    const courseRows = todayRows.filter(function (row) {
      return row.test_type === 'course_progress';
    });

    setCard(
      'courseStatusCard',
      'courseStatusText',
      courseRows.length > 0,
      courseRows.length
        ? '✓ आज का Course Test <b>पूरा</b> कर लिया है।'
        : '⚠ आज का Course Test अभी <b>Attempt नहीं किया</b> है।'
    );

    // Chapter Practice — आज attempt किए गए unique chapters
    const chapterRows = todayRows.filter(function (row) {
      return row.test_type === 'chapter_practice';
    });

    const chapterSet = new Set();
    chapterRows.forEach(function (row) {
      const chapter = getChapterNumber(row);
      if (chapter) chapterSet.add(chapter);
    });

    const chapters = Array.from(chapterSet).sort(function (a, b) { return a - b; });

    let chapterBody;
    if (chapters.length) {
      chapterBody =
        `✓ आज <b>${chapters.length}</b> अध्याय का Chapter Test पूरा किया: ` +
        `<b>${chapters.map(function (n) { return 'अध्याय ' + n; }).join(', ')}</b>`;
    } else {
      chapterBody = '⚠ आज अभी कोई Chapter Test <b>Attempt नहीं किया</b> है।';
    }

    setCard(
      'chapterStatusCard',
      'chapterStatusText',
      chapters.length > 0,
      chapterBody
    );

    // Daily Test
    const dailyRows = todayRows.filter(function (row) {
      return row.test_type === 'daily';
    });

    setCard(
      'dailyStatusCard',
      'dailyStatusText',
      dailyRows.length > 0,
      dailyRows.length
        ? '✓ आज का Daily Test <b>पूरा</b> कर लिया है।'
        : '⚠ आज का Daily Test अभी <b>Attempt नहीं किया</b> है।'
    );
  }

  async function loadTodayStatus() {
    const courseCard = getEl('courseStatusCard');
    const chapterCard = getEl('chapterStatusCard');
    const dailyCard = getEl('dailyStatusCard');

    if ((!courseCard && !chapterCard && !dailyCard) || typeof supabaseClient === 'undefined') return;

    const studentCode = sessionStorage.getItem('ganit_setu_student_id');

    if (!studentCode) {
      setCard('courseStatusCard', 'courseStatusText', false, 'विद्यार्थी की जानकारी नहीं मिली।');
      setCard('chapterStatusCard', 'chapterStatusText', false, 'विद्यार्थी की जानकारी नहीं मिली।');
      setCard('dailyStatusCard', 'dailyStatusText', false, 'विद्यार्थी की जानकारी नहीं मिली।');
      return;
    }

    try {
      const result = await supabaseClient.rpc('get_ganit_student_results', {
        p_student_code: studentCode
      });

      if (result.error) throw result.error;
      renderStatus(result.data || []);
    } catch (error) {
      console.error('Home test status load error:', error);
      const msg = 'टेस्ट की जानकारी लोड नहीं हो सकी।';
      setCard('courseStatusCard', 'courseStatusText', false, msg);
      setCard('chapterStatusCard', 'chapterStatusText', false, msg);
      setCard('dailyStatusCard', 'dailyStatusText', false, msg);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadTodayStatus, {once: true});
  } else {
    loadTodayStatus();
  }
})();
