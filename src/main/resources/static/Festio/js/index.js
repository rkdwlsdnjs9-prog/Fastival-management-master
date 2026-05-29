/**
 * Festival O2O — index.js
 * 메인 페이지: 포스터 그리드, 카테고리 필터, 히어로 슬라이더
 * 호버 오버레이, 위시리스트, 타임세일
 */
'use strict';

window._isIndexPage = true;

let _events = [];
let _wishlist = [];
let _currentCat = sessionStorage.getItem('idx_cat') || 'all';
let _currentSub = sessionStorage.getItem('idx_sub') || 'all';
let _currentSort = 'latest';
let _searchQuery = '';
let _page = 1;
const PAGE_SIZE = window.innerWidth >= 1280 ? 24 : window.innerWidth >= 1024 ? 20 : 12;

let _heroTimer = null;
let _heroIdx = 0;
let _heroSlides = [];

const MOBILE_CATS = [
  { key: 'all', label: '전체' },
  { key: 'concert', label: '콘서트' },
  { key: 'musical', label: '뮤지컬' },
  { key: 'play', label: '연극' },
  { key: 'classic', label: '클래식/무용' },
  { key: 'exhibition', label: '전시/스포츠' },
  { key: 'family', label: '가족/어린이' },
  { key: 'local', label: '지역축제' },
  { key: 'univ', label: '대학축제' },
  { key: 'expo', label: '박람회' },
];

/* ═══ 데이터 로드 ════════════════════════════════════════════ */
async function loadData() {
  const [wishData] = await Promise.all([
    wishlistApi.getWishlist().catch(() => []),
  ]);
  _wishlist = wishData || [];

  const onProgress = (partial) => {
    _events = partial || [];
    renderPosterGrid();
    updateStats();
    if (_heroSlides.length === 0) buildHeroSlides();
    renderTimesale();
    renderWhatsHot();
  };

  await eventApi.getEvents(null, onProgress).catch(console.error);
}

/* ═══ 히어로 슬라이더 ════════════════════════════════════════ */
function buildHeroSlides() {
  const hot = _events.filter(e => e.isHot).slice(0, 5);
  const rest = _events.filter(e => !e.isHot).slice(0, 7);
  let picks = [...hot, ...rest];
  while (picks.length > 0 && picks.length < 12) {
    picks = picks.concat(picks);
  }
  picks = picks.slice(0, 12);
  _heroSlides = picks.map(ev => {
    const parts = (ev.eventDate || '').split('-');
    const dateStr = parts.length === 3 ? `${parseInt(parts[1])}월 ${parseInt(parts[2])}일` : ev.eventDate;
    return {
      eventNo: ev.eventNo || ev.id,
      title: ev.eventName || ev.name,
      category: ev.category,
      date: dateStr,
      venue: ev.venue,
      badge: ev.badgeLabel || (ev.isHot ? 'HOT' : '추천'),
      thumbnailUrl: ev.thumbnailUrl,
    };
  });
  renderHeroSlides();
}

