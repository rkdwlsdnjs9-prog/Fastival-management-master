/**
 * Festival O2O Platform — mypage.js
 * ─────────────────────────────────────────────────────────────
 * 마이페이지 고도화:
 * - 인증 가드 (비로그인 사용자 login.html 리다이렉션)
 * - 사용자 정보 동적 바인딩 (localStorage 연동)
 * - JPA DB 명세 (reservation, order_item)를 준수한 티켓 및 푸드트럭 주문 내역 바인딩
 * - 안면 인증 등록 (face-api.js 구조 유지 및 Mock 보완)
 * - 실시간 동적 QR 코드 생성 및 30초/3분 단위 만료 갱신 주기
 * - 1:1 문의 등록 및 조회 기능 동적화
 * - 로그아웃 처리
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

/* ── 상태 관리 ───────────────────────────────────────────────── */
let _member = null;
let _qrTimer = null;       // setInterval ID (3분 갱신)
let _qrCountdown = 180;
let _qrCountTimer = null;   // 1초 카운트다운
let _currentOrderNo = 1;
let _isFaceDetected = false;
let _faceApiLoaded = false;
let _videoStream = null;
let _faceDetectLoop = null;

/* QR SVG 원 둘레 (r=11) */
const QR_CIRC = 2 * Math.PI * 11; // ≈ 69.1

/* ═══════════════════════════════════════════════════════════
   1. 인증 가드 & 로컬스토리지 연동 초기화
   ═══════════════════════════════════════════════════════════ */
