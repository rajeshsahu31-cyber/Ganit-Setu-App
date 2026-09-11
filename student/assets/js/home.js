// Home Page - Daily image banner slider
(function(){
  'use strict';

  const track = document.getElementById('gsNoticeTrack');
  const prev = document.getElementById('gsNoticePrev');
  const next = document.getElementById('gsNoticeNext');
  const dots = document.querySelectorAll('#gsNoticeDots button');

  if (!track || !prev || !next || !dots.length) return;

  const slides = track.children;
  let index = 0;
  let timer = null;

  function show(i){
    index = (i + slides.length) % slides.length;
    track.style.transform = 'translateX(-' + (index * 100) + '%)';
    dots.forEach((dot, n) => dot.classList.toggle('active', n === index));
  }

  function restart(){
    clearInterval(timer);
    timer = setInterval(() => show(index + 1), 5000);
  }

  prev.addEventListener('click', () => { show(index - 1); restart(); });
  next.addEventListener('click', () => { show(index + 1); restart(); });
  dots.forEach((dot, n) => dot.addEventListener('click', () => { show(n); restart(); }));

  show(0);
  restart();
})();
