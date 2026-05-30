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
  if (nameEl) nameEl.textContent = _member.name;
  if (emailEl) emailEl.textContent = _member.email;

  // 아바타 웰컴 캐릭터 지정
  const avatar = document.getElementById('profileAvatar');
  if (avatar) {
    // Keep the SVG if it exists, or update just the text
    // We'll leave the design SVG untouched if possible, or gracefully inject
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
      <svg class="icon mp-icon-sm" viewBox="0 0 24 24" fill="currentColor" stroke="none">
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
    <div class="mp-margin-b-24">
      <h3 class="mp-section-title">
        <span class="mp-margin-r-8"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mp-icon-md"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect><path d="M7 4v16"></path><path d="M17 4v16"></path></svg></span> 축제 티켓 예매 내역 (${MOCK_TICKETS.length}건)
      </h3>
  `;

  MOCK_TICKETS.forEach(t => {
    const statusClass = t.itemStatus === '예매완료' ? 'status-완료' : 'status-입장';
    htmlContent += `
      <div class="mp-card">
        <div class="mp-card-header">
          <p class="mp-card-title">${t.eventName}</p>
          <span class="mp-badge ${statusClass}">${t.itemStatus}</span>
        </div>
        <div class="mp-card-meta">
          <div>예매 번호: <strong class="mp-color-primary">${t.reservationId}</strong></div>
          <div>관람 일시: ${t.eventDate}</div>
          <div>구역명: ${t.zoneName} · 수량: ${t.quantity}매</div>
        </div>
        <div class="mp-card-footer">
          <span class="mp-card-price">₩${t.totalPrice.toLocaleString()}</span>
          ${t.itemStatus === '예매완료' ? `<button class="btn btn-sm btn-outline mp-btn-sm" onclick="showTicketQr('${t.qrToken}')">입장 QR 확인</button>` : ''}
        </div>
      </div>
    `;
  });

  htmlContent += `</div>`;

  // 2. 푸드트럭 주문 내역 섹션
  htmlContent += `
    <div>
      <h3 class="mp-section-title">
        <span class="mp-margin-r-8"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mp-icon-md"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg></span> 푸드트럭 실시간 주문 내역 (${MOCK_FOOD_ORDERS.length}건)
      </h3>
  `;

  MOCK_FOOD_ORDERS.forEach(f => {
    let statusLabelClass = 'status-대기';
    if (f.itemStatus === 'PREPARING') statusLabelClass = 'status-대기';
    else if (f.itemStatus === 'READY') statusLabelClass = 'status-완료';
    else if (f.itemStatus === 'PICKED_UP') statusLabelClass = 'status-입장';

    htmlContent += `
      <div class="mp-card">
        <div class="mp-card-header">
          <p class="mp-card-title">${f.storeName}</p>
          <span class="mp-badge ${statusLabelClass}">${f.statusText}</span>
        </div>
        <div class="mp-card-meta">
          <div>주문 번호: <strong class="mp-color-success">${f.orderItemId}</strong></div>
          <div>상품명: ${f.productName} · 수량: ${f.quantity}개</div>
          <div>옵션: ${f.selectedOptions}</div>
          <div class="mp-color-success mp-weight-500"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mp-icon-sm" style="vertical-align:middle;"><circle cx="12" cy="13" r="8"></circle><path d="M12 9v4l2 2"></path><path d="M12 2v2"></path><path d="M18 4l-1 1"></path></svg> ${f.pickupTimeSlot}</div>
        </div>
        <div class="mp-card-footer">
          <span class="mp-card-price">₩${f.totalPrice.toLocaleString()}</span>
          ${f.itemStatus !== 'PICKED_UP' ? `<button class="btn btn-sm btn-outline mp-btn-sm mp-btn-outline-success" onclick="showFoodQr('${f.qrToken}')">픽업 QR 확인</button>` : ''}
        </div>
      </div>
    `;
  });

  htmlContent += `</div>`;

  ticketListContainer.innerHTML = htmlContent;
}

// 쿠폰, 리뷰, 찜목록, 문의 렌더링
async function renderOtherLists() {
  // 쿠폰함 렌더링 호출
  renderCouponList();

  // 리뷰 목록 렌더링
  renderMyReviewList();
  const reviewEventList = document.getElementById('reviewEventList');
  if (reviewEventList) {
    reviewEventList.innerHTML = `
            <div class="mp-card review-card" style="cursor:pointer; border:1px solid #e8e8e8; border-radius:16px; padding:24px; transition:all 0.2s; display:flex; align-items:center; gap:8px; margin-bottom:16px;" onmouseover="this.style.borderColor='#a286fa';this.style.backgroundColor='#f8f7ff'" onmouseout="if(!this.classList.contains('selected')) {this.style.borderColor='#e8e8e8';this.style.backgroundColor='transparent'}" onclick="this.classList.add('selected');" data-event-name="2026 워터밤 서울">
        <h4 style="margin:0; font-size:1.1rem; font-weight:700; color:#1a1a2e;">2026 워터밤 서울</h4>
        <p style="margin:0; font-size:0.9rem; color:#8888a8;">(2026.07.01 관람)</p>
      </div>
            <div class="mp-card review-card" style="cursor:pointer; border:1px solid #e8e8e8; border-radius:16px; padding:24px; transition:all 0.2s; display:flex; align-items:center; gap:8px; margin-bottom:16px;" onmouseover="this.style.borderColor='#a286fa';this.style.backgroundColor='#f8f7ff'" onmouseout="if(!this.classList.contains('selected')) {this.style.borderColor='#e8e8e8';this.style.backgroundColor='transparent'}" onclick="this.classList.add('selected');" data-event-name="2026 퀸즈 락 페스티벌">
        <h4 style="margin:0; font-size:1.1rem; font-weight:700; color:#1a1a2e;">2026 퀸즈 락 페스티벌</h4>
        <p style="margin:0; font-size:0.9rem; color:#8888a8;">(2026.08.15 관람)</p>
      </div>
    `;
  }

  // 찜 목록 — 비동기 렌더 (api.js 사용)
  await renderWishGrid();
}

/* ── 찜 목록 렌더 ───────────────────────────────────── */
async function renderWishGrid() {
  const wishGrid = document.getElementById('wishGrid');
  const wishCount = document.getElementById('wishCount');
  if (!wishGrid) return;

  wishGrid.innerHTML = `<div class="wish-loading">불러오는 중...</div>`;

  try {
    const ids = await wishlistApi.getWishlist();
    const allEvents = await eventApi.getEvents(null);

    const wished = allEvents.filter(ev => ids.includes(ev.eventNo || ev.id));

    if (wishCount) wishCount.textContent = `${wished.length}개`;

    // 통계도 업데이트
    const statWishlists = document.getElementById('statWishlists');
    if (statWishlists) statWishlists.textContent = wished.length;

    if (!wished.length) {
      wishGrid.innerHTML = `
        <div class="mypage-empty mp-grid-col-all">
          <div class="empty-icon-wrap">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
            </svg>
          </div>
          <p class="mypage-empty-title">찜한 상품이 없습니다</p>
          <p class="mypage-empty-desc">관심있는 행사에서 하트 아이콘을 눌러 찜 목록에 추가해보세요!</p>
        </div>`;
      return;
    }

    wishGrid.innerHTML = wished.map(ev => {
      const no = ev.eventNo || ev.id;
      const name = ev.eventName || ev.name || '-';
      const price = ev.minPrice || 0;
      const thumb = ev.thumbnailUrl;
      const date = ev.eventDate || ev.startDate;
      const priceText = price > 0 ? `₩${price.toLocaleString()}` : '무료';

      return `
        <div class="wish-poster-card" data-event-no="${no}">
          <div class="wish-poster-img-wrap">
            ${thumb
          ? `<img src="${thumb}" alt="${name}" loading="lazy">`
          : `<div class="wish-poster-placeholder">
                   <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                 </div>`}
            <button class="wish-remove-btn" data-event-no="${no}" aria-label="찜 해제">
              <svg class="icon" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
              </svg>
            </button>
          </div>
          <div class="wish-poster-info">
            <p class="wish-poster-name">${name}</p>
            ${date ? `<p class="wish-poster-date">${date}</p>` : ''}
            <p class="wish-poster-price">${priceText}</p>
          </div>
        </div>`;
    }).join('');

    // 카드 클릭 → 상세페이지 / 찜 해제 버튼
    wishGrid.addEventListener('click', async (e) => {
      const removeBtn = e.target.closest('.wish-remove-btn');
      if (removeBtn) {
        e.stopPropagation();
        const no = parseInt(removeBtn.dataset.eventNo);
        try {
          await wishlistApi.removeWishlist(no);
          if (window.Toast) Toast.info('찜 목록에서 제거했습니다.');
          await renderWishGrid(); // 다시 렌더
        } catch {
          if (window.Toast) Toast.error('오류가 발생했습니다.');
        }
        return;
      }
      const card = e.target.closest('.wish-poster-card');
      if (card) {
        window.location.href = `detail.html?eventNo=${card.dataset.eventNo}`;
      }
    }, { once: true });

  } catch (err) {
    console.error('찜 목록 로드 실패:', err);
    wishGrid.innerHTML = `<div class="mypage-empty mp-grid-col-all"><p class="mypage-empty-title">데이터를 불러올 수 없습니다.</p></div>`;
  }
}

/* ═══════════════════════════════════════════════════════════
   4. 실시간 동적 QR 제어 (30초 만료 갱신)
   ═══════════════════════════════════════════════════════════ */
function showTicketQr(token) {
  openQrModal(token, '입장 확인용 일회용 안전 QR');
}

function showFoodQr(token) {
  openQrModal(token, '푸드 부스 수령용 픽업 QR');
}

function openQrModal(token, title) {
  const qrCodeContainer = document.getElementById('qr-code-container');
  if (qrCodeContainer) {
    qrCodeContainer.innerHTML = '';
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

    const titleEl = document.getElementById('qrModalTitle');
    if (titleEl && title) titleEl.textContent = title;

    const modal = document.getElementById('qrModal');
    if (modal) modal.style.display = 'flex';

    startQRRefreshCycle();

    const maskedName = document.querySelector('.qr-masked-name');
    if (maskedName) maskedName.textContent = title;

    const heroSection = document.querySelector('.mypage-hero');
    if (heroSection) {
      heroSection.scrollIntoView({ behavior: 'smooth' });
    }

    if (window.Toast) window.Toast.success('안전 일회용 QR 코드가 활성화되었습니다.');
  }
}

function startQRRefreshCycle() {
  _qrCountdown = 180; // 보안 강화: 3분 단위 카운트다운
  updateQRTimerDisplay(180);

  clearInterval(_qrTimer);
  clearInterval(_qrCountTimer);

  _qrTimer = setInterval(() => {
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

    _qrCountdown = 180;
    if (window.Toast) window.Toast.info('보안을 위해 일회용 QR이 자동 갱신되었습니다.');
  }, 180000);

  _qrCountTimer = setInterval(() => {
    _qrCountdown = Math.max(0, _qrCountdown - 1);
    updateQRTimerDisplay(_qrCountdown);
  }, 1000);
}

function updateQRTimerDisplay(sec) {
  const textEl = document.querySelector('.qr-timer-text');
  const progressEl = document.getElementById('qr-linear-progress');

  if (textEl) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    textEl.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  if (progressEl) {
    const pct = (sec / 180) * 100;
    progressEl.style.width = `${pct}%`;
    progressEl.style.background = sec <= 10 ? '#ff4757' : 'linear-gradient(90deg, #6a4dff 0%, #a770ef 100%)';
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
    inquiryList.innerHTML = `<div class="mypage-empty"><p class="mypage-empty-title">내역이 없습니다</p></div>`;
    return;
  }
  inquiryList.innerHTML = MOCK_INQUIRIES.map(q => `
    <div class="mp-card" style="margin-bottom:16px;">
      <div class="mp-card-header" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center;" onclick="toggleAccordion(${q.id})">
        <h4 class="mp-inquiry-title" style="font-size:1.1rem; margin:0; font-weight:600; flex:1;">${q.title}</h4>
        <div style="display:flex; align-items:center; gap:12px;">
          <span class="mp-inquiry-date" style="font-size:0.85rem; color:var(--text-muted);">${new Date(q.createdAt).toLocaleString()}</span>
          <span class="mp-badge ${q.status === '답변완료' ? 'status-완료' : 'status-대기'}">${q.status}</span>
          <svg id="arrow-${q.id}" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px; height:20px; transition:transform 0.3s;"><path d="M6 9l6 6 6-6"/></svg>
        </div>
      </div>
      <div id="acc-${q.id}" style="display:none; margin-top:16px; padding-top:16px; border-top:1px solid var(--border-subtle);">
        <p class="mp-inquiry-preview" style="color:var(--text-secondary); margin-bottom:16px;">${q.content}</p>
        ${q.answer ? `<div class="mp-inquiry-answer" style="background:#f9f9fc; padding:16px; border-radius:8px;"><p style="font-weight:bold; margin-bottom:8px; color:var(--color-primary);">운영센터 답변</p><p style="margin:0;">${q.answer}</p></div>` : ''}
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:16px;">
          ${q.answer ? `<div style="display:flex; gap:12px; align-items:center;">
              <span style="font-size:0.85rem; color:var(--text-muted);">이 답변이 도움이 되셨나요?</span>
              <button class="btn btn-sm btn-outline" onclick="this.style.background='#f0f0ff'; this.style.color='var(--color-primary)'; this.style.borderColor='var(--color-primary)'; /* Removed Toast */" style="padding:4px 8px; font-size:0.8rem; display:flex; align-items:center; gap:4px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                좋아요
              </button>
              <div style="display:flex; gap:2px;" class="inquiry-stars" data-id="${q.id}">
                ${[1, 2, 3, 4, 5].map(i => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffb400" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="cursor:pointer;" onmousemove="hoverInquiryStar(event, this, ${i}, ${q.id})" onmouseleave="resetInquiryStar(${q.id})" onclick="setInquiryStar(event, this, ${i}, ${q.id})"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`).join('')}
              </div>
            </div>` : '<div></div>'}
          <button class="btn btn-sm" onclick="deleteInquiry(${q.id})" style="padding:4px 10px; font-size:0.8rem; background:#ffebee; color:#d32f2f; border:none;">삭제</button>
        </div>
      </div>
    </div>
  `).join('');
}