function checkAuth() {
  const userToken = localStorage.getItem('userToken');
  if (!userToken) {
    alert('로그인이 필요한 서비스입니다.');
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

async function loadUserInfo() {
  const userToken = localStorage.getItem('userToken');
  if (!userToken) return;

  try {
    const response = await fetch('/api/auth/me', {
      method: 'GET',
      headers: {
        'Authorization': userToken
      }
    });

    if (response.ok) {
      const user = await response.json();
      _member = {
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone || '',
        grade: user.membershipGrade || 'Bronze',
        totalPurchaseAmount: user.balance || 0,
        isFaceRegistered: user.faceVector !== null && user.faceVector !== undefined,
        balance: user.balance || 0
      };
      
      // LocalStorage 캐시 동기화
      localStorage.setItem('userName', user.name);
      localStorage.setItem('userPhone', user.phone || '');
      localStorage.setItem('email', user.email);
    } else {
      fallbackLocalUserInfo();
    }
  } catch (error) {
    console.error('사용자 정보 로드 에러:', error);
    fallbackLocalUserInfo();
  }
}

function fallbackLocalUserInfo() {
  const userName = localStorage.getItem('userName') || '축제이용자';
  const userRole = localStorage.getItem('userRole') || 'CLIENT';
  const userEmail = localStorage.getItem('email') || 'user@festio.kr';
  const userPhone = localStorage.getItem('userPhone') || '';
  
  _member = {
    name: userName,
    email: userEmail,
    role: userRole,
    phone: userPhone,
    grade: userRole === 'ADMIN' ? 'VIP' : 'Bronze',
    totalPurchaseAmount: userRole === 'ADMIN' ? 750000 : 50000,
    isFaceRegistered: localStorage.getItem('isFaceRegistered') === 'true',
    balance: parseInt(localStorage.getItem('balance') || '35000')
  };
}

/* ═══════════════════════════════════════════════════════════
   2. 프로필 & 등급 동적 바인딩
   ═══════════════════════════════════════════════════════════ */
function renderProfile() {
  if (!_member) return;

  // 상단 환영 메시지 및 이메일
  const nameEl = document.getElementById('profileName');
  const emailEl = document.getElementById('profileEmail');
  if (nameEl) nameEl.textContent = `안녕하세요, ${_member.name}님! 반갑습니다.`;
  if (emailEl) emailEl.textContent = _member.email;

  // 아바타 웰컴 캐릭터 지정
  const avatar = document.getElementById('profileAvatar');
  if (avatar) {
    avatar.innerHTML = `<span style="font-size: 1.5rem; font-weight: 700; color: #6A4DFF;">${_member.name[0] || 'U'}</span>`;
  }

  // 안면 인증 배지 상태 업데이트
  const faceBadge = avatar ? avatar.querySelector('.profile-avatar-face-badge') : null;
  if (faceBadge) {
    faceBadge.classList.toggle('inactive', !_member.isFaceRegistered);
  }

  // 등급 배지 설정
  const gradeBadge = document.getElementById('profileGrade');
  if (gradeBadge) {
    const isVip = _member.grade === 'VIP';
    gradeBadge.className = `grade-badge ${isVip ? 'grade-vip' : 'grade-bronze'}`;
    gradeBadge.innerHTML = `
      <svg class="icon" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="width:14px;height:14px;margin-right:4px;">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
      ${_member.grade}
    `;
  }

  // 등급 진행률 프로그레스 바
  const nextText = document.getElementById('gradeNextText');
  const gradeBar = document.getElementById('gradeBar');
  if (_member.grade === 'VIP') {
    if (nextText) nextText.textContent = '최고 등급인 VIP 회원입니다.';
    if (gradeBar) gradeBar.style.width = '100%';
  } else {
    if (nextText) nextText.textContent = 'Silver 등급까지 ₩50,000 남음';
    if (gradeBar) gradeBar.style.width = '50%';
  }

  // 프로필 편집 폼 채우기
  const nicknameInput = document.getElementById('profileNickname');
  const phoneInput = document.getElementById('profilePhone');
  const emailInput = document.getElementById('profileEmail2');
  const avatarName = document.getElementById('profileAvatarName');
  const avatarGrade = document.getElementById('profileAvatarGrade');

  if (nicknameInput) nicknameInput.value = _member.name;
  if (phoneInput) phoneInput.value = _member.phone;
  if (emailInput) emailInput.value = _member.email;
  if (avatarName) avatarName.textContent = _member.name;
  if (avatarGrade) avatarGrade.textContent = _member.role === 'ADMIN' ? '관리자 회원' : '일반 회원';
}

/* ═══════════════════════════════════════════════════════════
   3. DB 명세 준수 - 가상 예매(reservation) / 푸드트럭 주문(order_item) 바인딩
   ═══════════════════════════════════════════════════════════ */
// MOCK 데이터 정의
const MOCK_TICKETS = [
  {
    reservationId: 'RES-20260529-873',
    eventName: '2026 워터밤 서울',
    eventDate: '2026.07.01 (금)',
    zoneName: '스탠딩 A구역',
    quantity: 2,
    totalPrice: 176000,
    discountAmount: 10000,
    paymentStatus: 'PAID', // PAID, PENDING, CANCELLED
    itemStatus: '예매완료',
    qrToken: 'WTRB-TKT-5629-8730'
  },
  {
    reservationId: 'RES-20260530-109',
    eventName: '2026 퀸즈 락 페스티벌',
    eventDate: '2026.08.15 (토)',
    zoneName: '지정석 R석',
    quantity: 1,
    totalPrice: 99000,
    discountAmount: 0,
    paymentStatus: 'PAID',
    itemStatus: '입장완료',
    qrToken: 'QN-ROCK-7712-1093'
  }
];

const MOCK_FOOD_ORDERS = [
  {
    orderItemId: 'ORD-20260529-045',
    storeName: '춘향이네 야시장 (Food Truck #3)',
    productName: '오코노미야끼 & 야끼소바 세트',
    quantity: 2,
    selectedOptions: '치즈 토핑 추가, 아주 매운맛',
    pickupTimeSlot: '13:00 - 13:30 (픽업 예정)',
    totalPrice: 24000,
    itemStatus: 'PREPARING', // ORDERED, PREPARING, READY, PICKED_UP
    statusText: '조리 중 (대기번호 14번)',
    qrToken: 'FOOD-TRK-CHUNHYANG-45'
  },
  {
    orderItemId: 'ORD-20260529-077',
    storeName: '맥스 킹 수제버거 (Booth #7)',
    productName: '클래식 치즈버거 & 감자튀김 세트',
    quantity: 1,
    selectedOptions: '콜라 제로 변경',
    pickupTimeSlot: '14:40 - 15:00 (수령 완료)',
    totalPrice: 15000,
    itemStatus: 'PICKED_UP',
    statusText: '수령 완료',
    qrToken: 'FOOD-TRK-MAXBURGER-77'
  }
];

// 통계 렌더링
function renderStats() {
  const statTickets = document.getElementById('statTickets');
  const statWishlists = document.getElementById('statWishlists');
  const statCoupons = document.getElementById('statCoupons');
  const statReviews = document.getElementById('statReviews');
  
  if (statTickets) statTickets.textContent = MOCK_TICKETS.length;
  if (statWishlists) statWishlists.textContent = '2';
  if (statCoupons) statCoupons.textContent = '1';
  if (statReviews) statReviews.textContent = '1';

  const ticketCount = document.getElementById('ticketCount');
  if (ticketCount) ticketCount.textContent = `${MOCK_TICKETS.length + MOCK_FOOD_ORDERS.length}건`;
}

// 예매 내역 & 푸드트럭 픽업 내역 통합 렌더링
function renderReservationList() {
  const ticketListContainer = document.getElementById('ticketList');
  if (!ticketListContainer) return;

  let htmlContent = '';

  // 1. 축제 티켓 예매 섹션
  htmlContent += `
    <div style="margin-bottom: 24px;">
      <h3 style="font-size: 1rem; color: #FFFFFF; margin-bottom: 12px; display: flex; align-items: center;">
        <span style="margin-right: 8px;">🎟️</span> 축제 티켓 예매 내역 (${MOCK_TICKETS.length}건)
      </h3>
  `;

  MOCK_TICKETS.forEach(t => {
    const statusClass = t.itemStatus === '예매완료' ? 'status-완료' : 'status-입장';
    htmlContent += `
      <div class="ticket-item" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; margin-bottom: 12px;">
        <div class="ticket-item-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <p class="ticket-event-name" style="font-weight: 700; color: #FFFFFF; font-size: 0.95rem;">${t.eventName}</p>
          <span class="ticket-status-badge ${statusClass}" style="padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">${t.itemStatus}</span>
        </div>
        <div class="ticket-item-meta" style="font-size: 0.8rem; color: rgba(255,255,255,0.6); margin-bottom: 12px; line-height: 1.5;">
          <div>예매 번호: <strong style="color: #6A4DFF;">${t.reservationId}</strong></div>
          <div>관람 일시: ${t.eventDate}</div>
          <div>구역명: ${t.zoneName} · 수량: ${t.quantity}매</div>
        </div>
        <div class="ticket-item-footer" style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 12px;">
          <span class="ticket-price" style="font-weight: 700; color: #FFFFFF; font-size: 1rem;">₩${t.totalPrice.toLocaleString()}</span>
          ${t.itemStatus === '예매완료' ? `<button class="btn btn-sm btn-outline" onclick="showTicketQr('${t.qrToken}')" style="font-size: 0.75rem; padding: 6px 12px;">입장 QR 확인</button>` : ''}
        </div>
      </div>
    `;
  });

  htmlContent += `</div>`;

  // 2. 푸드트럭 주문 내역 섹션
  htmlContent += `
    <div>
      <h3 style="font-size: 1rem; color: #FFFFFF; margin-bottom: 12px; display: flex; align-items: center;">
        <span style="margin-right: 8px;">🍔</span> 푸드트럭 실시간 주문 내역 (${MOCK_FOOD_ORDERS.length}건)
      </h3>
  `;

  MOCK_FOOD_ORDERS.forEach(f => {
    let statusLabelClass = 'status-대기';
    if (f.itemStatus === 'PREPARING') statusLabelClass = 'status-대기';
    else if (f.itemStatus === 'READY') statusLabelClass = 'status-완료';
    else if (f.itemStatus === 'PICKED_UP') statusLabelClass = 'status-입장';

    htmlContent += `
      <div class="ticket-item" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; margin-bottom: 12px;">
        <div class="ticket-item-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <p class="ticket-event-name" style="font-weight: 700; color: #FFFFFF; font-size: 0.95rem;">${f.storeName}</p>
          <span class="ticket-status-badge ${statusLabelClass}" style="padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">${f.statusText}</span>
        </div>
        <div class="ticket-item-meta" style="font-size: 0.8rem; color: rgba(255,255,255,0.6); margin-bottom: 12px; line-height: 1.5;">
          <div>주문 번호: <strong style="color: #00E5CC;">${f.orderItemId}</strong></div>
          <div>상품명: ${f.productName} · 수량: ${f.quantity}개</div>
          <div>옵션: ${f.selectedOptions}</div>
          <div style="color: #00E5CC; font-weight: 500;">⏱️ ${f.pickupTimeSlot}</div>
        </div>
        <div class="ticket-item-footer" style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 12px;">
          <span class="ticket-price" style="font-weight: 700; color: #FFFFFF; font-size: 1rem;">₩${f.totalPrice.toLocaleString()}</span>
          ${f.itemStatus !== 'PICKED_UP' ? `<button class="btn btn-sm btn-outline" onclick="showFoodQr('${f.qrToken}')" style="font-size: 0.75rem; padding: 6px 12px; border-color: #00E5CC; color: #00E5CC;">픽업 QR 확인</button>` : ''}
        </div>
      </div>
    `;
  });

  htmlContent += `</div>`;

  ticketListContainer.innerHTML = htmlContent;
}

// 쿠폰, 리뷰, 찜목록, 문의 렌더링
function renderOtherLists() {
  // 쿠폰함
  const couponList = document.getElementById('couponList');
  if (couponList) {
    couponList.innerHTML = `
      <div class="coupon-card" style="background: linear-gradient(135deg, #6A4DFF 0%, #3D22C6 100%); border-radius: 12px; padding: 16px; display: flex; justify-content: space-between; align-items: center; color: #FFFFFF; position: relative; overflow: hidden; margin-bottom: 12px;">
        <div style="flex: 1;">
          <p style="font-size: 0.75rem; color: rgba(255,255,255,0.7); margin-bottom: 4px;">FESTIO 회원 웰컴 쿠폰</p>
          <h3 style="font-size: 1.25rem; font-weight: 800; margin-bottom: 8px;">20% 할인 쿠폰</h3>
          <p style="font-size: 0.7rem; color: rgba(255,255,255,0.6);">최소 ₩30,000 이상 결제 시 사용 가능</p>
        </div>
        <div style="border-left: 1px dashed rgba(255,255,255,0.3); padding-left: 16px; text-align: center; min-width: 80px;">
          <span style="font-size: 0.8rem; font-weight: bold; background: #FFFFFF; color: #6A4DFF; padding: 4px 8px; border-radius: 4px;">보유중</span>
          <p style="font-size: 0.6rem; color: rgba(255,255,255,0.7); margin-top: 6px;">~2026.08.31</p>
        </div>
      </div>
    `;
  }

  // 리뷰 목록
  const reviewEventList = document.getElementById('reviewEventList');
  if (reviewEventList) {
    reviewEventList.innerHTML = `
      <div class="review-card" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <h4 style="font-weight: 700; color: #FFFFFF;">2026 워터밤 서울</h4>
          <div style="color: #FFB800;">⭐️⭐️⭐️⭐️⭐️ (5.0)</div>
        </div>
        <p style="font-size: 0.85rem; color: rgba(255,255,255,0.8); line-height: 1.5; margin-bottom: 6px;">라인업이 진짜 미쳤습니다!! 음향도 빵빵하고 내년에도 꼭 또 오고 싶어요!</p>
        <span style="font-size: 0.7rem; color: rgba(255,255,255,0.4);">작성일: 2026.05.29</span>
      </div>
    `;
  }

  // 찜 목록
  const wishGrid = document.getElementById('wishGrid');
  if (wishGrid) {
    wishGrid.innerHTML = `
      <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; overflow: hidden;">
        <div style="width: 100%; height: 180px; background: #22223B; display: flex; align-items: center; justify-content: center; font-size: 2.5rem;">🎸</div>
        <div style="padding: 12px;">
          <h4 style="font-weight: 700; color: #FFFFFF; font-size: 0.85rem; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">2026 퀸즈 락 페스티벌</h4>
          <p style="font-size: 0.75rem; color: #6A4DFF; font-weight: 600;">₩99,000</p>
        </div>
      </div>
      <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; overflow: hidden;">
        <div style="width: 100%; height: 180px; background: #1C1C32; display: flex; align-items: center; justify-content: center; font-size: 2.5rem;">💦</div>
        <div style="padding: 12px;">
          <h4 style="font-weight: 700; color: #FFFFFF; font-size: 0.85rem; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">2026 워터밤 서울</h4>
          <p style="font-size: 0.75rem; color: #6A4DFF; font-weight: 600;">₩88,000</p>
        </div>
      </div>
    `;
  }
}

/* ═══════════════════════════════════════════════════════════
   4. 실시간 동적 QR 제어 (30초 만료 갱신)
   ═══════════════════════════════════════════════════════════ */
function showTicketQr(token) {
  // 모달을 열고 해당 토큰 전달
  openQrModal(token, '입장 확인용 일회용 안전 QR');
}

function showFoodQr(token) {
  openQrModal(token, '푸드 부스 수령용 픽업 QR');
}

function openQrModal(token, title) {
  // 기존 모달이 없으므로, QR 갱신 영역으로 화면 포커싱
  const qrCodeContainer = document.getElementById('qr-code-container');
  if (qrCodeContainer) {
    qrCodeContainer.innerHTML = '';
    // QR Code 렌더링
    new QRCode(qrCodeContainer, {
      text: token,
      width: 140,
      height: 140,
      colorDark: '#0D0D1E',
      colorLight: '#FFFFFF',
      correctLevel: QRCode.CorrectLevel.H
    });

    const barcodeText = document.getElementById('qr-barcode-number');
    if (barcodeText) barcodeText.textContent = token;

    // 타이머 가동
    startQRRefreshCycle();

    // QR 안내 라벨 표시
    const maskedName = document.querySelector('.qr-masked-name');
    if (maskedName) maskedName.textContent = title;

    // QR 영역으로 스크롤 이동
    const heroSection = document.querySelector('.mypage-hero');
    if (heroSection) {
      heroSection.scrollIntoView({ behavior: 'smooth' });
    }
    
    if (window.Toast) window.Toast.success('안전 일회용 QR 코드가 활성화되었습니다.');
  }
}

function startQRRefreshCycle() {
  _qrCountdown = 30; // 보안 강화: 30초 단위 카운트다운
  updateQRTimerDisplay(30);

  clearInterval(_qrTimer);
  clearInterval(_qrCountTimer);

  _qrTimer = setInterval(() => {
    // 만료 시 가상으로 신규 토큰 생성 및 리프레시
    const randomToken = 'FEST-NEW-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const qrCodeContainer = document.getElementById('qr-code-container');
    if (qrCodeContainer) {
      qrCodeContainer.innerHTML = '';
      new QRCode(qrCodeContainer, {
        text: randomToken,
        width: 140,
        height: 140,
        colorDark: '#0D0D1E',
        colorLight: '#FFFFFF',
        correctLevel: QRCode.CorrectLevel.H
      });
    }
    const barcodeText = document.getElementById('qr-barcode-number');
    if (barcodeText) barcodeText.textContent = randomToken;
    
    _qrCountdown = 30;
    if (window.Toast) window.Toast.info('보안을 위해 일회용 QR이 자동 갱신되었습니다.');
  }, 30000);

  _qrCountTimer = setInterval(() => {
    _qrCountdown = Math.max(0, _qrCountdown - 1);
    updateQRTimerDisplay(_qrCountdown);
  }, 1000);
}

function updateQRTimerDisplay(sec) {
  const textEl = document.querySelector('.qr-timer-text');
  const progressEl = document.querySelector('.qr-timer-progress');

  if (textEl) {
    textEl.textContent = `${sec}초 남음`;
  }

  if (progressEl) {
    const pct = sec / 30;
    const offset = QR_CIRC * (1 - pct);
    progressEl.style.strokeDasharray = `${QR_CIRC}`;
    progressEl.style.strokeDashoffset = `${offset}`;
    progressEl.style.stroke = sec <= 5 ? '#FF2A7A' : '#6A4DFF';
  }
}

/* ═══════════════════════════════════════════════════════════
   5. 1:1 문의 dynamic CRUD 모크업
   ═══════════════════════════════════════════════════════════ */
const MOCK_INQUIRIES = [
  {
    id: 1,
    title: '입장 대기 시간 및 안면 검문 관련 문의',
    content: '안면 인식을 등록하고 가면 실물 신분증을 아예 안 들고 가도 티켓 부스 입장이 가능한가요?',
    status: '답변완료',
    answer: '안녕하세요, FESTIO 운영센터입니다. 사전에 안면 등록을 완료하신 경우, 대기 시간 없이 초고속 게이트를 통해 신분증 확인 없이 입장이 가능하십니다. 다만 비상 상황을 대비해 모바일 신분증 등을 지참하시는 것을 추천드립니다.',
    createdAt: '2026-05-29T10:00:00'
  }
];

function renderInquiryList() {
  const inquiryList = document.getElementById('inquiryList');
  if (!inquiryList) return;

  if (MOCK_INQUIRIES.length === 0) {
    inquiryList.innerHTML = `
      <div class="mypage-empty">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
        <p class="mypage-empty-title">문의 내역이 없습니다</p>
        <p class="mypage-empty-desc">궁금한 점은 1:1 문의를 이용해 주세요.</p>
      </div>
    `;
    return;
  }

  inquiryList.innerHTML = MOCK_INQUIRIES.map(q => `
    <div class="inquiry-card" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; margin-bottom: 12px;">
      <div class="inquiry-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <p class="inquiry-title" style="font-weight: 700; color: #FFFFFF; font-size: 0.9rem;">${q.title}</p>
        <span class="inquiry-status-badge ${q.status === '답변완료' ? 'answered' : 'waiting'}" style="padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; background: ${q.status === '답변완료' ? 'rgba(0,229,204,0.1)' : 'rgba(255,184,0,0.1)'}; color: ${q.status === '답변완료' ? '#00E5CC' : '#FFB800'};">${q.status}</span>
      </div>
      <p class="inquiry-preview" style="font-size: 0.85rem; color: rgba(255,255,255,0.8); line-height: 1.5; margin-bottom: 12px;">${q.content}</p>
      ${q.answer ? `
        <div class="inquiry-answer-box" style="background: rgba(106,77,255,0.05); border-left: 3px solid #6A4DFF; padding: 12px; border-radius: 4px; margin-bottom: 8px;">
          <p class="inquiry-answer-label" style="font-size: 0.75rem; font-weight: bold; color: #6A4DFF; margin-bottom: 4px;">운영센터 답변</p>
          <p class="inquiry-answer-text" style="font-size: 0.8rem; color: rgba(255,255,255,0.8); line-height: 1.5;">${q.answer}</p>
        </div>` : ''}
      <p class="inquiry-date" style="font-size: 0.7rem; color: rgba(255,255,255,0.4);">${new Date(q.createdAt).toLocaleDateString()}</p>
    </div>
  `).join('');
}

function initInquiryForm() {
  const btnNewInquiry = document.getElementById('btn-new-inquiry');
  const btnSubmitInquiry = document.getElementById('btn-submit-inquiry');
  
  if (btnNewInquiry) {
    btnNewInquiry.addEventListener('click', () => {
      if (window.Modal) {
        window.Modal.open('modal-inquiry');
      } else {
        const overlay = document.getElementById('modal-inquiry');
        if (overlay) overlay.classList.add('active');
      }
    });
  }

  if (btnSubmitInquiry) {
    btnSubmitInquiry.addEventListener('click', () => {
      const titleInput = document.getElementById('inqTitle');
      const contentInput = document.getElementById('inqContent');

      const title = titleInput.value.trim();
      const content = contentInput.value.trim();

      if (!title || !content) {
        alert('문의 제목과 내용을 모두 입력해 주세요.');
        return;
      }

      MOCK_INQUIRIES.unshift({
        id: Date.now(),
        title: title,
        content: content,
        status: '답변대기',
        answer: null,
        createdAt: new Date().toISOString()
      });

      titleInput.value = '';
      contentInput.value = '';

      if (window.Modal) {
        window.Modal.close('modal-inquiry');
      } else {
        const overlay = document.getElementById('modal-inquiry');
        if (overlay) overlay.classList.remove('active');
      }

      if (window.Toast) {
        window.Toast.success('문의가 정상적으로 등록되었습니다.');
      } else {
        alert('문의가 등록되었습니다.');
      }

      renderInquiryList();
    });
  }
}

/* ═══════════════════════════════════════════════════════════
   6. 프로필 정보 변경 저장 기능 구현
   ═══════════════════════════════════════════════════════════ */
function initProfileEditSave() {
  const btnSave = document.getElementById('btn-save-profile');
  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      const nicknameVal = document.getElementById('profileNickname').value.trim();
      const phoneVal = document.getElementById('profilePhone').value.trim();

      if (!nicknameVal || !phoneVal) {
        if (window.Toast) window.Toast.error('정보를 올바르게 입력해주세요.');
        else alert('정보를 입력해주세요.');
        return;
      }

      const userToken = localStorage.getItem('userToken');
      try {
        const response = await fetch('/api/auth/update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': userToken
          },
          body: JSON.stringify({
            name: nicknameVal,
            phone: phoneVal
          })
        });

        if (response.ok) {
          const updated = await response.json();
          localStorage.setItem('userName', updated.name);
          localStorage.setItem('userPhone', updated.phone || '');

          await loadUserInfo();
          renderProfile();

          if (window.Toast) window.Toast.success('프로필 변경사항이 DB에 안전하게 저장되었습니다!');
          else alert('저장되었습니다.');
        } else {
          const errMsg = await response.text();
          if (window.Toast) window.Toast.error(errMsg || '저장에 실패했습니다.');
          else alert(errMsg || '저장에 실패했습니다.');
        }
      } catch (error) {
        console.error('프로필 저장 에러:', error);
        if (window.Toast) window.Toast.error('서버 통신 실패로 변경사항을 저장하지 못했습니다.');
      }
    });
  }
}

