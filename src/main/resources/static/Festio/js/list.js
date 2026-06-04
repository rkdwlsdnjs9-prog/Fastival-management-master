/* js/list.js */

const CATEGORIES = {
  'concert': { label: '콘서트', bg: 'linear-gradient(135deg, #1a1b26, #3b3d58)', subs: [{ k: 'all', v: '전체보기' }, { k: 'domestic', v: '국내뮤지션' }, { k: 'overseas', v: '해외뮤지션' }, { k: 'festival', v: '페스티벌' }] },
  'musical': { label: '뮤지컬', bg: 'linear-gradient(135deg, #2b1021, #5c2041)', subs: [{ k: 'all', v: '전체보기' }, { k: 'original', v: '오리지널' }, { k: 'license', v: '라이선스' }, { k: 'creative', v: '창작' }] },
  'play': { label: '연극', bg: 'linear-gradient(135deg, #10212b, #20415c)', subs: [{ k: 'all', v: '전체보기' }, { k: 'drama', v: '정극' }, { k: 'comedy', v: '코미디' }, { k: 'thriller', v: '스릴러' }] },
  'classic': { label: '클래식/무용', bg: 'linear-gradient(135deg, #2b2b10, #5c5c20)', subs: [{ k: 'all', v: '전체보기' }, { k: 'classic', v: '클래식' }, { k: 'ballet', v: '발레/무용' }, { k: 'gukak', v: '국악' }] },
  'exhibition': { label: '전시/스포츠', bg: 'linear-gradient(135deg, #102b1c, #205c3b)', subs: [{ k: 'all', v: '전체보기' }, { k: 'exhibition', v: '전시' }, { k: 'experience', v: '체험/행사' }, { k: 'sports', v: '스포츠' }] },
  'family': { label: '가족/어린이', bg: 'linear-gradient(135deg, #2b1a10, #5c3520)', subs: [{ k: 'all', v: '전체보기' }, { k: 'musical', v: '가족뮤지컬' }, { k: 'play', v: '가족연극' }, { k: 'experience', v: '체험' }] },
  'local': { label: '지역축제', bg: 'linear-gradient(135deg, #1c102b, #3b205c)', subs: [{ k: 'all', v: '전체보기' }, { k: 'seoul', v: '수도권' }, { k: 'gangwon', v: '강원권' }, { k: 'chungcheong', v: '충청권' }, { k: 'gyeongsang', v: '경상권' }, { k: 'jeolla', v: '전라권' }, { k: 'jeju', v: '제주권' }] },
  'univ': { label: '대학축제', bg: 'linear-gradient(135deg, #2b2010, #5c4420)', subs: [{ k: 'all', v: '전체보기' }, { k: 'spring', v: '봄축제' }, { k: 'fall', v: '가을축제' }] },
  'expo': { label: '박람회', bg: 'linear-gradient(135deg, #101010, #333333)', subs: [{ k: 'all', v: '전체보기' }, { k: 'tech', v: 'IT/테크' }, { k: 'living', v: '리빙/라이프' }, { k: 'food', v: '식품' }, { k: 'job', v: '취업/창업' }] }
};

let _events = [];
let _currentCat = 'all';
let _wishlist = [];

document.addEventListener('DOMContentLoaded', async () => {
  // 카테고리를 위한 쿼리 문자열 파싱
  const urlParams = new URLSearchParams(window.location.search);
  const catParam = urlParams.get('category');
  if (catParam && CATEGORIES[catParam]) {
    _currentCat = catParam;
  } else {
    _currentCat = 'concert'; // 기본값
  }

  const subParam = urlParams.get('sub') || 'all';

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
  const container = $('#category-visual-header');
  if (!container) return;

  const catData = CATEGORIES[_currentCat];
  if (!catData) return;

  const urlParams = new URLSearchParams(window.location.search);
  const currentSub = urlParams.get('sub') || 'all';

  container.innerHTML = `
    <div class="category-banner" style="background: ${catData.bg};">
      <h1 class="category-banner-title">${catData.label}</h1>
    </div>
    <div class="category-lnb-wrap">
      <div class="category-lnb">
        ${catData.subs.map(s => `
          <div class="category-lnb-item ${s.k === currentSub ? 'active' : ''}" data-sub="${s.k}">
            ${s.v}
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // 서브 카테고리 클릭 이벤트
  $$('.category-lnb-item').forEach(item => {
    on(item, 'click', (e) => {
      const sub = e.target.dataset.sub;
      if (sub === currentSub) return;

      const url = new URL(window.location);
      url.searchParams.set('sub', sub);
      window.history.pushState({}, '', url);

      renderCategoryTabs();
      renderBentoGrid();
    });
  });
}

function renderBentoGrid() {
  const grid = $('.bento-grid');
  if (!grid) return;

  // 데이터가 실제 카테고리와 매핑되진 않았으므로 목업으로 전체를 렌더링하거나 일부만 필터링합니다.
  // 이 예제에서는 기존 코드를 유지하되 카테고리 필터를 제거합니다.
  const items = _events;

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
  if (typeof Auth !== 'undefined' && !Auth.isLoggedIn()) {
    if (window.Toast) Toast.info('로그인이 필요합니다.');
    setTimeout(() => { window.location.href = 'login.html'; }, 1000);
    return;
  }

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