window.hoverInquiryStar = function (e, svg, baseVal, qId) {
  const rect = svg.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const isHalf = clickX < rect.width / 2;
  const hoverVal = isHalf ? baseVal - 0.5 : baseVal;
  updateInquiryStars(qId, hoverVal);
};

window.resetInquiryStar = function (qId) {
  const container = document.querySelector(`.inquiry-stars[data-id="${qId}"]`);
  if (!container) return;
  const selectedRating = parseFloat(container.dataset.rating || '0');
  updateInquiryStars(qId, selectedRating);
};

window.setInquiryStar = function (e, svg, baseVal, qId) {
  const rect = svg.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const isHalf = clickX < rect.width / 2;
  const selectedRating = isHalf ? baseVal - 0.5 : baseVal;
  const container = document.querySelector(`.inquiry-stars[data-id="${qId}"]`);
  if (container) {
    container.dataset.rating = selectedRating;
    updateInquiryStars(qId, selectedRating);

  }
};

window.updateInquiryStars = function (qId, val) {
  const container = document.querySelector(`.inquiry-stars[data-id="${qId}"]`);
  if (!container) return;
  const svgs = container.querySelectorAll('svg');
  svgs.forEach((svg, idx) => {
    const sVal = idx + 1;
    if (sVal <= Math.floor(val)) {
      svg.setAttribute('fill', '#ffb400');
      svg.style.opacity = '1';
    } else if (sVal === Math.ceil(val) && !Number.isInteger(val)) {
      svg.setAttribute('fill', '#ffb400');
      svg.style.opacity = '0.5'; // Simulate half star visually
    } else {
      svg.setAttribute('fill', 'none');
      svg.style.opacity = '1';
    }
  });
};

