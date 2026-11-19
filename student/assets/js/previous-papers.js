(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const sid = sessionStorage.getItem('ganit_setu_student_id');
  let student = null, marks = 1, rows = [], answers = new Map();
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function msg(t){ $('status').textContent=t; }
  function normalizeMedium(value){
    const v=String(value??'').trim().toLowerCase();
    if(['english','eng','english medium','अंग्रेज़ी','अंग्रेजी','अंग्रेज़ी माध्यम','अंग्रेजी माध्यम'].includes(v)) return 'English';
    if(['hindi','hin','hindi medium','हिंदी','हिन्दी','हिंदी माध्यम','हिन्दी माध्यम'].includes(v)) return 'Hindi';
    if(['both','all','दोनों','दोनों माध्यम'].includes(v)) return 'Both';
    return v;
  }
  function languageField(row, hi, en){ return normalizeMedium(student.medium) === 'English' ? (row[en] || row[hi] || '') : (row[hi] || row[en] || ''); }
  async function init(){
    if(!sid){ location.href='index.html'; return; }
    const {data,error}=await supabaseClient.from('students').select('student_id,class_level,medium').eq('student_id',sid).maybeSingle();
    if(error || !data){ msg('विद्यार्थी की प्रोफाइल नहीं मिल सकी।'); return; }
    student=data;
    const normalizedMedium=normalizeMedium(student.medium);
    if(!['Hindi','English'].includes(normalizedMedium)) { console.warn('[Previous Papers] Unknown student medium:',student.medium); msg('आपकी प्रोफाइल में माध्यम दर्ज नहीं है। कृपया स्कूल/प्रशासन से संपर्क करें।'); return; }
    student.medium=normalizedMedium;
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
      q=supabaseClient.from('objective_questions').select('id,class_level,question_text_hi,question_text_en,option_a_hi,option_b_hi,option_c_hi,option_d_hi,option_a_en,option_b_en,option_c_en,option_d_en,correct_option,hint_hi,hint_en,explanation_hi,explanation_en,medium,exam_year,paper_set,status,is_active,source_question').eq('class_level',Number(student.class_level)).eq('status','published').eq('is_active',true).order('exam_year',{ascending:false}).order('source_question');
    } else {
      q=supabaseClient.from('written_questions').select('id,question_id,class_level,marks,question_text_hi,question_text_en,given_data_hi,given_data_en,required_to_find_hi,required_to_find_en,solution_steps_hi,solution_steps_en,formula_theorem_hi,formula_theorem_en,final_answer_hi,final_answer_en,medium,exam_year,paper_set,status,is_active').eq('class_level',Number(student.class_level)).eq('marks',marks).eq('status','published').eq('is_active',true).order('exam_year',{ascending:false}).order('question_id');
    }
    const {data,error}=await q;
    if(error){
      console.error('[Previous Papers] Supabase query failed:',{message:error.message,details:error.details,hint:error.hint,code:error.code,marks,classLevel:student.class_level,medium:student.medium});
      msg(`प्रश्न लोड नहीं हुए: ${error.message || 'डेटाबेस त्रुटि'} `);
      return;
    }
    // Medium values may be stored with different labels (Hindi/Hindi Medium/हिंदी).
    // Fetch the class/published rows first, then apply a normalized medium filter.
    const requested=normalizeMedium(student.medium);
    rows=(data||[]).filter(r=>{
      const stored=normalizeMedium(r.medium);
      return stored===requested || stored==='Both' || stored==='';
    });
    console.info('[Previous Papers] Loaded rows:',{marks,classLevel:student.class_level,medium:student.medium,dbRows:(data||[]).length,visibleRows:rows.length,storedMediums:[...new Set((data||[]).map(r=>r.medium))]});
    fillFilters(rows); render();
  }
  function fillFilters(data){
    const years=[...new Set(data.map(x=>x.exam_year).filter(Boolean).map(String))].sort((a,b)=>Number(b)-Number(a));
    const sets=[...new Set(data.map(x=>x.paper_set).filter(Boolean).map(String))].sort();
    const y=$('yearFilter'), oldY=y.value; y.innerHTML='<option value="">सभी उपलब्ध सत्र</option>'+years.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join(''); if(years.includes(oldY))y.value=oldY;
    const s=$('setFilter'),oldS=s.value;s.innerHTML='<option value="">सभी सेट</option>'+sets.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');if(sets.includes(oldS))s.value=oldS;
  }
  function questionKey(r){
    const q=String(r.question_text_hi||r.question_text_en||'').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
    const medium=normalizeMedium(r.medium);
    const options=marks===1?['a','b','c','d'].map(k=>String(r['option_'+k+'_hi']||r['option_'+k+'_en']||'').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim()).join('|'):'';
    return [Number(r.class_level),marks,medium,q,options].join('::');
  }
  function groupedQuestions(){
    const groups=new Map();
    rows.forEach(r=>{
      const key=questionKey(r);
      if(!groups.has(key)) groups.set(key,{...r,appearances:[]});
      const g=groups.get(key);
      const year=String(r.exam_year||'').trim(), set=String(r.paper_set||'').trim();
      if(year||set){
        const label=[year,set?`Set ${set}`:''].filter(Boolean).join(' ');
        if(!g.appearances.some(a=>a.label===label)) g.appearances.push({year,set,label});
      }
    });
    return [...groups.values()].map(g=>({...g,appearances:g.appearances.sort((a,b)=>Number(b.year||0)-Number(a.year||0)||a.set.localeCompare(b.set))}));
  }
  function filtered(){
    const year=$('yearFilter').value, set=$('setFilter').value;
    return groupedQuestions().filter(g=>g.appearances.some(a=>(!year||a.year===year)&&(!set||a.set===set)));
  }
  function sessionLabel(r){
    const labels=(r.appearances||[]).map(a=>a.label).filter(Boolean);
    return labels.length?`<div class="paper-session-label">${labels.map(esc).join(' | ')}</div>`:'';
  }

  function ensureExportToolbar(){
    let bar=$('exportToolbar');
    if(!bar){
      bar=document.createElement('div');bar.id='exportToolbar';bar.className='export-toolbar';
      bar.innerHTML='<button type="button" class="export-btn" id="downloadSessionPdf">इस सत्र के सभी प्रश्न PDF में</button><button type="button" class="export-btn secondary" id="shareSessionPdf">पूरा सत्र शेयर करें</button><p class="export-note" style="flex-basis:100%">चुने हुए सत्र और पेपर सेट के सभी प्रश्न एक PDF में आएँगे।</p>';
      $('questions').before(bar);
      $('downloadSessionPdf').addEventListener('click',()=>exportSession(false));
      $('shareSessionPdf').addEventListener('click',()=>exportSession(true));
    }
    bar.style.display=(marks===1?'none':'flex');
  }
  async function captureCard(card){
    if(!window.html2canvas)throw new Error('इमेज सुविधा लोड नहीं हुई। इंटरनेट कनेक्शन जाँचें।');
    if(document.fonts?.ready)await document.fonts.ready;
    return await window.html2canvas(card,{scale:2,useCORS:true,backgroundColor:'#ffffff',logging:false});
  }
  function safeName(s){return String(s||'Ganit_Setu').replace(/[^\w\-]+/g,'_').slice(0,60);}
  async function makePdf(cards){
    if(!window.jspdf?.jsPDF)throw new Error('PDF सुविधा लोड नहीं हुई। इंटरनेट कनेक्शन जाँचें।');
    const {jsPDF}=window.jspdf,pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    for(let i=0;i<cards.length;i++){
      const c=await captureCard(cards[i]),scale=Math.min(192/c.width,279/c.height);
      if(i)pdf.addPage();
      pdf.addImage(c.toDataURL('image/png'),'PNG',(210-c.width*scale)/2,9,c.width*scale,c.height*scale,undefined,'FAST');
    }
    return pdf;
  }
  async function withBusy(btn,fn){
    const old=btn.textContent;btn.disabled=true;btn.textContent='तैयार हो रहा है...';
    try{await fn();}catch(e){console.error(e);alert(e.message||'फाइल तैयार नहीं हो सकी।');}
    finally{btn.disabled=false;btn.textContent=old;}
  }
  async function exportSession(share){
    const cards=[...$('questions').querySelectorAll('.handwritten-card,.question-card')];
    if(!cards.length){alert('इस सत्र में प्रश्न उपलब्ध नहीं हैं।');return;}
    const btn=$(share?'shareSessionPdf':'downloadSessionPdf');
    await withBusy(btn,async()=>{
      const pdf=await makePdf(cards),year=$('yearFilter').value||'All_Sessions',set=$('setFilter').value||'All_Sets';
      const name=safeName(`Ganit_Setu_Class${student.class_level}_${marks}Marks_${year}_${set}`);
      const blob=pdf.output('blob'),file=new File([blob],name+'.pdf',{type:'application/pdf'});
      if(share&&navigator.share&&navigator.canShare?.({files:[file]})){
        await navigator.share({files:[file],title:'गणित सेतु — सत्र के प्रश्न और हल'});
      }else{pdf.save(name+'.pdf');if(share)alert('सीधा शेयर उपलब्ध नहीं है। PDF डाउनलोड हो गई है; इसे WhatsApp पर भेजें।');}
    });
  }
  async function exportOne(card,kind,share){
    const btn=card.querySelector(share?'[data-share-one]':`[data-export-${kind}]`);
    await withBusy(btn,async()=>{
      const canvas=await captureCard(card),title=safeName(card.querySelector('.hw-question,.question-title')?.textContent);
      let blob,file;
      if(kind==='png'){blob=await new Promise(r=>canvas.toBlob(r,'image/png'));file=new File([blob],title+'.png',{type:'image/png'});}
      else{const pdf=await makePdf([card]);blob=pdf.output('blob');file=new File([blob],title+'.pdf',{type:'application/pdf'});}
      if(share&&navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:'गणित सेतु प्रश्न और हल'});}
      else if(kind==='png'){const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download=title+'.png';a.click();if(share)alert('इमेज डाउनलोड हो गई है; इसे WhatsApp पर भेजें।');}
      else{const pdf=await makePdf([card]);pdf.save(title+'.pdf');if(share)alert('PDF डाउनलोड हो गई है; इसे WhatsApp पर भेजें।');}
    });
  }
  function render(){
    ensureExportToolbar();
    const list=filtered(); $('questions').innerHTML='';
    if(!list.length){msg('इस सत्र / सेट में प्रकाशित प्रश्न उपलब्ध नहीं हैं।');return;}
    msg(`${list.length} प्रश्न उपलब्ध हैं।`);
    if(marks===1){
      $('questions').innerHTML=list.map((r,i)=>{
        const opts=['a','b','c','d'].map(k=>`<label class="option"><input type="radio" name="q_${i}" value="${k.toUpperCase()}"> ${k.toUpperCase()}. ${esc(languageField(r,'option_'+k+'_hi','option_'+k+'_en'))}</label>`).join('');
        return `<article class="question-card">${sessionLabel(r)}<div class="question-title">प्रश्न ${i+1}. ${esc(languageField(r,'question_text_hi','question_text_en'))}</div>${opts}</article>`;
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
        if(marks>=2){
          const givenBlock=given?`<div class="hw-section">${student.medium==='English'?'Given':'दिया गया'}</div><div class="hw-given">${esc(given)}</div>`:'';
          const requiredBlock=required?`<div class="hw-section">${student.medium==='English'?'To find':'ज्ञात करना है'}</div><div class="hw-text">${esc(required)}</div>`:'';
          const formulaBlock=formula?`<div class="hw-section">${student.medium==='English'?'Formula / Theorem':'सूत्र / प्रमेय'}</div><div class="hw-formula">${esc(formula)}</div>`:'';
          const solutionBlock=solution?`<div class="hw-section">${student.medium==='English'?'Step-by-step solution':'हल के चरण'}</div><div class="hw-text">${esc(solution)}</div>`:'';
          const answerBlock=final?`<div class="hw-answer">${student.medium==='English'?'Final Answer:':'अंतिम उत्तर:'} ${esc(final)}</div>`:'';
          return `<article class="handwritten-card">${sessionLabel(r)}<div class="handwritten-head"><span>${student.medium==='English'?'MATHEMATICS • SOLVED ANSWER':'गणित सेतु • हल सहित प्रश्न'} ${i+1}</span><span class="handwritten-mark">${marks} ${student.medium==='English'?'Marks':'अंक'}</span></div><div class="handwritten-paper"><div class="hw-question">${student.medium==='English'?'Question':'प्रश्न'} ${i+1}. ${esc(question)}</div><div class="hw-solution-content" id="hw_solution_${i}">${givenBlock}${requiredBlock}${formulaBlock}${solutionBlock}${answerBlock}</div></div><div class="hw-actions"><button class="hw-toggle" type="button" data-target="hw_solution_${i}">${student.medium==='English'?'Hide solution':'हल छिपाएँ'}</button></div><div class="export-actions"><button type="button" class="export-btn" data-export-pdf>PDF</button><button type="button" class="export-btn secondary" data-export-png>इमेज</button><button type="button" class="export-btn" data-share-one>शेयर</button></div></article>`;
        }
        return `<article class="question-card">${sessionLabel(r)}<div class="question-title">प्रश्न ${i+1}. ${esc(question)}</div>${given?`<p><b>${student.medium==='English'?'Given':'दिया गया'}:</b> ${esc(given)}</p>`:''}${required?`<p><b>${student.medium==='English'?'To find':'ज्ञात करना है'}:</b> ${esc(required)}</p>`:''}<p><b>${student.medium==='English'?'Solution':'हल'}:</b></p><div class="solution">${esc([formula,solution,final].filter(Boolean).join('\n\n'))}</div><div class="export-actions"><button type="button" class="export-btn" data-export-pdf>PDF</button><button type="button" class="export-btn secondary" data-export-png>इमेज</button><button type="button" class="export-btn" data-share-one>शेयर</button></div></article>`;
      }).join('');
      if(marks>=2){
        $('questions').querySelectorAll('.hw-toggle').forEach(btn=>btn.addEventListener('click',()=>{
          const target=$(btn.dataset.target);
          if(!target)return;
          target.hidden=!target.hidden;
          btn.textContent=target.hidden?(student.medium==='English'?'Show solution':'हल दिखाएँ'):(student.medium==='English'?'Hide solution':'हल छिपाएँ');
        }));
      }
      $('questions').querySelectorAll('.handwritten-card,.question-card').forEach(card=>{
        card.querySelector('[data-export-pdf]')?.addEventListener('click',()=>exportOne(card,'pdf',false));
        card.querySelector('[data-export-png]')?.addEventListener('click',()=>exportOne(card,'png',false));
        card.querySelector('[data-share-one]')?.addEventListener('click',()=>exportOne(card,'pdf',true));
      });
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
