/* js/list.js */

const CATEGORIES = [
  { key: 'all', label: '모든 행사' },
  { key: '콘서트/뮤지컬', label: '콘서트/뮤지컬' },
  { key: '지역축제', label: '지역축제' },
  { key: '대학축제', label: '대학축제' },
  { key: '박람회', label: '박람회' },
  { key: '스포츠', label: '스포츠' }
];

let _events = [];
let _currentCat = 'all';
let _wishlist = [];

document.addEventListener('DOMContentLoaded', async () => {
  // 카테고리를 위한 쿼리 문자열 파싱
  const urlParams = new URLSearchParams(window.location.search);
  const catParam = urlParams.get('category');
  if (catParam && CATEGORIES.some(c => c.key === catParam)) {
    _currentCat = catParam;
  }

  const btnSearch = $('#btn-header-search');
  if (btnSearch) {
    on(btnSearch, 'click', () => alert('검색 기능은 준비 중입니다.'));
  }

  const btnBack = $('#btn-back');
  if (btnBack) {
    on(btnBack, 'click', () => history.back());
  }

  const alertReadyBtns = $$('.alert-ready');
  alertReadyBtns.forEach(btn => {
    on(btn, 'click', (e) => {
      e.preventDefault();
      alert('준비 중입니다.');
    });
  });

  // 로딩 스켈레톤
  const grid = $('.bento-grid');
  if (grid) {
    grid.innerHTML = Array.from({ length: 8 }, (_, i) => `
      <div class="bento-card">
        <div class="skeleton" style="position:absolute;inset:0;border-radius:0;"></div>
      </div>`).join('');
  }

  renderCategoryTabs();

  try {
    const wishData = await wishlistApi.getWishlist();
    _wishlist = wishData ? wishData.map(w => w.event_no) : [];

    await eventApi.getEvents('all', (partialEvents) => {
      _events = partialEvents;
      renderBentoGrid();
    });
  } catch (err) {
    console.error("Data load error:", err);
    if (grid) grid.innerHTML = `<div style="padding:2rem;text-align:center;color:#666;">데이터를 불러오는 중 오류가 발생했습니다.</div>`;
  }
});

function renderCategoryTabs() {
  const container = $('.category-tabs');
  if (!container) return;

  const svgMap = {
    'all': `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`,
    '콘서트/뮤지컬': `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
    '지역축제': `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    '대학축제': `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`,
    '박람회': `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
    '스포츠': `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M14.83 9.17l4.24-4.24M4.93 19.07l4.24-4.24"/></svg>`
  };

  container.innerHTML = CATEGORIES.map(c => `
    <button class="category-tab ${c.key === _currentCat ? 'active' : ''}" data-cat="${c.key}">
      ${svgMap[c.key] || ''}
      ${c.label}
    </button>
  `).join('');

  on(container, 'click', (e) => {
    const tab = e.target.closest('.category-tab');
    if (!tab) return;
    const cat = tab.dataset.cat;
    if (cat === _currentCat) return;
    _currentCat = cat;

    // 페이지 새로고침 없이 URL 업데이트
    const url = new URL(window.location);
    url.searchParams.set('category', cat);
    window.history.pushState({}, '', url);

    $$('.category-tab').forEach(t => t.classList.toggle('active', t.dataset.cat === cat));
    renderBentoGrid();
  });
}

function renderBentoGrid() {
  const grid = $('.bento-grid');
  if (!grid) return;

  const items = _currentCat === 'all'
    ? _events
    : _events.filter(ev => ev.category === _currentCat);

  if (items.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; padding: 4rem 1rem; text-align: center; color: #888;">
        해당 카테고리의 행사 정보가 없습니다.
      </div>
    `;
    return;
  }

  function wishBtnSVG(isWished) {
    return isWished
      ? `<svg class="icon" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="0" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>`
      : `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>`;
  }

  grid.innerHTML = items.map(ev => {
    const isWished = _wishlist.includes(ev.eventNo);
    const dday = calcDday(ev.eventDate, ev.eventEndDate);
    const catClass = getCategoryBadgeClass(ev.category);
    let badgeHTML = '';
    if (ev.badgeLabel) {
      badgeHTML = `<span class="badge ${ev.isHot ? 'badge-hot' : ev.badgeLabel === '신규' ? 'badge-new' : ev.badgeLabel === '타임세일' ? 'badge-sale' : 'badge-dday'}">${ev.badgeLabel}</span>`;
    } else if (dday !== '종료') {
      badgeHTML = `<span class="badge badge-dday">${dday}</span>`;
    }

    return `
      <div class="bento-card bento-card--standard" data-event-no="${ev.eventNo}" role="button" tabindex="0" aria-label="${ev.eventName}">
        <div class="bento-card-image" style="background: #000;">
          ${ev.thumbnailUrl
        ? `<div style="position: absolute; inset: 0; background: url('${ev.thumbnailUrl}') center/cover; filter: blur(15px); opacity: 0.6; transform: scale(1.1);"></div>
               <img src="${ev.thumbnailUrl}" alt="${ev.eventName}" loading="lazy" style="position: relative; width: 100%; height: 100%; object-fit: contain; z-index: 1;" />`
        : `<div class="bento-card-image-placeholder">
                 <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><path d="M16 3H8L6 7h12l-2-4z"/></svg>
               </div>`
      }
        </div>
        <button class="bento-card-wish ${isWished ? 'active' : ''}" data-event-no="${ev.eventNo}" data-wished="${isWished}" aria-label="${isWished ? '찜 해제' : '찜 추가'}">
          ${wishBtnSVG(isWished)}
        </button>
        <div class="bento-card-overlay">
          <div class="bento-card-badge-row">
            ${badgeHTML}
            <span class="badge ${catClass}">${ev.category}</span>
          </div>
          <div class="bento-card-title">${ev.eventName}</div>
          <div class="bento-card-action">
            <div class="bento-card-date">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              ${formatDateKo(ev.eventDate)}
            </div>
            <div class="bento-card-price">${formatKRW(ev.minPrice)}~</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  on(grid, 'click', (e) => {
    const wishBtn = e.target.closest('.bento-card-wish');
    if (wishBtn) {
      e.stopPropagation();
      toggleWish(wishBtn);
      return;
    }
    const card = e.target.closest('.bento-card');
    if (card) {
      window.location.href = `detail.html?eventNo=${card.dataset.eventNo}`;
    }
  });
}

async function toggleWish(btn) {
  const eventNo = parseInt(btn.dataset.eventNo);
  const isActive = btn.classList.contains('active');

  if (isActive) {
    const success = await wishlistApi.removeWishlist(eventNo);
    if (success) {
      btn.classList.remove('active');
      if (window.Toast) Toast.info('찜 목록에서 제거했습니다.');
    }
  } else {
    const success = await wishlistApi.addWishlist(eventNo);
    if (success) {
      btn.classList.add('active');
      if (window.Toast) Toast.success('찜 목록에 추가했습니다. 마이페이지로 이동합니다.');
      setTimeout(() => { window.location.href = 'mypage.html#tab-wishlist'; }, 900);
    }
  }
}
