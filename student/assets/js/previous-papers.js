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

  function ensureExportToolbar(){
    let bar=$('exportToolbar');
    if(!bar){
      bar=document.createElement('div');bar.id='exportToolbar';bar.className='export-toolbar';
      bar.innerHTML='<button type="button" class="export-btn" id="downloadAllPdf">सभी हल एक PDF में डाउनलोड करें</button><p class="export-note" style="flex-basis:100%">हर प्रश्न का PDF या PNG अलग से भी डाउनलोड कर सकते हैं।</p>';
      $('questions').before(bar);
      $('downloadAllPdf').addEventListener('click',()=>exportAllPdf());
    }
    bar.style.display=(marks===1?'none':'flex');
  }
  async function makeCanvas(element){
    if(!window.html2canvas) throw new Error('इमेज बनाने की लाइब्रेरी लोड नहीं हुई। इंटरनेट कनेक्शन जाँचें।');
    if(document.fonts?.ready) await document.fonts.ready;
    return await window.html2canvas(element,{scale:2,useCORS:true,backgroundColor:'#ffffff',logging:false});
  }
  function safeFileName(value){return String(value||'ganit-setu').replace(/[^\w\-]+/g,'_').slice(0,70);}
  async function exportPng(card,filename){
    const canvas=await makeCanvas(card);
    const a=document.createElement('a');a.download=filename+'.png';a.href=canvas.toDataURL('image/png');a.click();
  }
  async function exportPdfCards(cards,filename){
    if(!window.jspdf?.jsPDF) throw new Error('PDF लाइब्रेरी लोड नहीं हुई। इंटरनेट कनेक्शन जाँचें।');
    const {jsPDF}=window.jspdf;
    const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    const pageW=210,pageH=297,margin=10;
    for(let i=0;i<cards.length;i++){
      const canvas=await makeCanvas(cards[i]);
      const img=canvas.toDataURL('image/png');
      const ratio=Math.min((pageW-2*margin)/canvas.width,(pageH-2*margin)/canvas.height);
      const w=canvas.width*ratio,h=canvas.height*ratio;
      if(i>0)pdf.addPage();
      pdf.addImage(img,'PNG',(pageW-w)/2,margin,w,h,undefined,'FAST');
    }
    pdf.save(filename+'.pdf');
  }
  async function runExport(button,workFn){
    const old=button.textContent;button.disabled=true;button.textContent='तैयार हो रहा है...';
    try{await workFn();}
    catch(e){console.error(e);alert(e.message||'फाइल तैयार नहीं हो सकी।');}
    finally{button.disabled=false;button.textContent=old;}
  }
  async function exportAllPdf(){
    const cards=[...$('questions').querySelectorAll('.question-card')];
    if(!cards.length)return;
    const btn=$('downloadAllPdf');
    await runExport(btn,()=>exportPdfCards(cards,`Ganit_Setu_Class${student.class_level}_${marks}Marks_All_Solutions`));
  }
  function render(){
    ensureExportToolbar();
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
        const cardId=`writtenCard_${i}`;
        return `<article class="question-card" id="${cardId}"><div class="question-title">प्रश्न ${i+1}. ${esc(question)}</div>${given?`<p><b>${student.medium==='English'?'Given':'दिया गया'}:</b> ${esc(given)}</p>`:''}${required?`<p><b>${student.medium==='English'?'To find':'ज्ञात करना है'}:</b> ${esc(required)}</p>`:''}<p><b>${student.medium==='English'?'Solution':'हल'}:</b></p><div class="solution">${esc([formula,solution,final].filter(Boolean).join('\n\n'))}</div><div class="export-actions export-toolbar"><button type="button" class="export-btn" data-export-pdf="${cardId}">PDF डाउनलोड</button><button type="button" class="export-btn secondary" data-export-png="${cardId}">इमेज डाउनलोड</button></div></article>`;
      }).join('');
      $('questions').querySelectorAll('[data-export-pdf]').forEach(btn=>btn.addEventListener('click',()=>{
        const card=$(btn.dataset.exportPdf);
        runExport(btn,()=>exportPdfCards([card],`Ganit_Setu_Question_${btn.dataset.exportPdf}`));
      }));
      $('questions').querySelectorAll('[data-export-png]').forEach(btn=>btn.addEventListener('click',()=>{
        const card=$(btn.dataset.exportPng);
        runExport(btn,()=>exportPng(card,`Ganit_Setu_Question_${btn.dataset.exportPng}`));
      }));
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
