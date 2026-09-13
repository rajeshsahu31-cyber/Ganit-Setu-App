/* ============================================
   GANIT SETU - TODAY'S TEST STATUS
   केवल Profile के नीचे आज की Test Status

   IMPORTANT:
   - इस file में Leaderboard / Top 10 / Rank का कोई code नहीं है।
   - Course: आज attempt किया है या नहीं।
   - Chapter Practice: आज जिस chapter का कम-से-कम एक test दिया है,
     केवल वही chapter दिखेगा। बाकी chapters नहीं दिखेंगे।
   - Daily: आज attempt किया है या नहीं।
   - Pending test card को visually flash किया जाएगा।
   ============================================ */

(function () {
  function getEl(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, function (c) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      }[c];
    });
  }

  function todayIST() {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  }

  function resultDateIST(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';

    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);
  }

  function getChapterNumber(title) {
    const text = String(title || '');
    const match = text.match(/Chapter\s+(\d+)/i);
    return match ? Number(match[1]) : null;
  }

  function statusCard(type, icon, title, body, done) {
    return `
      <article class="gs-status-card ${done ? 'is-done' : 'is-pending'}"
               data-test-type="${escapeHtml(type)}">
        <div class="gs-status-icon">${icon}</div>

        <div class="gs-status-content">
          <div class="gs-status-title-row">
            <h3>${escapeHtml(title)}</h3>
            <span class="gs-status-badge">
              ${done ? '✓ पूरा' : '⚠ अभी बाकी'}
            </span>
          </div>

          <p>${body}</p>
        </div>
      </article>
    `;
  }

  function renderStatus(rows) {
    const grid = getEl('gsTodayTestGrid');
    if (!grid) return;

    const today = todayIST();

    const todayRows = (Array.isArray(rows) ? rows : []).filter(function (row) {
      return String(row.status || '').toLowerCase() === 'submitted' &&
             resultDateIST(row.submitted_at) === today;
    });

    /* ---------------- Course Test ---------------- */
    const courseRows = todayRows.filter(function (row) {
      return String(row.test_type || '').toLowerCase() === 'course_progress';
    });

    /* ---------------- Chapter Practice ---------------- */
    const chapterRows = todayRows.filter(function (row) {
      return String(row.test_type || '').toLowerCase() === 'chapter_practice';
    });

    /*
      केवल वे chapters दिखेंगे जिनका आज कम-से-कम एक
      Chapter Practice test दिया गया है।
    */
    const chapterSet = new Set();

    chapterRows.forEach(function (row) {
      const chapter = getChapterNumber(row.test_title);
      if (chapter) chapterSet.add(chapter);
    });

    const chapters = Array.from(chapterSet).sort(function (a, b) {
      return a - b;
    });

    let chapterBody;

    if (chapters.length) {
      chapterBody =
        `आज आपने <b>${chapters.length}</b> अध्याय का Chapter Test दिया: ` +
        `<b>${chapters.map(function (n) {
          return `अध्याय ${n}`;
        }).join(', ')}</b>`;
    } else {
      chapterBody = 'आज अभी किसी अध्याय का Chapter Test Attempt नहीं किया है।';
    }

    /* ---------------- Daily Test ---------------- */
    const dailyRows = todayRows.filter(function (row) {
      return String(row.test_type || '').toLowerCase() === 'daily';
    });

    grid.innerHTML = [
      statusCard(
        'course',
        '📘',
        'Course Test',
        courseRows.length
          ? 'आज का Course Test पूरा कर लिया है।'
          : 'आज अभी कोई Course Test Attempt नहीं किया है।',
        courseRows.length > 0
      ),

      statusCard(
        'chapter',
        '📗',
        'Chapter Wise Test',
        chapterBody,
        chapters.length > 0
      ),

      statusCard(
        'daily',
        '📝',
        'Daily Test',
        dailyRows.length
          ? 'आज का Daily Test पूरा कर लिया है।'
          : 'आज अभी कोई Daily Test Attempt नहीं किया है।',
        dailyRows.length > 0
      )
    ].join('');
  }

  async function loadTodayStatus() {
    const grid = getEl('gsTodayTestGrid');

    if (!grid || typeof supabaseClient === 'undefined') return;

    const studentCode = sessionStorage.getItem('ganit_setu_student_id');

    if (!studentCode) {
      grid.innerHTML =
        '<div class="gs-status-error">विद्यार्थी की जानकारी नहीं मिली।</div>';
      return;
    }

    try {
      const result = await supabaseClient.rpc(
        'get_ganit_student_results',
        {
          p_student_code: studentCode
        }
      );

      if (result.error) throw result.error;

      renderStatus(result.data || []);
    } catch (error) {
      console.error('Today test status load error:', error);

      grid.innerHTML =
        '<div class="gs-status-error">आज की टेस्ट स्थिति लोड नहीं हो सकी।</div>';
    }
  }

  document.addEventListener('DOMContentLoaded', loadTodayStatus);
})();