function renderHeroSlides() {
  const slider = document.getElementById('heroSlider');
  const dotsWrap = document.getElementById('heroIndicators');
  if (!slider || !_heroSlides.length) return;

  slider.innerHTML = _heroSlides.map((s, i) => `
    <div class="hero-slide" data-event-no="${s.eventNo}">
      <div class="hero-slide-bg">
        ${s.thumbnailUrl ? `<img src="${s.thumbnailUrl}" alt="" class="bg-blur" loading="${i === 0 ? 'eager' : 'lazy'}">` : ''}
        <div class="bg-overlay"></div>
      </div>
      <div class="hero-slide-inner">
        <div class="hero-slide-content">
          <span class="hero-slide-cat">${s.category || ''}</span>
          <h2 class="hero-slide-title">${s.title}</h2>
          <div class="hero-slide-meta">
            <span>
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;display:inline-block"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              ${s.date}
            </span>
            <span>${s.venue}</span>
          </div>
          <span class="hero-slide-badge">${s.badge}</span>
        </div>
        <div class="hero-slide-poster-wrap">
          ${s.thumbnailUrl ? `<img src="${s.thumbnailUrl}" alt="${s.title}" class="hero-slide-poster">` : ''}
        </div>
      </div>
    </div>`).join('');

  if (dotsWrap) {
    const numsLayer = `<div class="hero-nums-layer">` + _heroSlides.map((s, i) => {
      const numStr = String(i + 1).padStart(2, '0');
      return `<div class="hero-dot ${i === 0 ? 'active' : ''}" data-dot="${i}">
        <span class="hero-dot-num">${numStr}</span>
      </div>`;
    }).join('') + `</div>`;

    const postersLayer = `<div class="hero-posters-layer">` + _heroSlides.map((s, i) => {
      return `<div class="hero-dot-poster ${i === 0 ? 'active' : ''}" data-dot="${i}">
        <div class="hero-dot-bg" style="--bg-img: url('${s.thumbnailUrl || ''}')"></div>
      </div>`;
    }).join('') + `</div>`;

    dotsWrap.innerHTML = numsLayer + postersLayer;

    on(dotsWrap, 'click', e => {
      const dot = e.target.closest('[data-dot]');
      if (dot) goHero(parseInt(dot.dataset.dot));
    });
  }

  on(slider, 'click', e => {
    const slide = e.target.closest('.hero-slide');
    if (slide) location.href = `detail.html?eventNo=${slide.dataset.eventNo}`;
  });

  const prevBtn = document.getElementById('heroPrevBtn');
  const nextBtn = document.getElementById('heroNextBtn');

  function startHeroTimer() {
    clearInterval(_heroTimer);
    _heroTimer = setInterval(() => goHero(_heroIdx + 1), 4500);
  }

  function stopHeroTimer() {
    clearInterval(_heroTimer);
  }

  if (prevBtn) {
    prevBtn.onclick = () => {
      stopHeroTimer();
      goHero(_heroIdx - 1);
      startHeroTimer();
    };
  }
  if (nextBtn) {
    nextBtn.onclick = () => {
      stopHeroTimer();
      goHero(_heroIdx + 1);
      startHeroTimer();
    };
  }

  if (dotsWrap) {
    on(dotsWrap, 'mouseenter', stopHeroTimer);
    on(dotsWrap, 'mouseleave', startHeroTimer);
  }
  on(slider, 'mouseenter', stopHeroTimer);
  on(slider, 'mouseleave', startHeroTimer);

  startHeroTimer();
}

function goHero(idx) {
  const slider = document.getElementById('heroSlider');
  const dots = $$('[data-dot]');
  if (!slider || !_heroSlides.length) return;
  _heroIdx = ((idx % _heroSlides.length) + _heroSlides.length) % _heroSlides.length;
  slider.style.transform = `translateX(-${_heroIdx * 100}%)`;
  dots.forEach(d => {
    const dotIdx = parseInt(d.dataset.dot);
    d.classList.toggle('active', dotIdx === _heroIdx);
  });
}

/* ═══ WHAT'S HOT 섹션 ════════════════════════════════════════ */
function renderWhatsHot() {
  const grid = document.getElementById('whatsHotGrid');
  if (!grid) return;

  // We need 7 popular items: 1 large, 6 small
  const popularEvents = [..._events].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 7);
  if (popularEvents.length < 7) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px;">데이터가 부족합니다.</div>';
    return;
  }

  const html = popularEvents.map((ev, index) => {
    const isLarge = index === 0;
    const badgeText = ev.badgeLabel || (isLarge ? '단독' : '단독'); // matching image

    // Large item has title/desc below the image
    const infoHtml = isLarge ? `
      <div class="whats-hot-info">
        <div class="whats-hot-item-title">${ev.eventName || ev.name}</div>
        <div class="whats-hot-item-desc">${ev.eventDate || '2026. 07. 16.'} ${ev.venue || 'YES24 LIVE HALL'} / <span>단독판매</span></div>
      </div>
    ` : '';

    const priceText = ev.price ? ev.price.toLocaleString() + '원' : '30,000원';
    const viewsText = ev.views ? ev.views.toLocaleString() : '2,100';

    return `
      <a href="detail.html?eventNo=${ev.eventNo || ev.id}" class="whats-hot-item ${isLarge ? 'large' : ''}">
        <div class="whats-hot-img-wrap">
          <img src="${ev.thumbnailUrl || ''}" alt="${ev.eventName || ev.name}" class="whats-hot-img">
          <div class="whats-hot-badge">${badgeText}</div>
          
          <div class="whats-hot-overlay">
            <h3 class="overlay-title">${(ev.eventName || ev.name || '').replace('HOT', '<span style="color:red">HOT</span>')}</h3>
            <div class="overlay-badges">
              <span class="ob-new">신규</span>
              <span class="ob-dday">D-115</span>
            </div>
            <div class="overlay-date">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              ${ev.eventDate || '2026.09.20'}
            </div>
            <div class="overlay-price">${priceText}</div>
            <div class="overlay-views">
              <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
              조회 ${viewsText}
            </div>
          </div>
        </div>
        ${infoHtml}
      </a>
    `;
  }).join('');

  grid.innerHTML = html;
}

