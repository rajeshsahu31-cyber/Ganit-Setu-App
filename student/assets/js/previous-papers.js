(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const sid = sessionStorage.getItem('ganit_setu_student_id');
  let student = null, marks = 1, rows = [], answers = new Map(), filterRecords = [], mathsLevel = ''; 
  let chooserPanel = null, resultPanel = null, questionPageOpen = false;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function msg(t){ $('status').textContent=t; }
  function normalizePaperSet(value){
    // 'A', 'Set A', and 'set a' are the same paper set.
    return String(value ?? '').trim().replace(/^set\s*/i, '').trim().toUpperCase();
  }
  function normalizeMathsLevel(value){
    const v=String(value??'').trim().toLowerCase();
    if(v==='basic') return 'Basic';
    if(v==='standard') return 'Standard';
    return '';
  }
  function paperSetLabel(value){
    const normalized=normalizePaperSet(value);
    return normalized ? `Set ${normalized}` : '';
  }
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
    document.querySelectorAll('[data-marks]').forEach(b=>b.addEventListener('click',()=>{
      if(!filtersReady()){alert('पहले सत्र और पेपर सेट चुनें।');return;}
      document.querySelectorAll('[data-marks]').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');marks=Number(b.dataset.marks);openQuestionPage();loadQuestions();
    }));
    $('yearFilter').addEventListener('change',()=>{
      fillMathsLevelFilter();
      fillSetFilter();
      updateTypeButtons();
      if(questionPageOpen)closeQuestionPage();
    });
    $('mathsLevelFilter')?.addEventListener('change',()=>{
      mathsLevel=$('mathsLevelFilter').value;
      fillSetFilter();
      updateTypeButtons();
      if(questionPageOpen)closeQuestionPage();
    });
    $('setFilter').addEventListener('change',()=>{
      updateTypeButtons();
      if(questionPageOpen)closeQuestionPage();
    });
    $('downloadFullQuestionPaper')?.addEventListener('click', downloadFullQuestionPaper);
    await loadFilterOptions();
  }

  function needsMathsLevel(year){ return Number(student?.class_level)===10 && String(year)==='2026'; }
  function filtersReady(){ const year=$('yearFilter').value; return Boolean(year && $('setFilter').value && (!needsMathsLevel(year) || mathsLevel)); }
  function updateTypeButtons(){
    const enabled=filtersReady();
    document.querySelectorAll('[data-marks]').forEach(b=>b.disabled=!enabled);
    const full=$('downloadFullQuestionPaper'); if(full)full.disabled=!enabled;
  }
  async function loadFilterOptions(){
    msg('उपलब्ध सत्र लोड हो रहे हैं...');
    const classLevel=Number(student.class_level);
    const [objective,written]=await Promise.all([
      supabaseClient.from('objective_questions').select('exam_year,paper_set,medium,maths_level').eq('class_level',classLevel).eq('status','published').eq('is_active',true),
      supabaseClient.from('written_questions').select('exam_year,paper_set,medium,maths_level').eq('class_level',classLevel).in('marks',[2,3,4]).eq('status','published').eq('is_active',true)
    ]);
    if(objective.error || written.error){
      console.error('[Previous Papers] Filter options failed:',objective.error||written.error);
      msg('सत्रों की सूची लोड नहीं हो सकी। कृपया पेज रीफ्रेश करें।');
      return;
    }
    const wanted=normalizeMedium(student.medium);
    filterRecords=[...(objective.data||[]),...(written.data||[])].filter(r=>{
      const m=normalizeMedium(r.medium); return m===wanted || m==='Both' || m==='';
    });
    const years=[...new Set(filterRecords.map(r=>String(r.exam_year||'').trim()).filter(Boolean))].sort((a,b)=>Number(b)-Number(a));
    $('yearFilter').innerHTML='<option value="">पहले सत्र चुनें</option>'+years.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
    $('setFilter').innerHTML='<option value="">पहले सत्र चुनें</option>';
    fillMathsLevelFilter();
    updateTypeButtons();
    msg(years.length?'पहले सत्र चुनें, फिर पेपर सेट चुनें।':'अभी कोई प्रकाशित पुराना पेपर उपलब्ध नहीं है।');
  }
  function fillMathsLevelFilter(){
    const year=$('yearFilter').value, wrap=$('mathsLevelFilterWrap'), select=$('mathsLevelFilter');
    const visible=needsMathsLevel(year);
    if(wrap)wrap.classList.toggle('hidden',!visible);
    if(!visible){mathsLevel='';if(select)select.value='';}
    else {mathsLevel=select?.value||'';}
  }
  function fillSetFilter(){
    const year=$('yearFilter').value;
    const eligible=filterRecords.filter(r=>String(r.exam_year||'').trim()===year && (!needsMathsLevel(year) || normalizeMathsLevel(r.maths_level)===mathsLevel));
    const sets=[...new Set(eligible.map(r=>normalizePaperSet(r.paper_set)).filter(Boolean))].sort();
    $('setFilter').innerHTML='<option value="">पेपर सेट चुनें</option>'+sets.map(v=>`<option value="${esc(v)}">${esc(paperSetLabel(v))}</option>`).join('');
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
      q=supabaseClient.from('objective_questions').select('id,class_level,question_text_hi,question_text_en,option_a_hi,option_b_hi,option_c_hi,option_d_hi,option_a_en,option_b_en,option_c_en,option_d_en,correct_option,hint_hi,hint_en,explanation_hi,explanation_en,medium,exam_year,paper_set,maths_level,status,is_active,source_question,question_type,true_false_answer,fill_blank_answer_hi,fill_blank_answer_en,match_pairs_json,short_answer_hi,short_answer_en,answer_option_a_hi,answer_option_b_hi,answer_option_a_en,answer_option_b_en,answer_correct_option').eq('class_level',Number(student.class_level)).eq('status','published').eq('is_active',true).order('exam_year',{ascending:false}).order('source_question');
    } else {
      q=supabaseClient.from('written_questions').select('id,question_id,class_level,marks,question_text_hi,question_text_en,given_data_hi,given_data_en,required_to_find_hi,required_to_find_en,solution_steps_hi,solution_steps_en,formula_theorem_hi,formula_theorem_en,final_answer_hi,final_answer_en,medium,exam_year,paper_set,maths_level,status,is_active').eq('class_level',Number(student.class_level)).eq('marks',marks).eq('status','published').eq('is_active',true).order('exam_year',{ascending:false}).order('question_id');
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
      return (stored===requested || stored==='Both' || stored==='') &&
        String(r.exam_year||'').trim()===$('yearFilter').value &&
        normalizePaperSet(r.paper_set)===normalizePaperSet($('setFilter').value) &&
        (!needsMathsLevel($('yearFilter').value) || normalizeMathsLevel(r.maths_level)===mathsLevel);
    });
    console.info('[Previous Papers] Loaded rows:',{marks,classLevel:student.class_level,medium:student.medium,dbRows:(data||[]).length,visibleRows:rows.length,storedMediums:[...new Set((data||[]).map(r=>r.medium))]});
    render();
  }
  function fillFilters(data){
    const years=[...new Set(data.map(x=>x.exam_year).filter(Boolean).map(String))].sort((a,b)=>Number(b)-Number(a));
    const sets=[...new Set(data.map(x=>normalizePaperSet(x.paper_set)).filter(Boolean))].sort();
    const y=$('yearFilter'), oldY=y.value; y.innerHTML='<option value="">सभी उपलब्ध सत्र</option>'+years.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join(''); if(years.includes(oldY))y.value=oldY;
    const s=$('setFilter'),oldS=normalizePaperSet(s.value);s.innerHTML='<option value="">सभी सेट</option>'+sets.map(v=>`<option value="${esc(v)}">${esc(paperSetLabel(v))}</option>`).join('');if(sets.includes(oldS))s.value=oldS;
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
      const year=String(r.exam_year||'').trim(), set=normalizePaperSet(r.paper_set);
      if(year||set){
        const setLabel=paperSetLabel(set);
        const label=[year,setLabel].filter(Boolean).join(' ');
        if(!g.appearances.some(a=>a.label===label)) g.appearances.push({year,set,label});
      }
    });
    return [...groups.values()].map(g=>({...g,appearances:g.appearances.sort((a,b)=>Number(b.year||0)-Number(a.year||0)||a.set.localeCompare(b.set))}));
  }
  function filtered(){
    const year=$('yearFilter').value, set=$('setFilter').value;
    return groupedQuestions().filter(g=>g.appearances.some(a=>(!year||a.year===year)&&(!set||normalizePaperSet(a.set)===normalizePaperSet(set))));
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
      renderObjectiveEntry(list);
    } else {
      renderWrittenSlides(list);
    }
  }

  function renderObjectiveEntry(list){
    clearInterval(objectiveTimer);
    const isEnglish=student.medium==='English';
    $('questions').innerHTML=`
      <style>
        .pp-objective-choice{max-width:760px;margin:14px auto;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
        .pp-objective-choice button{border:1px solid #d5e3f2;border-radius:16px;background:#fff;padding:20px 16px;text-align:left;cursor:pointer;box-shadow:0 5px 18px rgba(30,70,110,.06);color:#17385f;min-height:145px}
        .pp-objective-choice button:hover{border-color:#2380df;background:#f5faff}
        .pp-objective-choice .pp-choice-icon{font-size:28px;display:block;margin-bottom:9px}
        .pp-objective-choice strong{display:block;font-size:17px;margin-bottom:6px}
        .pp-objective-choice small{display:block;color:#667b93;line-height:1.55;font-size:13px}
        .pp-objective-count{text-align:center;color:#61758d;font-size:13px;margin:8px 0 14px}
        @media(max-width:600px){.pp-objective-choice{grid-template-columns:1fr}.pp-objective-choice button{min-height:115px}}
      </style>
      <div class="pp-objective-count">${isEnglish?`${list.length} objective questions are available.`:`कुल ${list.length} वस्तुनिष्ठ प्रश्न उपलब्ध हैं।`}</div>
      <div class="pp-objective-choice">
        <button type="button" id="ppViewAllObjective"><span class="pp-choice-icon">📖</span><strong>${isEnglish?'View all questions':'सभी प्रश्न एक साथ देखें'}</strong><small>${isEnglish?'See the complete question paper with options and download it as a PDF.':'सभी प्रश्न और उनके विकल्प एक ही पेज पर देखें और पूरा प्रश्न-पत्र PDF में डाउनलोड करें।'}</small></button>
        <button type="button" id="ppStartObjectiveTest"><span class="pp-choice-icon">📝</span><strong>${isEnglish?'Start the test':'टेस्ट शुरू करें'}</strong><small>${isEnglish?'Answer questions one by one and see your score at the end.':'एक-एक प्रश्न हल करें और अंत में अपना परिणाम देखें।'}</small></button>
      </div>`;
    $('ppViewAllObjective').addEventListener('click',()=>renderObjectiveQuestionSheet(list));
    $('ppStartObjectiveTest').addEventListener('click',()=>renderObjectiveTest(list));
  }

  function objectiveSheetOptions(r){
    const type=objectiveType(r), isEnglish=student.medium==='English';
    if(type==='MCQ'){
      return `<div class="pp-exam-options">${['A','B','C','D'].map(letter=>{
        const value=languageField(r,`option_${letter.toLowerCase()}_hi`,`option_${letter.toLowerCase()}_en`);
        return value?`<div class="pp-exam-option"><b>(${letter})</b> ${esc(value)}</div>`:'';
      }).join('')}</div>`;
    }
    if(type==='TRUE_FALSE'){
      return `<div class="pp-exam-options pp-exam-options-inline"><div class="pp-exam-option">(A) ${isEnglish?'True':'सही'}</div><div class="pp-exam-option">(B) ${isEnglish?'False':'गलत'}</div></div>`;
    }
    if(type==='FILL_BLANK'){
      // In the printable question paper, students write the missing answer themselves.
      // The two practice dropdown choices are intentionally not printed here.
      return '';
    }
    if(type==='SHORT_ANSWER'){
      // No answer choices in the question paper; leave writing space for the learner.
      return `<div class="pp-exam-writing-lines" aria-hidden="true"><span></span></div>`;
    }
    return '';
  }

  function objectiveMatchLeftText(r){
    const raw=languageField(r,'question_text_hi','question_text_en');
    const colon=raw.indexOf(':');
    return (colon>=0?raw.slice(colon+1):raw).trim();
  }

  function objectiveSheetBlocks(list){
    const blocks=[];
    for(let i=0;i<list.length;){
      const row=list[i];
      if(objectiveType(row)==='MATCH'){
        const group=[];
        while(i<list.length && objectiveType(list[i])==='MATCH') group.push(list[i++]);
        blocks.push({type:'MATCH_GROUP',rows:group,displayNo:blocks.length+1});
      }else{
        blocks.push({type:'SINGLE',row,index:i,displayNo:blocks.length+1});
        i++;
      }
    }
    return blocks;
  }

  function objectiveMatchSheetHtml(group,isEnglish){
    const firstPairs=matchPairs(group[0]);
    const first=firstPairs[0]||{};
    const right=isEnglish?(first.column_b_en||first.column_b_hi):(first.column_b_hi||first.column_b_en);
    const rightItems=Array.isArray(right)?right:[];
    const leftRows=group.map((r,i)=>`<tr><td class="pp-match-subno">${esc(objectiveMatchLeftText(r))}</td></tr>`).join('');
    const rightRows=rightItems.map(item=>`<tr><td><b>(${esc(item.label||'')})</b> ${esc(item.value||'')}</td></tr>`).join('');
    const count=Math.max(group.length,rightItems.length);
    const rows=Array.from({length:count},(_,i)=>`<tr><td>${i<group.length?`<span class="pp-match-subno">${esc(objectiveMatchLeftText(group[i]))}</span>`:''}</td><td>${i<rightItems.length?`<b>(${esc(rightItems[i].label||'')})</b> ${esc(rightItems[i].value||'')}`:''}</td></tr>`).join('');
    return `<div class="pp-exam-match-wrap"><table class="pp-exam-match-table"><thead><tr><th>${isEnglish?'Column A':'स्तम्भ A'}</th><th>${isEnglish?'Column B':'स्तम्भ B'}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function objectiveAnswerKey(r){
    const type=objectiveType(r), isEnglish=student.medium==='English';
    if(type==='MCQ') return String(r.correct_option||'—').trim().toUpperCase();
    if(type==='TRUE_FALSE'){
      const value=String(r.true_false_answer??'').trim().toLowerCase();
      if(['true','t','1','yes','सही','सत्य'].includes(value)) return isEnglish?'True':'सही';
      if(['false','f','0','no','गलत','असत्य'].includes(value)) return isEnglish?'False':'गलत';
      return String(r.true_false_answer||'—');
    }
    if(type==='FILL_BLANK') return languageField(r,'fill_blank_answer_hi','fill_blank_answer_en')||'—';
    if(type==='SHORT_ANSWER') return languageField(r,'short_answer_hi','short_answer_en')||'—';
    if(type==='MATCH') return matchPairs(r).map(pair=>pair.correct_label||'?').join(', ')||'—';
    return '—';
  }

  function renderObjectiveQuestionSheet(list){
    clearInterval(objectiveTimer);
    const isEnglish=student.medium==='English';
    const year=$('yearFilter').value|| (isEnglish?'All sessions':'सभी सत्र');
    const set=$('setFilter').value|| (isEnglish?'All sets':'सभी सेट');
    const pageSize=6, questionPages=[];
    for(let i=0;i<list.length;i+=pageSize) questionPages.push(list.slice(i,i+pageSize));
    const totalPages=questionPages.length+1;
    const pages=questionPages.map((group,pageIndex)=>{
      const first=pageIndex===0, startIndex=pageIndex*pageSize;
      let body='';
      if(objectiveType(group[0])==='MATCH'){
        body=`<article class="pp-exam-question pp-exam-match-question">
          <div class="pp-exam-qline"><span class="pp-exam-qnumber">${isEnglish?'Q.':'प्रश्न'} ${startIndex+1}.</span><span class="pp-exam-marks">[${group.length} ${isEnglish?'Marks':'अंक'}]</span></div>
          <div class="pp-exam-question-text">${isEnglish?'Match the following:':'सही जोड़ी मिलाइए :'}</div>
          ${objectiveMatchSheetHtml(group,isEnglish)}
        </article>`;
      }else{
        body=group.map((r,j)=>{
          const index=startIndex+j+1, question=languageField(r,'question_text_hi','question_text_en'), type=objectiveType(r);
          const questionText=type==='FILL_BLANK'?esc(question).replace(/_{3,}|…{2,}/g,'__________'):esc(question);
          return `<article class="pp-exam-question"><div class="pp-exam-qline"><span class="pp-exam-qnumber">${isEnglish?'Q.':'प्रश्न'} ${index}.</span><span class="pp-exam-marks">[1 ${isEnglish?'Mark':'अंक'}]</span></div><div class="pp-exam-question-text">${questionText}</div>${objectiveSheetOptions(r)}</article>`;
        }).join('');
      }
      const header=first?`
        <div class="pp-exam-brand">GANIT SETU • ${isEnglish?'MATHEMATICS':'गणित सेतु'}</div>
        <h1 class="pp-exam-title">${isEnglish?'OBJECTIVE QUESTION PAPER':'वस्तुनिष्ठ प्रश्नपत्र'}</h1>
        <div class="pp-exam-meta"><span>${isEnglish?'Class':'कक्षा'}: ${esc(student.class_level)}</span><span>${isEnglish?'Subject':'विषय'}: ${isEnglish?'Mathematics':'गणित'}</span><span>${isEnglish?'Session':'सत्र'}: ${esc(year)}</span><span>${isEnglish?'Set':'सेट'}: ${esc(set)}</span></div>
        <div class="pp-exam-meta pp-exam-meta-second"><span>${isEnglish?'Time':'समय'}: __________</span><span>${isEnglish?'Maximum Marks':'पूर्णांक'}: ${list.length}</span></div>
        <div class="pp-exam-student-line">${isEnglish?'Name':'विद्यार्थी का नाम'}: __________________________ <span>${isEnglish?'Roll No.':'अनुक्रमांक'}: ______________</span></div>
        <div class="pp-exam-instructions"><b>${isEnglish?'General Instructions':'सामान्य निर्देश'}:</b> ${isEnglish?'All questions are compulsory. Each question carries one mark. Choose or match the correct answer.':'सभी प्रश्न अनिवार्य हैं। प्रत्येक प्रश्न 1 अंक का है। दिए गए विकल्पों में से सही उत्तर चुनिए अथवा सही मिलान कीजिए।'}</div>`:
        `<div class="pp-exam-continuation"><b>GANIT SETU</b><span>${isEnglish?'OBJECTIVE QUESTION PAPER (Continued)':'वस्तुनिष्ठ प्रश्नपत्र (जारी)'}</span></div>`;
      return `<section class="pp-exam-page">${header}<div class="pp-exam-question-list">${body}</div><div class="pp-exam-page-footer">${isEnglish?'Ganit Setu • Objective Practice':'गणित सेतु • वस्तुनिष्ठ अभ्यास'} <span>${isEnglish?'Page':'पृष्ठ'} ${pageIndex+1} / ${totalPages}</span></div></section>`;
    }).join('');
    const answerRows=list.map((r,i)=>`<div class="pp-exam-key-item"><b>${i+1}.</b><span>${esc(objectiveAnswerKey(r))}</span></div>`).join('');
    const answerPage=`<section class="pp-exam-page pp-exam-answer-page"><div class="pp-exam-brand">GANIT SETU • ${isEnglish?'MATHEMATICS':'गणित सेतु'}</div><h1 class="pp-exam-title">${isEnglish?'ANSWER KEY':'उत्तरमाला'}</h1><p class="pp-exam-key-note">${isEnglish?'Answers to all questions in the question paper.':'प्रश्नपत्र के सभी प्रश्नों के उत्तर नीचे दिए गए हैं।'}</p><div class="pp-exam-key-grid">${answerRows}</div><div class="pp-exam-page-footer">${isEnglish?'Ganit Setu • Answer Key':'गणित सेतु • उत्तरमाला'} <span>${isEnglish?'Page':'पृष्ठ'} ${totalPages} / ${totalPages}</span></div></section>`;
    $('questions').innerHTML=`<style>
      .pp-sheet-toolbar{display:flex;flex-wrap:wrap;gap:9px;margin:12px 0}.pp-sheet-toolbar button{border:0;border-radius:10px;padding:11px 15px;background:#174b91;color:#fff;font-weight:800;cursor:pointer}.pp-sheet-toolbar .secondary{background:#16804a}.pp-sheet-back{border:1px solid #d1dfed!important;background:#eef6fb!important;color:#315b80!important}
      .pp-exam-preview{display:grid;gap:18px;justify-items:center;overflow-x:auto;padding:4px 0 18px}.pp-exam-page{position:relative;box-sizing:border-box;width:794px;height:1123px;padding:48px 54px 56px;background:#fff;color:#172b43;border:1px solid #d5dce5;box-shadow:0 5px 20px rgba(25,55,85,.12);font-family:'Noto Sans Devanagari',Arial,sans-serif;overflow:hidden}
      .pp-exam-brand{text-align:center;font-size:12px;letter-spacing:1.4px;font-weight:800;color:#34577c;border-bottom:2px solid #243f60;padding-bottom:9px}.pp-exam-title{text-align:center;font-size:23px;letter-spacing:.2px;margin:14px 0 13px;color:#152e4a}.pp-exam-meta{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:12px;font-weight:700;border-bottom:1px solid #aab8c8;padding:7px 0}.pp-exam-meta-second{border:0;padding-top:9px}.pp-exam-student-line{font-size:12px;margin:13px 0 12px;padding-bottom:10px;border-bottom:1px solid #c4ccd6}.pp-exam-student-line span{float:right}.pp-exam-instructions{font-size:11px;line-height:1.65;background:#f4f6f8;border:1px solid #dce2e8;padding:9px 11px;margin:0 0 14px}.pp-exam-continuation{display:flex;justify-content:space-between;border-bottom:2px solid #243f60;padding-bottom:10px;margin-bottom:22px;font-size:13px;color:#34577c}
      .pp-exam-question{padding:0 0 15px;margin:0 0 14px;border-bottom:1px dotted #aeb8c5;break-inside:avoid}.pp-exam-qline{display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:800;color:#263f5d;margin-bottom:5px}.pp-exam-marks{font-weight:600;color:#52677f}.pp-exam-question-text{font-size:14px;line-height:1.75;font-weight:600;white-space:pre-wrap;margin-bottom:8px}.pp-exam-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px 18px;padding-left:12px}.pp-exam-options-inline{grid-template-columns:repeat(2,minmax(0,1fr))}.pp-exam-option{font-size:12px;line-height:1.55;padding:2px 0;white-space:pre-wrap;overflow-wrap:anywhere}.pp-exam-option b{font-weight:800;margin-right:4px}.pp-exam-writing-lines{height:28px;margin:3px 8px 0;border-bottom:1px solid #aeb8c5}
      .pp-exam-match-wrap{padding:4px 10px 0}.pp-exam-match-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px}.pp-exam-match-table th,.pp-exam-match-table td{width:50%;border:1px solid #aeb8c5;padding:7px 9px;text-align:left;vertical-align:top;line-height:1.55;overflow-wrap:anywhere}.pp-exam-match-table th{text-align:center;background:#f3f6f9;font-weight:800}.pp-exam-match-table td b{margin-right:4px}
      .pp-exam-page-footer{position:absolute;bottom:25px;left:54px;right:54px;border-top:1px solid #cbd3dd;padding-top:7px;display:flex;justify-content:space-between;font-size:9px;color:#69798b}.pp-exam-key-note{text-align:center;font-size:12px;margin:0 0 22px;color:#52677f}.pp-exam-key-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0 18px;border-top:1px solid #aeb8c5}.pp-exam-key-item{display:flex;gap:7px;align-items:flex-start;padding:9px 4px;border-bottom:1px solid #d8dee6;font-size:12px;line-height:1.5;break-inside:avoid;overflow-wrap:anywhere}.pp-exam-key-item b{min-width:28px;color:#244d78}@media(max-width:820px){.pp-exam-preview{justify-items:start}.pp-exam-page{transform-origin:top left}}
      </style><div class="pp-sheet-toolbar"><button type="button" id="ppDownloadObjectiveSheet">⬇ ${isEnglish?'Download exam-style PDF with answer key':'परीक्षा जैसे प्रारूप में उत्तरमाला सहित PDF डाउनलोड करें'}</button><button type="button" class="secondary" id="ppStartTestFromSheet">${isEnglish?'Start test':'टेस्ट शुरू करें'}</button><button type="button" class="pp-sheet-back" id="ppBackToObjectiveChoices">${isEnglish?'← Back':'← वापस जाएँ'}</button></div><div class="pp-exam-preview" id="ppObjectiveSheet">${pages}${answerPage}</div>`;
    $('ppBackToObjectiveChoices').addEventListener('click',()=>renderObjectiveEntry(list));
    $('ppStartTestFromSheet').addEventListener('click',()=>renderObjectiveTest(list));
    $('ppDownloadObjectiveSheet').addEventListener('click',()=>downloadObjectiveSheet());
  }

  async function downloadObjectiveSheet(){
    const btn=$('ppDownloadObjectiveSheet');
    await withBusy(btn,async()=>{
      const pages=[...$('ppObjectiveSheet').querySelectorAll('.pp-exam-page')];
      if(!pages.length)throw new Error('प्रश्नपत्र उपलब्ध नहीं है।');
      const pdf=await makePdf(pages);
      const year=$('yearFilter').value||'All_Sessions',set=$('setFilter').value||'All_Sets';
      pdf.save(safeName(`Ganit_Setu_Class${student.class_level}_Objective_Paper_${year}_${set}_With_Answer_Key`)+'.pdf');
    });
  }

  function canonicalPaperSet(value){
    return normalizePaperSet(value);
  }
  async function downloadFullQuestionPaper(){
    const btn=$('downloadFullQuestionPaper');
    await withBusy(btn,async()=>{
      const year=$('yearFilter').value, selectedSet=$('setFilter').value;
      const setKey=canonicalPaperSet(selectedSet);
      const classLevel=Number(student.class_level);
      const objectiveSelect='id,class_level,question_text_hi,question_text_en,option_a_hi,option_b_hi,option_c_hi,option_d_hi,option_a_en,option_b_en,option_c_en,option_d_en,medium,exam_year,paper_set,maths_level,source_question,question_type,match_pairs_json';
      const writtenSelect='id,question_id,class_level,marks,question_text_hi,question_text_en,medium,exam_year,paper_set,maths_level,original_question_number,or_group_id,or_order';
      const [objRes,writeRes]=await Promise.all([
        supabaseClient.from('objective_questions').select(objectiveSelect).eq('class_level',classLevel).eq('status','published').eq('is_active',true).eq('exam_year',Number(year)).order('source_question'),
        supabaseClient.from('written_questions').select(writtenSelect).eq('class_level',classLevel).in('marks',[2,3,4]).eq('status','published').eq('is_active',true).eq('exam_year',Number(year)).order('question_id')
      ]);
      if(objRes.error)throw new Error('1 अंक के प्रश्न लोड नहीं हुए: '+objRes.error.message);
      if(writeRes.error)throw new Error('2, 3, 4 अंक के प्रश्न लोड नहीं हुए: '+writeRes.error.message);
      const mediumOK=r=>{const m=normalizeMedium(r.medium);return m===normalizeMedium(student.medium)||m==='Both'||m==='';};
      const setOK=r=>canonicalPaperSet(r.paper_set)===setKey && (!needsMathsLevel(year) || normalizeMathsLevel(r.maths_level)===mathsLevel);
      const objective=(objRes.data||[]).filter(r=>mediumOK(r)&&setOK(r));
      const written=(writeRes.data||[]).filter(r=>mediumOK(r)&&setOK(r));
      if(!objective.length&&!written.length)throw new Error('चुने हुए सत्र और सेट में कोई प्रश्न उपलब्ध नहीं है।');

      const isEnglish=student.medium==='English';
      const roman=['i','ii','iii','iv','v','vi','vii','viii','ix','x'];
      const objectiveTypeOrder=['MCQ','FILL_BLANK','TRUE_FALSE','MATCH','SHORT_ANSWER'];
      const typeLabels={
        MCQ:isEnglish?'Choose the correct option and write it:':'सही विकल्प चुनकर लिखिए :',
        FILL_BLANK:isEnglish?'Fill in the blanks:':'रिक्त स्थानों की पूर्ति कीजिए :',
        TRUE_FALSE:isEnglish?'Write True / False:':'सत्य / असत्य लिखिए :',
        MATCH:isEnglish?'Match the correct column:':'सही जोड़ी मिलाइए :',
        SHORT_ANSWER:isEnglish?'Write the answer in one word / sentence:':'प्रत्येक का एक शब्द / वाक्य में उत्तर लिखिए :'
      };
      const objectiveGroups=objectiveTypeOrder.map(type=>({
        type, rows:objective.filter(r=>objectiveType(r)===type)
      })).filter(g=>g.rows.length);

      const writtenGroupsByMark={2:[],3:[],4:[]};
      [2,3,4].forEach(mark=>{
        const list=written.filter(r=>Number(r.marks)===mark);
        const map=new Map();
        list.forEach((r,index)=>{
          const id=String(r.or_group_id||'').trim();
          const key=id?`or:${id}`:`single:${r.id||r.question_id||index}`;
          if(!map.has(key))map.set(key,[]);
          map.get(key).push(r);
        });
        const groups=[...map.values()].map(group=>{
          group.sort((a,b)=>{
            const ao=Number(a.or_order)||1, bo=Number(b.or_order)||1;
            if(ao!==bo)return ao-bo;
            return String(a.question_id||'').localeCompare(String(b.question_id||''));
          });
          const raw=String(group[0].original_question_number||'').trim();
          const match=raw.match(/\d+/);
          return {number:match?Number(match[0]):null, label:raw, rows:group};
        });
        groups.sort((a,b)=>{
          if(a.number!==null&&b.number!==null)return a.number-b.number;
          if(a.number!==null)return -1;
          if(b.number!==null)return 1;
          return String(a.label).localeCompare(String(b.label),'en',{numeric:true});
        });
        writtenGroupsByMark[mark]=groups;
      });

      const escapeText=v=>esc(v==null?'':String(v)).replace(/\n/g,'<br>');
      const objectiveHtml=(group,mainNo)=>{
        const rows=group.rows;
        let body='';
        if(group.type==='MATCH' && rows.length){
          body=`<div class="fullpaper-subintro">${escapeText(typeLabels.MATCH)}</div>${objectiveMatchSheetHtml(rows,isEnglish)}`;
        }else{
          body=rows.map((r,i)=>{
            const q=languageField(r,'question_text_hi','question_text_en');
            const qText=group.type==='FILL_BLANK'?esc(q).replace(/_{3,}|…{2,}/g,'__________'):escapeText(q);
            return `<div class="fullpaper-subq"><b>(${roman[i]||i+1})</b> ${qText}${objectiveSheetOptions(r)}</div>`;
          }).join('');
        }
        return `<article class="fullpaper-q"><div class="fullpaper-qhead"><b>${isEnglish?'Question':'प्रश्न'} ${mainNo}.</b><span>[${rows.length} ${isEnglish?'Marks':'अंक'}]</span></div><div class="fullpaper-subintro">${escapeText(typeLabels[group.type])}</div>${body}</article>`;
      };
      const writtenHtml=(group,mark)=>{
        const questionNo=group.number!==null?group.number:'';
        const items=group.rows.map((r,i)=>{
          const q=languageField(r,'question_text_hi','question_text_en');
          const label=questionNo?`${isEnglish?'Question':'प्रश्न'} ${questionNo}.`:`${isEnglish?'Question':'प्रश्न'}`;
          return `<div class="fullpaper-written-option"><div class="fullpaper-qhead"><b>${label}</b><span>[${mark} ${isEnglish?'Marks':'अंक'}]</span></div><div class="fullpaper-text">${escapeText(q)}</div></div>${i<group.rows.length-1?`<div class="fullpaper-or">${isEnglish?'OR':'अथवा'}</div>`:''}`;
        }).join('');
        return `<article class="fullpaper-q">${items}</article>`;
      };

      const blocks=[];
      blocks.push({section:isEnglish?'Section A — Objective Questions (1 Mark)':'खंड अ — वस्तुनिष्ठ प्रश्न (1 अंक)'});
      objectiveGroups.forEach((g,i)=>blocks.push({html:objectiveHtml(g,i+1),kind:'question',objective:true}));
      [2,3,4].forEach((mark,index)=>{
        const groups=writtenGroupsByMark[mark];
        if(!groups.length)return;
        blocks.push({section:isEnglish?`Section ${String.fromCharCode(66+index)} — ${mark} Mark Questions`:`खंड ${['ब','स','द'][index]} — ${mark} अंक के प्रश्न`});
        groups.forEach(g=>blocks.push({html:writtenHtml(g,mark),kind:'question'}));
      });

      // Keep each six-part objective group on its own page to prevent clipping.
      // Written groups may share pages, while each OR pair stays together.
      const pages=[];let page=[],questionCount=0;
      blocks.forEach(block=>{
        if(block.section){
          if(page.length){pages.push(page);page=[];questionCount=0;}
          page.push(block);
        }else if(block.objective){
          if(questionCount>0){pages.push(page);page=[];questionCount=0;}
          page.push(block);
          pages.push(page);page=[];questionCount=0;
        }else{
          if(questionCount>=4){pages.push(page);page=[];questionCount=0;}
          page.push(block);questionCount++;
        }
      });
      if(page.length)pages.push(page);

      const host=document.createElement('div');
      host.style.cssText='position:fixed;left:-10000px;top:0;z-index:-1';
      host.innerHTML=`<style>
        .fullpaper-page{box-sizing:border-box;width:794px;height:1123px;padding:42px 55px 58px;background:#fff;color:#111;font-family:'Noto Sans Devanagari',Arial,sans-serif;position:relative;overflow:hidden}
        .fullpaper-head{text-align:center;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:12px;color:#111}
        .fullpaper-head .board{font-size:16px;font-weight:800}.fullpaper-head h1{font-size:20px;margin:6px 0}.fullpaper-meta{display:flex;justify-content:space-between;gap:8px;font-size:12px;font-weight:700;margin:6px 0}
        .fullpaper-roll{display:flex;justify-content:space-between;font-size:12px;margin:10px 0;border-bottom:1px solid #888;padding-bottom:8px}
        .fullpaper-instructions{font-size:11px;line-height:1.6;border:1px solid #777;padding:8px 9px;margin-bottom:12px}
        .fullpaper-section{font-size:15px;font-weight:800;border-bottom:1px solid #444;padding:8px 0;margin:7px 0 10px}
        .fullpaper-q{margin:0 0 12px;padding-bottom:9px;border-bottom:1px dotted #aaa;break-inside:avoid}
        .fullpaper-qhead{display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px}
        .fullpaper-text{font-size:13px;line-height:1.65;white-space:pre-wrap;margin:4px 0 6px}
        .fullpaper-subintro{font-size:12px;font-weight:700;margin:4px 0 6px}
        .fullpaper-subq{font-size:13px;line-height:1.65;margin:5px 0 8px;break-inside:avoid}
        .pp-exam-options{display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;padding-left:18px;margin-top:4px}
        .pp-exam-option{font-size:12px;line-height:1.5;white-space:pre-wrap}
        .pp-exam-options-inline{grid-template-columns:1fr 1fr}
        .pp-exam-writing-lines{height:18px;border-bottom:1px dotted #aaa;margin:3px 0}
        .pp-exam-match-wrap{margin:6px 0}.pp-exam-match-table{width:100%;border-collapse:collapse;font-size:12px}.pp-exam-match-table th,.pp-exam-match-table td{border:1px solid #777;padding:5px;text-align:left}
        .fullpaper-or{text-align:center;font-weight:800;font-size:12px;margin:7px 0}
        .fullpaper-footer{position:absolute;bottom:24px;left:55px;right:55px;border-top:1px solid #999;padding-top:7px;display:flex;justify-content:space-between;font-size:10px}
      </style>`;
      const pageHtml=pages.map((items,index)=>{
        const first=index===0;
        const content=items.map(b=>b.section?`<div class="fullpaper-section">${esc(b.section)}</div>`:b.html).join('');
        const header=first?`<div class="fullpaper-head"><div class="board">हाई स्कूल परीक्षा / HIGH SCHOOL EXAMINATION</div><h1>गणित — प्रश्नपत्र / MATHEMATICS</h1><div class="fullpaper-meta"><span>कक्षा: ${esc(student.class_level)}</span><span>सत्र / Year: ${esc(year)}</span><span>स्तर / Level: ${needsMathsLevel(year)?esc(mathsLevel):'—'}</span><span>सेट / Set: ${esc(selectedSet)}</span></div><div class="fullpaper-meta"><span>समय / Time: 3 घंटे</span><span>पूर्णांक / Maximum Marks: 75</span></div></div><div class="fullpaper-roll"><span>विद्यार्थी का नाम: __________________</span><span>अनुक्रमांक: ______________</span></div><div class="fullpaper-instructions"><b>निर्देश:</b><br>(i) सभी प्रश्न अनिवार्य हैं।<br>(ii) प्रश्न क्रमांक 1 से 5 तक वस्तुनिष्ठ प्रकार के प्रश्न हैं।<br>(iii) प्रश्न क्रमांक 6 से 23 तक आंतरिक विकल्प दिए गए हैं।<br>(iv) जहाँ आवश्यक हो स्वच्छ एवं नामांकित आकृति बनाइए।</div>`:`<div class="fullpaper-head"><div class="board">GANIT SETU • MATHEMATICS</div><h1>प्रश्नपत्र (जारी)</h1><div class="fullpaper-meta"><span>कक्षा: ${esc(student.class_level)}</span><span>सत्र: ${esc(year)}</span><span>स्तर: ${needsMathsLevel(year)?esc(mathsLevel):'—'}</span><span>सेट: ${esc(selectedSet)}</span></div></div>`;
        return `<section class="fullpaper-page">${header}${content}<div class="fullpaper-footer"><span>GANIT SETU • गणित</span><span>पृष्ठ ${index+1} / ${pages.length}</span></div></section>`;
      }).join('');
      host.insertAdjacentHTML('beforeend',pageHtml);document.body.appendChild(host);
      try{
        if(!window.jspdf?.jsPDF)throw new Error('PDF सुविधा लोड नहीं हुई। इंटरनेट कनेक्शन जाँचें।');
        const {jsPDF}=window.jspdf,pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
        const pageEls=[...host.querySelectorAll('.fullpaper-page')];
        for(let i=0;i<pageEls.length;i++){
          const canvas=await window.html2canvas(pageEls[i],{scale:1.6,useCORS:true,backgroundColor:'#fff',logging:false});
          if(i)pdf.addPage();pdf.addImage(canvas.toDataURL('image/jpeg',0.92),'JPEG',0,0,210,297,undefined,'FAST');
        }
        pdf.save(safeName(`Ganit_Setu_Class${classLevel}_Full_Paper_${year}_${needsMathsLevel(year)?mathsLevel+'_':''}${selectedSet}`)+'.pdf');
      }finally{host.remove();}
    });
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
