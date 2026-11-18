(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const sid = sessionStorage.getItem('ganit_setu_student_id');
  let student = null, marks = 1, rows = [], answers = new Map();
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function msg(t){ $('status').textContent=t; }
  function languageField(row, hi, en){ return student.medium === 'English' ? (row[en] || row[hi] || '') : (row[hi] || row[en] || ''); }
  async function init(){
    if(!sid){ location.href='index.html'; return; }
    const {data,error}=await supabaseClient.from('students').select('student_id,class_level,medium').eq('student_id',sid).maybeSingle();
    if(error || !data){ msg('विद्यार्थी की प्रोफाइल नहीं मिल सकी।'); return; }
    student=data;
    if(!['Hindi','English'].includes(student.medium)) { msg('आपकी प्रोफाइल में माध्यम दर्ज नहीं है। कृपया स्कूल/प्रशासन से संपर्क करें।'); return; }
    sessionStorage.setItem('ganit_setu_student_class',String(student.class_level));
    sessionStorage.setItem('ganit_setu_student_medium',student.medium);
    $('studentInfo').textContent=`कक्षा ${student.class_level} • ${student.medium==='English'?'English Medium':'हिंदी माध्यम'}`;
    document.querySelectorAll('[data-marks]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-marks]').forEach(x=>x.classList.remove('active'));b.classList.add('active');marks=Number(b.dataset.marks);loadQuestions();}));
    $('yearFilter').addEventListener('change',loadQuestions); $('setFilter').addEventListener('change',loadQuestions);
    await loadQuestions();
  }
  async function loadQuestions(){
    $('questions').innerHTML=''; answers.clear(); msg('प्रश्न लोड हो रहे हैं...');
    let q;
    if(marks===1){
      q=supabaseClient.from('objective_questions').select('id,class_level,question_text_hi,question_text_en,option_a_hi,option_b_hi,option_c_hi,option_d_hi,option_a_en,option_b_en,option_c_en,option_d_en,correct_option,hint_hi,hint_en,explanation_hi,explanation_en,medium,exam_year,paper_set,status,is_active,source_question').eq('class_level',Number(student.class_level)).eq('status','published').eq('is_active',true).in('medium',[student.medium,'Both']).order('exam_year',{ascending:false}).order('source_question');
    } else {
      q=supabaseClient.from('written_questions').select('id,question_id,class_level,marks,question_text_hi,question_text_en,given_data_hi,given_data_en,required_to_find_hi,required_to_find_en,solution_steps_hi,solution_steps_en,formula_theorem_hi,formula_theorem_en,final_answer_hi,final_answer_en,medium,exam_year,paper_set,status,is_active').eq('class_level',Number(student.class_level)).eq('marks',marks).eq('status','published').eq('is_active',true).in('medium',[student.medium,'Both']).order('exam_year',{ascending:false}).order('question_id');
    }
    const {data,error}=await q;
    if(error){console.error(error);msg('प्रश्न लोड नहीं हुए। Admin से प्रकाशित प्रश्न और database access जाँचने को कहें।');return;}
    rows=data||[];
    fillFilters(rows); render();
  }
  function fillFilters(data){
    const years=[...new Set(data.map(x=>x.exam_year).filter(Boolean).map(String))].sort((a,b)=>Number(b)-Number(a));
    const sets=[...new Set(data.map(x=>x.paper_set).filter(Boolean).map(String))].sort();
    const y=$('yearFilter'), oldY=y.value; y.innerHTML='<option value="">सभी उपलब्ध सत्र</option>'+years.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join(''); if(years.includes(oldY))y.value=oldY;
    const s=$('setFilter'),oldS=s.value;s.innerHTML='<option value="">सभी सेट</option>'+sets.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');if(sets.includes(oldS))s.value=oldS;
  }
  function filtered(){return rows.filter(r=>(!$('yearFilter').value||String(r.exam_year)===$('yearFilter').value)&&(!$('setFilter').value||String(r.paper_set)===$('setFilter').value));}
  function render(){
    const list=filtered(); $('questions').innerHTML='';
    if(!list.length){msg('इस सत्र / सेट में प्रकाशित प्रश्न उपलब्ध नहीं हैं।');return;}
    msg(`${list.length} प्रश्न उपलब्ध हैं।`);
    if(marks===1){
      $('questions').innerHTML=list.map((r,i)=>{
        const opts=['a','b','c','d'].map(k=>`<label class="option"><input type="radio" name="q_${i}" value="${k.toUpperCase()}"> ${k.toUpperCase()}. ${esc(languageField(r,'option_'+k+'_hi','option_'+k+'_en'))}</label>`).join('');
        return `<article class="question-card"><div class="question-title">प्रश्न ${i+1}. ${esc(languageField(r,'question_text_hi','question_text_en'))}</div>${opts}</article>`;
      }).join('')+`<button class="primary-btn" id="submitQuiz">टेस्ट जमा करें</button><div id="quizResult"></div>`;
      $('questions').querySelectorAll('input[type=radio]').forEach(el=>el.addEventListener('change',e=>answers.set(e.target.name,e.target.value)));
      $('submitQuiz').addEventListener('click',()=>submitQuiz(list));
    } else {
      $('questions').innerHTML=list.map((r,i)=>{
        const question=languageField(r,'question_text_hi','question_text_en');
        const given=languageField(r,'given_data_hi','given_data_en');
        const required=languageField(r,'required_to_find_hi','required_to_find_en');
        const formula=languageField(r,'formula_theorem_hi','formula_theorem_en');
        const solution=languageField(r,'solution_steps_hi','solution_steps_en');
        const final=languageField(r,'final_answer_hi','final_answer_en');
        if(marks===2){
          const givenBlock=given?`<div class="hw-section">${student.medium==='English'?'Given':'दिया गया'}</div><div class="hw-given">${esc(given)}</div>`:'';
          const requiredBlock=required?`<div class="hw-section">${student.medium==='English'?'To find':'ज्ञात करना है'}</div><div class="hw-text">${esc(required)}</div>`:'';
          const formulaBlock=formula?`<div class="hw-section">${student.medium==='English'?'Formula / Theorem':'सूत्र / प्रमेय'}</div><div class="hw-formula">${esc(formula)}</div>`:'';
          const solutionBlock=solution?`<div class="hw-section">${student.medium==='English'?'Step-by-step solution':'हल के चरण'}</div><div class="hw-text">${esc(solution)}</div>`:'';
          const answerBlock=final?`<div class="hw-answer">${student.medium==='English'?'Final Answer:':'अंतिम उत्तर:'} ${esc(final)}</div>`:'';
          return `<article class="handwritten-card"><div class="handwritten-head"><span>${student.medium==='English'?'MATHEMATICS • SOLVED ANSWER':'गणित सेतु • हल सहित प्रश्न'} ${i+1}</span><span class="handwritten-mark">2 ${student.medium==='English'?'Marks':'अंक'}</span></div><div class="handwritten-paper"><div class="hw-question">${student.medium==='English'?'Question':'प्रश्न'} ${i+1}. ${esc(question)}</div><div class="hw-solution-content" id="hw_solution_${i}">${givenBlock}${requiredBlock}${formulaBlock}${solutionBlock}${answerBlock}</div></div><div class="hw-actions"><button class="hw-toggle" type="button" data-target="hw_solution_${i}">${student.medium==='English'?'Hide solution':'हल छिपाएँ'}</button></div></article>`;
        }
        return `<article class="question-card"><div class="question-title">प्रश्न ${i+1}. ${esc(question)}</div>${given?`<p><b>${student.medium==='English'?'Given':'दिया गया'}:</b> ${esc(given)}</p>`:''}${required?`<p><b>${student.medium==='English'?'To find':'ज्ञात करना है'}:</b> ${esc(required)}</p>`:''}<p><b>${student.medium==='English'?'Solution':'हल'}:</b></p><div class="solution">${esc([formula,solution,final].filter(Boolean).join('\n\n'))}</div></article>`;
      }).join('');
      if(marks===2){
        $('questions').querySelectorAll('.hw-toggle').forEach(btn=>btn.addEventListener('click',()=>{
          const target=$(btn.dataset.target);
          if(!target)return;
          target.hidden=!target.hidden;
          btn.textContent=target.hidden?(student.medium==='English'?'Show solution':'हल दिखाएँ'):(student.medium==='English'?'Hide solution':'हल छिपाएँ');
        }));
      }
    }
  }
  function submitQuiz(list){
    let correct=0,attempted=0;
    list.forEach((r,i)=>{const chosen=answers.get(`q_${i}`);if(chosen)attempted++;if(chosen&&chosen===String(r.correct_option||'').toUpperCase())correct++;});
    const total=list.length, pct=total?Math.round(correct/total*100):0;
    $('quizResult').innerHTML=`<div class="message"><b>टेस्ट परिणाम</b><br>कुल प्रश्न: ${total}<br>हल किए: ${attempted}<br>सही उत्तर: ${correct}<br>प्रतिशत: ${pct}%<br><small>यह अभ्यास परिणाम है; इसे पुराने लीडरबोर्ड में शामिल नहीं किया गया है।</small></div>`;
    $('questions').querySelectorAll('input[type=radio]').forEach(el=>el.disabled=true);$('submitQuiz').disabled=true;
  }
  document.addEventListener('DOMContentLoaded',init);
})();
