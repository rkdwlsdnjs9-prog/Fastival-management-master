/**
 * Festival O2O Platform — mypage.js
 * ─────────────────────────────────────────────────────────────
 * 마이페이지:
 * - 프로필 / 등급 / 누적 금액 렌더링
 * - 동적 QR 코드 (30초마다 갱신, qrcode.js)
 * - face-api.js 안면 인증 등록
 * - 탭 패널: 내 티켓 / 쿠폰 / 후기 / 문의
 * - 알림 설정 토글
 * - 로그아웃
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

/* ── 상태 ─────────────────────────────────────────────────── */
let _member = null;
let _qrTimer = null;    // setInterval ID (3분 갱신)
let _qrCountdown = 180;
let _qrCountTimer = null;    // 1초 카운트다운
let _currentOrderNo = 1;       // QR 표시 중인 주문번호
let _isFaceDetected = false;
let _faceApiLoaded = false;
let _videoStream = null;
let _faceDetectLoop = null;

/* QR SVG 원 circumference (r=11) */
const QR_CIRC = 2 * Math.PI * 11; // ≈ 69.1

/* ═══════════════════════════════════════════════════════════
   프로필 & 등급 렌더링
═══════════════════════════════════════════════════════════ */
function renderProfile(member) {
  // 아바타 이니셜
  const avatar = $('.profile-avatar');
  if (avatar) avatar.textContent = member.name?.[0] || '?';

  // 안면 인증 배지
  const faceBadge = $('.profile-avatar-face-badge');
  if (faceBadge) faceBadge.classList.toggle('inactive', !member.isFaceRegistered);

  // 이름 / 아이디
  const nameEl = $('.profile-name');
  const idEl = $('.profile-id');
  if (nameEl) nameEl.textContent = maskName(member.name);
  if (idEl) idEl.textContent = `@${member.memberId}`;

  // 등급 배지
  const gradeClass = getGradeClass(member.grade);
  const gradeBadge = $('.grade-badge');
  if (gradeBadge) {
    gradeBadge.className = `grade-badge ${gradeClass}`;
    gradeBadge.querySelector('.grade-badge-text').textContent = GRADE_INFO[member.grade]?.displayName || member.grade;
  }

  // 등급 프로그레스
  const pct = getGradeProgress(member.grade, member.totalPurchaseAmount);
  const fill = $('.grade-progress-fill');
  if (fill) {
    fill.className = `grade-progress-fill ${member.grade.toLowerCase()}`;
    setTimeout(() => { fill.style.width = `${pct}%`; }, 100);
  }

  // 등급 진행 정보
  const info = GRADE_INFO[member.grade];
  const progressInfo = $('.grade-progress-info');
  if (progressInfo) {
    const spent = member.totalPurchaseAmount.toLocaleString();
    const nextAmt = info?.nextAmount?.toLocaleString();
    const nextGrd = info?.next ? GRADE_INFO[info.next].displayName : null;
    progressInfo.innerHTML = nextAmt
      ? `<span>누적: <strong>${spent}원</strong></span><span>${nextGrd} 까지 <strong>${(info.nextAmount - member.totalPurchaseAmount).toLocaleString()}원</strong> 남음</span>`
      : `<span>누적: <strong>${spent}원</strong></span><span class="text-accent">최고 등급 달성!</span>`;
  }

  // 등급 레벨 마커
  const levels = ['Bronze', 'Silver', 'Gold', 'VIP', 'VVIP'];
  const currentIdx = levels.indexOf(member.grade);
  $$('.grade-level-dot').forEach((dot, i) => {
    dot.classList.toggle('reached', i <= currentIdx);
  });

  // 통계 행
  const statEls = {
    '[data-stat="tickets"]': null,
    '[data-stat="wishlist"]': null,
    '[data-stat="grade"]': GRADE_INFO[member.grade]?.displayName || member.grade,
  };
  Object.entries(statEls).forEach(([sel, val]) => {
    const el = $(sel);
    if (el && val !== null) el.textContent = val;
  });
}

