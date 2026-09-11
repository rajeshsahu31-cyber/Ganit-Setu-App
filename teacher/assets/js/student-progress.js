document.addEventListener('DOMContentLoaded', async () => {

  const params = new URLSearchParams(window.location.search);
  const studentId = params.get('student_id');

  if (!studentId) {
    alert('विद्यार्थी की जानकारी नहीं मिली।');
    location.href = 'students.html';
    return;
  }

  const teacherDiseCode =
    sessionStorage.getItem('ganit_setu_teacher_dise_code');

  if (!teacherDiseCode) {
    alert('Teacher का DISE Code नहीं मिला। कृपया दोबारा लॉगिन करें।');
    location.href = 'index.html';
    return;
  }

  try {

    /* =========================================
       Student Information
    ========================================= */

    const {
      data: student,
      error: studentError
    } = await supabaseClient
      .from('students')
      .select(`
        id,
        student_id,
        full_name,
        class_level,
        school_name,
        school_dise_code,
        photo_url,
        status
      `)
      .eq('student_id', studentId)
      .eq('school_dise_code', teacherDiseCode)
      .maybeSingle();

    if (studentError) {
      throw studentError;
    }

    if (!student) {
      alert(
        'यह विद्यार्थी आपके विद्यालय से संबंधित नहीं है या उपलब्ध नहीं है।'
      );

      location.href = 'students.html';
      return;
    }


    /* =========================================
       Student Name / Information
    ========================================= */

    const studentName =
      document.getElementById('studentName');

    const studentInfo =
      document.getElementById('studentInfo');

    if (studentName) {
      studentName.textContent =
        student.full_name || 'विद्यार्थी';
    }

    if (studentInfo) {
      studentInfo.textContent =
        '🆔 ' +
        (student.student_id || '—') +
        ' • 📘 कक्षा ' +
        (student.class_level || '—') +
        ' • 🏫 ' +
        (student.school_name || '—');
    }


    /* =========================================
       Student Photo
    ========================================= */

    const photoBox =
      document.getElementById('studentPhoto');

    if (photoBox) {

      if (student.photo_url) {

        photoBox.innerHTML =
          '<img src="' +
          escapeHtml(student.photo_url) +
          '" alt="Student Photo">';

      } else {

        photoBox.textContent =
          getInitials(student.full_name);

      }
    }


    /* =========================================
       Load Test Attempts

       IMPORTANT:
       tests nested relation नहीं है।
    ========================================= */

    const {
      data: attempts,
      error: attemptsError
    } = await supabaseClient
      .from('test_attempts')
      .select(`
        id,
        test_id,
        correct_answers,
        wrong_answers,
        unattempted,
        score,
        total_marks,
        percentage,
        started_at,
        submitted_at,
        time_taken_seconds,
        status
      `)
      .eq('student_id', student.id)
      .order(
        'submitted_at',
        {
          ascending: false
        }
      );

    if (attemptsError) {
      throw attemptsError;
    }

    const attemptList = attempts || [];


    /* =========================================
       Submitted Attempts
    ========================================= */

    const submittedAttempts =
      attemptList.filter(function (attempt) {

        const status =
          String(
            attempt.status || ''
          ).toLowerCase();

        return (
          status === 'submitted' ||
          !!attempt.submitted_at
        );

      });


    /* =========================================
       Test IDs
    ========================================= */

    const testIds = [
      ...new Set(
        submittedAttempts
          .map(function (attempt) {
            return attempt.test_id;
          })
          .filter(function (testId) {
            return (
              testId !== null &&
              testId !== undefined
            );
          })
      )
    ];


    /* =========================================
       Load Tests Separately
    ========================================= */

    let testMap = {};

    if (testIds.length > 0) {

      const {
        data: tests,
        error: testsError
      } = await supabaseClient
        .from('tests')
        .select(`
          id,
          title,
          test_type,
          class_level,
          test_date
        `)
        .in('id', testIds);

      if (testsError) {
        throw testsError;
      }

      (tests || []).forEach(function (test) {
        testMap[test.id] = test;
      });
    }


    /* =========================================
       Combine Attempt + Test
    ========================================= */

    const enrichedAttempts =
      submittedAttempts.map(function (attempt) {

        return {
          id: attempt.id,
          test_id: attempt.test_id,
          correct_answers: attempt.correct_answers,
          wrong_answers: attempt.wrong_answers,
          unattempted: attempt.unattempted,
          score: attempt.score,
          total_marks: attempt.total_marks,
          percentage: attempt.percentage,
          started_at: attempt.started_at,
          submitted_at: attempt.submitted_at,
          time_taken_seconds: attempt.time_taken_seconds,
          status: attempt.status,
          tests: testMap[attempt.test_id] || null
        };

      });


    /* =========================================
       Class Filter
    ========================================= */

    const validAttempts =
      enrichedAttempts.filter(function (attempt) {

        const test = attempt.tests;

        if (!test) {
          return false;
        }

        return (
          Number(test.class_level) ===
          Number(student.class_level)
        );

      });


    /* =========================================
       Statistics
    ========================================= */

    const totalTests =
      validAttempts.length;

    let totalPercentage = 0;
    let bestPercentage = 0;

    validAttempts.forEach(function (attempt) {

      const percentage =
        Number(attempt.percentage || 0);

      totalPercentage += percentage;

      if (percentage > bestPercentage) {
        bestPercentage = percentage;
      }

    });

    const averagePercentage =
      totalTests > 0
        ? totalPercentage / totalTests
        : 0;


    /* =========================================
       Display Statistics
    ========================================= */

    const totalTestsElement =
      document.getElementById('totalTests');

    const averageElement =
      document.getElementById('averagePercentage');

    const bestElement =
      document.getElementById('bestPercentage');

    if (totalTestsElement) {
      totalTestsElement.textContent =
        totalTests;
    }

    if (averageElement) {
      averageElement.textContent =
        averagePercentage.toFixed(1) + '%';
    }

    if (bestElement) {
      bestElement.textContent =
        bestPercentage.toFixed(1) + '%';
    }


    /* =========================================
       Render Results
    ========================================= */

    renderResults(validAttempts);


  } catch (error) {

    console.error(
      'Student Progress Load Error:',
      error
    );

    const studentName =
      document.getElementById('studentName');

    const studentInfo =
      document.getElementById('studentInfo');

    const resultList =
      document.getElementById('resultList');

    if (studentName) {
      studentName.textContent =
        'जानकारी लोड नहीं हो सकी';
    }

    if (studentInfo) {
      studentInfo.textContent =
        'कृपया बाद में पुनः प्रयास करें।';
    }

    if (resultList) {
      resultList.innerHTML =
        '<div class="error-box">' +
        '❌ टेस्ट परिणाम लोड नहीं हो सके।' +
        '</div>';
    }

    alert(
      'डेटा लोड नहीं हो सका: ' +
      (
        error.message ||
        'Unknown Error'
      )
    );

  }


  /* =========================================
     Render Results
  ========================================= */

  function renderResults(attempts) {

    const resultList =
      document.getElementById('resultList');

    if (!resultList) {
      return;
    }

    if (!attempts.length) {

      resultList.innerHTML =
        '<div class="empty-box">' +
        '📝 इस विद्यार्थी ने अभी तक कोई टेस्ट Submit नहीं किया है।' +
        '</div>';

      return;
    }

    resultList.innerHTML =
      attempts.map(function (attempt) {

        const test =
          attempt.tests || {};

        const title =
          test.title || 'टेस्ट';

        const score =
          Number(attempt.score || 0);

        const totalMarks =
          Number(attempt.total_marks || 0);

        const percentage =
          Number(attempt.percentage || 0);

        const correct =
          Number(attempt.correct_answers || 0);

        const wrong =
          Number(attempt.wrong_answers || 0);

        const date =
          formatDate(
            attempt.submitted_at ||
            test.test_date ||
            attempt.started_at
          );

        return (
          '<div class="mini-result">' +

            '<div class="result-info">' +

              '<b>' +
                escapeHtml(title) +
              '</b>' +

              '<small>' +
                '✅ सही: ' +
                correct +
                '&nbsp; | &nbsp;' +
                '❌ गलत: ' +
                wrong +
              '</small>' +

            '</div>' +

            '<div class="result-score">' +
              score +
              '/' +
              totalMarks +
              '<br>' +
              percentage.toFixed(1) +
              '%' +
            '</div>' +

            '<div class="result-date">' +
              '📅 ' +
              escapeHtml(date) +
            '</div>' +

          '</div>'
        );

      }).join('');

  }


  /* =========================================
     Date Format
  ========================================= */

  function formatDate(value) {

    if (!value) {
      return '—';
    }

    try {

      return new Date(value)
        .toLocaleDateString(
          'hi-IN',
          {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          }
        );

    } catch (error) {

      return '—';

    }

  }


  /* =========================================
     Initials
  ========================================= */

  function getInitials(name) {

    return String(name || 'GS')
      .trim()
      .split(/\s+/)
      .map(function (word) {
        return word.charAt(0);
      })
      .join('')
      .slice(0, 2)
      .toUpperCase();

  }


  /* =========================================
     HTML Escape
  ========================================= */

  function escapeHtml(value) {

    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  }


  /* =========================================
     Live Refresh
  ========================================= */

  setInterval(function () {

    if (
      document.visibilityState ===
      'visible'
    ) {
      location.reload();
    }

  }, 30000);

});