window.toggleAccordion = function (id) {
  const content = document.getElementById('acc-' + id);
  const arrow = document.getElementById('arrow-' + id);
  if (content.style.display === 'none') {
    content.style.display = 'block';
    arrow.style.transform = 'rotate(180deg)';
  } else {
    content.style.display = 'none';
    arrow.style.transform = 'rotate(0deg)';
  }
};
window.deleteInquiry = function (id) {
  if (!confirm('문의 내역을 삭제하시겠습니까?')) return;
  const idx = MOCK_INQUIRIES.findIndex(q => q.id === id);
  if (idx > -1) MOCK_INQUIRIES.splice(idx, 1);
  if (window.Toast) window.Toast.success('삭제되었습니다.');
  renderInquiryList();
};



let MOCK_COUPONS = [
  { id: 1, title: '20% 할인 쿠폰', desc: 'FESTIO 회원 웰컴 쿠폰', limit: '최소 ₩30,000 이상 결제 시 사용 가능', date: '2026.08.31' }
];
function renderCouponList() {
  const couponList = document.getElementById('couponList');
  const couponCount = document.getElementById('couponCount');
  if (!couponList) return;
  if (couponCount) couponCount.textContent = `보유 ${MOCK_COUPONS.length}개`;
  if (MOCK_COUPONS.length === 0) {
    couponList.innerHTML = `<div class="mypage-empty"><p class="mypage-empty-title">보유 쿠폰이 없습니다</p></div>`;
    return;
  }
  couponList.innerHTML = MOCK_COUPONS.map(c => `
    <div class="mp-card" style="display:flex; justify-content:space-between; align-items:center;">
      <div>
        <p class="mp-coupon-desc" style="font-size:0.85rem; color:var(--text-muted);">${c.desc}</p>
        <h3 class="mp-coupon-title" style="margin:8px 0; font-size:1.25rem;">${c.title}</h3>
        <p class="mp-coupon-meta" style="font-size:0.9rem; color:var(--text-secondary);">${c.limit}</p>
      </div>
      <div style="display:flex; flex-direction:column; align-items:flex-end;">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
          <div style="text-align:center;">
            <svg viewBox="0 0 100 30" style="width:100px; height:30px;">
              <rect x="0" y="0" width="4" height="30" fill="#333"/><rect x="6" y="0" width="2" height="30" fill="#333"/><rect x="12" y="0" width="6" height="30" fill="#333"/><rect x="22" y="0" width="4" height="30" fill="#333"/><rect x="30" y="0" width="2" height="30" fill="#333"/><rect x="36" y="0" width="8" height="30" fill="#333"/><rect x="48" y="0" width="4" height="30" fill="#333"/><rect x="56" y="0" width="2" height="30" fill="#333"/><rect x="62" y="0" width="10" height="30" fill="#333"/><rect x="76" y="0" width="4" height="30" fill="#333"/><rect x="84" y="0" width="2" height="30" fill="#333"/><rect x="90" y="0" width="6" height="30" fill="#333"/><rect x="100" y="0" width="4" height="30" fill="#333"/>
            </svg>
            <p style="font-size:0.75rem; letter-spacing:2px; margin-top:4px; font-family:monospace;">FEST-${c.id}026</p>
          </div>
          <div>
            <span class="mp-coupon-badge" style="display:inline-block; padding:4px 8px; background:rgba(106, 77, 255, 0.1); color:var(--color-primary); border-radius:4px; font-weight:bold; margin-bottom:4px;">보유중</span>
            <p class="mp-coupon-date" style="font-size:0.85rem; color:var(--text-muted); margin:0;">~${c.date}</p>
          </div>
        </div>
        <button class="btn btn-sm" onclick="deleteCoupon(${c.id})" style="padding:6px 12px; background:#ffebee; color:#d32f2f; border:none; border-radius:6px; font-weight:600; cursor:pointer;">사용/삭제</button>
      </div>
    </div>
  `).join('');
}
window.deleteCoupon = function (id) {
  MOCK_COUPONS = MOCK_COUPONS.filter(c => c.id !== id);
  if (window.Toast) window.Toast.success('쿠폰이 삭제(사용 처리) 되었습니다.');
  else alert('삭제되었습니다.');
  renderCouponList();
};