/* ═══════════════════════════════════════════════════════════
   동적 QR 코드 (30초 TTL, qrcode.js)
═══════════════════════════════════════════════════════════ */
async function refreshQRCode() {
  const overlay = $('.qr-refresh-overlay');
  if (overlay) overlay.classList.add('active');

  try {
    const res = await orderApi.refreshQrToken(_currentOrderNo);
    if (!res) return;

    const container = $('#qr-code-container');
    if (!container) return;

    container.innerHTML = '';   // 기존 QR 제거

    if (!window.QRCode) {
      container.textContent = res.qrToken;
      return;
    }

    new QRCode(container, {
      text: res.qrToken,
      width: 160,
      height: 160,
      colorDark: '#1C1C32',
      colorLight: '#FFFFFF',
      correctLevel: QRCode.CorrectLevel.M,
    });

    // 바코드 텍스트 업데이트
    const barcodeEl = $('#qr-barcode-number');
    if (barcodeEl) {
      // 가독성을 위해 4자리씩 띄어서 출력 (선택 사항이지만 안해도 무방함, 일단 그대로 출력)
      barcodeEl.textContent = res.qrToken;
    }

    // 마스킹 이름 업데이트
    const nameEl = $('.qr-masked-name');
    if (nameEl && _member) {
      const masked = maskName(_member.name);
      nameEl.innerHTML = masked.split('').map((c, i) =>
        i > 0 && c !== '*' ? `<span>${c}</span>` : c
      ).join('');
    }

  } finally {
    setTimeout(() => {
      if (overlay) overlay.classList.remove('active');
    }, 400);
  }
}

function startQRRefreshCycle() {
  _qrCountdown = 180;
  updateQRTimerDisplay(180);

  clearInterval(_qrTimer);
  clearInterval(_qrCountTimer);

  // 3분마다 QR 갱신
  _qrTimer = setInterval(() => {
    refreshQRCode();
    _qrCountdown = 180;
  }, 180000);

  // 1초 카운트다운
  _qrCountTimer = setInterval(() => {
    _qrCountdown = Math.max(0, _qrCountdown - 1);
    updateQRTimerDisplay(_qrCountdown);
  }, 1000);
}

function updateQRTimerDisplay(sec) {
  const textEl = $('.qr-timer-text');
  const progressEl = $('.qr-timer-progress');

  if (textEl) {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    textEl.textContent = mins > 0 ? `${mins}분 ${secs}초` : `${secs}초`;
  }

  if (progressEl) {
    const pct = sec / 180;
    const offset = QR_CIRC * (1 - pct);
    progressEl.style.strokeDasharray = `${QR_CIRC}`;
    progressEl.style.strokeDashoffset = `${offset}`;
    // 10초 이하 → 빨간색 경고
    progressEl.style.stroke = sec <= 10 ? 'var(--color-secondary)' : 'var(--color-accent)';
    if (textEl) textEl.style.color = sec <= 10 ? 'var(--color-secondary)' : 'var(--color-accent)';
  }
}

/* ═══════════════════════════════════════════════════════════
   탭 패널
═══════════════════════════════════════════════════════════ */
function initTabs() {
  on(document, 'click', (e) => {
    const tab = e.target.closest('.mypage-sidenav-item, .mypage-tab');
    if (!tab) return;
    const tabId = tab.dataset.tab;
    if (!tabId) return;

    $$('.mypage-sidenav-item, .mypage-tab').forEach(t => t.classList.remove('active'));
    $$('.tab-pane').forEach(p => p.classList.remove('active'));

    // Sync active state for both desktop and mobile tabs
    $$(`[data-tab="${tabId}"]`).forEach(t => t.classList.add('active'));
    const panel = $(`#${tabId}`);
    if (panel) panel.classList.add('active');
  });
}

/* ── 탭 패널 데이터 로드 & 렌더링 ─────────────────────────── */
async function loadTabData() {
  const [orders, coupons, reviews, inquiries] = await Promise.all([
    orderApi.getMyOrders(),
    couponApi.getMyCoupons(),
    reviewApi.getMyReviews(),
    inquiryApi.getMyInquiries(),
  ]);

  renderTicketList(orders || []);
  renderCouponList(coupons || []);
  renderReviewList(reviews || []);
  renderInquiryList(inquiries || []);

  // 통계 행 업데이트
  const ticketStatEl = $('[data-stat="tickets"]');
  if (ticketStatEl) ticketStatEl.textContent = (orders || []).filter(o => o.reservationStatus === '결제완료' || o.reservationStatus === '입장완료').length;
}

