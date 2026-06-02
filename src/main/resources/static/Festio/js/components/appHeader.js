/**
 * @file appHeader.js
 * @description 전역 상단 헤더(Header) 컴포넌트입니다.
 * 현재 접속 중인 페이지의 URL을 분석하여, 해당 페이지 성격(홈, 상세, 일반 서브)에 맞는
 * 최적화된 헤더 레이아웃을 동적으로 렌더링합니다.
 */
(function () {
  // 1. 현재 접속한 페이지 URL 경로 확인
  const path = window.location.pathname;
  const isIndex = path.endsWith('index.html') || path.endsWith('/');
  const isDetail = path.endsWith('detail.html');
  const isMypage = path.endsWith('mypage.html');

  // 2. 공통으로 사용되는 UI 아이콘(SVG) 정의
  const hamburgerSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`;
  const backSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
  const searchSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
  const alarmSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>`;
  const mypageSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
  const logoutSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;
  const ticketSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12v6a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h6"/><path d="M14 4h6v6"/><path d="M10 14L20 4"/></svg>`;
  const wishSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>`;
  const shareSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`;

  // 3. 데스크톱용 카테고리 네비게이션 마크업
  // (모든 페이지의 일반적인 헤더와 홈 화면 헤더에서 공통적으로 사용)
  const catNavHtml = `
    <nav class="header-cat-nav" aria-label="주요 카테고리">
      <button class="header-cat-item" data-cat="concert">콘서트<svg class="icon cat-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        <div class="cat-dropdown"><a class="cat-dropdown-item" data-cat="concert" data-sub="all"><span>전체보기</span></a><a class="cat-dropdown-item" data-cat="concert" data-sub="domestic"><span>국내뮤지션</span></a><a class="cat-dropdown-item" data-cat="concert" data-sub="overseas"><span>해외뮤지션</span></a><a class="cat-dropdown-item" data-cat="concert" data-sub="festival"><span>페스티벌</span></a></div>
      </button>
      <button class="header-cat-item" data-cat="musical">뮤지컬</button>
      <button class="header-cat-item" data-cat="play">연극</button>
      <button class="header-cat-item" data-cat="classic">클래식/무용<svg class="icon cat-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        <div class="cat-dropdown"><a class="cat-dropdown-item" data-cat="classic" data-sub="all"><span>전체보기</span></a><a class="cat-dropdown-item" data-cat="classic" data-sub="classic"><span>클래식</span></a><a class="cat-dropdown-item" data-cat="classic" data-sub="ballet"><span>발레/무용</span></a><a class="cat-dropdown-item" data-cat="classic" data-sub="gukak"><span>국악</span></a></div>
      </button>
      <button class="header-cat-item" data-cat="exhibition">전시/스포츠<svg class="icon cat-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        <div class="cat-dropdown"><a class="cat-dropdown-item" data-cat="exhibition" data-sub="all"><span>전체보기</span></a><a class="cat-dropdown-item" data-cat="exhibition" data-sub="exhibition"><span>전시</span></a><a class="cat-dropdown-item" data-cat="exhibition" data-sub="experience"><span>체험/행사</span></a><a class="cat-dropdown-item" data-cat="exhibition" data-sub="sports"><span>스포츠</span></a></div>
      </button>
      <button class="header-cat-item" data-cat="family">가족/어린이</button>
      <button class="header-cat-item" data-cat="local">지역축제</button>
      <button class="header-cat-item" data-cat="univ">대학축제</button>
      <button class="header-cat-item" data-cat="expo">박람회</button>
    </nav>
  `;

  let headerHtml = '';

  // 4. 로그인 및 권한 상태 확인
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true' || sessionStorage.getItem('isLoggedIn') === 'true' || !!localStorage.getItem('userToken') || !!sessionStorage.getItem('userToken');
  const userRole = localStorage.getItem('userRole') || sessionStorage.getItem('userRole') || 'CLIENT';

  // 5. 권한별 모드 전환 버튼 생성 (ADMIN / STAFF 만 렌더링)
  const adminModeBtnSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>`;
  const staffModeBtnSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;

  let modeSwitchBtnHtml = '';
  if (isLoggedIn && userRole === 'ADMIN') {
    modeSwitchBtnHtml = `
      <a href="/features/user/admin/dashboard.html" id="modeSwitchBtn" class="header-mode-switch-btn header-mode-switch-admin" aria-label="관리자 모드로 전환">
        ${adminModeBtnSvg}
        <span class="mode-btn-label">관리자 모드</span>
      </a>`;
  } else if (isLoggedIn && userRole === 'STAFF') {
    modeSwitchBtnHtml = `
      <a href="/features/payment/staff/store-management.html" id="modeSwitchBtn" class="header-mode-switch-btn header-mode-switch-staff" aria-label="업주 모드로 전환">
        ${staffModeBtnSvg}
        <span class="mode-btn-label">업주 모드</span>
      </a>`;
  }

  // 모드 전환 버튼 CSS 인라인 주입 (별도 CSS 파일 불필요)
  if (modeSwitchBtnHtml && !document.getElementById('mode-switch-styles')) {
    const style = document.createElement('style');
    style.id = 'mode-switch-styles';
    style.textContent = `
      .header-mode-switch-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 6px 13px;
        border-radius: 20px;
        font-weight: 600;
        font-size: 12.5px;
        text-decoration: none;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
        line-height: 1;
      }
      .header-mode-switch-admin {
        background: rgba(255, 42, 122, 0.12);
        color: #FF2A7A;
        border: 1.5px solid rgba(255, 42, 122, 0.35);
      }
      .header-mode-switch-admin:hover {
        background: rgba(255, 42, 122, 0.22);
        transform: translateY(-1px);
        box-shadow: 0 3px 10px rgba(255,42,122,0.2);
      }
      .header-mode-switch-staff {
        background: rgba(42, 193, 188, 0.12);
        color: #2ac1bc;
        border: 1.5px solid rgba(42, 193, 188, 0.35);
      }
      .header-mode-switch-staff:hover {
        background: rgba(42, 193, 188, 0.22);
        transform: translateY(-1px);
        box-shadow: 0 3px 10px rgba(42,193,188,0.2);
      }
      @media (max-width: 480px) {
        .mode-btn-label { display: none; }
        .header-mode-switch-btn { padding: 8px; border-radius: 50%; }
      }
    `;
    document.head.appendChild(style);
  }

  if (isDetail) {
    // 4-1. 상세 페이지 헤더 (뒤로가기, 찜, 공유 버튼 레이아웃)
    headerHtml = `
      <header class="app-header">
        <button class="header-hamburger" id="hamburgerBtn" aria-label="메뉴">${hamburgerSvg}</button>
        <button class="header-back-btn" aria-label="뒤로가기">${backSvg}<span class="header-title">행사 상세</span></button>
        <div class="header-spacer"></div>
        <div class="header-actions">
          ${modeSwitchBtnHtml}
          <button class="header-icon-btn" id="btn-wish-detail" data-wished="false" aria-label="찜">${wishSvg}</button>
          <button class="header-icon-btn" aria-label="공유">${shareSvg}</button>
        </div>
      </header>
    `;
  } else if (isIndex) {
    // 4-2. 메인(홈) 페이지 헤더 (검색바, MY티켓 등 확장된 기능 레이아웃)
    headerHtml = `
      <header class="app-header header-home" role="banner" id="appHeader">
        <button class="header-hamburger" id="hamburgerBtn" aria-label="전체 메뉴 열기" aria-expanded="false">${hamburgerSvg}</button>
        <a href="index.html" class="header-logo" aria-label="FESTIO 홈"><span class="header-logo-text">FESTIO</span></a>
        ${catNavHtml}
        <div class="header-spacer"></div>
        <div class="header-actions">
          ${modeSwitchBtnHtml}
          <a href="mypage.html" class="header-text-btn" aria-label="MY티켓">${ticketSvg}MY티켓</a>
          <div class="header-search-bar" role="search">${searchSvg}<input type="search" class="header-search-input" id="headerSearch" placeholder="행사명, 아티스트 검색" autocomplete="off" aria-label="검색"></div>
          <button class="header-icon-btn mobile-search-btn" aria-label="검색">${searchSvg}</button>
          <button class="header-icon-btn" aria-label="알림">${alarmSvg}</button>
          ${isLoggedIn ? `
            <a href="mypage.html" class="header-icon-btn" aria-label="마이페이지">${mypageSvg}</a>
          ` : `
            <a href="login.html" class="header-text-btn aria-label="로그인">로그인</a>
          `}
        </div>
      </header>
    `;
  } else {
    // 4-3. 일반 서브 페이지 헤더 (목록, 이용안내, 마이페이지 등 기본 레이아웃)
    // 마이페이지의 경우 우측 액션이 '로그아웃' 버튼이 되며, 그 외에는 '마이페이지' 이동 아이콘이 렌더링됩니다.
    let rightAction = '';
    if (isMypage) {
      rightAction = `<button class="header-icon-btn" id="btn-logout" aria-label="로그아웃">${logoutSvg}</button>`;
    } else {
      rightAction = isLoggedIn
        ? `<a href="mypage.html" class="header-icon-btn" aria-label="마이페이지">${mypageSvg}</a>`
        : `<a href="login.html" class="header-text-btn aria-label="로그인">로그인</a>`;
    }

    headerHtml = `
      <header class="app-header" role="banner" id="appHeader">
        <button class="header-hamburger" id="hamburgerBtn" aria-label="전체 메뉴">${hamburgerSvg}</button>
        <a href="index.html" class="header-logo"><span class="header-logo-text">FESTIO</span></a>
        ${catNavHtml}
        <div class="header-spacer"></div>
        <div class="header-actions">
          ${modeSwitchBtnHtml}
          <div class="header-search-bar">${searchSvg}<input type="search" class="header-search-input" placeholder="행사명, 아티스트 검색" aria-label="검색"></div>
          <button class="header-icon-btn" aria-label="알림">${alarmSvg}</button>
          ${rightAction}
        </div>
      </header>
    `;
  }

  // 6. 생성된 헤더 마크업을 현재 페이지의 DOM에 직접 삽입
  document.write(headerHtml);
})();