/* ═══════════════════════════════════════════════════════════
   7. 탭 전환 리스너 바인딩
   ═══════════════════════════════════════════════════════════ */
function initTabs() {
  const tabs = document.querySelectorAll('.mypage-sidenav-item, .mypage-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      const tabId = tab.dataset.tab;
      if (!tabId) return;

      // 액티브 클래스 초기화
      document.querySelectorAll('.mypage-sidenav-item, .mypage-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      // 클릭한 탭 동기화 활성화
      document.querySelectorAll(`[data-tab="${tabId}"]`).forEach(t => t.classList.add('active'));
      const activePane = document.getElementById(tabId);
      if (activePane) activePane.classList.add('active');
    });
  });
}

/* ═══════════════════════════════════════════════════════════
   8. 로그아웃 리스너 통합 구현
   ═══════════════════════════════════════════════════════════ */
function initLogout() {
  const logoutButtons = [
    document.getElementById('btn-logout'),
    document.getElementById('sideLogoutBtn'),
    document.getElementById('btn-logout-profile')
  ];

  logoutButtons.forEach(btn => {
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        
        // 인증데이터 삭제
        localStorage.removeItem('userToken');
        localStorage.removeItem('userName');
        localStorage.removeItem('userRole');
        localStorage.removeItem('email');
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('userPhone');
        localStorage.removeItem('balance');
        localStorage.removeItem('isFaceRegistered');
        
        if (window.Auth) {
          window.Auth.clear();
        }

        alert('로그아웃 되었습니다.');
        window.location.href = 'index.html';
      });
    }
  });
}