function renderTicketList(orders) {
  const panel = $('#tab-tickets');
  if (!panel) return;

  if (!orders.length) {
    panel.innerHTML = `<div class="empty-state">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12v6a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      <p class="empty-state-title">예매 내역이 없습니다.</p>
      <p class="empty-state-desc">첫 번째 티켓을 예매해 보세요!</p>
    </div>`;
    return;
  }

  const statusClass = { '결제완료': 'status-완료', '결제대기': 'status-대기', '입장완료': 'status-입장', '취소': 'status-취소' };

  panel.innerHTML = orders.map(o => `
    <div class="ticket-item ${statusClass[o.reservationStatus] || ''}">
      <div class="ticket-item-header">
        <p class="ticket-event-name">${o.eventName}</p>
        <span class="ticket-status-badge ${statusClass[o.reservationStatus] || ''}">${o.reservationStatus}</span>
      </div>
      <div class="ticket-item-meta">
        <span class="ticket-meta-row">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12v6a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h6"/></svg>
          ${o.zoneName} · ${o.quantity}매
        </span>
        ${o.paymentDatetime ? `<span class="ticket-meta-row">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          ${formatDate(o.paymentDatetime)} 결제
        </span>` : ''}
      </div>
      <div class="ticket-item-footer">
        <span class="ticket-price">${formatKRW(o.paymentAmount)}</span>
        ${o.reservationStatus === '결제완료' ? `<button class="btn btn-sm btn-outline" data-order-no="${o.orderNo}" id="btn-show-qr">QR 확인</button>` : ''}
      </div>
    </div>`).join('');

  on(panel, 'click', (e) => {
    const qrBtn = e.target.closest('#btn-show-qr');
    if (qrBtn) {
      _currentOrderNo = parseInt(qrBtn.dataset.orderNo);
      // QR 섹션으로 스크롤
      const qrSection = $('.qr-section');
      if (qrSection) qrSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      refreshQRCode();
      startQRRefreshCycle();
    }
  });
}

function renderCouponList(coupons) {
  const panel = $('#tab-coupons');
  if (!panel) return;

  if (!coupons.length) {
    panel.innerHTML = `<div class="empty-state">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="6" width="22" height="12" rx="2"/><path d="M1 12h22"/></svg>
      <p class="empty-state-title">보유 쿠폰이 없습니다.</p>
    </div>`;
    return;
  }

  panel.innerHTML = coupons.map(c => `
    <div class="coupon-card ${c.isUsed ? 'used' : ''}">
      <div class="coupon-left">
        <span class="coupon-discount-value">${c.discountType === 'PERCENT' ? c.discountValue + '%' : (c.discountValue / 1000) + 'K'}</span>
        <span class="coupon-discount-type">${c.discountType === 'PERCENT' ? 'OFF' : '원 할인'}</span>
      </div>
      <div class="coupon-right">
        <p class="coupon-name">${c.couponName}</p>
        <div class="coupon-meta">
          <span>최소 ${formatKRW(c.minPurchase)} 이상 구매 시</span>
          <span>만료: ${formatDate(c.expiresAt)}</span>
        </div>
      </div>
      ${c.isUsed ? '<span class="coupon-used-stamp">사용완료</span>' : ''}
    </div>`).join('');
}

