(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const sid = sessionStorage.getItem('ganit_setu_student_id');
  let student = null, marks = 1, rows = [], answers = new Map();
  let chooserPanel = null, resultPanel = null, questionPageOpen = false;
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
    const panels=document.querySelectorAll('main.paper-wrap > .paper-panel');
    chooserPanel=panels[0]||null; resultPanel=panels[1]||null;
    if(resultPanel) resultPanel.hidden=true;
    if(resultPanel && !$('previousPapersBack')){
      const back=document.createElement('button'); back.type='button'; back.id='previousPapersBack'; back.className='export-btn secondary'; back.textContent='← प्रश्नों के प्रकार पर वापस जाएँ'; back.style.marginBottom='12px';
      resultPanel.insertBefore(back,resultPanel.firstChild);
      back.addEventListener('click',closeQuestionPage);
    }
    document.querySelectorAll('[data-marks]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-marks]').forEach(x=>x.classList.remove('active'));b.classList.add('active');marks=Number(b.dataset.marks);openQuestionPage();loadQuestions();}));
    $('yearFilter').addEventListener('change',()=>{if(questionPageOpen)loadQuestions();}); $('setFilter').addEventListener('change',()=>{if(questionPageOpen)loadQuestions();});
  }
  function openQuestionPage(){
    questionPageOpen=true;
    if(chooserPanel)chooserPanel.hidden=true;
    if(resultPanel)resultPanel.hidden=false;
    const back=$('previousPapersBack'); if(back)back.hidden=false;
  }
  function closeQuestionPage(){
    questionPageOpen=false; clearInterval(objectiveTimer);
    if(chooserPanel)chooserPanel.hidden=false;
    if(resultPanel)resultPanel.hidden=true;
    $('questions').innerHTML=''; $('status').textContent='प्रश्न देखने के लिए ऊपर से अंक चुनें।';
    $('exportToolbar')?.remove(); answers.clear();
  }
  async function loadQuestions(){
    $('questions').innerHTML=''; answers.clear(); msg('प्रश्न लोड हो रहे हैं...');
    let q;
    if(marks===1){
      q=supabaseClient.from('objective_questions').select('id,class_level,question_text_hi,question_text_en,option_a_hi,option_b_hi,option_c_hi,option_d_hi,option_a_en,option_b_en,option_c_en,option_d_en,correct_option,hint_hi,hint_en,explanation_hi,explanation_en,medium,exam_year,paper_set,status,is_active,source_question,question_type,true_false_answer,fill_blank_answer_hi,fill_blank_answer_en,match_pairs_json,short_answer_hi,short_answer_en,answer_option_a_hi,answer_option_b_hi,answer_option_a_en,answer_option_b_en,answer_correct_option').eq('class_level',Number(student.class_level)).eq('status','published').eq('is_active',true).order('exam_year',{ascending:false}).order('source_question');
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
    const type=String(r.question_type||'MCQ').toUpperCase();
    const answerOptions=type==='FILL_BLANK'||type==='SHORT_ANSWER'?['a','b'].map(k=>String(r['answer_option_'+k+'_hi']||r['answer_option_'+k+'_en']||'').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim()).join('|'):'';
    return [Number(r.class_level),marks,medium,type,q,options,answerOptions].join('::');
  }
  function groupedQuestions(){
    const groups=new Map();
    rows.forEach(r=>{
      const key=questionKey(r);
      if(!groups.has(key)) groups.set(key,{...r,appearances:[]});
      const g=groups.get(key);
      const year=String(r.exam_year||'').trim(), set=String(r.paper_set||'').trim();
      if(year||set){
        const setLabel=set ? (/^set\s+/i.test(set) ? set : `Set ${set}`) : '';
        const label=[year,setLabel].filter(Boolean).join(' ');
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
    const captureId=`capture-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    card.dataset.exportCaptureId=captureId;
    try{return await window.html2canvas(card,{
      scale:2,useCORS:true,backgroundColor:'#ffffff',logging:false,
      onclone:clonedDoc=>{
        const clonedCard=clonedDoc.querySelector(`[data-export-capture-id="${card.dataset.exportCaptureId}"]`);
        if(!clonedCard)return;
        clonedCard.querySelectorAll('.hw-actions,.export-actions,.export-toolbar,.export-note,[data-export-pdf],[data-export-png],[data-share-one],.hw-toggle,.download-instructions').forEach(el=>el.remove());
        clonedCard.querySelectorAll('.hw-solution-content').forEach(el=>{el.hidden=false;el.style.display='';});
      }
    });}finally{delete card.dataset.exportCaptureId;}
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
    const slides=[...$('questions').querySelectorAll('.pp-written-slide')];
    const cards=slides.length?slides.map(slide=>slide.querySelector('.handwritten-card,.question-card')).filter(Boolean):[...$('questions').querySelectorAll('.handwritten-card,.question-card')];
    if(!cards.length){alert('इस सत्र में प्रश्न उपलब्ध नहीं हैं।');return;}
    const btn=$(share?'shareSessionPdf':'downloadSessionPdf');
    await withBusy(btn,async()=>{
      const previous=slides.map(slide=>slide.hidden);
      slides.forEach(slide=>slide.hidden=false);
      let pdf;
      try{pdf=await makePdf(cards);}finally{slides.forEach((slide,i)=>slide.hidden=previous[i]);}
      const year=$('yearFilter').value||'All_Sessions',set=$('setFilter').value||'All_Sets';
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

  let objectiveIndex=0, objectiveStartedAt=0, objectiveTimer=null, objectiveSubmitted=false;
  let objectiveOptionOrder = new Map();
  let writtenIndex=0;
  function shuffleTwo(){ return Math.random() < 0.5 ? ['A','B'] : ['B','A']; }
  function objectiveType(r){ return String(r.question_type || 'MCQ').trim().toUpperCase(); }
  function answerOptionText(r, letter){
    const suffix=letter.toLowerCase();
    return languageField(r, `answer_option_${suffix}_hi`, `answer_option_${suffix}_en`);
  }
  function correctAnswerOption(r){ return String(r.answer_correct_option || 'A').trim().toUpperCase(); }
  function matchPairs(r){
    try { const parsed=typeof r.match_pairs_json==='string'?JSON.parse(r.match_pairs_json):r.match_pairs_json; return Array.isArray(parsed)?parsed:[]; }
    catch(_){ return []; }
  }
  function normalizeAnswer(v){ return String(v??'').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim(); }
  function renderObjectiveTest(list){
    objectiveIndex=0; objectiveStartedAt=Date.now(); objectiveSubmitted=false; answers.clear();
    objectiveOptionOrder = new Map();
    list.forEach(r=>{ if(['FILL_BLANK','SHORT_ANSWER'].includes(objectiveType(r))) objectiveOptionOrder.set(`q_${r.id}`, shuffleTwo()); });
    clearInterval(objectiveTimer);
    const host=$('questions');
    host.innerHTML=`
      <style>
      .pp-test{max-width:720px;margin:10px auto;color:#17385f}
      .pp-test-top{display:flex;align-items:center;gap:10px;margin-bottom:12px}
      .pp-test-back{width:40px;height:40px;border-radius:50%;border:1px solid #cfe5fa;background:#f0f8ff;color:#0867d8;font-size:22px;display:grid;place-items:center;cursor:pointer}
      .pp-test-heading{flex:1;min-width:0}.pp-test-heading h2{font-size:19px;margin:0;color:#123b72}.pp-test-heading p{font-size:12px;color:#6a84a0;margin:3px 0 0}
      .pp-test-timer{background:#fff2f2;border:1px solid #ffc5c5;border-radius:12px;padding:6px 9px;text-align:center;color:#a51f2a;min-width:76px;font-weight:800}
      .pp-test-timer small{display:block;font-size:9px}
      .pp-test-progress{background:#fff;border:1px solid #d6e8fa;border-radius:14px;padding:11px 13px;margin-bottom:12px}
      .pp-test-progress-line{display:flex;justify-content:space-between;font-size:12px;font-weight:800;gap:8px}
      .pp-test-track{height:8px;border-radius:20px;background:#dcecf9;overflow:hidden;margin-top:8px}.pp-test-fill{height:100%;width:0;background:linear-gradient(90deg,#0874e6,#1b91f4);transition:width .2s}
      .pp-test-question{background:linear-gradient(145deg,#f2f9ff,#fff);border:1px solid #c8e4fb;border-radius:17px;padding:16px}
      .pp-test-qhead{display:flex;justify-content:space-between;gap:8px;margin-bottom:12px}
      .pp-test-badge{background:#0874e6;color:#fff;border-radius:18px;padding:6px 11px;font-size:12px;font-weight:800}
      .pp-test-mark{background:#e4f1ff;color:#164a80;border-radius:12px;padding:6px 9px;font-size:11px;font-weight:800}
      .pp-test-session{font-size:11px;color:#2871b8;background:#eaf6ff;border-radius:9px;padding:5px 8px;display:inline-block;margin-bottom:10px;font-weight:700}
      .pp-test-text{font-size:17px;line-height:1.75;font-weight:700;color:#172f50}
      .pp-test-hint{border:1px solid #cfe5fa;background:#eef8ff;color:#0867d8;border-radius:10px;padding:8px 11px;margin-top:12px;font-weight:700;cursor:pointer}
      .pp-test-options{display:grid;gap:9px;margin-top:13px}
      .pp-test-fill-answer,.pp-test-short-answer,.pp-test-match{margin-top:14px;padding:12px;background:#fff;border:1px solid #dce7f0;border-radius:12px;line-height:1.8}
      .pp-answer-select-wrap{display:inline-block;vertical-align:middle;margin:4px 6px;min-width:150px}
      .pp-answer-select{width:100%;max-width:100%;min-height:44px;padding:9px 34px 9px 11px;border:1.5px solid #087cf0;border-radius:10px;background:#f7fbff;color:#17385f;font:inherit;font-size:14px;font-weight:600}
      .pp-answer-prompt{font-weight:700;margin-bottom:9px;color:#244c78}
      .pp-test-option{width:100%;display:flex;align-items:flex-start;gap:10px;text-align:left;background:#fff;border:1.5px solid #dce7f0;border-radius:13px;padding:10px 11px;color:#1c2f49;font:600 14px/1.55 inherit;cursor:pointer}
      .pp-test-option b{width:29px;height:29px;border-radius:50%;background:#edf3f8;color:#183858;display:grid;place-items:center;flex:0 0 29px}
      .pp-test-option.selected{border-color:#087cf0;background:#eef8ff;box-shadow:0 0 0 1px rgba(8,124,240,.08)}
      .pp-test-option.selected b{background:#087cf0;color:#fff}
      .pp-test-nav{display:grid;grid-template-columns:1fr 1.15fr;gap:9px;margin-top:13px}
      .pp-test-nav button{min-height:47px;border-radius:13px;font-weight:800;font-size:13px;cursor:pointer}
      .pp-test-prev{border:1px solid #cfe1ef;background:#eef6fb;color:#315b80}.pp-test-next{border:0;background:linear-gradient(100deg,#0870df,#087ff2);color:#fff}
      .pp-test-submit{width:100%;margin-top:12px;padding:13px;border:0;border-radius:13px;background:#16804a;color:white;font-weight:800;font-size:14px;cursor:pointer}
      .pp-test-note{text-align:center;background:#eef8ff;border-radius:11px;padding:9px;margin-top:10px;font-size:11px;color:#66809a}
      .pp-test-result{background:#fff;border:1px solid #d6e8fa;border-radius:16px;padding:18px;text-align:center;margin-top:12px}
      .pp-test-score{font-size:30px;font-weight:900;color:#0870df}
      @media(max-width:560px){.pp-test-heading h2{font-size:16px}.pp-test-text{font-size:14px}.pp-test-option{font-size:12px;padding:9px}.pp-test-nav button{min-height:43px;font-size:12px}}
      </style>
      <div class="pp-test">
        <div class="pp-test-top">
          <button class="pp-test-back" id="ppTestBack" aria-label="वापस">←</button>
          <div class="pp-test-heading"><h2>अपनी तैयारी परखें</h2><p>कक्षा ${esc(student.class_level)} • पिछले वर्षों के वस्तुनिष्ठ प्रश्न</p></div>
          <div class="pp-test-timer"><small>चला हुआ समय</small><span id="ppTestTimer">00:00</span></div>
        </div>
        <div class="pp-test-progress">
          <div class="pp-test-progress-line"><span id="ppTestProgressText">प्रश्न 1 / ${list.length}</span><span id="ppTestPercent">0% पूर्ण</span></div>
          <div class="pp-test-track"><div class="pp-test-fill" id="ppTestFill"></div></div>
        </div>
        <div id="ppTestStage"></div>
        <div class="pp-test-note">ⓘ सभी प्रश्नों के उत्तर देने के बाद ही टेस्ट Submit करें।</div>
      </div>`;
    $('ppTestBack').addEventListener('click',closeQuestionPage);
    objectiveTimer=setInterval(()=>{
      const sec=Math.floor((Date.now()-objectiveStartedAt)/1000);
      const el=$('ppTestTimer'); if(el)el.textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
    },1000);
    drawObjectiveQuestion(list);
  }
  function drawObjectiveQuestion(list){
    if(objectiveSubmitted)return;
    const r=list[objectiveIndex], key=`q_${r.id}`, chosen=answers.get(key)||'';
    const type=objectiveType(r);
    const question=languageField(r,'question_text_hi','question_text_en');
    const isEnglish=student.medium==='English';
    const letters=['A','B','C','D'];
    let answerUI='';
    let questionMarkup=esc(question);

    if(type==='MCQ'){
      const opts=letters.map(letter=>{
        const value=letter;
        const text=languageField(r,`option_${letter.toLowerCase()}_hi`,`option_${letter.toLowerCase()}_en`);
        return `<button type="button" class="pp-test-option ${chosen===value?'selected':''}" data-pp-answer="${value}"><b>${letter}</b><span>${esc(text)}</span></button>`;
      }).join('');
      answerUI=`<div class="pp-test-options">${opts}</div>`;
    } else if(type==='TRUE_FALSE'){
      const trueLabel=isEnglish?'True':'सही', falseLabel=isEnglish?'False':'गलत';
      answerUI=`<div class="pp-test-options"><button type="button" class="pp-test-option ${chosen==='TRUE'?'selected':''}" data-pp-answer="TRUE"><b>✓</b><span>${trueLabel}</span></button><button type="button" class="pp-test-option ${chosen==='FALSE'?'selected':''}" data-pp-answer="FALSE"><b>✕</b><span>${falseLabel}</span></button></div>`;
    } else if(type==='FILL_BLANK' || type==='SHORT_ANSWER'){
      const order=objectiveOptionOrder.get(key)||['A','B'];
      const options=order.map(letter=>`<option value="${letter}" ${chosen===letter?'selected':''}>${esc(answerOptionText(r,letter))}</option>`).join('');
      const selectLabel=type==='FILL_BLANK'?(isEnglish?'Select the missing answer':'सही उत्तर चुनें'):(isEnglish?'Select the correct answer':'सही उत्तर चुनें');
      const selectHTML=`<select class="pp-answer-select" id="ppAnswerSelect"><option value="">${selectLabel}</option>${options}</select>`;
      if(type==='FILL_BLANK'){
        const inlineSelect=questionMarkup.replace(/_{3,}|…{2,}/, `<span class="pp-answer-select-wrap">${selectHTML}</span>`);
        questionMarkup=inlineSelect;
        if(inlineSelect===esc(question)) answerUI=`<div class="pp-test-fill-answer"><div class="pp-answer-prompt">${isEnglish?'Select the missing answer:':'रिक्त स्थान के लिए सही उत्तर चुनें:'}</div>${selectHTML}</div>`;
      } else {
        answerUI=`<div class="pp-test-short-answer"><div class="pp-answer-prompt">${isEnglish?'Choose the correct one-sentence answer:':'नीचे दिए गए विकल्पों में से सही उत्तर चुनें:'}</div>${selectHTML}</div>`;
      }
    } else if(type==='MATCH'){
      const pairs=matchPairs(r);
      if(!pairs.length){ answerUI=`<div class="pp-test-note">${isEnglish?'Matching data is unavailable.':'मिलान का डेटा उपलब्ध नहीं है।'}</div>`; }
      else {
        const pair=pairs[0];
        const left=isEnglish?(pair.column_a_en||pair.column_a_hi):(pair.column_a_hi||pair.column_a_en);
        const choices=isEnglish?(pair.column_b_en||pair.column_b_hi):(pair.column_b_hi||pair.column_b_en);
        const selected=chosen||'';
        const opts=(choices||[]).map(item=>`<option value="${esc(item.label)}" ${selected===String(item.label)?'selected':''}>${esc(item.label)}. ${esc(item.value)}</option>`).join('');
        answerUI=`<div class="pp-test-match"><div class="pp-answer-prompt">${esc(left)}</div><select class="pp-answer-select" id="ppAnswerSelect"><option value="">${isEnglish?'Select the matching option':'सही जोड़ी चुनें'}</option>${opts}</select></div>`;
      }
    } else {
      answerUI=`<div class="pp-test-note">${isEnglish?'Unsupported question type.':'यह प्रश्न प्रकार उपलब्ध नहीं है।'}</div>`;
    }

    const sessionLabels=(r.appearances||[]).map(a=>a.label).filter(Boolean);
    if(!sessionLabels.length){
      const year=String(r.exam_year||'').trim(), set=String(r.paper_set||'').trim();
      const setLabel=set?(/^set\s+/i.test(set)?set:`Set ${set}`):'';
      const fallback=[year,setLabel].filter(Boolean).join(' ');
      if(fallback)sessionLabels.push(fallback);
    }
    const session=sessionLabels.join(' | ');
    const hint=languageField(r,'hint_hi','hint_en');
    $('ppTestStage').innerHTML=`
      <div class="pp-test-question">
        <div class="pp-test-qhead"><span class="pp-test-badge">${isEnglish?'Question':'प्रश्न'} ${objectiveIndex+1} / ${list.length}</span><span class="pp-test-mark">1 ${isEnglish?'Mark':'अंक'}</span></div>
        ${session?`<div class="pp-test-session">${esc(session)}</div>`:''}
        <div class="pp-test-text">${questionMarkup}</div>
        ${hint?`<button type="button" class="pp-test-hint" id="ppTestHint">💡 ${isEnglish?'Hint':'संकेत'}</button><div id="ppTestHintText" hidden class="pp-test-note">${esc(hint)}</div>`:''}
        ${answerUI}
        <div class="pp-test-nav">
          <button type="button" class="pp-test-prev" id="ppTestPrev" ${objectiveIndex===0?'disabled':''}>${isEnglish?'← Previous':'← पिछला प्रश्न'}</button>
          <button type="button" class="pp-test-next" id="ppTestNext">${objectiveIndex===list.length-1?(isEnglish?'Submit Test':'टेस्ट Submit करें'):(isEnglish?'Next Question →':'अगला प्रश्न →')}</button>
        </div>
      </div>`;
    const pct=Math.round((objectiveIndex+1)/list.length*100);
    $('ppTestProgressText').textContent=`${isEnglish?'Question':'प्रश्न'} ${objectiveIndex+1} / ${list.length}   ${isEnglish?'Total':'कुल'} ${list.length}`;
    $('ppTestPercent').textContent=`${pct}% ${isEnglish?'complete':'पूर्ण'}`; $('ppTestFill').style.width=`${pct}%`;
    $('ppTestStage').querySelectorAll('[data-pp-answer]').forEach(btn=>btn.addEventListener('click',()=>{
      answers.set(key,btn.dataset.ppAnswer);drawObjectiveQuestion(list);
    }));
    $('ppAnswerSelect')?.addEventListener('change',e=>{ answers.set(key,e.target.value); });
    $('ppTestPrev').addEventListener('click',()=>{if(objectiveIndex>0){objectiveIndex--;drawObjectiveQuestion(list);}});
    $('ppTestNext').addEventListener('click',()=>{
      if(!answers.has(key) || !answers.get(key)){alert(isEnglish?'Please answer this question.':'कृपया इस प्रश्न का उत्तर चुनें।');return;}
      if(objectiveIndex<list.length-1){objectiveIndex++;drawObjectiveQuestion(list);}
      else submitObjectiveTest(list);
    });
    $('ppTestHint')?.addEventListener('click',()=>{const el=$('ppTestHintText');el.hidden=!el.hidden;});
  }
  function submitObjectiveTest(list){
    const unanswered=list.filter(r=>!answers.has(`q_${r.id}`) || !answers.get(`q_${r.id}`));
    if(unanswered.length){alert(`${unanswered.length} प्रश्नों के उत्तर बाकी हैं।`);return;}
    clearInterval(objectiveTimer);objectiveSubmitted=true;
    let correct=0;
    const isEnglish=student.medium==='English';
    const review=list.map((r,i)=>{
      const selected=answers.get(`q_${r.id}`);
      const type=objectiveType(r);
      let ok=false, selectedText=selected, correctText='';
      if(type==='MCQ'){
        const answer=String(r.correct_option||'').trim().toUpperCase().replace(/[^A-D]/g,'').slice(0,1);
        ok=selected===answer;
        selectedText=languageField(r,`option_${String(selected).toLowerCase()}_hi`,`option_${String(selected).toLowerCase()}_en`);
        correctText=languageField(r,`option_${answer.toLowerCase()}_hi`,`option_${answer.toLowerCase()}_en`);
      } else if(type==='TRUE_FALSE'){
        const answer=String(r.true_false_answer||'').trim().toUpperCase();
        ok=selected===answer;
        selectedText=selected==='TRUE'?(isEnglish?'True':'सही'):(isEnglish?'False':'गलत');
        correctText=answer==='TRUE'?(isEnglish?'True':'सही'):(isEnglish?'False':'गलत');
      } else if(type==='FILL_BLANK' || type==='SHORT_ANSWER'){
        const answer=correctAnswerOption(r);
        ok=selected===answer;
        selectedText=answerOptionText(r,selected);
        correctText=answerOptionText(r,answer) || (type==='FILL_BLANK'?languageField(r,'fill_blank_answer_hi','fill_blank_answer_en'):languageField(r,'short_answer_hi','short_answer_en'));
      } else if(type==='MATCH'){
        const pairs=matchPairs(r), pair=pairs[0];
        const answer=String(pair?.correct_label||'');
        ok=selected===answer;
        const choices=isEnglish?(pair?.column_b_en||pair?.column_b_hi):(pair?.column_b_hi||pair?.column_b_en);
        selectedText=(choices||[]).find(x=>String(x.label)===selected)?.value||selected;
        correctText=(choices||[]).find(x=>String(x.label)===answer)?.value||answer;
      }
      if(ok)correct++;
      return `<div class="pp-test-note" style="text-align:left;margin:8px 0"><b>${isEnglish?'Question':'प्रश्न'} ${i+1}:</b> ${ok?'✅ '+(isEnglish?'Correct':'सही'):'❌ '+(isEnglish?'Incorrect':'गलत')}<br>${isEnglish?'Your answer':'आपका उत्तर'}: ${esc(selectedText)} • ${isEnglish?'Correct answer':'सही उत्तर'}: ${esc(correctText)}</div>`;
    }).join('');
    const percent=Math.round(correct/list.length*100);
    $('ppTestStage').innerHTML=`<div class="pp-test-result"><div>${isEnglish?'Test completed':'टेस्ट पूरा हुआ'}</div><div class="pp-test-score">${correct} / ${list.length}</div><b>${percent}% ${isEnglish?'marks':'अंक'}</b><p>${isEnglish?'Correct':'सही उत्तर'}: ${correct} • ${isEnglish?'Incorrect':'गलत उत्तर'}: ${list.length-correct}</p><p>⏱️ ${isEnglish?'Time':'समय'}: ${$('ppTestTimer').textContent}</p><button type="button" class="pp-test-next" id="ppTestReview" style="padding:11px 18px;border:0;border-radius:10px;color:white;background:#0870df">${isEnglish?'Review answers':'उत्तर देखें'}</button><button type="button" class="pp-test-prev" id="ppTestAgain" style="padding:11px 18px;border-radius:10px;margin-left:8px">${isEnglish?'Try again':'फिर से प्रयास करें'}</button></div><div id="ppTestReviewList" hidden>${review}</div>`;
    $('ppTestReview').addEventListener('click',()=>{const el=$('ppTestReviewList');el.hidden=!el.hidden;});
    $('ppTestAgain').addEventListener('click',()=>{answers.clear();renderObjectiveTest(list);});
    $('ppTestPercent').textContent='100% पूर्ण';$('ppTestFill').style.width='100%';
  }
  function render(){
    ensureExportToolbar();
    const list=filtered(); $('questions').innerHTML='';
    if(!list.length){msg('इस सत्र / सेट में प्रकाशित प्रश्न उपलब्ध नहीं हैं।');return;}
    msg(`${list.length} प्रश्न उपलब्ध हैं।`);
    if(marks===1){
      renderObjectiveTest(list);
    } else {
      renderWrittenSlides(list);
    }
  }
  function renderWrittenSlides(list){
    writtenIndex=0;
    const cards=list.map((r,i)=>{
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
        return `<div class="pp-written-slide" data-slide-index="${i}" ${i?'hidden':''}><article class="handwritten-card"><div class="handwritten-head"><span>${student.medium==='English'?'MATHEMATICS • SOLVED ANSWER':'गणित सेतु • हल सहित प्रश्न'} ${i+1}</span><span class="handwritten-mark">${marks} ${student.medium==='English'?'Marks':'अंक'}</span></div><div class="handwritten-paper">${sessionLabel(r)}<div class="hw-question">${student.medium==='English'?'Question':'प्रश्न'} ${i+1}. ${esc(question)}</div><div class="hw-solution-content" id="hw_solution_${i}">${givenBlock}${requiredBlock}${formulaBlock}${solutionBlock}${answerBlock}</div></div><div class="hw-actions"><button class="hw-toggle" type="button" data-target="hw_solution_${i}">${student.medium==='English'?'Hide solution':'हल छिपाएँ'}</button></div><div class="export-actions"><button type="button" class="export-btn" data-export-pdf>PDF</button><button type="button" class="export-btn secondary" data-export-png>इमेज</button><button type="button" class="export-btn" data-share-one>शेयर</button></div></article></div>`;
      }
      return `<div class="pp-written-slide" data-slide-index="${i}" ${i?'hidden':''}><article class="question-card">${sessionLabel(r)}<div class="question-title">प्रश्न ${i+1}. ${esc(question)}</div>${given?`<p><b>${student.medium==='English'?'Given':'दिया गया'}:</b> ${esc(given)}</p>`:''}${required?`<p><b>${student.medium==='English'?'To find':'ज्ञात करना है'}:</b> ${esc(required)}</p>`:''}<p><b>${student.medium==='English'?'Solution':'हल'}:</b></p><div class="solution">${esc([formula,solution,final].filter(Boolean).join('\n\n'))}</div><div class="export-actions"><button type="button" class="export-btn" data-export-pdf>PDF</button><button type="button" class="export-btn secondary" data-export-png>इमेज</button><button type="button" class="export-btn" data-share-one>शेयर</button></div></article></div>`;
    }).join('');
    $('questions').innerHTML=`<div class="pp-written-viewer">${cards}<div class="pp-written-navigation"><button type="button" id="ppWrittenPrev" class="export-btn secondary">← पिछला प्रश्न</button><span id="ppWrittenCount">प्रश्न 1 / ${list.length}</span><button type="button" id="ppWrittenNext" class="export-btn">अगला प्रश्न →</button></div></div>`;
    const update=()=>{
      $('questions').querySelectorAll('.pp-written-slide').forEach((slide,i)=>slide.hidden=i!==writtenIndex);
      $('ppWrittenCount').textContent=`प्रश्न ${writtenIndex+1} / ${list.length}`;
      $('ppWrittenPrev').disabled=writtenIndex===0;
      $('ppWrittenNext').disabled=writtenIndex===list.length-1;
      $('ppWrittenNext').textContent=writtenIndex===list.length-1?'अंतिम प्रश्न':'अगला प्रश्न →';
    };
    $('ppWrittenPrev').addEventListener('click',()=>{if(writtenIndex>0){writtenIndex--;update();}});
    $('ppWrittenNext').addEventListener('click',()=>{if(writtenIndex<list.length-1){writtenIndex++;update();}});
    $('questions').querySelectorAll('.hw-toggle').forEach(btn=>btn.addEventListener('click',()=>{
      const target=$(btn.dataset.target);if(!target)return;target.hidden=!target.hidden;
      btn.textContent=target.hidden?(student.medium==='English'?'Show solution':'हल दिखाएँ'):(student.medium==='English'?'Hide solution':'हल छिपाएँ');
    }));
    $('questions').querySelectorAll('.handwritten-card,.question-card').forEach(card=>{
      card.querySelector('[data-export-pdf]')?.addEventListener('click',()=>exportOne(card,'pdf',false));
      card.querySelector('[data-export-png]')?.addEventListener('click',()=>exportOne(card,'png',false));
      card.querySelector('[data-share-one]')?.addEventListener('click',()=>exportOne(card,'pdf',true));
    });
    update();
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
