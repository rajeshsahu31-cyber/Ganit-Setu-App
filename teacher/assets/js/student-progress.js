document.addEventListener('DOMContentLoaded', async () => {

/* =========================================
URL से Student ID लें
========================================= */

const params = new URLSearchParams(window.location.search);

const studentId = params.get('student_id');

if (!studentId) {
alert('विद्यार्थी की जानकारी नहीं मिली।');
location.href = 'students.html';
return;
}

/* =========================================
Teacher का DISE Code लें
========================================= */

const teacherDiseCode =
sessionStorage.getItem('ganit_setu_teacher_dise_code');

if (!teacherDiseCode) {
alert('Teacher का DISE Code नहीं मिला। कृपया दोबारा लॉगिन करें।');
location.href = 'index.html';
return;
}

try {

```
/* =========================================
   Student की जानकारी लोड करें

   केवल उसी Teacher के School का Student
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
   Student की जानकारी दिखाएं
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
   Profile Photo
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
   Student Results

   test_attempts पर RLS enabled है।

   इसलिए direct SELECT नहीं करेंगे।

   SECURITY DEFINER RPC:
   get_ganit_student_results()
========================================= */

console.log(
  'Loading results for student:',
  student.student_id
);


const {
  data: rpcResults,
  error: rpcError
} = await supabaseClient.rpc(
  'get_ganit_student_results',
  {
    p_student_code: student.student_id
  }
);


if (rpcError) {
  throw rpcError;
}


console.log(
  'Student Results:',
  rpcResults
);


/* =========================================
   RPC Result को Frontend Format में बदलें
========================================= */

const attempts =
  (rpcResults || []).map(function (row) {

    return {

      id:
        row.attempt_id,

      test_id:
        row.test_id,

      correct_answers:
        Number(row.correct_answers || 0),

      wrong_answers:
        Number(row.wrong_answers || 0),

      unattempted:
        Number(row.unattempted || 0),

      score:
        Number(row.score || 0),

      total_marks:
        Number(row.total_marks || 0),

      percentage:
        Number(row.percentage || 0),

      started_at:
        row.submitted_at || null,

      submitted_at:
        row.submitted_at || null,

      time_taken_seconds:
        row.time_taken_seconds || null,

      status:
        'submitted',

      tests: {

        id:
          row.test_id,

        title:
          row.test_title || 'टेस्ट',

        test_type:
          row.test_type || '',

        class_level:
          Number(row.class_level),

        test_date:
          row.submitted_at || null

      }

    };

  });


/* =========================================
   केवल Submitted Results
========================================= */

const submittedAttempts =
  attempts.filter(function (attempt) {

    return (
      String(
        attempt.status || ''
      ).toLowerCase() === 'submitted'
    ) ||
    !!attempt.submitted_at;

  });


/* =========================================
   केवल उसी Class के Tests
========================================= */

const validAttempts =
  submittedAttempts.filter(function (attempt) {

    if (!attempt.tests) {
      return false;
    }


    return (
      Number(
        attempt.tests.class_level
      ) ===
      Number(
        student.class_level
      )
    );

  });


console.log(
  'Valid Student Results:',
  validAttempts
);


/* =========================================
   Progress Statistics
========================================= */

const totalTests =
  validAttempts.length;


let totalPercentage = 0;

let bestPercentage = 0;


validAttempts.forEach(function (attempt) {

  const percentage =
    Number(
      attempt.percentage || 0
    );


  totalPercentage +=
    percentage;


  if (
    percentage >
    bestPercentage
  ) {

    bestPercentage =
      percentage;

  }

});


const averagePercentage =
  totalTests > 0
    ? totalPercentage / totalTests
    : 0;


/* =========================================
   Statistics दिखाएं
========================================= */

const totalTestsElement =
  document.getElementById(
    'totalTests'
  );


const averagePercentageElement =
  document.getElementById(
    'averagePercentage'
  );


const bestPercentageElement =
  document.getElementById(
    'bestPercentage'
  );


if (totalTestsElement) {

  totalTestsElement.textContent =
    totalTests;

}


if (averagePercentageElement) {

  averagePercentageElement.textContent =
    averagePercentage.toFixed(1) +
    '%';

}


if (bestPercentageElement) {

  bestPercentageElement.textContent =
    bestPercentage.toFixed(1) +
    '%';

}


/* =========================================
   Result List
========================================= */

renderResults(
  validAttempts
);
```

} catch (error) {

```
console.error(
  'Student Progress Load Error:',
  error
);


const studentName =
  document.getElementById(
    'studentName'
  );


const studentInfo =
  document.getElementById(
    'studentInfo'
  );


const resultList =
  document.getElementById(
    'resultList'
  );


if (studentName) {

  studentName.textContent =
    'जानकारी लोड नहीं हो सकी';

}


if (studentInfo) {

  studentInfo.textContent =
    'कृपया बाद में पुनः प्रयास करें।';

}


if (resultList) {

  resultList.innerHTML = `

    <div class="error-box">

      ❌ टेस्ट परिणाम लोड नहीं हो सके।

    </div>

  `;

}


console.error(
  'Error message:',
  error.message || 'Unknown Error'
);
```

}

/* =========================================
Results Render करें
========================================= */

function renderResults(
attempts
) {

```
const resultList =
  document.getElementById(
    'resultList'
  );


if (!resultList) {
  return;
}


if (!attempts.length) {

  resultList.innerHTML = `

    <div class="empty-box">

      📝 इस विद्यार्थी ने अभी तक कोई टेस्ट Submit नहीं किया है।

    </div>

  `;

  return;
}


resultList.innerHTML =
  attempts.map(function (attempt) {

    const test =
      attempt.tests || {};


    const title =
      test.title || 'टेस्ट';


    const score =
      Number(
        attempt.score || 0
      );


    const totalMarks =
      Number(
        attempt.total_marks || 0
      );


    const percentage =
      Number(
        attempt.percentage || 0
      );


    const correct =
      Number(
        attempt.correct_answers || 0
      );


    const wrong =
      Number(
        attempt.wrong_answers || 0
      );


    const unattempted =
      Number(
        attempt.unattempted || 0
      );


    const date =
      formatDate(
        attempt.submitted_at ||
        test.test_date ||
        attempt.started_at
      );


    return `

      <div class="mini-result">

        <div class="result-info">

          <b>
            ${escapeHtml(title)}
          </b>

          <small>

            ✅ सही: ${correct}

            &nbsp; | &nbsp;

            ❌ गलत: ${wrong}

            &nbsp; | &nbsp;

            ⭕ छोड़े: ${unattempted}

          </small>

        </div>


        <div class="result-score">

          ${score}/${totalMarks}

          <br>

          ${percentage.toFixed(1)}%

        </div>


        <div class="result-date">

          📅 ${escapeHtml(date)}

        </div>

      </div>

    `;

  }).join('');
```

}

/* =========================================
Date Format
========================================= */

function formatDate(
value
) {

```
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
```

}

/* =========================================
Initials
========================================= */

function getInitials(
name
) {

```
return String(
  name || 'GS'
)
  .trim()
  .split(/\s+/)
  .map(function (word) {

    return word.charAt(0);

  })
  .join('')
  .slice(0, 2)
  .toUpperCase();
```

}

/* =========================================
HTML Escape
========================================= */

function escapeHtml(
value
) {

```
return String(
  value ?? ''
)
  .replace(
    /&/g,
    '&amp;'
  )
  .replace(
    /</g,
    '&lt;'
  )
  .replace(
    />/g,
    '&gt;'
  )
  .replace(
    /"/g,
    '&quot;'
  )
  .replace(
    /'/g,
    '&#039;'
  );
```

}

/* =========================================
Live Refresh
========================================= */

setInterval(
function () {

```
  if (
    document.visibilityState ===
    'visible'
  ) {

    location.reload();

  }

},
30000
```

);

});
