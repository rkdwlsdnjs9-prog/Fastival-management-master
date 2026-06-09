/**
 * Festival O2O Platform — detail.js
 * ─────────────────────────────────────────────────────────────
 * 상세/예매 화면:
 * - URL 파라미터에서 eventNo 읽기
 * - 행사 상세 정보 렌더링
 * - SVG 도면 구역 선택 & 잔여 수량 실시간 차감 반영
 * - Chart.js 예매자 성별/연령 통계 차트
 * - 대기열 시뮬레이션 (프로그레스 바 + 카운터)
 * - Toss Payments v1 Sandbox 결제 연동
 *   - clientKey: test_ck_D5GePWvyJnrK0W0k6q8gLzN97Emo
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

/* ── 상태 ─────────────────────────────────────────────────── */
let _eventDetail = null;
let _selectedZoneNo = null;
let _quantity = 1;
let _appliedCoupon = null;
let _orderNo = null;
let _orderUid = null;
let _queueTimer = null;
let _queueCount = 0;
let _selectedPayMethod = 'card';

/* ── Toss Payments 설정 ─────────────────────────────────────── */
const TOSS_CLIENT_KEY = 'test_ck_D5GePWvyJnrK0W0k6q8gLzN97Emo';

/* ── URL 파라미터 ─────────────────────────────────────────────
   사용 예시: detail.html?eventNo=1
─────────────────────────────────────────────────────────── */
function getEventNo() {
  const params = new URLSearchParams(window.location.search);
  return parseInt(params.get('eventNo')) || 1;
}

/* ═══════════════════════════════════════════════════════════
   행사 상세 렌더링
═══════════════════════════════════════════════════════════ */
function getCategoryBadgeClass(category) {
  switch (category) {
    case '콘서트': return 'badge-primary';
    case '뮤지컬': return 'badge-secondary';
    case '연극': return 'badge-success';
    case '클래식': return 'badge-info';
    case '전시': return 'badge-warning';
    default: return 'badge-dark';
  }
}

function renderEventDetail(detail) {
  const catBadgeClass = getCategoryBadgeClass(detail.category);

  // 제목
  const titleEl = $('.event-main-title');
  if (titleEl) titleEl.textContent = detail.eventName;

  // 카테고리 배지
  const catRow = $('.event-category-row');
  if (catRow) {
    catRow.innerHTML = `
      <span class="badge ${catBadgeClass}">${detail.category}</span>
      ${detail.badgeLabel ? `<span class="badge ${detail.badgeLabel === 'HOT' ? 'badge-hot' : 'badge-sale'}">${detail.badgeLabel}</span>` : ''}`;
  }

  // 메타 정보 (날짜, 시간, 장소)
  const metaDate = $('.event-meta-date');
  const metaTime = $('.event-meta-time');
  const metaVenue = $('.event-meta-venue');
  if (metaDate) metaDate.textContent = formatDate(detail.eventDate, true);
  if (metaTime) metaTime.textContent = `${detail.startTime} ~ ${detail.endTime}`;
  if (metaVenue) metaVenue.textContent = detail.venue;

  // 페이지 타이틀
  document.title = `${detail.eventName} | Festival O2O`;

  // 포스터 이미지 동기화
  const posterWrap = document.getElementById('detailPosterWrap');
  if (posterWrap) {
    // mapImageUrl 제거, 오직 썸네일(포스터)만 사용
    const posterUrl = detail.thumbnailUrl || detail.thumbnail_url;
    if (posterUrl) {
      posterWrap.innerHTML = `<img src="${posterUrl}" alt="${detail.eventName} 포스터" style="width: 100%; height: 100%; object-fit: cover; border-radius: var(--radius-lg);">`;
      posterWrap.style.background = 'none';
    }
  }

  // 좌석 배치도 동기화 (구역 선택 영역)
  const mapUrl = detail.mapImageUrl || detail.map_image_url;
  if (mapUrl) {
    const venueSvg = document.querySelector('.venue-svg');
    if (venueSvg) {
      const img = document.createElement('img');
      img.src = mapUrl;
      img.alt = '좌석 배치도';
      img.style.width = '100%';
      img.style.height = 'auto';
      img.style.borderRadius = 'var(--radius-lg)';
      img.style.marginBottom = '1.5rem';
      venueSvg.parentNode.replaceChild(img, venueSvg);
    }
  }
}

/* ═══════════════════════════════════════════════════════════
   SVG 도면 구역 선택
   — DCC (대전컨벤션센터) 스타일 벡터 플로어맵
═══════════════════════════════════════════════════════════ */
function initVenueMap(zones) {
  const svg = $('.venue-svg');
  if (!svg || !zones || !Array.isArray(zones)) return;

  // 구역 zone-no 데이터 → SVG path와 연결
  const zoneEls = $$('.venue-zone-path', svg);

  zoneEls.forEach(el => {
    const zoneNo = parseInt(el.dataset.zoneNo);
    const zone = zones.find(z => z.zoneNo === zoneNo);
    if (!zone) return;

    // 잔여 수량 0이면 sold-out 처리
    if (zone.remainingCapacity === 0) {
      el.classList.add('sold-out');
      el.setAttribute('aria-disabled', 'true');
      return;
    }

    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', `${zone.zoneName} - ${formatKRW(zone.price)} - 잔여 ${zone.remainingCapacity}석`);

    on(el, 'click', () => selectZone(zoneNo, zone, el));
    on(el, 'keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') selectZone(zoneNo, zone, el); });
  });

  // 범례 클릭 → 구역 선택
  on(document, 'click', (e) => {
    const legendItem = e.target.closest('.zone-legend-item[data-zone-no]');
    if (!legendItem) return;
    const zoneNo = parseInt(legendItem.dataset.zoneNo);
    const zone = zones.find(z => z.zoneNo === zoneNo);
    const svgEl = svg.querySelector(`[data-zone-no="${zoneNo}"]`);
    if (zone && svgEl && zone.remainingCapacity > 0) {
      selectZone(zoneNo, zone, svgEl);
    }
  });
}

