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
}

/* ═══════════════════════════════════════════════════════════
   SVG 도면 구역 선택
   — DCC (대전컨벤션센터) 스타일 벡터 플로어맵
═══════════════════════════════════════════════════════════ */
function initVenueMap(zones) {
  const svg = $('.venue-svg');
  if (!svg) return;

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
  if (!window.Chart) return;

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

  // 2. Toss Payments 결제 요청
  try {
    const tossPayments = TossPayments(TOSS_CLIENT_KEY);

    const methodMap = {
      card: '카드',
      virtual: '가상계좌',
      phone: '휴대폰',
    };

    await tossPayments.requestPayment(methodMap[_selectedPayMethod] || '카드', {
      amount,
      orderId: _orderUid,
      orderName: `${_eventDetail.eventName} - ${zone.zoneName} x${_quantity}`,
      customerName: user.name,
      successUrl: `${window.location.origin}/payment-success.html?orderNo=${_orderNo}`,
      failUrl: `${window.location.origin}/payment-fail.html?orderNo=${_orderNo}`,
      // 테스트 환경에서 카드 결제 자동 성공:
      // 카드번호: 4242424242424242 / 만료: 임의 미래 날짜 / CVV: 임의 3자리
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
    const option = e.target.closest('.payment-method-option');
    if (!option) return;
    $$('.payment-method-option').forEach(o => o.classList.remove('selected'));
    option.classList.add('selected');
    _selectedPayMethod = option.dataset.method || 'card';
  });
}

/* ─── 쿠폰 적용 ─────────────────────────────────────────────── */
function initCouponApply() {
  on($('#btn-apply-coupon'), 'click', async () => {
    const select = $('#coupon-select');
    if (!select?.value) { Toast.warning('쿠폰을 선택해 주세요.'); return; }
    const couponNo = parseInt(select.value);
    const zone = _eventDetail?.zones.find(z => z.zoneNo === _selectedZoneNo);
    if (!zone) return;

    const res = await couponApi.validateCoupon(couponNo, zone.price * _quantity);
    if (!res) { Toast.error('쿠폰 확인에 실패했습니다.'); return; }
    if (!res.valid) { Toast.warning(res.reason); return; }

    _appliedCoupon = { couponNo, discountAmount: res.discountAmount };

    const appliedBox = $('.coupon-applied-badge');
    const applyRow = $('.coupon-apply-row');
    if (appliedBox) {
      appliedBox.classList.remove('hidden');
      const amountEl = appliedBox.querySelector('.coupon-applied-amount');
      if (amountEl) amountEl.textContent = `-${formatKRW(res.discountAmount)}`;
    }
    if (applyRow) applyRow.classList.add('hidden');

    updatePaymentSummary(zone);
    Toast.success('쿠폰이 적용되었습니다.');
  });

  on($('#btn-remove-coupon'), 'click', () => {
    _appliedCoupon = null;
    const appliedBox = $('.coupon-applied-badge');
    const applyRow = $('.coupon-apply-row');
    if (appliedBox) appliedBox.classList.add('hidden');
    if (applyRow) applyRow.classList.remove('hidden');

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

  _eventDetail = detail;

  renderEventDetail(detail);
  initVenueMap(detail.zones);
  initQtySelector();
  initStatsCharts(detail.stats);
  initBookingBtn();
  initPaymentMethodSelect();
  initCouponApply();
  loadCouponsForPayment();

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
