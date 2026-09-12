/* ============================================
   GANIT SETU - HOME PAGE
   Dynamic Banner Slider

   Admin Panel में active banners 'home_banners'
   table से आएँगे। Home पर कोई default image नहीं है।
   ============================================ */

(function(){
  let banners = [];
  let currentIndex = 0;
  let timer = null;

  function el(id){ return document.getElementById(id); }

  function stopAutoSlide(){
    if(timer){
      clearInterval(timer);
      timer = null;
    }
  }

  function updateSlider(){
    const track = el('gsBannerTrack');
    const counterDots = el('gsBannerDots');
    if(!track || !counterDots || !banners.length) return;

    track.style.transform = `translateX(-${currentIndex * 100}%)`;

    [...counterDots.children].forEach((dot, i)=>{
      dot.classList.toggle('active', i === currentIndex);
    });
  }

  function startAutoSlide(){
    stopAutoSlide();
    if(banners.length > 1){
      timer = setInterval(()=>{
        currentIndex = (currentIndex + 1) % banners.length;
        updateSlider();
      }, 5000);
    }
  }

  function renderBanners(rows){
    const section = el('gsBannerSlider');
    const track = el('gsBannerTrack');
    const dots = el('gsBannerDots');
    const controls = el('gsBannerControls');
    const prev = el('gsBannerPrev');
    const next = el('gsBannerNext');

    if(!section || !track || !dots) return;

    banners = (Array.isArray(rows) ? rows : [])
      .filter(row => row && row.image_url && row.is_active !== false)
      .sort((a,b) => Number(a.display_order || 0) - Number(b.display_order || 0));

    track.innerHTML = '';
    dots.innerHTML = '';
    currentIndex = 0;
    stopAutoSlide();

    if(!banners.length){
      section.hidden = true;
      if(controls) controls.hidden = true;
      return;
    }

    banners.forEach((banner, index)=>{
      const slide = document.createElement('article');
      slide.className = 'gs-banner-slide';

      const image = document.createElement('img');
      image.src = banner.image_url;
      image.alt = '';
      image.loading = index === 0 ? 'eager' : 'lazy';
      image.decoding = 'async';

      if(banner.link_url){
        const link = document.createElement('a');
        link.href = banner.link_url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.appendChild(image);
        slide.appendChild(link);
      }else{
        slide.appendChild(image);
      }

      track.appendChild(slide);

      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = index === 0 ? 'active' : '';
      dot.setAttribute('aria-label', `बैनर ${index + 1}`);
      dot.addEventListener('click', ()=>{
        currentIndex = index;
        updateSlider();
        startAutoSlide();
      });
      dots.appendChild(dot);
    });

    section.hidden = false;
    if(controls) controls.hidden = banners.length <= 1;

    if(prev) prev.onclick = ()=>{
      currentIndex = (currentIndex - 1 + banners.length) % banners.length;
      updateSlider();
      startAutoSlide();
    };

    if(next) next.onclick = ()=>{
      currentIndex = (currentIndex + 1) % banners.length;
      updateSlider();
      startAutoSlide();
    };

    updateSlider();
    startAutoSlide();
  }

  async function loadHomeBanners(){
    if(typeof supabaseClient === 'undefined') return;

    try{
      const { data, error } = await supabaseClient
        .from('home_banners')
        .select('id, image_url, link_url, display_order, is_active')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .order('id', { ascending: true });

      if(error){
        // Table अभी न बनी हो तो Home Page को blank ही रखें।
        console.warn('Home banner load skipped:', error.message);
        renderBanners([]);
        return;
      }

      renderBanners(data || []);
    }catch(error){
      console.warn('Home banner load skipped:', error);
      renderBanners([]);
    }
  }

  document.addEventListener('DOMContentLoaded', loadHomeBanners);
})();

/* GS-BANNER-SWIPE */

/* GS-BANNER-SWIPE */
(function(){
  let startX = 0, startY = 0, moved = false;
  const threshold = 45;

  function bannerTarget(){
    return document.querySelector('.banner-slider, .banner-carousel, .hero-banner, #bannerSlider, #bannerCarousel');
  }

  function clickArrow(direction){
    const root = bannerTarget();
    if(!root) return;
    const selectors = direction === 'next'
      ? ['.banner-next', '.next', '.slider-next', '[data-direction="next"]', '[aria-label*="Next" i]']
      : ['.banner-prev', '.prev', '.slider-prev', '[data-direction="prev"]', '[aria-label*="Previous" i]'];
    for(const selector of selectors){
      const btn = root.querySelector(selector) || document.querySelector(selector);
      if(btn){ btn.click(); return true; }
    }
    return false;
  }

  function attach(){
    const el = bannerTarget();
    if(!el || el.dataset.gsSwipeAttached === '1') return;
    el.dataset.gsSwipeAttached = '1';

    el.addEventListener('touchstart', function(e){
      if(!e.touches || !e.touches[0]) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      moved = false;
    }, {passive:true});

    el.addEventListener('touchmove', function(e){
      if(!e.touches || !e.touches[0]) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if(Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 12) moved = true;
    }, {passive:true});

    el.addEventListener('touchend', function(e){
      if(!moved) return;
      const touch = e.changedTouches && e.changedTouches[0];
      if(!touch) return;
      const dx = touch.clientX - startX;
      if(Math.abs(dx) < threshold) return;
      clickArrow(dx < 0 ? 'next' : 'prev');
      moved = false;
    }, {passive:true});
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', attach, {once:true});
  }else{
    attach();
  }
  setTimeout(attach, 500);
})();