function selectZone(zoneNo, zone, svgEl) {
  _selectedZoneNo = zoneNo;

  // SVG 선택 강조
  $$('.venue-zone-path').forEach(el => el.classList.remove('selected'));
  svgEl.classList.add('selected');

  // 범례 선택 강조
  $$('.zone-legend-item').forEach(li => li.classList.remove('active'));
  const legendItem = $(`.zone-legend-item[data-zone-no="${zoneNo}"]`);
  if (legendItem) legendItem.classList.add('active');

  // 구역 정보 패널 업데이트
  updateZoneInfoPanel(zone);

  // 수량 초기화 & CTA 업데이트
  _quantity = 1;
  updateQtyDisplay();
  updateCtaBar(zone);
}

function updateZoneInfoPanel(zone) {
  const panel = $('.zone-info-panel');
  if (!panel) return;
  panel.classList.add('visible');

  const name = panel.querySelector('.zone-info-name');
  const soldRem = panel.querySelector('.zone-info-stat-value.remaining');
  const priceEl = panel.querySelector('.zone-info-stat-value.price');
  const capBar = panel.querySelector('.capacity-bar-fill');

  if (name) name.textContent = zone.zoneName;
  if (soldRem) soldRem.textContent = `${zone.remainingCapacity}석`;
  if (priceEl) priceEl.textContent = formatKRW(zone.price);

  if (capBar) {
    const pct = Math.round(zone.remainingCapacity / zone.totalCapacity * 100);
    capBar.style.width = `${pct}%`;
    capBar.className = `capacity-bar-fill ${zone.zoneType === 'VIP' ? 'zone-vip' : zone.zoneName.includes('A') ? 'zone-a' : zone.zoneName.includes('B') ? 'zone-b' : 'standing'}`;
  }
}

function updateCtaBar(zone) {
  if (!zone) return;
  const zoneLabel = $('.booking-cta-zone strong');
  const totalEl = $('.booking-cta-total');
  if (zoneLabel) zoneLabel.textContent = zone.zoneName;

  const gross = zone.price * _quantity;
  const discount = _appliedCoupon ? _appliedCoupon.discountAmount : 0;
  const net = gross - discount;
  if (totalEl) totalEl.textContent = formatKRW(net);
}

/* ═══════════════════════════════════════════════════════════
   수량 선택
═══════════════════════════════════════════════════════════ */
function initQtySelector() {
  on($('.qty-btn-minus'), 'click', () => changeQty(-1));
  on($('.qty-btn-plus'), 'click', () => changeQty(+1));
}

function changeQty(delta) {
  const zone = _eventDetail?.zones.find(z => z.zoneNo === _selectedZoneNo);
  const max = zone ? Math.min(4, zone.remainingCapacity) : 4;
  _quantity = Math.max(1, Math.min(max, _quantity + delta));
  updateQtyDisplay();
  if (zone) updateCtaBar(zone);
}

function updateQtyDisplay() {
  const el = $('.qty-value');
  if (el) el.textContent = _quantity;

  const minus = $('.qty-btn-minus');
  const plus = $('.qty-btn-plus');
  const zone = _eventDetail?.zones.find(z => z.zoneNo === _selectedZoneNo);
  const max = zone ? Math.min(4, zone.remainingCapacity) : 4;

  if (minus) minus.disabled = _quantity <= 1;
  if (plus) plus.disabled = _quantity >= max;
}