function initCouponForm() {
  const btnRegister = document.getElementById('btn-register-coupon');
  if (btnRegister) {
    btnRegister.addEventListener('click', () => {
      const input = document.getElementById('couponInput');
      const code = input.value.trim();
      if (!code) { alert('쿠폰 번호를 입력해주세요.'); return; }
      MOCK_COUPONS.unshift({ id: Date.now(), title: `${code} 할인 쿠폰`, desc: '입력 등록 쿠폰', limit: '최소 결제금액 제한 없음', date: '2026.12.31' });
      input.value = '';
      if (window.Toast) window.Toast.success('쿠폰이 성공적으로 등록되었습니다.');
      else alert('등록되었습니다.');
      renderCouponList();
    });
  }
}


let MOCK_REVIEWS = [
  { id: 1, eventName: '2026 워터밤 서울', rating: 5, content: '라인업이 진짜 미쳤습니다!! 음향도 빵빵하고 내년에도 꼭 또 오고 싶어요!', date: '2026.05.29' }
];
let currentEditReviewId = null;

function renderMyReviewList() {
  const list = document.getElementById('myReviewList');
  if (!list) return;
  if (MOCK_REVIEWS.length === 0) {
    list.innerHTML = '<div class="mypage-empty"><p class="mypage-empty-title">작성한 리뷰가 없습니다</p></div>';
    return;
  }
  list.innerHTML = MOCK_REVIEWS.map(r => `
    <div class="mp-card">
      <div class="mp-flex-between mp-margin-b-8">
        <h4 class="mp-card-title">${r.eventName}</h4>
        <div class="mp-review-rating" style="color:#ffb400; font-weight:bold;">${'⭐️'.repeat(r.rating)} (${r.rating}.0)</div>
      </div>
      <p class="mp-card-meta mp-margin-b-8">${r.content}</p>
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span class="mp-inquiry-date">작성일: ${r.date}</span>
        <div>
          <button class="btn btn-sm btn-outline" onclick="editReview(${r.id})" style="padding:4px 10px; font-size:0.8rem; margin-right:4px;">수정</button>
          <button class="btn btn-sm" onclick="deleteReview(${r.id})" style="padding:4px 10px; font-size:0.8rem; background:#ffebee; color:#d32f2f; border:none;">삭제</button>
        </div>
      </div>
    </div>
  `).join('');
}
window.deleteReview = function (id) {
  if (!confirm('리뷰를 삭제하시겠습니까?')) return;
  MOCK_REVIEWS = MOCK_REVIEWS.filter(r => r.id !== id);
  if (window.Toast) window.Toast.success('리뷰가 삭제되었습니다.');
  renderMyReviewList();
};
window.editReview = function (id) {
  const review = MOCK_REVIEWS.find(r => r.id === id);
  if (!review) return;
  document.getElementById('reviewContent').value = review.content;
  // trigger UI for edit
  const reviewWrap = document.getElementById('reviewFormWrap');
  if (reviewWrap) reviewWrap.classList.remove('hidden');
  document.getElementById('btn-submit-review').textContent = '리뷰 수정 완료';
  currentEditReviewId = id;
  window.scrollTo({ top: document.getElementById('reviewFormWrap').offsetTop, behavior: 'smooth' });
};