function renderReviewList(reviews) {
  const panel = $('#tab-reviews');
  if (!panel) return;

  if (!reviews.length) {
    panel.innerHTML = `<div class="empty-state">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
      <p class="empty-state-title">작성한 후기가 없습니다.</p>
    </div>`;
    return;
  }

  const stars = (r) => Array.from({ length: 5 }, (_, i) =>
    `<svg class="icon ${i < r ? 'star-filled' : 'star-unfilled'}" viewBox="0 0 24 24" fill="${i < r ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
  ).join('');

  panel.innerHTML = reviews.map(r => `
    <div class="review-card">
      <div class="review-header">
        <p class="review-event-name">${r.eventName}</p>
        <div class="review-stars">${stars(r.rating)}</div>
      </div>
      <p class="review-content">${r.content}</p>
      <p class="review-date">${formatDate(r.createdAt)}</p>
    </div>`).join('');
}

function renderInquiryList(inquiries) {
  const panel = $('#tab-inquiries');
  if (!panel) return;

  if (!inquiries.length) {
    panel.innerHTML = `<div class="empty-state">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <p class="empty-state-title">문의 내역이 없습니다.</p>
    </div>`;
    return;
  }

  panel.innerHTML = inquiries.map(q => `
    <div class="inquiry-card">
      <div class="inquiry-header">
        <p class="inquiry-title">${q.title}</p>
        <span class="inquiry-status-badge ${q.status === '답변완료' ? 'answered' : 'waiting'}">${q.status}</span>
      </div>
      <p class="inquiry-preview">${q.content}</p>
      ${q.answer ? `
        <div class="inquiry-answer-box">
          <p class="inquiry-answer-label">답변</p>
          <p class="inquiry-answer-text">${q.answer}</p>
        </div>` : ''}
      <p class="inquiry-date">${formatDate(q.createdAt)}</p>
    </div>`).join('');
}

/* ═══════════════════════════════════════════════════════════
   알림 설정 토글
═══════════════════════════════════════════════════════════ */
function initNotificationToggles() {
  on(document, 'change', async (e) => {
    const toggle = e.target.closest('input[data-notif]');
    if (!toggle) return;
    const key = toggle.dataset.notif;
    const value = toggle.checked;
    const payload = { [key]: value };
    const res = await memberApi.updateNotifications(payload);
    if (res) {
      Toast.info(value ? '알림이 켜졌습니다.' : '알림이 꺼졌습니다.');
    }
  });
}

/* ─── 초기 토글 상태 설정 ─────────────────────────────────── */
function setNotifToggles(member) {
  const toggleMap = {
    'notif-event': member.notifEvent,
    'notif-payment': member.notifPayment,
    'notif-coupon': member.notifCoupon,
  };
  Object.entries(toggleMap).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.checked = val;
  });
}

/* ═══════════════════════════════════════════════════════════
   face-api.js — 안면 등록
   CDN: https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js
   모델: TinyFaceDetector + FaceLandmark68Net
═══════════════════════════════════════════════════════════ */
const FACE_MODEL_URL = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights';

async function loadFaceApiModels() {
  if (!window.faceapi) return false;
  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_URL),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(FACE_MODEL_URL),
    ]);
    _faceApiLoaded = true;
    return true;
  } catch (e) {
    console.warn('[face-api] 모델 로드 실패:', e);
    return false;
  }
}

async function startFaceCamera() {
  const video = $('#face-video');
  const canvas = $('#face-canvas');
  if (!video) return;

  try {
    _videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 240, height: 240 } });
    video.srcObject = _videoStream;
    await video.play();

    if (!_faceApiLoaded) {
      const loaded = await loadFaceApiModels();
      if (!loaded) {
        startMockFaceDetection();
        return;
      }
    }

    startFaceDetectionLoop(video, canvas);
  } catch (err) {
    console.warn('[Camera]', err);
    Toast.warning('카메라 권한이 필요합니다. 브라우저 설정에서 허용해 주세요.');
    startMockFaceDetection();
  }
}

function startFaceDetectionLoop(video, canvas) {
  clearInterval(_faceDetectLoop);

  _faceDetectLoop = setInterval(async () => {
    if (!video.readyState || video.paused) return;

    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });
    const detections = await faceapi.detectAllFaces(video, options).withFaceLandmarks(true);

    _isFaceDetected = detections.length > 0;
    updateFaceStatus(_isFaceDetected);

    // 캔버스에 랜드마크 오버레이 표시
    if (canvas && detections.length > 0) {
      const displaySize = { width: 240, height: 240 };
      faceapi.matchDimensions(canvas, displaySize);
      const resized = faceapi.resizeResults(detections, displaySize);
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      faceapi.draw.drawFaceLandmarks(canvas, resized);
    }
  }, 300);
}

/** face-api 미로드 시 카운트다운 기반 모의 감지 */
function startMockFaceDetection() {
  let count = 0;
  const mockLoop = setInterval(() => {
    count++;
    if (count >= 5) {
      _isFaceDetected = true;
      updateFaceStatus(true);
      clearInterval(mockLoop);
    }
  }, 600);
}

function updateFaceStatus(detected) {
  const wrapper = $('.face-video-wrapper');
  const statusText = $('.face-detection-status');
  const registerBtn = $('#btn-face-register');

  if (wrapper) wrapper.classList.toggle('detected', detected);

  if (statusText) {
    statusText.className = `face-detection-status ${detected ? 'detected' : 'no-face'}`;
    statusText.textContent = detected ? '얼굴이 인식되었습니다.' : '얼굴을 화면 중앙에 위치시켜 주세요.';
  }

  if (registerBtn) registerBtn.disabled = !detected;
}

async function saveFaceData() {
  if (!_isFaceDetected) {
    Toast.warning('먼저 얼굴을 인식시켜 주세요.');
    return;
  }

  const video = $('#face-video');
  let landmarkJson = null;

  if (_faceApiLoaded && window.faceapi && video) {
    try {
      const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224 });
      const result = await faceapi.detectSingleFace(video, options).withFaceLandmarks(true);
      if (result) {
        landmarkJson = JSON.stringify(result.landmarks.positions);
      }
    } catch (e) {
      console.warn('[face-api] 특징점 추출 실패:', e);
    }
  }

  if (!landmarkJson) {
    // Mock: 임의 벡터 (face-api 미로드 시)
    landmarkJson = JSON.stringify(Array.from({ length: 68 }, () => ({
      x: Math.random() * 240,
      y: Math.random() * 240,
    })));
  }

  const res = await memberApi.saveFaceData(landmarkJson);
  if (res?.success || res) {
    _member.isFaceRegistered = true;
    const faceBadge = $('.profile-avatar-face-badge');
    if (faceBadge) faceBadge.classList.remove('inactive');

    Toast.success('안면 인증이 등록되었습니다!');
    stopFaceCamera();
    Modal.close('modal-face');
  } else {
    Toast.error('안면 데이터 저장에 실패했습니다.');
  }
}

function stopFaceCamera() {
  clearInterval(_faceDetectLoop);
  if (_videoStream) {
    _videoStream.getTracks().forEach(t => t.stop());
    _videoStream = null;
  }
  const video = $('#face-video');
  if (video) { video.srcObject = null; video.pause(); }
}

/* ═══════════════════════════════════════════════════════════
   문의 작성 폼
═══════════════════════════════════════════════════════════ */
function initInquiryForm() {
  on($('#btn-open-inquiry'), 'click', () => Modal.open('modal-inquiry'));

  on($('#btn-submit-inquiry'), 'click', async () => {
    const titleEl = $('#inquiry-title');
    const contentEl = $('#inquiry-content');
    const title = titleEl?.value.trim();
    const content = contentEl?.value.trim();

    if (!title) { Toast.warning('제목을 입력해 주세요.'); return; }
    if (!content) { Toast.warning('내용을 입력해 주세요.'); return; }

    const res = await inquiryApi.createInquiry({ title, content });
    if (res) {
      Toast.success('문의가 등록되었습니다. 빠른 시일 내에 답변 드리겠습니다.');
      Modal.close('modal-inquiry');
      if (titleEl) titleEl.value = '';
      if (contentEl) contentEl.value = '';
      // 문의 목록 재로드
      const inquiries = await inquiryApi.getMyInquiries();
      renderInquiryList(inquiries || []);
    } else {
      Toast.error('문의 등록에 실패했습니다.');
    }
  });
}

/* ═══════════════════════════════════════════════════════════
   로그아웃 & 프로필 수정
═══════════════════════════════════════════════════════════ */
function initLogout() {
  on($('#btn-logout'), 'click', () => {
    Auth.clear();
    clearInterval(_qrTimer);
    clearInterval(_qrCountTimer);
    stopFaceCamera();
    window.location.href = 'index.html';
  });
}

function initEditProfile() {
  const btnEditProfile = $('#btn-edit-profile');
  if (btnEditProfile) {
    on(btnEditProfile, 'click', () => {
      Toast.info('프로필 수정 기능은 준비 중입니다.');
    });
  }
}

/* ═══════════════════════════════════════════════════════════
   안면 인증 모달 열기/닫기
═══════════════════════════════════════════════════════════ */
function initFaceModal() {
  on($('#btn-open-face-modal'), 'click', () => {
    Modal.open('modal-face');
    startFaceCamera();
  });

  on($('#btn-face-register'), 'click', () => saveFaceData());

  on($('#btn-face-cancel'), 'click', () => {
    stopFaceCamera();
    Modal.close('modal-face');
  });

  // 모달 overlay 닫힐 때도 카메라 정지
  const faceModalOverlay = document.getElementById('modal-face');
  if (faceModalOverlay) {
    const observer = new MutationObserver(() => {
      if (!faceModalOverlay.classList.contains('active')) stopFaceCamera();
    });
    observer.observe(faceModalOverlay, { attributes: true, attributeFilter: ['class'] });
  }
}

/* ═══════════════════════════════════════════════════════════
   DOMContentLoaded — 진입점
═══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  _member = await memberApi.getMyInfo();
  if (!_member) {
    Toast.warning('로그인이 필요합니다.');
    window.location.href = 'index.html';
    return;
  }

  Auth.save(_member);

  renderProfile(_member);
  setNotifToggles(_member);
  initTabs();
  initNotificationToggles();
  initFaceModal();
  initInquiryForm();
  initLogout();
  initEditProfile();

  await loadTabData();

  // QR 초기 로드 (주문이 있을 경우)
  const orders = await orderApi.getMyOrders();
  const completedOrder = (orders || []).find(o => o.reservationStatus === '결제완료' || o.reservationStatus === '입장완료');
  if (completedOrder) {
    _currentOrderNo = completedOrder.orderNo;
    await refreshQRCode();
    startQRRefreshCycle();
  } else {
    // QR 없을 때 안내
    const qrContainer = $('#qr-code-container');
    if (qrContainer) {
      qrContainer.innerHTML = `<p style="font-size:0.75rem;color:var(--text-muted);text-align:center;padding:20px 0;">예매 완료된 티켓이<br>없습니다.</p>`;
    }
  }
});
