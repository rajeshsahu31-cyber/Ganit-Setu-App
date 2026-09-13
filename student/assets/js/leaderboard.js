/* =====================================================
   GANIT SETU - FINAL OVERALL LEADERBOARD
   =====================================================
   Frozen snapshot: public.ganit_daily_rankings
   - Class is automatic from logged-in student.
   - No class-changing control.
   - Top 3 podium: 2nd left, 1st center, 3rd right.
   - Below podium: exactly 10 rows, including Top 3.
   - Missing students are shown as "—".
   - No slider / auto-scroll.
   ===================================================== */

(function () {
  "use strict";

  const RANK_TABLE = "ganit_daily_rankings";
  const $ = id => document.getElementById(id);

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function todayISO() {
    const d = new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0")
    ].join("-");
  }

  function formatDate(dateString) {
    if (!dateString) return "Frozen Ranking";
    const d = new Date(dateString + "T00:00:00");
    return d.toLocaleDateString("hi-IN", {
      day: "2-digit", month: "2-digit", year: "numeric"
    });
  }

  function getStoredClass() {
    const keys = ["ganit_setu_student_class", "ganit_setu_class_level"];
    for (const key of keys) {
      const n = Number(sessionStorage.getItem(key));
      if (n === 9 || n === 10) return n;
    }
    return null;
  }

  async function getStudentClass() {
    const stored = getStoredClass();
    if (stored) return stored;

    const code =
      sessionStorage.getItem("ganit_setu_student_id") ||
      localStorage.getItem("ganit_setu_student_id");

    if (!code) return null;

    const { data, error } = await supabaseClient
      .from("students")
      .select("class_level")
      .eq("student_id", code)
      .maybeSingle();

    if (error) {
      console.error("Student class load error:", error);
      return null;
    }

    const n = Number(data?.class_level);
    if (n === 9 || n === 10) {
      sessionStorage.setItem("ganit_setu_student_class", String(n));
      return n;
    }
    return null;
  }

  function statusBadge(done, label) {
    return done
      ? `<span class="test-status done">✓ ${label}</span>`
      : `<span class="test-status pending">— ${label}</span>`;
  }

  function timeText(seconds) {
    const sec = Number(seconds || 0);
    if (!sec) return "—";
    const min = Math.floor(sec / 60);
    const rem = sec % 60;
    return min > 0 ? `${min}m ${rem}s` : `${rem}s`;
  }

  async function getTodayStatuses(studentCodes, rankDate) {
    const result = new Map();
    if (!studentCodes.length) return result;

    const { data: students } = await supabaseClient
      .from("students")
      .select("id,student_id")
      .in("student_id", studentCodes);

    const idToCode = new Map(
      (students || []).map(s => [String(s.id), String(s.student_id)])
    );

    const ids = [...idToCode.keys()];
    for (const code of studentCodes) {
      result.set(code, {
        course_progress: false,
        chapter_practice: false,
        daily: false
      });
    }
    if (!ids.length) return result;

    const { data: tests } = await supabaseClient
      .from("tests")
      .select("id,test_type,test_date,status")
      .eq("test_date", rankDate)
      .in("test_type", ["course_progress", "chapter_practice", "daily"]);

    const testIds = (tests || [])
      .filter(t => !t.status || t.status === "active" || t.status === "published")
      .map(t => t.id);

    if (!testIds.length) return result;

    const { data: attempts } = await supabaseClient
      .from("test_attempts")
      .select("student_id,test_id,status")
      .in("student_id", ids)
      .in("test_id", testIds)
      .eq("status", "submitted");

    const typeByTest = new Map(
      (tests || []).map(t => [String(t.id), t.test_type])
    );

    (attempts || []).forEach(a => {
      const code = idToCode.get(String(a.student_id));
      const type = typeByTest.get(String(a.test_id));
      if (code && type && result.has(code)) result.get(code)[type] = true;
    });

    return result;
  }

  function sortRows(data) {
    return (data || []).slice().sort((a, b) => {
      const p = Number(b.overall_percentage || 0) -
                Number(a.overall_percentage || 0);
      if (p) return p;

      const c = Number(b.total_correct || 0) -
                Number(a.total_correct || 0);
      if (c) return c;

      const q = Number(b.total_questions || 0) -
                Number(a.total_questions || 0);
      if (q) return q;

      const t = Number(a.total_time_seconds || 0) -
                Number(b.total_time_seconds || 0);
      if (t) return t;

      return String(a.student_code || "")
        .localeCompare(String(b.student_code || ""));
    }).slice(0, 10);
  }

  function initials(name) {
    return String(name || "विद्यार्थी")
      .trim().split(/\s+/).filter(Boolean)
      .map(x => x[0]).join("").slice(0, 2).toUpperCase() || "वि";
  }

  function podiumCard(row, rank, cls) {
    if (!row) {
      return `<article class="podium-card ${cls} empty">
        <div class="podium-medal">${rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉"}</div>
        <div class="podium-photo">—</div>
        <div class="podium-name">—</div>
        <div class="podium-school">—</div>
        <div class="podium-score">—</div>
      </article>`;
    }

    const photo = row.photo_url || "assets/images/default-student.webp";
    return `<article class="podium-card ${cls}">
      <div class="podium-medal">${rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉"}</div>
      <img class="podium-photo" src="${esc(photo)}" alt="${esc(row.full_name || "विद्यार्थी")}"
           onerror="this.onerror=null;this.src='assets/images/default-student.webp';">
      <div class="podium-name">${esc(row.full_name || "विद्यार्थी")}</div>
      <div class="podium-school">🏫 ${esc(row.school_name || "—")}</div>
      <div class="podium-class">📚 कक्षा ${esc(row.class_level || "")} • ${esc(row.student_code || "—")}</div>
      <div class="podium-score">${Number(row.overall_percentage || 0).toFixed(2)}%</div>
      <div class="podium-meta">✓ ${Number(row.total_correct || 0)}/${Number(row.total_questions || 0)} • ⏱ ${esc(timeText(row.total_time_seconds))}</div>
    </article>`;
  }

  function emptyRow(rank) {
    return `<article class="rank-row empty-row">
      <div class="rank-no">#${rank}</div>
      <div class="rank-photo-placeholder">—</div>
      <div class="rank-student">
        <div class="rank-name">—</div>
        <div class="rank-school">विद्यार्थी उपलब्ध नहीं</div>
        <div class="rank-class">कक्षा — • ID —</div>
      </div>
      <div class="rank-overall"><strong>—</strong><small>Overall</small></div>
      <div class="rank-metrics">
        <div class="metric"><b>सही</b><span>—</span></div>
        <div class="metric"><b>समय</b><span>—</span></div>
      </div>
      <div class="rank-status">
        ${statusBadge(false, "Course")}
        ${statusBadge(false, "Chapter")}
        ${statusBadge(false, "Daily")}
      </div>
    </article>`;
  }

  async function loadRanking(classLevel) {
    const message = $("leaderboardMessage");
    const list = $("leaderboardList");

    message.textContent = "Ranking जाँच हो रही है...";
    list.innerHTML = "";
    $("classText").textContent = `कक्षा ${classLevel}`;

    const rankDate = todayISO();

    const { data, error } = await supabaseClient
      .from(RANK_TABLE)
      .select("rank_date,class_level,full_name,student_code,overall_percentage,total_correct,total_questions,total_time_seconds")
      .eq("rank_date", rankDate)
      .eq("class_level", classLevel);

    if (error) {
      console.error("Frozen leaderboard error:", error);
      message.textContent =
        "Ranking load नहीं हुई। Supabase में ganit_daily_rankings की SELECT policy जाँचें।";
      return;
    }

    const sorted = sortRows(data);

    const codes = sorted.map(r => String(r.student_code));
    const { data: profiles, error: profileError } = await supabaseClient
      .from("students")
      .select("student_id,full_name,school_name,class_level,photo_url")
      .in("student_id", codes);

    if (profileError) console.warn("Student profile load warning:", profileError);

    const profileMap = new Map(
      (profiles || []).map(p => [String(p.student_id), p])
    );

    const merged = sorted.map(r => {
      const p = profileMap.get(String(r.student_code)) || {};
      return {
        ...r,
        full_name: p.full_name || r.full_name || "विद्यार्थी",
        school_name: p.school_name || "विद्यालय —",
        class_level: p.class_level ?? r.class_level ?? classLevel,
        photo_url: p.photo_url || ""
      };
    });

    const statuses = await getTodayStatuses(codes, rankDate);

    $("rankingDate").textContent = `🔒 ${formatDate(rankDate)} • Frozen`;
    message.innerHTML =
      `🔒 <b>${formatDate(rankDate)}</b> की Frozen Overall Ranking • कक्षा ${classLevel}`;

    $("podium").innerHTML =
      podiumCard(merged[1], 2, "second") +
      podiumCard(merged[0], 1, "first") +
      podiumCard(merged[2], 3, "third");

    let rows = "";
    for (let i = 0; i < 10; i++) {
      const r = merged[i];
      const rank = i + 1;

      if (!r) {
        rows += emptyRow(rank);
        continue;
      }

      const code = String(r.student_code);
      const status = statuses.get(code) || {};
      const photo = r.photo_url || "assets/images/default-student.webp";

      rows += `<article class="rank-row">
        <div class="rank-no">#${rank}</div>
        <img class="rank-photo" src="${esc(photo)}" alt="${esc(r.full_name)}"
             loading="lazy"
             onerror="this.onerror=null;this.src='assets/images/default-student.webp';">
        <div class="rank-student">
          <div class="rank-name">${esc(r.full_name)}</div>
          <div class="rank-school">🏫 ${esc(r.school_name)}</div>
          <div class="rank-class">📚 कक्षा ${esc(r.class_level)} • ${esc(code)}</div>
        </div>
        <div class="rank-overall">
          <strong>${Number(r.overall_percentage || 0).toFixed(2)}%</strong>
          <small>Overall</small>
        </div>
        <div class="rank-metrics">
          <div class="metric"><b>सही</b><span>${Number(r.total_correct || 0)}/${Number(r.total_questions || 0)}</span></div>
          <div class="metric"><b>समय</b><span>${esc(timeText(r.total_time_seconds))}</span></div>
        </div>
        <div class="rank-status">
          ${statusBadge(!!status.course_progress, "Course")}
          ${statusBadge(!!status.chapter_practice, "Chapter")}
          ${statusBadge(!!status.daily, "Daily")}
        </div>
      </article>`;
    }

    list.innerHTML = rows;
  }

  async function start() {
    if (typeof supabaseClient === "undefined") {
      $("leaderboardMessage").textContent = "Supabase connect नहीं है।";
      return;
    }

    const classLevel = await getStudentClass();

    if (classLevel !== 9 && classLevel !== 10) {
      $("classText").textContent = "कक्षा —";
      $("leaderboardMessage").textContent =
        "Student की Class जानकारी नहीं मिली।";
      $("podium").innerHTML =
        podiumCard(null, 2, "second") +
        podiumCard(null, 1, "first") +
        podiumCard(null, 3, "third");
      $("leaderboardList").innerHTML =
        Array.from({length:10}, (_,i) => emptyRow(i+1)).join("");
      return;
    }

    await loadRanking(classLevel);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
