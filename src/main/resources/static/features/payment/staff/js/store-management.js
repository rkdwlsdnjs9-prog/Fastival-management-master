// ── 인증 토큰 가져오기 ──────────────────────────────────────────
  function getAuthHeader() {
    return localStorage.getItem('userToken') || sessionStorage.getItem('userToken') || 'festio-admin-jwt-token-7777';
  }

  // ── DOM 요소 참조 ───────────────────────────────────────────────
  const baeminOpenToggle    = document.getElementById('baeminOpenToggle');
  const baeminToggleBoard   = document.getElementById('baeminToggleBoard');
  const businessStatusText  = document.getElementById('businessStatusText');
  const businessStatusSubText = document.getElementById('businessStatusSubText');
  const o2oToggle           = document.getElementById('o2oToggle');
  const ownerNoticeInput    = document.getElementById('ownerNoticeInput');
  const saveNoticeBtn       = document.getElementById('saveNoticeBtn');

  // 가맹점 정보 폼 필드
  const storeNameEl         = document.getElementById('storeNameEl');       // h2 가게 이름
  const storeCategorySelect = document.getElementById('storeCategorySelect');
  const storeOperatingHours = document.getElementById('storeOperatingHours');
  const saveInfoBtn         = document.getElementById('saveInfoBtn');

  // 네비바 유저 정보
  const navUserName         = document.getElementById('navUserName');
  const navUserRole         = document.getElementById('navUserRole');

  // ── 페이지 로드 시 DB 정보 조회 ─────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    loadStoreDetails();
    loadNavUserInfo();
  });

  // 네비바에 로그인 유저 정보 바인딩
  function loadNavUserInfo() {
    const userName = localStorage.getItem('userName') || sessionStorage.getItem('userName') || '점주';
    const userEmail = localStorage.getItem('userEmail') || sessionStorage.getItem('userEmail') || '';
    if (navUserName) navUserName.textContent = userName;
    if (navUserRole) navUserRole.textContent = userEmail || '가맹점주 (STAFF)';
  }

  // ── 가맹점 정보 API 조회 및 전체 UI 바인딩 ─────────────────────
  function loadStoreDetails() {
    fetch('/api/payment/staff/store', {
      headers: { 'Authorization': getAuthHeader() }
    })
    .then(res => {
      if (!res.ok) throw new Error('가맹점 정보 로드 실패 (status: ' + res.status + ')');
      return res.json();
    })
    .then(store => {
      // 1. 가게 이름
      if (storeNameEl) storeNameEl.textContent = store.name || '(이름 없음)';

      // 2. 영업 상태 토글
      const isOpen = store.is_open === true || store.is_open === 'true';
      baeminOpenToggle.checked = isOpen;
      updateToggleUI(isOpen);

      // 3. 사장님 공지
      const notice = store.notice || '';
      ownerNoticeInput.value = notice;

      // 4. 카테고리 드롭다운 선택 맞추기
      const category = store.category || '';
      if (storeCategorySelect) {
        const options = storeCategorySelect.querySelectorAll('option');
        options.forEach(opt => {
          if (opt.value === category || opt.textContent.includes(category)) {
            opt.selected = true;
          }
        });
        // DB 값이 드롭다운에 없으면 직접 data 속성으로 저장
        storeCategorySelect.dataset.dbValue = category;
      }

      // 5. 운영 시간
      if (storeOperatingHours) {
        storeOperatingHours.value = store.operating_hours || '';
      }
    })
    .catch(err => {
      console.error('점포 정보 로드 에러:', err);
      // Fallback: localStorage 캐시 사용
      const savedNotice = localStorage.getItem('owner_notice');
      if (savedNotice) ownerNoticeInput.value = savedNotice;
    });
  }

  // ── 영업 상태 UI 업데이트 헬퍼 ────────────────────────────────
  function updateToggleUI(isOpen) {
    if (isOpen) {
      baeminToggleBoard.style.borderColor = '#2ac1bc';
      baeminToggleBoard.style.backgroundColor = 'rgba(42, 193, 188, 0.04)';
      businessStatusText.innerText = '🏪 주문 수락 대기중';
      businessStatusText.style.color = '#2ac1bc';
      businessStatusSubText.innerText = '소비자용 모바일 앱에 실시간 메뉴 주문 버튼이 노출되고 있습니다.';
    } else {
      baeminToggleBoard.style.borderColor = '#e0e0e0';
      baeminToggleBoard.style.backgroundColor = '#f8f9fa';
      businessStatusText.innerText = '💤 영업 마감 (준비중)';
      businessStatusText.style.color = '#6c757d';
      businessStatusSubText.innerText = '현재 모바일 앱 주문이 정지되었으며 매장 정비 상태입니다.';
    }
  }

  // ── 영업 개시/종료 토글 ─────────────────────────────────────────
  baeminOpenToggle.addEventListener('change', function(e) {
    const nextStatus = e.target.checked;
    fetch('/api/payment/staff/store/status', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getAuthHeader()
      },
      body: JSON.stringify({ isOpen: nextStatus })
    })
    .then(res => { if (!res.ok) throw new Error('상태 갱신 실패'); return res.json(); })
    .then(data => {
      updateToggleUI(data.isOpen);
      alert(data.isOpen
        ? '🏪 오늘 영업이 개시되었습니다! 신규 오더를 받을 준비가 되었습니다.'
        : '💤 오늘 영업이 마감 상태로 처리되었습니다. 외부 주문 접수가 마감됩니다.');
    })
    .catch(err => {
      console.error(err);
      alert('❌ 영업 상태 반영 중 에러가 발생했습니다.');
      baeminOpenToggle.checked = !nextStatus;
    });
  });

  // ── 사장님 공지 저장 ────────────────────────────────────────────
  saveNoticeBtn.addEventListener('click', () => {
    const noticeVal = ownerNoticeInput.value.trim();
    if (!noticeVal) { alert('⚠️ 공지 내용을 입력해 주세요!'); return; }

    fetch('/api/payment/staff/store/notice', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': getAuthHeader() },
      body: JSON.stringify({ notice: noticeVal })
    })
    .then(res => { if (!res.ok) throw new Error('공지 저장 실패'); return res.json(); })
    .then(data => {
      localStorage.setItem('owner_notice', data.notice);
      alert('📢 실시간 사장님 공지가 정상 등록되었습니다!\n\n등록된 공지: ' + data.notice);
    })
    .catch(err => { console.error(err); alert('❌ 공지 등록 중 오류가 발생했습니다.'); });
  });

  // ── 가맹점 기본 정보 저장 (DB 연동) ────────────────────────────
  if (saveInfoBtn) {
    saveInfoBtn.addEventListener('click', () => {
      const name = storeNameEl ? storeNameEl.textContent.trim() : null;
      const category = storeCategorySelect
        ? (storeCategorySelect.options[storeCategorySelect.selectedIndex]?.value
           || storeCategorySelect.dataset.dbValue)
        : null;
      const operatingHours = storeOperatingHours ? storeOperatingHours.value.trim() : null;

      fetch('/api/payment/staff/store/info', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': getAuthHeader() },
        body: JSON.stringify({ name, category, operatingHours })
      })
      .then(res => { if (!res.ok) throw new Error('정보 저장 실패'); return res.json(); })
      .then(data => {
        alert('✅ 가맹점 정보가 성공적으로 저장되었습니다.');
        // 저장 완료 후 최신 데이터로 다시 로드
        loadStoreDetails();
      })
      .catch(err => { console.error(err); alert('❌ 가맹점 정보 저장 중 오류가 발생했습니다.'); });
    });
  }

  // ── O2O 토글 알림 ───────────────────────────────────────────────
  o2oToggle.addEventListener('change', function(e) {
    if (e.target.checked) {
      alert('🔔 모바일 앱을 통한 O2O 온라인 주문 접수가 재개되었습니다!');
    } else {
      alert('🔕 모바일 앱 O2O 온라인 주문 접수가 긴급 일시중지되었습니다.');
    }
  });