/* ═══════════════════════════════════════════════════════════
   Chart.js — 예매자 현황 통계 차트
═══════════════════════════════════════════════════════════ */
function initStatsCharts(stats) {
  if (!window.Chart || !stats) return;

  const chartDefaults = {
    plugins: { legend: { display: false } },
    animation: { duration: 800, easing: 'easeInOutQuart' },
  };

  // 성별 도넛 차트
  const genderCtx = document.getElementById('chart-gender');
  if (genderCtx) {
    new Chart(genderCtx, {
      type: 'doughnut',
      data: {
        labels: ['남성', '여성'],
        datasets: [{
          data: [stats.genderMale, stats.genderFemale],
          backgroundColor: ['rgba(106,77,255,0.8)', 'rgba(255,59,110,0.8)'],
          borderColor: ['#6A4DFF', '#FF3B6E'],
          borderWidth: 2,
          hoverOffset: 4,
        }],
      },
      options: {
        ...chartDefaults,
        cutout: '65%',
        plugins: {
          legend: { display: true, position: 'bottom', labels: { color: '#9090B8', font: { size: 11, family: 'Pretendard Variable' }, padding: 10, boxWidth: 10, boxHeight: 10 } },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.label}: ${ctx.parsed}%`,
            },
          },
        },
      },
    });
  }

  // 연령대 바 차트
  const ageCtx = document.getElementById('chart-age');
  if (ageCtx) {
    new Chart(ageCtx, {
      type: 'bar',
      data: {
        labels: ['10대', '20대', '30대', '40대', '50대+'],
        datasets: [{
          label: '예매 비율',
          data: [stats.age10s, stats.age20s, stats.age30s, stats.age40s, stats.age50s],
          backgroundColor: [
            'rgba(0,229,204,0.7)', 'rgba(106,77,255,0.7)', 'rgba(255,59,110,0.7)',
            'rgba(255,184,0,0.7)', 'rgba(59,130,246,0.7)',
          ],
          borderColor: ['#00E5CC', '#6A4DFF', '#FF3B6E', '#FFB800', '#3B82F6'],
          borderWidth: 1,
          borderRadius: 4,
        }],
      },
      options: {
        ...chartDefaults,
        indexAxis: 'x',
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9090B8', font: { size: 10, family: 'Pretendard Variable' } } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9090B8', font: { size: 10, family: 'Pretendard Variable' }, callback: v => `${v}%` } },
        },
        plugins: {
          ...chartDefaults.plugins,
          tooltip: {
            callbacks: { label: ctx => ` ${ctx.parsed.y}%` },
          },
        },
      },
    });
  }
}

/* ═══════════════════════════════════════════════════════════
   대기열 시뮬레이션
═══════════════════════════════════════════════════════════ */
function startQueueSimulation() {
  _queueCount = Math.floor(Math.random() * 400) + 150;
  const totalEntry = _queueCount;
  const myEntry = Math.floor(Math.random() * 80) + 10;
  let elapsed = 0;
  const totalWait = 30;   // seconds (시뮬레이션 총 시간)

  const countEl = $('.queue-count');
  const progFill = $('.queue-progress-fill');
  const progPct = $('.queue-progress-pct');
  const waitEl = $('.queue-estimated-time');
  const myNumEl = $('.queue-my-number');

  if (myNumEl) myNumEl.textContent = myEntry;

  _queueTimer = setInterval(() => {
    elapsed++;
    const progress = Math.min(100, Math.round(elapsed / totalWait * 100));
    const decrease = Math.floor((totalEntry - myEntry) * (elapsed / totalWait));
    const current = Math.max(myEntry, totalEntry - decrease);
    const remaining = Math.max(0, current - myEntry);
    const waitMin = Math.max(0, Math.ceil((remaining * 3) / 60));

    if (countEl) countEl.innerHTML = `${remaining.toLocaleString()}<span>명 앞</span>`;
    if (progFill) progFill.style.width = `${progress}%`;
    if (progPct) progPct.textContent = `${progress}%`;
    if (waitEl) waitEl.textContent = waitMin > 0
      ? `예상 대기 시간: 약 ${waitMin}분`
      : `잠시 후 입장됩니다...`;

    if (elapsed >= totalWait) {
      clearInterval(_queueTimer);
      enterPaymentModal();
    }
  }, 1000);
}

function cancelQueue() {
  clearInterval(_queueTimer);
  Modal.close('modal-queue');
}

/* ═══════════════════════════════════════════════════════════
   Toss Payments v1 Sandbox 결제 연동
   SDK: https://js.tosspayments.com/v1/payment
   Test Client Key: test_ck_D5GePWvyJnrK0W0k6q8gLzN97Emo
═══════════════════════════════════════════════════════════ */
async function initiateTossPayment() {
  if (!window.TossPayments) {
    Toast.error('결제 모듈을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');
    return;
  }

  const zone = _eventDetail?.zones.find(z => z.zoneNo === _selectedZoneNo);
  if (!zone) { Toast.warning('구역을 선택해 주세요.'); return; }

  const user = Auth.get();
  if (!user) { Toast.warning('로그인이 필요합니다.'); return; }

  // 1. 서버에 주문 생성 → orderNo & orderUid 발급
  const orderPayload = {
    eventNo: _eventDetail.eventNo,
    zoneNo: zone.zoneNo,
    quantity: _quantity,
    couponNo: _appliedCoupon?.couponNo || null,
  };

  Modal.close('modal-payment');
  Toast.info('주문을 생성하는 중...');

  const orderRes = await orderApi.createOrder(orderPayload);
  if (!orderRes) { Toast.error('주문 생성에 실패했습니다.'); return; }

  _orderNo = orderRes.orderNo;
  _orderUid = orderRes.orderUid;

  const gross = zone.price * _quantity;
  const discount = _appliedCoupon?.discountAmount || 0;
  const amount = gross - discount;

  // FESTIO Pay 결제 시뮬레이션
  if (_selectedPayMethod === 'festiopay') {
    const balEl = $('#festiopay-balance');
    let balance = parseInt(balEl ? balEl.textContent.replace(/[^0-9]/g, '') : 0);
    if (balance < amount) {
      Toast.warning('잔액이 부족합니다. 충전 후 다시 시도해주세요.');
      return;
    }
    // 결제 성공 처리
    Toast.success('FESTIO Pay로 결제되었습니다.');
    Modal.closeAll();
    showBookingSuccess();
    return;
  }

  // 2. Toss Payments 결제 요청
  try {
    const tossPayments = TossPayments(TOSS_CLIENT_KEY);

    const methodMap = {
      card: '카드',
      virtual: '가상계좌',
    };

    await tossPayments.requestPayment(methodMap[_selectedPayMethod] || '카드', {
      amount,
      orderId: _orderUid,
      orderName: `${_eventDetail.eventName} - ${zone.zoneName} x${_quantity}`,
      customerName: user.name,
      successUrl: `${window.location.origin}/payment-success.html?orderNo=${_orderNo}`,
      failUrl: `${window.location.origin}/payment-fail.html?orderNo=${_orderNo}`,
    });

  } catch (err) {
    if (err.code === 'USER_CANCEL') {
      Toast.info('결제를 취소했습니다.');
    } else {
      console.error('[Toss Payments Error]', err);
      Toast.error(`결제 오류: ${err.message}`);
    }
  }
}

/**
 * 결제 성공 콜백 처리 (payment-success.html에서 호출하거나
 * successUrl redirect 후 이 페이지에서 확인)
 */
async function handlePaymentSuccess(paymentKey, orderId) {
  const confirmRes = await orderApi.confirmPayment(_orderNo, {
    pgProvider: 'toss',
    pgTid: paymentKey,
    orderUid: orderId,
  });

  if (confirmRes?.success) {
    Modal.closeAll();
    showBookingSuccess();
    Toast.success('예매가 완료되었습니다!', 5000);
  } else {
    Toast.error('결제 확인 중 오류가 발생했습니다. 고객센터로 문의해 주세요.');
  }
}

function showBookingSuccess() {
  const main = $('main');
  if (!main) return;
  const successEl = document.createElement('div');
  successEl.className = 'booking-success';
  const zone = _eventDetail?.zones.find(z => z.zoneNo === _selectedZoneNo);
  successEl.innerHTML = `
    <div class="booking-success-icon">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
    </div>
    <h2 class="booking-success-title">예매 완료!</h2>
    <p class="booking-success-desc">
      ${_eventDetail?.eventName}<br>
      ${zone?.zoneName || ''} · ${_quantity}매<br>
      마이페이지에서 QR 티켓을 확인하세요.
    </p>
    <a href="mypage.html" class="btn btn-primary btn-full">QR 티켓 확인하기</a>`;
  main.appendChild(successEl);
  successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ═══════════════════════════════════════════════════════════
   결제 모달 진입
═══════════════════════════════════════════════════════════ */
function enterPaymentModal() {
  Modal.close('modal-queue');
  const zone = _eventDetail?.zones.find(z => z.zoneNo === _selectedZoneNo);
  if (!zone) return;

  updatePaymentSummary(zone);
  Modal.open('modal-payment');
}

function updatePaymentSummary(zone) {
  const gross = zone.price * _quantity;
  const discount = _appliedCoupon?.discountAmount || 0;
  const net = gross - discount;

  const rows = {
    '[data-payment="event-name"]': _eventDetail?.eventName || '',
    '[data-payment="zone"]': `${zone.zoneName} × ${_quantity}매`,
    '[data-payment="subtotal"]': formatKRW(gross),
    '[data-payment="discount"]': discount > 0 ? `-${formatKRW(discount)}` : '-',
    '[data-payment="total"]': formatKRW(net),
  };

  Object.entries(rows).forEach(([sel, val]) => {
    const el = $(sel);
    if (el) el.textContent = val;
  });
}

/* ═══════════════════════════════════════════════════════════
   예매 버튼 클릭 → 대기열 진입
═══════════════════════════════════════════════════════════ */
function initBookingBtn() {
  on($('#btn-book'), 'click', () => {
    if (!_selectedZoneNo) {
      Toast.warning('구역을 먼저 선택해 주세요.');
      return;
    }
    Modal.open('modal-queue');
    startQueueSimulation();
  });

  on($('#btn-cancel-queue'), 'click', () => {
    cancelQueue();
  });

  on($('#btn-pay'), 'click', () => {
    initiateTossPayment();
  });

  on($('#btn-payment-cancel'), 'click', () => {
    Modal.close('modal-payment');
  });
}

/* ─── 결제 방법 선택 ─────────────────────────────────────────── */
function initPaymentMethodSelect() {
  on(document, 'click', (e) => {
    const option = e.target.closest('.pay-method-btn');
    if (!option) return;
    $$('.pay-method-btn').forEach(o => o.classList.remove('selected'));
    option.classList.add('selected');
    _selectedPayMethod = option.dataset.method || 'card';

    const festioArea = $('#festiopay-area');
    if (festioArea) {
      if (_selectedPayMethod === 'festiopay') {
        festioArea.classList.remove('hidden');
        // 임시 잔액 표시
        const balEl = $('#festiopay-balance');
        if (balEl) balEl.textContent = formatKRW(50000); // 5만 원 임시 설정
      } else {
        festioArea.classList.add('hidden');
      }
    }
  });

  on($('#btn-charge-festiopay'), 'click', () => {
    Toast.success('50,000 포인트가 충전되었습니다.');
    const balEl = $('#festiopay-balance');
    if (balEl) balEl.textContent = formatKRW(100000); // 잔액 증가 시뮬레이션
  });
}

/* ─── 쿠폰 적용 ─────────────────────────────────────────────── */
function initCouponApply() {
  on($('#btn-apply-coupon'), 'click', async () => {
    const input = $('#coupon-input');
    const code = input?.value?.trim();
    if (!code) { Toast.warning('쿠폰 코드를 입력해 주세요.'); return; }

    const zone = _eventDetail?.zones.find(z => z.zoneNo === _selectedZoneNo);
    if (!zone) return;

    // 단순 시뮬레이션 로직 (입력값이 'FESTIO2026'이면 10% 할인)
    let discountAmount = 0;
    const gross = zone.price * _quantity;
    if (code === 'FESTIO2026') {
      discountAmount = Math.floor(gross * 0.1); // 10% 할인
    } else {
      Toast.warning('유효하지 않은 쿠폰 코드입니다.');
      return;
    }

    _appliedCoupon = { couponNo: code, discountAmount: discountAmount };

    const appliedBox = $('#coupon-applied-info');
    const applyRow = $('#coupon-apply-row');
    if (appliedBox) {
      appliedBox.classList.remove('hidden');
      const amountEl = appliedBox.querySelector('.coupon-applied-amt');
      if (amountEl) amountEl.textContent = `-${formatKRW(discountAmount)}`;
    }
    if (applyRow) applyRow.classList.add('hidden');

    updatePaymentSummary(zone);
    Toast.success('쿠폰이 적용되었습니다.');
  });

  on($('#btn-remove-coupon'), 'click', () => {
    _appliedCoupon = null;
    const appliedBox = $('#coupon-applied-info');
    const applyRow = $('#coupon-apply-row');
    if (appliedBox) appliedBox.classList.add('hidden');
    if (applyRow) applyRow.classList.remove('hidden');
    const input = $('#coupon-input');
    if (input) input.value = '';

    const zone = _eventDetail?.zones.find(z => z.zoneNo === _selectedZoneNo);
    if (zone) updatePaymentSummary(zone);
    Toast.info('쿠폰이 제거되었습니다.');
  });
}

/* ─── 쿠폰 select 옵션 로드 ─────────────────────────────────── */
async function loadCouponsForPayment() {
  const select = $('#coupon-select');
  if (!select) return;
  const coupons = await couponApi.getMyCoupons();
  const valid = (coupons || []).filter(c => !c.isUsed);
  if (!valid.length) {
    select.innerHTML = '<option value="">사용 가능한 쿠폰이 없습니다</option>';
    return;
  }
  select.innerHTML = `<option value="">쿠폰 선택</option>` + valid.map(c =>
    `<option value="${c.couponNo}">${c.couponName} (${c.discountType === 'PERCENT' ? `${c.discountValue}%` : formatKRW(c.discountValue)} 할인)</option>`
  ).join('');
}

/* ═══════════════════════════════════════════════════════════
   URL 파라미터 확인 — Toss 결제 성공 콜백
   successUrl redirect 시 ?paymentKey=...&orderId=...&amount=...
═══════════════════════════════════════════════════════════ */
function checkPaymentCallback() {
  const params = new URLSearchParams(window.location.search);
  const paymentKey = params.get('paymentKey');
  const orderId = params.get('orderId');
  if (paymentKey && orderId) {
    handlePaymentSuccess(paymentKey, orderId);
    // URL 파라미터 제거
    window.history.replaceState({}, '', window.location.pathname + `?eventNo=${getEventNo()}`);
  }
}

/* ═══════════════════════════════════════════════════════════
   DOMContentLoaded — 진입점
═══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  checkPaymentCallback();

  const eventNo = getEventNo();
  const detail = await eventApi.getEventDetail(eventNo);
  if (!detail) {
    Toast.error('행사 정보를 불러올 수 없습니다.');
    return;
  }

  // 사용자 편집 데이터 불러오기 (localStorage)
  const savedTabs = localStorage.getItem(`festio_event_${eventNo}_tabs`);
  if (savedTabs) {
    const tabsSection = document.getElementById('detailTabsSection');
    if (tabsSection) {
      tabsSection.innerHTML = savedTabs;
    }
  }

  // 추가 데이터 동기 로드
  detail.zones = await eventApi.getZoneCapacity(eventNo);
  detail.stats = await eventApi.getEventStats(eventNo);

  _eventDetail = detail;

  renderEventDetail(detail);
  initVenueMap(detail.zones);
  initQtySelector();
  initStatsCharts(detail.stats);
  initBookingBtn();
  initPaymentMethodSelect();
  initCouponApply();
  loadCouponsForPayment();

  // 탭 클릭 이벤트 로직 (편집 모드가 아닐 때 탭 전환 및 스크롤)
  const tabsHeader = document.querySelector('.detail-tabs-header');
  if (tabsHeader) {
    tabsHeader.addEventListener('click', (e) => {
      const btn = e.target.closest('.detail-tab-btn');
      if (!btn) return;

      let targetId = btn.dataset.target;
      if (!targetId && btn.dataset.tab) {
        targetId = 'tab-' + btn.dataset.tab;
      }
      if (!targetId) return;

      document.querySelectorAll('.detail-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.detail-tab-content').forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetContent = document.getElementById(targetId);
      if (targetContent) {
        targetContent.classList.add('active');
        if (!isEditMode) {
          const offsetTop = targetContent.getBoundingClientRect().top + window.scrollY - 140;
          window.scrollTo({ top: offsetTop, behavior: 'smooth' });
        }
      }
    });
  }

  // 위시리스트 버튼
  on($('#btn-wish-detail'), 'click', async (e) => {
    if (typeof Auth !== 'undefined' && !Auth.isLoggedIn()) {
      Toast.info('로그인이 필요합니다.');
      setTimeout(() => { window.location.href = 'login.html'; }, 1000);
      return;
    }
    const btn = e.currentTarget;
    const isWished = btn.dataset.wished === 'true';
    await wishlistApi.toggleWishlist(detail.eventNo, isWished);
    const newWished = !isWished;
    btn.dataset.wished = String(newWished);
    btn.classList.toggle('active', newWished);
    const icon = btn.querySelector('.icon');
    if (icon) icon.setAttribute('fill', newWished ? 'currentColor' : 'none');
    Toast.show(newWished ? '찜 목록에 추가했습니다.' : '찜 목록에서 제거했습니다.', newWished ? 'success' : 'info');
  });
});


/* ═══════════════════════════════════════════════════════════
   편집 모드 (Edit Mode)
═══════════════════════════════════════════════════════════ */
let isEditMode = false;
const quillEditors = {};

function toggleEditMode(enable) {
  isEditMode = enable;
  const detailTabsSection = document.getElementById('detailTabsSection');
  const body = document.body;
  const editBadge = document.getElementById('editBadge');
  const btnSave = document.getElementById('btnSaveAllEdits');

  if (enable) {
    body.classList.add('edit-mode');
    if (editBadge) editBadge.style.display = 'inline-flex';
    if (btnSave) btnSave.style.display = 'inline-flex';

    if (!document.querySelector('.builder-tabs-wrapper')) {
      const wrapper = document.createElement('div');
      wrapper.className = 'builder-tabs-wrapper edit-builder-layout';
      detailTabsSection.parentNode.insertBefore(wrapper, detailTabsSection);
      wrapper.appendChild(detailTabsSection);

      const builderSidebar = document.createElement('aside');
      builderSidebar.className = 'builder-sidebar';
      builderSidebar.id = 'builderSidebar';
      wrapper.insertBefore(builderSidebar, detailTabsSection);

      initBuilderSidebar(builderSidebar, detailTabsSection);
      initMainAreaEditors(detailTabsSection);
    } else {
      document.querySelector('.builder-tabs-wrapper').classList.add('edit-builder-layout');
    }
  } else {
    body.classList.remove('edit-mode');
    if (editBadge) editBadge.style.display = 'none';
    if (btnSave) btnSave.style.display = 'none';
    const wrapper = document.querySelector('.builder-tabs-wrapper');
    if (wrapper) {
      wrapper.classList.remove('edit-builder-layout');
    }
    // 에디터 비활성화 및 내용 반영
    destroyMainAreaEditors(detailTabsSection);
  }
}

function destroyMainAreaEditors(tabsSection) {
  const tabs = tabsSection.querySelectorAll('.detail-tab-content');
  tabs.forEach(tab => {
    const inner = tab.querySelector('.tab-content-inner');
    if (!inner) return;

    if (tab.id === 'tab-venue') {
      inner.contentEditable = false;
      inner.style.border = 'none';
      inner.style.padding = '0';
      return;
    }

    // Quill 에디터 정리
    const quillWrap = inner.querySelector('.quill-main-editor');
    if (quillWrap) {
      const html = quillWrap.querySelector('.ql-editor') ? quillWrap.querySelector('.ql-editor').innerHTML : quillWrap.innerHTML;
      inner.innerHTML = html;
      delete quillEditors[tab.id];
    }

    // 갤러리 에디터 정리 (업로드된 이미지만 남기고 UI 제거)
    const galleryWrap = inner.querySelector('.gallery-main-editor');
    if (galleryWrap) {
      const previewArea = galleryWrap.querySelector('.gallery-preview');
      const images = previewArea ? Array.from(previewArea.querySelectorAll('img')).map(img => img.src) : [];
      inner.innerHTML = '';
      if (images.length > 0) {
        const sliderHtml = images.map(src => `<div style="margin-bottom:10px;"><img src="${src}" style="width:100%; border-radius:8px;"></div>`).join('');
        inner.innerHTML = `<div class="gallery-view-mode">${sliderHtml}</div>`;
      }
    }
  });
}

function initBuilderSidebar(sidebar, tabsSection) {
  sidebar.innerHTML = `
    <div class="builder-sidebar-header" style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1rem;">
      <div>
        <h3 style="margin:0; font-size:1.1rem;">섹션 구성</h3>
        <p style="font-size:0.75rem; color:var(--text-muted); margin:0.5rem 0 0 0;">드래그하여 순서를 변경하거나 섹션을 관리하세요.</p>
      </div>
      <div style="display:flex; gap:0.5rem; align-items:center;">
        <button class="btn btn-outline btn-sm" id="btnResetLayout" style="border-radius:20px; padding: 0.3rem 0.8rem; font-size:0.8rem;">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-right:2px;"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg> 초기화
        </button>
        <button class="btn btn-primary btn-sm" id="btnAddSectionTop" style="border-radius:50%; width:28px; height:28px; padding:0; display:flex; align-items:center; justify-content:center;">+</button>
      </div>
    </div>
    <div class="builder-accordion-list" id="builderAccordionList"></div>
    <div class="builder-sidebar-footer">
      <button class="btn btn-outline btn-full" id="btnAddSection" style="border-style:dashed;">+ 새 섹션 추가</button>
    </div>
  `;

  const listWrap = sidebar.querySelector('#builderAccordionList');
  const tabs = tabsSection.querySelectorAll('.detail-tab-content');
  const tabBtns = document.querySelectorAll('.detail-tab-btn');

  tabs.forEach((tab, index) => {
    const targetId = tab.id;
    const tabId = targetId.replace('tab-', '');
    const btn = Array.from(tabBtns).find(b => b.dataset.tab === tabId || b.dataset.target === targetId);
    const title = btn ? btn.textContent.trim() : '새 섹션';
    addAccordionItem(listWrap, title, targetId, index);
  });

  if (typeof Sortable !== 'undefined') {
    Sortable.create(listWrap, {
      handle: '.drag-handle',
      animation: 150,
      onEnd: function (evt) {
        syncTabsOrder(listWrap, tabsSection);
      }
    });
  }

  sidebar.querySelector('#btnAddSection').addEventListener('click', handleAddSection);
  sidebar.querySelector('#btnAddSectionTop').addEventListener('click', handleAddSection);
}

function addAccordionItem(listWrap, title, id, index) {
  const bodyHtml = `
    <div class="section-editor-notice" style="margin-bottom: 1rem;">
      <p style="font-size:0.85rem; color:var(--text-muted);">기본 텍스트 에디터 섹션입니다. 우측 메인 화면에서 내용을 편집하세요.</p>
    </div>
    <div class="gallery-settings-wrap" style="padding-top: 1rem; border-top: 1px solid var(--border-default);">
      <div style="margin-bottom: 1.2rem;">
        <p style="font-size:0.85rem; font-weight:600; margin-bottom:0.6rem; color:var(--text-main);">갤러리 타입</p>
        <div style="position: relative;">
          <select class="form-select gallery-layout-select" style="width:100%; font-size:0.9rem; padding:0.6rem; border:1px solid var(--border-default); border-radius:8px; appearance:none; background:#fff; outline:none;">
            <option value="slider">Slider (슬라이더)</option>
            <option value="grid">Grid (바둑판)</option>
            <option value="polaroid">Polaroid (폴라로이드)</option>
            <option value="carousel">Carousel (캐러셀)</option>
          </select>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); width:16px; height:16px; pointer-events:none; color:var(--text-muted);"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>
      </div>
      <div>
        <p style="font-size:0.85rem; font-weight:600; margin-bottom:0.6rem; color:var(--text-main);">이미지</p>
        <input type="file" class="gallery-upload-input" accept="image/*" multiple style="display:none;" id="file-upload-${id}">
        <label for="file-upload-${id}" class="image-upload-box" style="display:block; border:1px dashed var(--border-default); border-radius:12px; padding:2.5rem 1rem; text-align:center; background:#fbfbfb; cursor:pointer; margin-bottom:1rem; transition:background 0.2s;">
          <div style="width:44px; height:44px; border-radius:50%; border:1px solid var(--border-default); display:flex; align-items:center; justify-content:center; margin:0 auto 0.8rem; background:#fff; box-shadow:0 2px 6px rgba(0,0,0,0.03);">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" fill="none"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </div>
          <p style="font-size:0.85rem; color:var(--text-muted); font-weight:600;">이미지 선택</p>
        </label>
        <div class="uploaded-image-grid" style="display:flex; overflow-x:auto; gap:0.6rem; padding-bottom: 0.5rem; flex-wrap:nowrap;">
          <!-- 첨부된 썸네일 이미지가 여기에 동적으로 추가됩니다 -->
        </div>
      </div>
    </div>
  `;

  const item = document.createElement('div');
  item.className = 'builder-accordion-item';
  item.dataset.targetId = id;
  item.innerHTML = `
    <div class="builder-accordion-header">
      <div class="builder-accordion-title">
        <span class="drag-handle" title="드래그하여 순서 변경">☰</span>
        <span class="accordion-index">${index}</span>
        <span class="accordion-name" contenteditable="true">${title}</span>
      </div>
      <div style="display:flex; gap:0.5rem;">
        <button class="btn-delete-section" title="삭제"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
        <span class="accordion-toggle">▼</span>
      </div>
    </div>
    <div class="builder-accordion-body">
      ${bodyHtml}
    </div>
  `;
  listWrap.appendChild(item);

  const header = item.querySelector('.builder-accordion-header');
  header.addEventListener('click', (e) => {
    if (e.target.closest('.drag-handle') || e.target.closest('.btn-delete-section') || e.target.hasAttribute('contenteditable')) return;

    const isActive = item.classList.contains('active');
    listWrap.querySelectorAll('.builder-accordion-item').forEach(i => i.classList.remove('active'));

    if (!isActive) {
      item.classList.add('active');
      const targetId = item.dataset.targetId;
      const targetTab = document.getElementById(targetId);
      if (targetTab) {
        document.querySelectorAll('.detail-tab-content').forEach(t => t.classList.remove('active'));
        targetTab.classList.add('active');
      }
      const tabId = targetId.replace('tab-', '');
      document.querySelectorAll('.detail-tab-btn').forEach(b => b.classList.remove('active'));
      const tabBtn = document.querySelector(`.detail-tab-btn[data-tab="${tabId}"], .detail-tab-btn[data-target="${targetId}"]`);
      if (tabBtn) tabBtn.classList.add('active');
    }
  });

  const nameEl = item.querySelector('.accordion-name');
  nameEl.addEventListener('input', () => {
    const targetId = item.dataset.targetId;
    const targetTab = document.getElementById(targetId);
    if (targetTab) {
      const h2 = targetTab.querySelector('.tab-title');
      if (h2) h2.textContent = nameEl.textContent;
    }
    const tabId = targetId.replace('tab-', '');
    const tabBtn = document.querySelector(`.detail-tab-btn[data-tab="${tabId}"], .detail-tab-btn[data-target="${targetId}"]`);
    if (tabBtn) tabBtn.textContent = nameEl.textContent;
  });

  item.querySelector('.btn-delete-section').addEventListener('click', () => {
    if (confirm('이 섹션을 삭제하시겠습니까?')) {
      const targetId = item.dataset.targetId;
      const targetTab = document.getElementById(targetId);
      if (targetTab) targetTab.remove();

      const tabId = targetId.replace('tab-', '');
      const tabBtn = document.querySelector(`.detail-tab-btn[data-tab="${tabId}"], .detail-tab-btn[data-target="${targetId}"]`);
      if (tabBtn) tabBtn.remove();

      item.remove();
      syncTabsOrder(listWrap, document.getElementById('detailTabsSection'));
    }
  });

  // 파일 업로드 처리
  const fileInput = item.querySelector('.gallery-upload-input');
  const previewGrid = item.querySelector('.uploaded-image-grid');
  if (fileInput && previewGrid) {
    fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const imgItem = document.createElement('div');
          imgItem.className = 'uploaded-image-item';
          imgItem.style.cssText = 'position:relative; flex-shrink:0; width:100px; height:100px; border-radius:10px; overflow:hidden; box-shadow:0 2px 6px rgba(0,0,0,0.06);';
          imgItem.innerHTML = `
            <img src="${ev.target.result}" style="width:100%; height:100%; object-fit:cover;">
            <button class="btn-delete-image" style="position:absolute; top:6px; right:6px; width:24px; height:24px; background:transparent; color:#fff; border-radius:4px; border:none; display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.3); text-shadow:0 1px 2px rgba(0,0,0,0.5);">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          `;

          imgItem.querySelector('.btn-delete-image').addEventListener('click', () => {
            imgItem.remove();
            updateGalleryPreview(id); // 이미지 삭제 시 메인 화면 즉시 업데이트
          });

          previewGrid.appendChild(imgItem);
        };
        reader.readAsDataURL(file);
      });

      // 파일 읽기가 비동기이므로, 약간의 지연 후 메인 화면 업데이트
      setTimeout(() => updateGalleryPreview(id), 100);
      fileInput.value = ''; // 같은 파일 다시 선택 가능하도록 초기화
    });
  }

  // 갤러리 타입 변경 시 업데이트
  const layoutSelect = item.querySelector('.gallery-layout-select');
  if (layoutSelect) {
    layoutSelect.addEventListener('change', () => {
      updateGalleryPreview(id);
    });
  }
}

function syncTabsOrder(listWrap, tabsSection) {
  const items = listWrap.querySelectorAll('.builder-accordion-item');
  const tabsHeader = document.querySelector('.detail-tabs-header');
  items.forEach((it, idx) => {
    it.querySelector('.accordion-index').textContent = idx;
    const targetId = it.dataset.targetId;
    const tabContent = document.getElementById(targetId);
    if (tabContent) {
      tabsSection.appendChild(tabContent);
    }
    if (tabsHeader) {
      const tabId = targetId.replace('tab-', '');
      const tabBtn = document.querySelector(`.detail-tab-btn[data-tab="${tabId}"], .detail-tab-btn[data-target="${targetId}"]`);
      if (tabBtn) tabsHeader.appendChild(tabBtn);
    }
  });
}

function updateGalleryPreview(targetId) {
  const accordionItem = document.querySelector(`.builder-accordion-item[data-target-id="${targetId}"]`);
  const targetTab = document.getElementById(targetId);
  if (!accordionItem || !targetTab) return;

  const inner = targetTab.querySelector('.tab-content-inner');
  if (!inner) return;

  const layout = accordionItem.querySelector('.gallery-layout-select')?.value || 'grid';
  const imgElements = accordionItem.querySelectorAll('.uploaded-image-grid img');
  const images = Array.from(imgElements).map(img => img.src);

  if (images.length === 0) {
    inner.innerHTML = '<div style="padding:3rem; text-align:center; color:var(--text-muted); background:var(--bg-surface1); border-radius:12px; border:1px dashed var(--border-default);">등록된 이미지가 없습니다. 좌측에서 이미지를 첨부해주세요.</div>';
    return;
  }

  let html = '';
  if (layout === 'grid') {
    html = '<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:1rem;">';
    images.forEach(src => {
      html += `<div style="aspect-ratio:1; border-radius:12px; overflow:hidden;"><img src="${src}" style="width:100%; height:100%; object-fit:cover;"></div>`;
    });
    html += '</div>';
  } else if (layout === 'slider') {
    html = '<div style="display:flex; overflow-x:auto; gap:1rem; padding-bottom:1rem; scroll-snap-type:x mandatory;">';
    images.forEach(src => {
      html += `<div style="flex:0 0 80%; scroll-snap-align:center; border-radius:12px; overflow:hidden;"><img src="${src}" style="width:100%; height:auto; object-fit:contain; max-height:400px; background:#f0f0f0;"></div>`;
    });
    html += '</div>';
  } else if (layout === 'polaroid') {
    html = '<div style="display:flex; flex-wrap:wrap; gap:1.5rem; justify-content:center;">';
    images.forEach(src => {
      html += `
        <div style="background:#fff; padding:10px 10px 30px; box-shadow:0 4px 12px rgba(0,0,0,0.1); border-radius:4px; width:220px; transform:rotate(${Math.floor(Math.random() * 10 - 5)}deg);">
          <img src="${src}" style="width:100%; aspect-ratio:1; object-fit:cover; border:1px solid #eee;">
        </div>
      `;
    });
    html += '</div>';
  } else if (layout === 'carousel') {
    html = '<div style="display:flex; flex-direction:column; gap:1rem; align-items:center;">';
    images.forEach(src => {
      html += `<div style="width:100%; max-width:600px; border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.1);"><img src="${src}" style="width:100%; height:auto; object-fit:contain; display:block;"></div>`;
    });
    html += '</div>';
  }

  inner.innerHTML = html;
}

const quillToolbarOptions = [
  [{ 'font': [] }, { 'size': [] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ 'color': [] }, { 'background': [] }],
  [{ 'script': 'sub' }, { 'script': 'super' }],
  [{ 'header': 1 }, { 'header': 2 }, 'blockquote', 'code-block'],
  [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'indent': '-1' }, { 'indent': '+1' }],
  [{ 'direction': 'rtl' }, { 'align': [] }],
  ['link', 'image', 'video'],
  ['clean']
];

function initMainAreaEditors(tabsSection) {
  const tabs = tabsSection.querySelectorAll('.detail-tab-content');
  tabs.forEach(tab => {
    const inner = tab.querySelector('.tab-content-inner');
    if (!inner) return;

    if (tab.id === 'tab-venue') {
      inner.contentEditable = true;
      inner.style.border = '1px dashed var(--border-default)';
      inner.style.padding = '10px';
      return;
    }

    if (inner.querySelector('.quill-main-editor') || inner.querySelector('.gallery-main-editor')) return;

    const title = tab.querySelector('.tab-title')?.textContent || '';
    if (title.includes('갤러리') || tab.id.includes('gallery')) {
      makeGalleryEditor(tab, inner);
    } else {
      makeTextEditor(tab, inner);
    }
  });
}

function makeTextEditor(tab, inner) {
  const html = inner.innerHTML;
  inner.innerHTML = '';

  const editorWrap = document.createElement('div');
  editorWrap.className = 'quill-main-editor';
  editorWrap.style.minHeight = '300px';
  editorWrap.style.marginTop = '1rem';
  editorWrap.innerHTML = html;

  inner.appendChild(editorWrap);

  if (typeof Quill !== 'undefined') {
    const quill = new Quill(editorWrap, {
      theme: 'snow',
      modules: { toolbar: quillToolbarOptions }
    });
    quillEditors[tab.id] = quill;
  }
}

function makeGalleryEditor(tab, inner) {
  // 메인 화면에서는 사이드바에서 설정한 갤러리 프리뷰만 렌더링합니다.
  inner.innerHTML = '';
  // 초기 렌더링 시점에 즉시 프리뷰 업데이트 호출
  updateGalleryPreview(tab.id);
}

function handleAddSection() {
  const title = '새 섹션';
  const sectionType = 'text';

  const newId = 'tab-custom-' + Date.now();
  const tabsSection = document.getElementById('detailTabsSection');

  const tabsHeader = document.querySelector('.detail-tabs-header');
  if (tabsHeader) {
    const newBtn = document.createElement('button');
    newBtn.className = 'detail-tab-btn';
    newBtn.dataset.target = newId;
    newBtn.textContent = title;
    tabsHeader.appendChild(newBtn);

    newBtn.addEventListener('click', () => {
      document.querySelectorAll('.detail-tab-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.detail-tab-content').forEach(content => content.classList.remove('active'));
      newBtn.classList.add('active');
      const targetContent = document.getElementById(newId);
      if (targetContent) targetContent.classList.add('active');
    });
  }

  const newContent = document.createElement('div');
  newContent.className = 'detail-tab-content';
  newContent.id = newId;
  newContent.innerHTML = `
    <h2 class="tab-title">${title}</h2>
    <div class="tab-content-inner"></div>
  `;
  tabsSection.appendChild(newContent);

  const inner = newContent.querySelector('.tab-content-inner');
  inner.innerHTML = '<p>내용을 입력하세요.</p>';
  makeTextEditor(newContent, inner);

  const listWrap = document.getElementById('builderAccordionList');
  const items = listWrap.querySelectorAll('.builder-accordion-item');
  addAccordionItem(listWrap, title, newId, items.length);

  const newItem = listWrap.lastElementChild;
  newItem.querySelector('.builder-accordion-header').click();
}

document.addEventListener('DOMContentLoaded', () => {
  // 관리자 권한 확인 (여기서는 데모용으로 항상 표시)
  const globalEdit = document.getElementById('globalEditControls');
  if (globalEdit) {
    globalEdit.style.display = 'flex';
  }

  const switchBtn = document.getElementById('btnToggleEditModeSwitch');
  if (switchBtn) {
    switchBtn.addEventListener('change', (e) => {
      toggleEditMode(e.target.checked);
    });
  }

  const btnSave = document.getElementById('btnSaveAllEdits');
  if (btnSave) {
    btnSave.addEventListener('click', () => {
      const tabsSection = document.getElementById('detailTabsSection');
      if (!tabsSection) return;

      // 현재 에디터 상태를 HTML에 반영 (비활성화)
      const wasEditMode = isEditMode;
      if (wasEditMode) {
        destroyMainAreaEditors(tabsSection);
      }

      // 저장
      localStorage.setItem(`festio_event_${getEventNo()}_tabs`, tabsSection.innerHTML);
      Toast.success('이벤트 상세 내용이 저장되었습니다.');

      // 편집 모드였다면 에디터 다시 활성화
      if (wasEditMode) {
        initMainAreaEditors(tabsSection);
      }
    });
  }

  // 커스텀 권종 선택 드롭다운 로직
  const ticketDropdown = document.getElementById('ticketTypeDropdown');
  const ticketSelected = document.getElementById('ticketTypeSelected');
  const ticketOptions = document.getElementById('ticketTypeOptions');
  const ticketText = document.getElementById('ticketTypeText');
  const nativeSelect = document.getElementById('ticketTypeSelect');

  if (ticketDropdown && ticketSelected && ticketOptions && nativeSelect) {
    ticketSelected.addEventListener('click', () => {
      ticketDropdown.classList.toggle('open');
    });

    const options = ticketOptions.querySelectorAll('.custom-dropdown-option');
    options.forEach(opt => {
      opt.addEventListener('click', () => {
        ticketText.textContent = opt.textContent;
        options.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        nativeSelect.value = opt.getAttribute('data-value');
        ticketDropdown.classList.remove('open');
      });
    });

    document.addEventListener('click', (e) => {
      if (!ticketDropdown.contains(e.target)) {
        ticketDropdown.classList.remove('open');
      }
    });
  }

  // 상/하 스크롤 FAB 버튼 로직
  const fabWrap = document.querySelector('.scroll-fab-wrap');
  const fabUp = document.getElementById('fab-up');
  const fabDown = document.getElementById('fab-down');
  const footer = document.querySelector('footer') || document.querySelector('.site-footer');

  if (fabWrap) {
    window.addEventListener('scroll', () => {
      // 보이기/숨기기
      if (window.scrollY > 300) {
        fabWrap.classList.add('visible');
      } else {
        fabWrap.classList.remove('visible');
      }

      // 푸터 침범 방지
      if (footer) {
        const footerRect = footer.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        if (footerRect.top < windowHeight) {
          fabWrap.style.bottom = (windowHeight - footerRect.top + 20) + 'px';
        } else {
          fabWrap.style.bottom = '120px';
        }
      }
    });
  }

  if (fabUp) {
    fabUp.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  if (fabDown) {
    fabDown.addEventListener('click', () => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    });
  }
});