/* ═══════════════════════════════════════════════════════════
   9. 안면 인식 (face-api.js) 통합 제어
   ═══════════════════════════════════════════════════════════ */
function startFaceCamera() {
  const video = document.getElementById('face-video');
  if (!video) return;

  // 가상 카메라 로딩 및 안면 등록 성공 시뮬레이션
  _isFaceDetected = true;
  if (window.Toast) window.Toast.info('카메라 스트림을 준비 중입니다...');
  
  setTimeout(() => {
    if (window.Toast) window.Toast.success('안면 인식이 활성화되었습니다. 중앙을 봐주세요.');
    const statusText = document.querySelector('.face-detection-status');
    if (statusText) {
      statusText.textContent = '얼굴 인식 완료! 등록 버튼을 눌러주세요.';
      statusText.className = 'face-detection-status detected';
    }
    const registerBtn = document.getElementById('btn-face-register');
    if (registerBtn) registerBtn.disabled = false;
  }, 1000);
}

function initFaceModal() {
  const btnOpenFace = document.getElementById('profileAvatar');
  if (btnOpenFace) {
    btnOpenFace.addEventListener('click', () => {
      alert('안면 인식 인증 기능은 로컬 환경에서 테스트 모드로 실행됩니다.');
      localStorage.setItem('isFaceRegistered', 'true');
      _member.isFaceRegistered = true;
      renderProfile();
      if (window.Toast) window.Toast.success('안면 인증 정보가 동적으로 등록되었습니다!');
    });
  }
}

/* ═══════════════════════════════════════════════════════════
   10. 초기 로드 리스너 (DOMContentLoaded)
   ═══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  // 인증 체크
  if (!checkAuth()) return;

  // 유저 정보 가져오기 및 바인딩
  await loadUserInfo();
  renderProfile();

  // 티켓 & 푸드트럭 렌더링
  renderStats();
  renderReservationList();
  renderOtherLists();
  renderInquiryList();

  // 이벤트 바인딩
  initTabs();
  initInquiryForm();
  initProfileEditSave();
  initLogout();
  initFaceModal();

  // QR 초기 활성화 (티켓이 있을 때 가상 토큰 삽입)
  if (MOCK_TICKETS.length > 0) {
    openQrModal(MOCK_TICKETS[0].qrToken, '입장 확인용 일회용 안전 QR');
  }
});
