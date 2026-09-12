/* ============================================
   GANIT SETU - HOME OVERALL LEADERBOARD
   ============================================

   Overall Ranking:
   Course % + Chapter % + Daily %
   --------------------------------------------
   Overall % ज्यादा  → ऊपर Rank
   Overall % समान   → कम कुल समय
   Overall % + Time समान → पहले Submit
   ============================================ */

let homeWinnerData = [];


/* ============================================
   BASIC HELPERS
   ============================================ */

function escapeHomeHtml(v = '') {
  return String(v).replace(/[&<>"']/g, c =>
    ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[c])
  );
}


function homeInitials(name = 'विद्यार्थी') {
  return String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(x => x[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'वि';
}


/* ============================================
   STUDENT PHOTO
   ============================================ */

function homePhotoHtml(student) {

  const name = student.full_name || 'विद्यार्थी';
  const photoUrl = student.photo_url || '';

  if (photoUrl) {

    return `
      <img
        src="${escapeHomeHtml(photoUrl)}"
        alt="${escapeHomeHtml(name)}"
        onerror="
          this.remove();
          this.parentElement.textContent='${escapeHomeHtml(homeInitials(name))}'
        "
      >
    `;

  }

  return escapeHomeHtml(homeInitials(name));
}


async function addHomeProfilePhotos(rows) {

  if (!rows || !rows.length) {
    return rows || [];
  }

  const ids = [
    ...new Set(
      rows
        .map(r => String(r.student_code || '').trim())
        .filter(Boolean)
    )
  ];

  if (!ids.length) return rows;

  const { data, error } = await supabaseClient
    .from('students')
    .select('student_id,photo_url,school_name,class_level')
    .in('student_id', ids);

  if (error) {
    console.error('Home profile photos load error:', error);
    return rows;
  }

  const profileMap = new Map(
    (data || []).map(s => [
      String(s.student_id),
      s
    ])
  );

  return rows.map(r => {

    const p =
      profileMap.get(String(r.student_code)) || {};

    return {
      ...r,
      photo_url:
        p.photo_url ||
        r.photo_url ||
        '',

      school_name:
        p.school_name ||
        r.school_name ||
        '',

      class_level:
        p.class_level ??
        r.class_level ??
        ''
    };

  });
}


/* ============================================
   MESSAGE
   ============================================ */

function setHomeLeaderboardMessage(message) {

  const topThree =
    document.getElementById('topThree');

  const track =
    document.getElementById('winnerTrack');

  if (topThree) {

    topThree.innerHTML = `
      <div
        style="
          grid-column:1/-1;
          width:100%;
          text-align:center;
          padding:24px 12px;
        "
      >
        ${message}
      </div>
    `;

  }

  if (track) {
    track.innerHTML = '';
  }
}


/* ============================================
   HOME DATE / LABEL
   ============================================ */

function setHomeDateFromResults() {

  const el =
    document.getElementById('testDateText');

  if (el) {

    el.textContent =
      'तीनों टेस्ट के आधार पर Overall Ranking';

  }
}


/* ============================================
   FORMAT TIME
   ============================================ */

function formatHomeDuration(seconds) {

  const s =
    Math.max(
      0,
      Math.floor(Number(seconds) || 0)
    );

  const m =
    Math.floor(s / 60);

  const sec =
    s % 60;

  return m
    ? `${m} मिनट ${String(sec).padStart(2, '0')} सेकंड`
    : `${sec} सेकंड`;
}


/* ============================================
   TOP 3
   ============================================ */

function renderTopThree(data) {

  const el =
    document.getElementById('topThree');

  if (!el) return;

  if (!data || !data.length) {

    el.innerHTML = `
      <div
        style="
          grid-column:1/-1;
          width:100%;
          text-align:center;
          padding:24px 12px;
        "
      >
        <b>अभी कोई Overall Result उपलब्ध नहीं है</b>
      </div>
    `;

    return;
  }


  el.innerHTML =
    data.slice(0, 3)
      .map((r, index) => {

        const rank =
          Number(r.rank_no) || index + 1;

        const medal =
          rank === 1
            ? '🥇'
            : rank === 2
              ? '🥈'
              : '🥉';


        const percentage =
          Number(
            r.overall_percentage || 0
          ).toFixed(2);


        return `
          <div
            class="champion-card rank-${rank}${rank === 1 ? ' first' : ''}"
          >

            <div class="medal">
              ${medal}
            </div>

            <div class="champion-photo">
              ${homePhotoHtml(r)}
            </div>

            <h3>
              ${escapeHomeHtml(
                r.full_name || 'विद्यार्थी'
              )}
            </h3>

            <small>
              ${escapeHomeHtml(
                r.student_code || ''
              )}
            </small>

            <small>
              🏫
              ${escapeHomeHtml(
                r.school_name || 'विद्यालय —'
              )}
            </small>

            <div class="champion-score">
              ${percentage}%
            </div>

            <small>
              Overall Performance
            </small>

          </div>
        `;

      })
      .join('');
}


/* ============================================
   TOP 10
   ============================================ */

function renderTopTen(data) {

  const track =
    document.getElementById('winnerTrack');

  if (!track) return;

  const rows =
    (data || []).slice(0, 10);


  if (!rows.length) {

    track.innerHTML = `
      <small
        style="padding:8px;color:#687489;"
      >
        अभी कोई Overall Result उपलब्ध नहीं है।
      </small>
    `;

    return;
  }


  const cards =
    rows.map(r => {

      const percentage =
        Number(
          r.overall_percentage || 0
        ).toFixed(2);


      const timeSeconds =
        Number(
          r.total_time_seconds ?? 0
        );


      const timeText =
        Number.isFinite(timeSeconds)
          ? formatHomeDuration(timeSeconds)
          : '—';


      const classText =
        r.class_level
          ? `कक्षा ${escapeHomeHtml(r.class_level)}`
          : 'कक्षा —';


      return `
        <div class="winner-card">

          <div class="winner-number">
            #${escapeHomeHtml(r.rank_no)}
          </div>

          <div class="mini-photo">
            ${homePhotoHtml(r)}
          </div>

          <div class="winner-info">

            <b>
              ${escapeHomeHtml(
                r.full_name || 'विद्यार्थी'
              )}
            </b>

            <small>
              🏫
              ${escapeHomeHtml(
                r.school_name || 'विद्यालय —'
              )}
            </small>

            <small>
              📚 ${classText}
            </small>

            <div class="winner-score">
              🏆 Overall ${percentage}%
            </div>

            <small>
              📚 Course:
              ${Number(
                r.course_percentage || 0
              ).toFixed(2)}%
            </small>

            <small>
              📖 Chapter:
              ${Number(
                r.chapter_percentage || 0
              ).toFixed(2)}%
            </small>

            <small>
              📝 Daily:
              ${Number(
                r.daily_percentage || 0
              ).toFixed(2)}%
            </small>

            <small>
              ⏱️ ${escapeHomeHtml(timeText)}
            </small>

          </div>

        </div>
      `;

    })
    .join('');


  /* दो समान sets — seamless scrolling */
  track.innerHTML =
    cards + cards;

  track.scrollLeft = 0;
}


/* ============================================
   MY OVERALL RANK
   ============================================ */

function updateMyRank(data) {

  const el =
    document.getElementById('myRank');

  if (!el) return;


  const studentCode =
    sessionStorage.getItem(
      'ganit_setu_student_id'
    );


  const mine =
    (data || []).find(
      r =>
        String(r.student_code) ===
        String(studentCode)
    );


  if (!mine) {

    el.textContent = '—';

    return;
  }


  const percentage =
    Number(
      mine.overall_percentage || 0
    ).toFixed(2);


  el.textContent =
    `#${mine.rank_no} • ${percentage}%`;
}


/* ============================================
   AUTO SCROLL
   ============================================ */

let homeScrollFrame = null;


function stopAutoScroll() {

  if (homeScrollFrame) {

    cancelAnimationFrame(
      homeScrollFrame
    );

    homeScrollFrame = null;
  }
}


function startAutoScroll() {

  const track =
    document.getElementById('winnerTrack');

  stopAutoScroll();

  if (!track) return;


  let lastTime =
    performance.now();


  const speed = 18;


  const step = now => {

    if (!document.body.contains(track)) {

      homeScrollFrame = null;

      return;
    }


    const delta =
      Math.min(
        (now - lastTime) / 1000,
        0.1
      );


    lastTime = now;


    if (
      track.scrollWidth >
      track.clientWidth
    ) {

      const halfWidth =
        track.scrollWidth / 2;


      track.scrollLeft +=
        speed * delta;


      if (
        track.scrollLeft >=
        halfWidth
      ) {

        track.scrollLeft -=
          halfWidth;
      }
    }


    homeScrollFrame =
      requestAnimationFrame(step);
  };


  homeScrollFrame =
    requestAnimationFrame(step);
}


/* ============================================
   GET STUDENT CLASS
   ============================================ */

async function getHomeStudentClass() {

  let classLevel =
    Number(
      sessionStorage.getItem(
        'ganit_setu_student_class'
      )
    );


  if (
    classLevel === 9 ||
    classLevel === 10
  ) {

    return classLevel;
  }


  const studentCode =
    sessionStorage.getItem(
      'ganit_setu_student_id'
    );


  if (!studentCode) return null;


  const {
    data,
    error
  } =
    await supabaseClient
      .from('students')
      .select('class_level')
      .eq('student_id', studentCode)
      .maybeSingle();


  if (error || !data) {
    return null;
  }


  classLevel =
    Number(data.class_level);


  if (
    classLevel === 9 ||
    classLevel === 10
  ) {

    sessionStorage.setItem(
      'ganit_setu_student_class',
      String(classLevel)
    );

    return classLevel;
  }


  return null;
}


/* ============================================
   LOAD OVERALL LEADERBOARD
   ============================================ */

async function loadHomeLeaderboard() {

  setHomeLeaderboardMessage(
    'Overall Ranking लोड हो रही है...'
  );


  const classLevel =
    await getHomeStudentClass();


  if (
    classLevel !== 9 &&
    classLevel !== 10
  ) {

    setHomeLeaderboardMessage(
      '<b>Student की Class जानकारी नहीं मिली।</b>'
    );

    return;
  }


  /* ==========================================
     नया Overall Ranking Function
     ========================================== */

  const {
    data,
    error
  } =
    await supabaseClient.rpc(
      'get_ganit_overall_leaderboard',
      {
        p_class_level: classLevel
      }
    );


  if (error) {

    console.error(
      'Overall leaderboard error:',
      error
    );


    setHomeLeaderboardMessage(
      `<b>Overall Ranking load नहीं हुई:</b>
       ${escapeHomeHtml(error.message)}`
    );

    return;
  }


  if (!data || !data.length) {

    setHomeLeaderboardMessage(
      '<b>अभी Overall Ranking उपलब्ध नहीं है।</b>'
    );

    return;
  }


  /* ==========================================
     DATA
     ========================================== */

  homeWinnerData =
    data.slice(0, 10);


  setHomeDateFromResults();


  renderTopThree(
    homeWinnerData
  );


  renderTopTen(
    homeWinnerData
  );


  updateMyRank(
    homeWinnerData
  );


  startAutoScroll();


  /* ==========================================
     STUDENT PHOTO / SCHOOL DATA
     ========================================== */

  try {

    homeWinnerData =
      await addHomeProfilePhotos(
        homeWinnerData
      );


    renderTopThree(
      homeWinnerData
    );


    renderTopTen(
      homeWinnerData
    );


    updateMyRank(
      homeWinnerData
    );

  } catch (e) {

    console.error(
      'Home photo enhancement error:',
      e
    );
  }
}


/* ============================================
   START
   ============================================ */

document.addEventListener(
  'DOMContentLoaded',
  loadHomeLeaderboard
);