function initReviewForm() {
  if (!document.getElementById("half-star-css")) { document.head.insertAdjacentHTML("beforeend", `<style id="half-star-css">.star-btn{position:relative;} .star-btn.half{color:#ffb400;} .star-btn.half::after{content:"";position:absolute;top:0;left:0;width:50%;height:100%;background:currentColor;mix-blend-mode:color;} /* simple mockup */</style>`); }
  const eventList = document.getElementById('reviewEventList');
  const reviewWrap = document.getElementById('reviewFormWrap');
  const submitBtn = document.getElementById('btn-submit-review');
  const stars = document.querySelectorAll('.star-btn');
  let selectedRating = 5; let selectedEvent = '';

  if (eventList) {
    eventList.addEventListener('click', (e) => {
      const card = e.target.closest('.mp-card');
      if (card) {
        eventList.querySelectorAll('.mp-card').forEach(c => c.style.border = '1px solid var(--border-subtle)');
        card.style.border = '2px solid var(--color-primary)';
        selectedEvent = card.dataset.eventName;
        if (reviewWrap) reviewWrap.classList.remove('hidden');
        currentEditReviewId = null;
        document.getElementById('btn-submit-review').textContent = '리뷰 등록';
      }
    });
  }


  if (stars.length > 0) {
    stars.forEach(star => {
      star.style.cursor = 'pointer';

      const updateReviewStars = (rating) => {
        stars.forEach(s => {
          const sVal = parseInt(s.dataset.star);
          const svg = s.querySelector('svg');
          if (sVal <= Math.floor(rating)) {
            svg.setAttribute('fill', '#ffb400');
            svg.setAttribute('stroke', '#ffb400');
          } else if (sVal === Math.ceil(rating) && !Number.isInteger(rating)) {
            svg.setAttribute('fill', 'url(#half-star-grad)');
            svg.setAttribute('stroke', '#ffb400');
          } else {
            svg.setAttribute('fill', 'none');
            svg.setAttribute('stroke', '#ccc');
          }
        });
      };

      star.addEventListener('mousemove', (e) => {
        const rect = star.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const isHalf = clickX < rect.width / 2;
        const baseVal = parseInt(star.dataset.star);
        const hoverVal = isHalf ? baseVal - 0.5 : baseVal;
        updateReviewStars(hoverVal);
      });

      star.addEventListener('mouseleave', () => {
        updateReviewStars(selectedRating);
      });

      star.addEventListener('click', (e) => {
        e.preventDefault();
        const rect = star.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const isHalf = clickX < rect.width / 2;
        const baseVal = parseInt(star.dataset.star);
        selectedRating = isHalf ? baseVal - 0.5 : baseVal;
        updateReviewStars(selectedRating);
      });

      // Init styles
      const svg = star.querySelector('svg');
      svg.style.transition = 'all 0.2s';
      svg.setAttribute('stroke-width', '2');
      svg.setAttribute('stroke-linejoin', 'round');
      svg.setAttribute('stroke-linecap', 'round');
    });
    // Init display
    setTimeout(() => {
      document.querySelector('.star-btn[data-star="5"]').dispatchEvent(new Event('mouseleave'));
    }, 100);
  }


  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      const content = document.getElementById('reviewContent').value.trim();
      if (!content) { alert('리뷰 내용을 입력해주세요.'); return; }

      if (currentEditReviewId) {
        const r = MOCK_REVIEWS.find(r => r.id === currentEditReviewId);
        if (r) { r.content = content; r.rating = selectedRating; }
        if (window.Toast) window.Toast.success('리뷰가 수정되었습니다.');
      } else {
        if (!selectedEvent) { alert('행사를 선택해주세요.'); return; }
        MOCK_REVIEWS.unshift({ id: Date.now(), eventName: selectedEvent, rating: selectedRating, content: content, date: new Date().toLocaleDateString() });
        if (window.Toast) window.Toast.success('리뷰가 등록되었습니다.');
      }
      document.getElementById('reviewContent').value = '';
      if (reviewWrap) reviewWrap.classList.add('hidden');
      eventList.querySelectorAll('.mp-card').forEach(c => c.style.border = '1px solid var(--border-subtle)');
      renderMyReviewList();
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

function initProfileFeatures() {
  const btnChangeAva = document.getElementById('btn-change-avatar');
  const btnDelAva = document.getElementById('btn-delete-avatar');
  const avatarText = document.getElementById('profileAvatarText');
  if (btnChangeAva) {
    btnChangeAva.addEventListener('click', () => {
      alert('사진을 업로드했습니다.');
      if (avatarText) { avatarText.innerHTML = '<img src="https://i.pravatar.cc/150?img=32" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">'; }
    });
  }
  if (btnDelAva) {
    btnDelAva.addEventListener('click', () => {
      alert('기본 이미지로 변경되었습니다.');
      if (avatarText) { avatarText.innerHTML = 'U'; }
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

      document.querySelectorAll('.mypage-sidenav-item, .mypage-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

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
  if (!checkAuth()) return;

  await loadUserInfo();
  renderProfile();

  renderStats();
  renderReservationList();
  await renderOtherLists();
  renderInquiryList();

  initTabs();
  initInquiryForm();
  initCouponForm();
  initReviewForm();
  initProfileEditSave();
  initProfileFeatures();
  initLogout();
  initFaceModal();

  // URL 해시(#tab-wishlist 등)로 특정 탭 자동 활성화
  const hashTab = window.location.hash.replace('#', '');
  if (hashTab) {
    const targetTab = document.getElementById(hashTab);
    if (targetTab) {
      document.querySelectorAll('.mypage-sidenav-item, .mypage-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      document.querySelectorAll(`[data-tab="${hashTab}"]`).forEach(t => t.classList.add('active'));
      targetTab.classList.add('active');
      targetTab.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  if (MOCK_TICKETS.length > 0) {
    openQrModal(MOCK_TICKETS[0].qrToken, '입장 확인용 일회용 안전 QR');
  }
});

window.deleteInquiry = function (id) {
  if (!confirm('문의 내역을 삭제하시겠습니까?')) return;
  const idx = MOCK_INQUIRIES.findIndex(q => q.id === id);
  if (idx !== -1) MOCK_INQUIRIES.splice(idx, 1);
  renderInquiryList();
  alert('삭제되었습니다.');
};


setTimeout(() => {
  const profileBtn = document.getElementById('btn-profile-update') || document.querySelector('.btn-profile-update');
  if (profileBtn) {
    profileBtn.addEventListener('click', (e) => {
      e.preventDefault();
      alert('프로필이 성공적으로 업데이트되었습니다.');
    });
  }
}, 1000);