/* ═══ 카테고리 탭바 (모바일) ════════════════════════════════ */
function renderMobileCatTabbar() {
  const container = document.getElementById('catTabbar');
  if (!container) return;
  container.innerHTML = MOBILE_CATS.map(c => `
    <button class="cat-tabbar-item ${c.key === _currentCat ? 'active' : ''}" data-cat="${c.key}">
      ${c.label}
    </button>`).join('');
  on(container, 'click', e => {
    const item = e.target.closest('.cat-tabbar-item');
    if (!item) return;
    const cat = item.dataset.cat;
    if (cat === _currentCat) return;
    window.applyCategory(cat, 'all');
  });
}

/* ═══ 포스터 그리드 렌더링 ══════════════════════════════════ */
function getFilteredEvents() {
  let items = _events.slice();

  // 카테고리 필터
  if (_currentCat && _currentCat !== 'all') {
    const catMap = {
      concert: ['콘서트/뮤지컬', '콘서트'],
      musical: ['뮤지컬', '콘서트/뮤지컬'],
      play: ['연극'],
      classic: ['클래식/무용', '클래식'],
      exhibition: ['전시/스포츠', '전시', '스포츠', '체험/행사'],
      family: ['가족/어린이', '아동/가족'],
      local: ['지역축제'],
      univ: ['대학축제'],
      expo: ['박람회'],
    };
    const targets = catMap[_currentCat] || [];
    if (targets.length) {
      items = items.filter(e => targets.some(t => (e.category || '').includes(t)));
    }
  }

  // 검색 필터
  if (_searchQuery) {
    const q = _searchQuery.toLowerCase();
    items = items.filter(e =>
      (e.eventName || e.name || '').toLowerCase().includes(q) ||
      (e.venue || '').toLowerCase().includes(q)
    );
  }

  // 종료된 행사 하단으로
  const active = items.filter(e => calcDday(e.eventDate || e.startDate, e.eventEndDate || e.endDate) !== '종료');
  const ended = items.filter(e => calcDday(e.eventDate || e.startDate, e.eventEndDate || e.endDate) === '종료');

  // 정렬
  const sort = (arr) => {
    if (_currentSort === 'popular') return [...arr].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    if (_currentSort === 'date') return [...arr].sort((a, b) => new Date(a.eventDate || a.startDate) - new Date(b.eventDate || b.startDate));
    return arr; // latest (API 순서)
  };

  return [...sort(active), ...ended];
}

function renderPosterGrid() {
  const grid = document.getElementById('posterGrid');
  if (!grid) return;

  const filtered = getFilteredEvents();
  const paginated = filtered.slice(0, _page * PAGE_SIZE);

  // 결과 카운트 업데이트
  const countEl = document.getElementById('resultCount');
  if (countEl) countEl.textContent = filtered.length.toLocaleString();

  // 더보기 버튼
  const loadMoreWrap = document.getElementById('loadMoreWrap');
  if (loadMoreWrap) {
    loadMoreWrap.style.display = paginated.length < filtered.length ? 'flex' : 'none';
  }

  if (!paginated.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <p class="empty-state-title">조건에 맞는 행사가 없습니다.</p>
        <p class="empty-state-desc">다른 카테고리를 선택하거나 검색어를 바꿔보세요.</p>
      </div>`;
    return;
  }

  grid.innerHTML = paginated.map((ev, i) => buildPosterCard(ev, i)).join('');

  // 위시 버튼 이벤트
  on(grid, 'click', e => {
    const wishBtn = e.target.closest('.poster-wish-btn');
    if (wishBtn) { e.stopPropagation(); handleWish(wishBtn); return; }
    const card = e.target.closest('.poster-card');
    if (card) {
      const no = card.dataset.eventNo;
      const ev = _events.find(e => String(e.eventNo || e.id) === String(no));
      if (ev) {
        RecentViewed.add({
          eventNo: no,
          name: ev.eventName || ev.name,
          thumbnailUrl: ev.thumbnailUrl,
        });
      }
      location.href = `detail.html?eventNo=${no}`;
    }
  });
}

function buildPosterCard(ev, idx) {
  const no = ev.eventNo || ev.id;
  const name = ev.eventName || ev.name || '-';
  const date = ev.eventDate || ev.startDate;
  const endDate = ev.eventEndDate || ev.endDate;
  const price = ev.minPrice || 0;
  const badge = ev.badgeLabel;
  const isHot = ev.isHot;
  const isAdult = ev.isAdultOnly || false;
  const isWished = _wishlist.includes(no);
  const thumb = ev.thumbnailUrl;
  const dday = calcDday(date, endDate);
  const views = ev.viewCount || 0;

  const badgeHTML = badge ? `
    <span class="overlay-badge ${isHot ? 'hot' : badge === '타임세일' ? 'sale' : ''}">
      ${badge}
    </span>` : '';

  const ddayHTML = dday !== '종료' ? `<span class="overlay-badge">${dday}</span>` : '';

  const discountHTML = price > 0 ? `
    <div class="overlay-price-row">
      <span class="overlay-price">${formatKRW(price)}</span>
      ${isHot ? `<span class="overlay-orig-price">${formatKRW(Math.round(price * 1.25))}</span>
                 <span class="overlay-discount">20%</span>` : ''}
    </div>` : `<div class="overlay-price-row"><span class="overlay-price">무료</span></div>`;

  const eventTag = isHot ? `<div class="overlay-event-tag">HOT DEAL 진행중</div>` : '';

  return `
    <div class="poster-card" data-event-no="${no}" tabindex="0" role="button" aria-label="${name}">
      <div class="poster-img-wrap">
        ${thumb
      ? `<img src="${thumb}" alt="${name}" loading="lazy">`
      : `<div class="poster-placeholder">
               <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
             </div>`}
        ${isAdult ? `<span class="poster-adult-badge">19+</span>` : ''}
        <button class="poster-wish-btn ${isWished ? 'active' : ''}" data-event-no="${no}" data-wished="${isWished}" aria-label="${isWished ? '찜 해제' : '찜 추가'}">
          <svg class="icon" viewBox="0 0 24 24" fill="${isWished ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
        </button>
        <!-- 호버 오버레이 (데스크톱) -->
        <div class="poster-hover-overlay" aria-hidden="true">
          <div class="overlay-title">${name}</div>
          <div class="overlay-badges">${badgeHTML}${ddayHTML}</div>
          <div class="overlay-date">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            ${date ? formatDate(date) : '-'}
          </div>
          ${discountHTML}
          ${eventTag}
          ${views > 0 ? `
          <div class="overlay-review">
            <svg class="icon" viewBox="0 0 24 24" fill="currentColor" stroke="none" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            조회 ${views.toLocaleString()}
          </div>` : ''}
        </div>
      </div>
      <!-- 모바일 카드 하단 정보 -->
      <div class="poster-info">
        <div class="poster-info-badges">
          ${badge ? `<span class="badge ${isHot ? 'badge-hot' : 'badge-dday'}">${badge}</span>` : ''}
          ${dday !== '종료' && !badge ? `<span class="badge badge-dday">${dday}</span>` : ''}
        </div>
        <p class="poster-info-title">${name}</p>
        <p class="poster-info-date">${date ? formatDate(date) : '-'}</p>
        <p class="poster-info-price">${formatKRW(price)}</p>
      </div>
    </div>`;
}

/* ═══ 위시 토글 ═════════════════════════════════════════════ */
async function handleWish(btn) {
  if (btn.dataset.loading === 'true') return;
  btn.dataset.loading = 'true';
  const no = parseInt(btn.dataset.eventNo);
  const isWished = btn.dataset.wished === 'true';
  const newWish = !isWished;

  btn.dataset.wished = String(newWish);
  btn.classList.toggle('active', newWish);
  const icon = btn.querySelector('.icon');
  if (icon) icon.setAttribute('fill', newWish ? 'currentColor' : 'none');

  try {
    await wishlistApi.toggleWishlist(no, isWished);
    if (newWish) { _wishlist.push(no); Toast.success('찜 목록에 추가했습니다.'); }
    else { _wishlist = _wishlist.filter(n => n !== no); Toast.info('찜 목록에서 제거했습니다.'); }
  } catch {
    btn.dataset.wished = String(isWished);
    btn.classList.toggle('active', isWished);
    if (icon) icon.setAttribute('fill', isWished ? 'currentColor' : 'none');
    Toast.error('오류가 발생했습니다.');
  } finally {
    btn.dataset.loading = 'false';
  }
}

/* ═══ 타임세일 ══════════════════════════════════════════════ */
function renderTimesale() {
  const container = document.getElementById('timesaleCards');
  if (!container) return;
  const active = _events
    .filter(e => calcDday(e.eventDate || e.startDate, e.eventEndDate || e.endDate) !== '종료')
    .slice(0, 6);
  if (!active.length) { container.innerHTML = ''; return; }

  container.innerHTML = active.map(ev => {
    const no = ev.eventNo || ev.id;
    const name = ev.eventName || ev.name;
    const price = ev.minPrice || 0;
    const thumb = ev.thumbnailUrl;
    return `
      <div class="timesale-card" data-event-no="${no}">
        <div class="timesale-card-img">
          ${thumb ? `<img src="${thumb}" alt="${name}" loading="lazy">` : `<div class="timesale-card-img-placeholder"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>`}
        </div>
        <div class="timesale-card-body">
          <p class="timesale-card-title">${name}</p>
          <div class="timesale-price-row">
            <span class="timesale-price">${formatKRW(price)}</span>
            ${price > 0 ? `<span class="timesale-orig">${formatKRW(Math.round(price * 1.2))}</span>
            <span class="timesale-pct">20%</span>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');

  on(container, 'click', e => {
    const card = e.target.closest('.timesale-card');
    if (card) location.href = `detail.html?eventNo=${card.dataset.eventNo}`;
  });
}

/* ═══ 카운트다운 ════════════════════════════════════════════ */
function initCountdown() {
  const target = new Date(); target.setHours(23, 59, 59, 0);
  const tick = () => {
    const diff = Math.max(0, target - new Date());
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    const pad = n => String(n).padStart(2, '0');
    const hEl = $('.countdown-hours');
    const mEl = $('.countdown-minutes');
    const sEl = $('.countdown-seconds');
    if (hEl) hEl.textContent = pad(h);
    if (mEl) mEl.textContent = pad(m);
    if (sEl) sEl.textContent = pad(s);
  };
  tick();
  setInterval(tick, 1000);
}

/* ═══ 통계 업데이트 ═════════════════════════════════════════ */
function updateStats() {
  const total = document.getElementById('statTotal');
  const hot = document.getElementById('statHot');
  if (total) total.innerHTML = `<span>${_events.length}</span>개`;
  if (hot) hot.innerHTML = `<span>${_events.filter(e => e.isHot).length}</span>개`;
}

/* ═══ 카테고리/검색 적용 (전역) ════════════════════════════ */
window.applyCategory = (cat, sub = 'all') => {
  _currentCat = cat;
  _currentSub = sub;
  _page = 1;
  _searchQuery = '';
  sessionStorage.setItem('idx_cat', cat);
  sessionStorage.setItem('idx_sub', sub);

  // 모바일 탭 active
  $$('.cat-tabbar-item').forEach(t => t.classList.toggle('active', t.dataset.cat === cat));
  // 데스크톱 헤더 active
  $$('.header-cat-item').forEach(t => t.classList.toggle('active', t.dataset.cat === cat));
  // 서브탭 업데이트
  renderDesktopSubnav(cat, sub);

  renderPosterGrid();
};

window.applySubCategory = (sub) => {
  _currentSub = sub;
  _page = 1;
  renderPosterGrid();
};

window.applySort = (sort) => {
  _currentSort = sort;
  _page = 1;
  renderPosterGrid();
};

window.applySearch = (q) => {
  _searchQuery = q;
  _page = 1;
  renderPosterGrid();
};

/* ═══ 더보기 ════════════════════════════════════════════════ */
function initLoadMore() {
  on(document.getElementById('loadMoreBtn'), 'click', () => {
    _page++;
    renderPosterGrid();
  });
}

/* ═══ URL 파라미터 읽기 ════════════════════════════════════ */
function readUrlParams() {
  const p = new URLSearchParams(location.search);
  if (p.get('cat')) _currentCat = p.get('cat');
  if (p.get('sub')) _currentSub = p.get('sub');
}

/* ═══ DOMContentLoaded ══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  readUrlParams();
  renderMobileCatTabbar();
  renderDesktopSubnav(_currentCat, _currentSub);
  initCountdown();
  initLoadMore();

  // 스켈레톤
  const grid = document.getElementById('posterGrid');
  if (grid) {
    const cols = window.innerWidth >= 1280 ? 6 : window.innerWidth >= 1024 ? 5 : 2;
    grid.innerHTML = Array.from({ length: cols * 2 }, () => `
      <div class="poster-card">
        <div class="poster-img-wrap" style="aspect-ratio:3/4">
          <div class="skeleton" style="position:absolute;inset:0;border-radius:var(--radius-md)"></div>
        </div>
        <div class="poster-info">
          <div class="skeleton" style="height:14px;margin-bottom:6px;border-radius:4px"></div>
          <div class="skeleton" style="height:12px;width:70%;border-radius:4px"></div>
        </div>
      </div>`).join('');
  }

  await loadData();
  if (_currentCat !== 'all') {
    $$('.header-cat-item').forEach(t => t.classList.toggle('active', t.dataset.cat === _currentCat));
  }
});
