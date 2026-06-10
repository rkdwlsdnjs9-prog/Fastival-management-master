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
  const container = document.getElementById('ticketSelectionList');
  const btnAdd = document.getElementById('btnAddTicketType');

  if (btnAdd && container) {
    btnAdd.addEventListener('click', () => {
      if (container.children.length >= 4) {
        alert('권종은 최대 4개까지 추가할 수 있습니다.');
        return;
      }
      const clone = container.children[0].cloneNode(true);

      const delBtn = clone.querySelector('.btn-delete-ticket');
      if (delBtn) delBtn.style.visibility = 'visible';

      const valEl = clone.querySelector('.qty-value');
      if (valEl) valEl.textContent = '1';

      container.appendChild(clone);
      bindTicketRowEvents(clone);
      updateTotalQtyFromRows();
    });
  }

  if (container && container.children.length > 0) {
    bindTicketRowEvents(container.children[0]);
  }
}

function bindTicketRowEvents(row) {
  const minus = row.querySelector('.qty-btn-minus');
  const plus = row.querySelector('.qty-btn-plus');
  const valEl = row.querySelector('.qty-value');
  const delBtn = row.querySelector('.btn-delete-ticket');

  const dropdownOpts = row.querySelectorAll('.custom-dropdown-option');
  const textSpan = row.querySelector('.ticketTypeText');
  const dropdownSelected = row.querySelector('.custom-dropdown-selected');
  const dropdownParent = dropdownSelected?.parentElement;

  if (dropdownOpts && textSpan && dropdownParent) {
    dropdownOpts.forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownOpts.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        textSpan.textContent = opt.textContent;
        dropdownParent.classList.remove('open');
      });
    });
  }

  if (minus) {
    minus.addEventListener('click', () => {
      let q = parseInt(valEl.textContent) || 1;
      if (q > 1) {
        valEl.textContent = q - 1;
        updateTotalQtyFromRows();
      }
    });
  }
  if (plus) {
    plus.addEventListener('click', () => {
      let q = parseInt(valEl.textContent) || 1;
      const zone = _eventDetail?.zones.find(z => z.zoneNo === _selectedZoneNo);
      const max = zone ? Math.min(4, zone.remainingCapacity) : 4;
      if (q < max) {
        valEl.textContent = q + 1;
        updateTotalQtyFromRows();
      }
    });
  }
  if (delBtn) {
    delBtn.addEventListener('click', () => {
      const container = document.getElementById('ticketSelectionList');
      if (container && container.children.length > 1) {
        row.remove();
        updateTotalQtyFromRows();
      }
    });
  }
}

function updateTotalQtyFromRows() {
  const container = document.getElementById('ticketSelectionList');
  if (!container) return;
  let total = 0;
  container.querySelectorAll('.qty-value').forEach(el => {
    total += parseInt(el.textContent) || 1;
  });
  _quantity = total;

  // Update disabled states
  const zone = _eventDetail?.zones.find(z => z.zoneNo === _selectedZoneNo);
  const max = zone ? Math.min(4, zone.remainingCapacity) : 4;

  container.querySelectorAll('.qty-selector-wrap').forEach(row => {
    const q = parseInt(row.querySelector('.qty-value').textContent) || 1;
    const m = row.querySelector('.qty-btn-minus');
    const p = row.querySelector('.qty-btn-plus');
    if (m) m.disabled = (q <= 1);
    if (p) p.disabled = (q >= max);
  });

  if (zone) updateCtaBar(zone);
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
    window.genderChart = new Chart(genderCtx, {
      type: 'doughnut',
      data: {
        labels: ['남성', '여성'],
        datasets: [{
          data: [stats.gender?.male || 0, stats.gender?.female || 0],
          backgroundColor: ['#8B5CF6', '#F43F5E'],
          borderColor: '#ffffff',
          borderWidth: 4,
          hoverBorderWidth: 4,
          hoverOffset: 4,
        }],
      },
      options: {
        ...chartDefaults,
        cutout: '65%',
        plugins: {
          legend: { display: false },
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
          data: [stats.age?.['10대'] || 0, stats.age?.['20대'] || 0, stats.age?.['30대'] || 0, stats.age?.['40대'] || 0, stats.age?.['50대이상'] || 0],
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
          y: { min: 0, max: 100, beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9090B8', font: { size: 10, family: 'Pretendard Variable' }, callback: v => `${v}%` } },
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
          const header = document.querySelector('.detail-tabs-header');
          const headerHeight = header ? header.offsetHeight : 0;
          const globalHeaderH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 80;
          const offsetTop = targetContent.getBoundingClientRect().top + window.scrollY - headerHeight - globalHeaderH - 20;
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
      // initMainAreaEditors moved to sidebar
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
    // Editors are now in sidebar, right area already has live preview HTML
  }
}


function destroyMainAreaEditors(tabsSection) {
  const tabs = tabsSection.querySelectorAll('.detail-tab-content');
  tabs.forEach(tab => {
    const inner = tab.querySelector('.tab-content-inner');
    if (!inner) return;

    if (tab.id === 'tab-venue') {
      const editorWrap = inner.querySelector('.venue-editor-wrap');
      if (editorWrap) {
        editorWrap.remove();
      }
      return;
    }

    const wrap = inner.querySelector('.block-editor-wrap');
    if (wrap) {
      const blocksContainer = wrap.querySelector('.blocks-container');
      const blocks = blocksContainer.querySelectorAll('.editor-block');
      let combinedHtml = '';
      blocks.forEach(block => {
        if (block.classList.contains('text-block')) {
          const quillWrap = block.querySelector('.quill-main-editor');
          const editorContent = quillWrap.querySelector('.ql-editor') ? quillWrap.querySelector('.ql-editor').innerHTML : quillWrap.innerHTML;
          combinedHtml += `<div class="view-text-block" style="margin-bottom:1rem;">${editorContent}</div>`;
        } else if (block.classList.contains('gallery-block')) {
          const previewHtml = block.querySelector('.gallery-preview-container').innerHTML;
          combinedHtml += `<div class="view-gallery-block" style="margin-bottom:1rem;">${previewHtml}</div>`;
        }
      });
      inner.innerHTML = combinedHtml;

      Object.keys(quillEditors).forEach(k => {
        if (k.startsWith(tab.id + '_')) delete quillEditors[k];
      });
    } else {
      const quillWrap = inner.querySelector('.quill-main-editor');
      if (quillWrap) {
        const html = quillWrap.querySelector('.ql-editor') ? quillWrap.querySelector('.ql-editor').innerHTML : quillWrap.innerHTML;
        inner.innerHTML = html;
        delete quillEditors[tab.id];
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
        <button class="btn btn-sm" id="btnResetLayout" style="padding: 0.3rem 0.5rem; font-size:0.8rem; color:#6b7280; background:transparent; border:none; box-shadow:none;">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-right:2px;"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg> 초기화
        </button>
        <button class="btn btn-primary btn-sm" id="btnAddSectionTop" style="border-radius:50%; width:36px; height:36px; padding:0; display:flex; align-items:center; justify-content:center; background:#3B82F6; border:none; box-shadow:0 4px 12px rgba(59,130,246,0.4); font-size:1.6rem; font-weight:600;">+</button>
      </div>
    </div>
    <div class="builder-accordion-list" id="builderAccordionList"></div>
  `;


  const btnReset = sidebar.querySelector('#btnResetLayout');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (confirm('모든 섹션을 삭제하고 초기화하시겠습니까? (이 작업은 되돌릴 수 없습니다)')) {
        const listWrap = sidebar.querySelector('#builderAccordionList');
        if (listWrap) listWrap.innerHTML = '';

        const tabsSection = document.getElementById('detailTabsSection');
        if (tabsSection) {
          const contents = tabsSection.querySelectorAll('.detail-tab-content');
          contents.forEach(c => c.remove());
        }

        const tabsHeader = document.querySelector('.detail-tabs-header');
        if (tabsHeader) {
          const btns = tabsHeader.querySelectorAll('.detail-tab-btn');
          btns.forEach(b => b.remove());
        }
        Toast.success('모든 섹션이 초기화되었습니다. 새 섹션을 추가해 주세요.');
      }
    });
  }

  const listWrap = sidebar.querySelector('#builderAccordionList');
  const tabs = tabsSection.querySelectorAll('.detail-tab-content');
  const tabBtns = document.querySelectorAll('.detail-tab-btn');

  tabs.forEach((tab, index) => {
    const targetId = tab.id;
    const tabId = targetId.replace('tab-', '');
    const btn = Array.from(tabBtns).find(b => b.dataset.tab === tabId || b.dataset.target === targetId);
    const title = btn ? btn.textContent.trim() : '새 섹션';
    addAccordionItem(listWrap, title, targetId, index, tab);
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

  sidebar.querySelector('#btnAddSectionTop').addEventListener('click', () => handleAddSection());
}

function addAccordionItem(listWrap, title, id, index, tabElement) {
  const bodyHtml = `
    <div style="margin-bottom: 1rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
        <span style="font-size:0.85rem; font-weight:700; color:var(--text-main);">섹션 타이틀</span>
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <span style="font-size:0.75rem; color:var(--text-muted);">텍스트 정렬</span>
          <div class="align-toggle-group" style="display:flex; background:var(--bg-surface2); border-radius:6px; overflow:hidden; border:1px solid var(--border-default);">
            <button class="btn-align active" data-align="left" style="padding:4px 10px; border:none; background:transparent; cursor:pointer;" onclick="changeSectionAlign('${id}', 'left', this)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 6H3"/><path d="M15 12H3"/><path d="M17 18H3"/></svg>
            </button>
            <button class="btn-align" data-align="center" style="padding:4px 10px; border:none; background:transparent; cursor:pointer;" onclick="changeSectionAlign('${id}', 'center', this)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 6H3"/><path d="M19 12H5"/><path d="M21 18H3"/></svg>
            </button>
            <button class="btn-align" data-align="right" style="padding:4px 10px; border:none; background:transparent; cursor:pointer;" onclick="changeSectionAlign('${id}', 'right', this)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="12" x2="9" y2="12"></line><line x1="21" y1="18" x2="7" y2="18"></line></svg>
            </button>
          </div>
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
        <span class="drag-handle" title="드래그하여 순서 변경">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#a1a1aa;"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </span>
        <span class="accordion-index" style="color:#3B82F6; font-weight:800; font-size:13px; margin-right:4px;">${index}</span>
        <span class="accordion-name" contenteditable="true" style="font-size:14px; color:#1f2937;">${title}</span>
      </div>
      <div style="display:flex; gap:0.2rem; align-items:center;">
        <button class="btn-delete-section" title="삭제" style="padding:6px; border-radius:6px; transition:background 0.2s;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
        <span class="accordion-toggle" style="padding:4px; color:#9ca3af; transition:transform 0.2s;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
        </span>
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
    listWrap.querySelectorAll('.builder-accordion-item').forEach(i => {
      i.classList.remove('active');
      const toggle = i.querySelector('.accordion-toggle svg');
      if (toggle) toggle.style.transform = 'rotate(0deg)';
    });

    if (!isActive) {
      item.classList.add('active');
      const toggle = item.querySelector('.accordion-toggle svg');
      if (toggle) toggle.style.transform = 'rotate(180deg)';
      const targetId = item.dataset.targetId;
      const targetTab = document.getElementById(targetId);
      if (targetTab) {
        document.querySelectorAll('.detail-tab-content').forEach(t => t.classList.remove('active'));
        targetTab.classList.add('active');
      }
      const tabId = targetId.replace('tab-', '');
      document.querySelectorAll('.detail-tab-btn').forEach(b => b.classList.remove('active'));
      const tabBtn = document.querySelector(`.detail-tab-btn[data-tab="${tabId}"], .detail-tab-btn[data-target="${targetId}"]`);
      if (tabBtn) {
        tabBtn.classList.add('active');
        tabBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
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

  const bodyWrap = item.querySelector('.builder-accordion-body');
  if (tabElement) {
    if (id === 'tab-venue') {
      if (typeof makeVenueEditor === 'function') makeVenueEditor(tabElement, bodyWrap);
    } else {
      makeBlockEditor(tabElement, bodyWrap);
    }
  }

  item.querySelector('.btn-delete-section').addEventListener('click', (e) => {
    e.stopPropagation();
    const modal = document.getElementById('deleteConfirmModal');
    const btnConfirm = document.getElementById('btnDeleteConfirm');
    const btnCancel = document.getElementById('btnDeleteCancel');

    modal.querySelector('p').textContent = '이 섹션을 삭제하시겠습니까?';

    const handleConfirm = () => {
      const targetId = item.dataset.targetId;
      const targetTab = document.getElementById(targetId);
      if (targetTab) targetTab.remove();

      const tabId = targetId.replace('tab-', '');
      const tabBtn = document.querySelector(`.detail-tab-btn[data-tab="${tabId}"], .detail-tab-btn[data-target="${targetId}"]`);
      if (tabBtn) tabBtn.remove();

      item.remove();
      syncTabsOrder(listWrap, document.getElementById('detailTabsSection'));
      closeModal();
    };

    const closeModal = () => {
      modal.style.display = 'none';
      btnConfirm.removeEventListener('click', handleConfirm);
      btnCancel.removeEventListener('click', closeModal);
    };

    btnConfirm.addEventListener('click', handleConfirm);
    btnCancel.addEventListener('click', closeModal);
    modal.style.display = 'flex';
  });

  const fileInput = item.querySelector('.gallery-upload-input');
  const previewGrid = item.querySelector('.uploaded-image-grid');
  if (fileInput && previewGrid) {
    fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      const currentImgCount = previewGrid.querySelectorAll('.uploaded-image-item').length;
      if (currentImgCount + files.length > 20) {
        Toast.warning(`최대 20장까지만 업로드할 수 있습니다. (현재 ${currentImgCount}장)`);
        fileInput.value = '';
        return;
      }

      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const imgItem = document.createElement('div');
          imgItem.className = 'uploaded-image-item';
          imgItem.style.cssText = 'position:relative; flex-shrink:0; width:80px; height:80px; border-radius:10px; overflow:hidden; box-shadow:0 2px 6px rgba(0,0,0,0.06); border:1px solid #e5e7eb;';
          imgItem.innerHTML = `
            <img src="${ev.target.result}" style="width:100%; height:100%; object-fit:cover;">
            <button class="btn-delete-image" style="position:absolute; top:4px; right:4px; width:20px; height:20px; background:rgba(0,0,0,0.5); color:#fff; border-radius:50%; border:none; display:flex; align-items:center; justify-content:center; cursor:pointer; backdrop-filter:blur(4px);">
              <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          `;

          imgItem.querySelector('.btn-delete-image').addEventListener('click', () => {
            imgItem.remove();
            updateGalleryPreview(id);
          });

          previewGrid.appendChild(imgItem);
        };
        reader.readAsDataURL(file);
      });

      setTimeout(() => updateGalleryPreview(id), 100);
      fileInput.value = '';
    });
  }

  window.changeGalleryLayout = function (id, value, text, optionEl) {
    const dropdown = optionEl.closest('.gallery-layout-dropdown');
    dropdown.querySelector('.galleryLayoutText').textContent = text;
    dropdown.querySelector('.gallery-layout-select').value = value;
    dropdown.querySelectorAll('.custom-dropdown-option').forEach(el => el.classList.remove('active'));
    optionEl.classList.add('active');
    dropdown.classList.remove('open');
    updateGalleryPreview(id);
  };

  window.changeSectionAlign = function (id, align, btn) {
    const parent = btn.closest('.align-toggle-group');
    parent.querySelectorAll('.btn-align').forEach(el => el.classList.remove('active'));
    btn.classList.add('active');
    const targetTab = document.getElementById(id);
    if (targetTab) {
      const titleEl = targetTab.querySelector('.tab-title');
      if (titleEl) titleEl.style.textAlign = align;
    }
  };
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
      if (inner.querySelector('.venue-editor-wrap')) return;

      const currentAddress = inner.querySelector('.venue-address-text')?.textContent || '';
      const currentTransit = inner.querySelector('#transitContent')?.innerHTML || '';

      const editorHtml = `
        <div class="venue-editor-wrap" style="background: var(--bg-surface1); padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; border: 1px dashed var(--border-default);">
          <div style="margin-bottom: 1rem;">
            <label style="display:block; font-weight: 700; margin-bottom: 0.5rem; color:var(--text-main);">행사 장소 주소</label>
            <div style="display:flex; gap: 0.5rem;">
              <input type="text" id="venueEditAddress" class="form-control" style="flex: 1; border-radius:8px;" placeholder="예: 서울특별시 강남구 테헤란로 123" value="${currentAddress === '장소 정보가 없습니다.' ? '' : currentAddress}">
              <button type="button" class="btn btn-primary" id="btnUpdateVenueMap" style="border-radius:8px;">지도 반영</button>
            </div>
          </div>
          <div>
            <label style="display:block; font-weight: 700; margin-bottom: 0.5rem; color:var(--text-main);">대중교통 안내</label>
            <textarea id="venueEditTransit" class="form-control" style="width:100%; min-height: 100px; resize: vertical; border-radius:8px;" placeholder="지하철, 버스 등 교통편 안내를 입력하세요">${currentTransit === '대중교통 정보가 없습니다.' ? '' : currentTransit}</textarea>
          </div>
        </div>
      `;
      inner.insertAdjacentHTML('afterbegin', editorHtml);

      const btnUpdate = inner.querySelector('#btnUpdateVenueMap');
      const addressInput = inner.querySelector('#venueEditAddress');
      const transitInput = inner.querySelector('#venueEditTransit');

      btnUpdate.addEventListener('click', () => {
        const address = addressInput.value.trim();
        const transit = transitInput.value.trim();

        const addressTextEl = inner.querySelector('.venue-address-text');
        const transitContentEl = inner.querySelector('#transitContent');
        const googleMapFrame = inner.querySelector('#googleMap');

        if (addressTextEl) addressTextEl.textContent = address || '장소 정보가 없습니다.';
        if (transitContentEl) transitContentEl.innerHTML = transit.replace(/\n/g, '<br>') || '대중교통 정보가 없습니다.';

        if (googleMapFrame && address) {
          googleMapFrame.src = `https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
        }

        let linksWrap = inner.querySelector('#directionsLinksWrap');
        if (!linksWrap) {
          linksWrap = document.createElement('div');
          linksWrap.id = 'directionsLinksWrap';
          inner.appendChild(linksWrap);
        }

        if (address) {
          linksWrap.innerHTML = `
            <div style="margin-top: 1.5rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
              <a href="https://map.kakao.com/link/search/${encodeURIComponent(address)}" target="_blank" style="display:inline-flex; align-items:center; gap:6px; padding: 10px 16px; background: #FEE500; color: #000; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.9rem;"><svg width="16" height="16" viewBox="0 0 24 24" fill="#000"><path d="M12 3c-5.523 0-10 3.514-10 7.85 0 2.804 1.83 5.253 4.606 6.647l-1.18 4.34c-.05.18.17.33.32.22l5.12-3.41c.37.04.74.06 1.13.06 5.523 0 10-3.514 10-7.85C22 6.514 17.523 3 12 3z"/></svg>카카오맵</a>
              <a href="https://map.naver.com/v5/search/${encodeURIComponent(address)}" target="_blank" style="display:inline-flex; align-items:center; gap:6px; padding: 10px 16px; background: #03C75A; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.9rem;"><svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M16.084 12.637L8.03 2.127C7.625 1.597 7.026 1.334 6.386 1.334H2v21.332h5.922V11.233l8.053 10.51C16.42 22.316 17.02 22.58 17.658 22.58H22V1.248h-5.916v11.389z"/></svg>네이버지도</a>
              <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=transit" target="_blank" style="display:inline-flex; align-items:center; gap:6px; padding: 10px 16px; background: #4285F4; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.9rem;"><svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>구글맵 길찾기</a>
            </div>
          `;
        } else {
          linksWrap.innerHTML = '';
        }

        Toast.success('장소 및 지도가 반영되었습니다.');
      });

      return;
    }

    if (inner.querySelector('.block-editor-wrap')) return;

    makeBlockEditor(tab, inner);
  });
}

function syncLivePreview(tab, blocksContainer) {
  const inner = tab.querySelector('.tab-content-inner');
  if (!inner) return;

  let combinedHtml = '';
  const blocks = blocksContainer.querySelectorAll('.editor-block');
  if (blocks.length === 0) {
    inner.innerHTML = '<p class="tab-empty-text">등록된 내용이 없습니다.</p>';
    return;
  }

  blocks.forEach(block => {
    if (block.classList.contains('text-block')) {
      const quillWrap = block.querySelector('.quill-main-editor');
      if (quillWrap) {
        const editorContent = quillWrap.querySelector('.ql-editor') ? quillWrap.querySelector('.ql-editor').innerHTML : quillWrap.innerHTML;
        combinedHtml += `<div class="view-text-block" style="margin-bottom:1rem;">${editorContent}</div>`;
      }
    } else if (block.classList.contains('gallery-block')) {
      const previewContainer = block.querySelector('.gallery-preview-container');
      if (previewContainer) {
        combinedHtml += previewContainer.innerHTML;
      }
    }
  });
  inner.innerHTML = combinedHtml;
}

function makeBlockEditor(tab, sidebarContainer) {
  const inner = tab.querySelector('.tab-content-inner');
  let html = '';
  if (inner) {
    html = inner.innerHTML;
  }

  const wrap = document.createElement('div');
  wrap.className = 'block-editor-wrap';

  const blocksContainer = document.createElement('div');
  blocksContainer.className = 'blocks-container';
  blocksContainer.style.display = 'flex';
  blocksContainer.style.flexDirection = 'column';
  blocksContainer.style.gap = '1.5rem';
  wrap.appendChild(blocksContainer);

  const addActions = document.createElement('div');
  addActions.className = 'block-add-actions';
  addActions.style.display = 'flex';
  addActions.style.gap = '12px';
  addActions.style.padding = '24px 0';
  addActions.style.justifyContent = 'center';
  addActions.innerHTML = `
    <button class="btn btn-add-text-block" style="background:#fff; border:1px solid #e5e7eb; padding:10px 20px; border-radius:30px; font-weight:600; font-size:0.9rem; color:#4b5563; box-shadow:0 2px 4px rgba(0,0,0,0.02); cursor:pointer; transition:all 0.2s;">+ 텍스트 블록 추가</button>
    <button class="btn btn-add-gallery-block" style="background:#fff; border:1px solid #e5e7eb; padding:10px 20px; border-radius:30px; font-weight:600; font-size:0.9rem; color:#4b5563; box-shadow:0 2px 4px rgba(0,0,0,0.02); cursor:pointer; transition:all 0.2s;">+ 갤러리 영역 추가</button>
  `;
  wrap.appendChild(addActions);
  sidebarContainer.appendChild(wrap);

  const addTextBlock = (content = '') => {
    const block = document.createElement('div');
    block.className = 'editor-block text-block';
    block.style.position = 'relative';
    block.style.border = '1px solid #e5e7eb';
    block.style.borderRadius = '12px';
    block.style.padding = '40px 0 0 0';
    block.style.background = '#fff';
    block.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05)';
    block.style.overflow = 'hidden';

    const controls = document.createElement('div');
    controls.style.position = 'absolute';
    controls.style.top = '0';
    controls.style.left = '0';
    controls.style.right = '0';
    controls.style.height = '40px';
    controls.style.background = '#f9fafb';
    controls.style.borderBottom = '1px solid #e5e7eb';
    controls.style.display = 'flex';
    controls.style.alignItems = 'center';
    controls.style.justifyContent = 'space-between';
    controls.style.padding = '0 12px';

    controls.innerHTML = `
      <div style="font-size:0.75rem; font-weight:700; color:#6b7280; display:flex; align-items:center; gap:4px;">
         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg> 텍스트 블록
      </div>
      <div style="display:flex; gap:4px;">
        <button class="btn-block-up" style="cursor:pointer; background:#fff; border:1px solid #d1d5db; border-radius:4px; width:24px; height:24px; display:flex; align-items:center; justify-content:center; color:#4b5563; transition:background 0.2s;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m18 15-6-6-6 6"/></svg></button>
        <button class="btn-block-down" style="cursor:pointer; background:#fff; border:1px solid #d1d5db; border-radius:4px; width:24px; height:24px; display:flex; align-items:center; justify-content:center; color:#4b5563; transition:background 0.2s;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg></button>
        <button class="btn-block-del" style="cursor:pointer; background:#fef2f2; border:1px solid #fecaca; border-radius:4px; width:24px; height:24px; display:flex; align-items:center; justify-content:center; color:#ef4444; transition:background 0.2s; margin-left:4px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
      </div>
    `;
    block.appendChild(controls);

    const quillWrap = document.createElement('div');
    quillWrap.className = 'quill-main-editor';
    quillWrap.style.minHeight = '150px';
    quillWrap.innerHTML = content;
    block.appendChild(quillWrap);

    blocksContainer.appendChild(block);

    if (typeof Quill !== 'undefined') {
      const quill = new Quill(quillWrap, {
        theme: 'snow',
        modules: { toolbar: quillToolbarOptions }
      });
      quillEditors[tab.id + '_' + Date.now()] = quill;

      quill.on('text-change', () => {
        syncLivePreview(tab, blocksContainer);
      });
    }

    bindBlockControls(block);
    syncLivePreview(tab, blocksContainer);
  };

  const addGalleryBlock = () => {
    const block = document.createElement('div');
    block.className = 'editor-block gallery-block';
    block.style.position = 'relative';
    block.style.border = '1px solid #e5e7eb';
    block.style.borderRadius = '12px';
    block.style.padding = '40px 0 0 0';
    block.style.background = '#fff';
    block.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05)';
    block.style.overflow = 'hidden';

    const controls = document.createElement('div');
    controls.style.position = 'absolute';
    controls.style.top = '0';
    controls.style.left = '0';
    controls.style.right = '0';
    controls.style.height = '40px';
    controls.style.background = '#f9fafb';
    controls.style.borderBottom = '1px solid #e5e7eb';
    controls.style.display = 'flex';
    controls.style.alignItems = 'center';
    controls.style.justifyContent = 'space-between';
    controls.style.padding = '0 12px';

    controls.innerHTML = `
      <div style="font-size:0.75rem; font-weight:700; color:#6b7280; display:flex; align-items:center; gap:4px;">
         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg> 갤러리 영역
      </div>
      <div style="display:flex; gap:4px;">
        <button class="btn-block-up" style="cursor:pointer; background:#fff; border:1px solid #d1d5db; border-radius:4px; width:24px; height:24px; display:flex; align-items:center; justify-content:center; color:#4b5563; transition:background 0.2s;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m18 15-6-6-6 6"/></svg></button>
        <button class="btn-block-down" style="cursor:pointer; background:#fff; border:1px solid #d1d5db; border-radius:4px; width:24px; height:24px; display:flex; align-items:center; justify-content:center; color:#4b5563; transition:background 0.2s;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg></button>
        <button class="btn-block-del" style="cursor:pointer; background:#fef2f2; border:1px solid #fecaca; border-radius:4px; width:24px; height:24px; display:flex; align-items:center; justify-content:center; color:#ef4444; transition:background 0.2s; margin-left:4px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
      </div>
    `;
    block.appendChild(controls);

    const uploadWrap = document.createElement('div');
    uploadWrap.style.padding = '1.5rem';
    uploadWrap.innerHTML = `
      <div style="margin-bottom:1rem;">
        <select class="form-control gallery-layout-select" style="width:100%; border-radius:8px;">
          <option value="grid">Grid (기본 격자)</option>
          <option value="masonry">Masonry (핀터레스트 스타일)</option>
          <option value="mosaic">Mosaic (모자이크형)</option>
          <option value="carousel">Carousel (캐러셀)</option>
        </select>
      </div>
      <div style="margin-bottom:1rem; font-weight:700; color:var(--text-main); font-size:0.9rem;">이미지</div>
      <label class="gallery-upload-area" style="display:block; border:1px dashed #d1d5db; border-radius:12px; padding:2rem; text-align:center; cursor:pointer; background:#f9fafb; transition:all 0.2s;">
        <input type="file" multiple accept="image/*" class="gallery-upload-input" style="display:none;">
        <div style="width:40px; height:40px; background:#fff; border-radius:50%; box-shadow:0 2px 4px rgba(0,0,0,0.05); display:inline-flex; align-items:center; justify-content:center; margin-bottom:0.5rem; color:#9ca3af;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
        </div>
        <div style="color:#6b7280; font-size:0.9rem; font-weight:600;">이미지 선택</div>
      </label>
      <div class="uploaded-image-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(80px, 1fr)); gap:10px; margin-top:1rem;"></div>
      <div class="gallery-preview-container" style="display:none;"></div>
    `;
    block.appendChild(uploadWrap);

    blocksContainer.appendChild(block);
    bindBlockControls(block);

    const fileInput = block.querySelector('.gallery-upload-input');
    const previewGrid = block.querySelector('.uploaded-image-grid');
    const layoutSelect = block.querySelector('.gallery-layout-select');

    layoutSelect.addEventListener('change', () => {
      updateGalleryPreview(tab.id);
    });

    fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      const currentImgCount = previewGrid.querySelectorAll('.uploaded-image-item').length;
      if (currentImgCount + files.length > 20) {
        Toast.warning(`최대 20장까지만 업로드할 수 있습니다. (현재 ${currentImgCount}장)`);
        fileInput.value = '';
        return;
      }

      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const imgWrap = document.createElement('div');
          imgWrap.className = 'uploaded-image-item';
          imgWrap.style.position = 'relative';
          imgWrap.style.aspectRatio = '1';
          imgWrap.style.borderRadius = '8px';
          imgWrap.style.overflow = 'hidden';
          imgWrap.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';

          imgWrap.innerHTML = `
            <img src="${e.target.result}" style="width:100%; height:100%; object-fit:cover;">
            <button class="btn-remove-img" style="position:absolute; top:4px; right:4px; background:rgba(0,0,0,0.5); color:#fff; border:none; border-radius:50%; width:20px; height:20px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:12px;">✕</button>
          `;

          imgWrap.querySelector('.btn-remove-img').addEventListener('click', () => {
            imgWrap.remove();
            updateGalleryPreview(tab.id);
          });

          previewGrid.appendChild(imgWrap);
          updateGalleryPreview(tab.id);
        };
        reader.readAsDataURL(file);
      });
      fileInput.value = '';
    });

    syncLivePreview(tab, blocksContainer);
  };

  function bindBlockControls(block) {
    block.querySelector('.btn-block-up').addEventListener('click', () => {
      const prev = block.previousElementSibling;
      if (prev) blocksContainer.insertBefore(block, prev);
      syncLivePreview(tab, blocksContainer);
    });
    block.querySelector('.btn-block-down').addEventListener('click', () => {
      const next = block.nextElementSibling;
      if (next) blocksContainer.insertBefore(next, block);
      syncLivePreview(tab, blocksContainer);
    });
    block.querySelector('.btn-block-del').addEventListener('click', () => {
      block.remove();
      syncLivePreview(tab, blocksContainer);
    });
  }

  addActions.querySelector('.btn-add-text-block').addEventListener('click', () => addTextBlock('<p><br></p>'));
  addActions.querySelector('.btn-add-gallery-block').addEventListener('click', () => addGalleryBlock());

  if (html.trim() && !html.includes('등록된 상세 설명 이미지가 제공되지 않았습니다.') && !html.includes('등록된 공지사항이 없습니다.')) {
    if (html.includes('view-text-block') || html.includes('gallery-grid') || html.includes('gallery-carousel') || html.includes('gallery-slider')) {
      const temp = document.createElement('div');
      temp.innerHTML = html;
      const children = Array.from(temp.children);
      if (children.length > 0) {
        children.forEach(child => {
          if (child.classList.contains('view-text-block')) {
            addTextBlock(child.innerHTML);
          } else {
            addTextBlock(child.outerHTML);
          }
        });
      } else {
        addTextBlock(html);
      }
    } else {
      addTextBlock(html);
    }
  } else {
    addTextBlock('<p>내용을 입력하세요.</p>');
  }

  syncLivePreview(tab, blocksContainer);
}
window.updateGalleryPreviewOrig = window.updateGalleryPreview;
window.updateGalleryPreview = function (targetId) {
  const accordionItem = document.querySelector(`.builder-accordion-item[data-target-id="${targetId}"]`);
  const targetTab = document.getElementById(targetId);
  if (!accordionItem || !targetTab) return;

  const inner = targetTab.querySelector('.gallery-preview-container') || targetTab.querySelector('.tab-content-inner');
  if (!inner) return;

  const layout = accordionItem.querySelector('.gallery-layout-select')?.value || 'grid';
  const imgElements = accordionItem.querySelectorAll('.uploaded-image-grid img');
  const images = Array.from(imgElements).map(img => img.src);

  if (images.length === 0) {
    if (inner.classList.contains('gallery-preview-container')) {
      inner.innerHTML = '<div style="padding:2rem; border:1px dashed #d1d5db; border-radius:12px; background:#f9fafb; color:#9ca3af; font-size:0.85rem;">등록된 이미지가 없습니다.</div>';
    }
    return;
  }

  let html = '';
  if (layout === 'grid') {
    html = '<div class="gallery-grid">';
    images.forEach(src => { html += `<div class="gallery-grid-item"><img src="${src}" alt="갤러리 이미지"></div>`; });
    html += '</div>';
  } else if (layout === 'masonry') {
    html = '<div class="gallery-masonry">';
    images.forEach(src => { html += `<div class="gallery-masonry-item"><img src="${src}" alt="갤러리 이미지"></div>`; });
    html += '</div>';
  } else if (layout === 'mosaic') {
    html = `<div class="gallery-mosaic layout-${Math.min(images.length, 5)}">`;
    images.forEach((src, idx) => { html += `<div class="gallery-mosaic-item item-${idx + 1}"><img src="${src}" alt="갤러리 이미지"></div>`; });
    html += '</div>';
  } else if (layout === 'coverflow') {
    html = '<div class="gallery-coverflow">';
    images.forEach(src => { html += `<div class="gallery-coverflow-item"><img src="${src}" alt="갤러리 이미지"></div>`; });
    html += '</div>';
  } else if (layout === 'slider' || layout === 'carousel') {
    html = '<div class="gallery-slider">';
    images.forEach(src => { html += `<div class="gallery-slider-item"><img src="${src}" alt="갤러리 이미지"></div>`; });
    html += '</div>';
  } else if (layout === 'polaroid') {
    html = '<div style="display:flex; flex-wrap:wrap; gap:1.5rem; justify-content:center;">';
    images.forEach(src => {
      html += `
        <div style="background:#fff; padding:12px 12px 36px; box-shadow:0 10px 25px rgba(0,0,0,0.1); border-radius:4px; width:220px; transform:rotate(${Math.floor(Math.random() * 10 - 5)}deg); transition:transform 0.3s; cursor:pointer;" onmouseover="this.style.transform='scale(1.05) rotate(0deg)'" onmouseout="this.style.transform='rotate(${Math.floor(Math.random() * 10 - 5)}deg)'">
          <img src="${src}" style="width:100%; aspect-ratio:1; object-fit:cover; border:1px solid #f3f4f6;">
        </div>
      `;
    });
    html += '</div>';
  }

  inner.innerHTML = html;
}

function handleAddSection(customTitle) {
  const title = customTitle || '새 섹션';
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

    // Auto focus and scroll
    setTimeout(() => {
      newBtn.click();
      tabsHeader.scrollLeft = tabsHeader.scrollWidth;
    }, 10);
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
  makeBlockEditor(newContent, inner);

  const listWrap = document.getElementById('builderAccordionList');
  const items = listWrap.querySelectorAll('.builder-accordion-item');
  addAccordionItem(listWrap, title, newId, items.length);

  const newItem = listWrap.lastElementChild;
  newItem.querySelector('.builder-accordion-header').click();
}

document.addEventListener('DOMContentLoaded', () => {
  // 관리자 권한 확인 (여기서는 데모용으로 항상 표시)
  
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true' || sessionStorage.getItem('isLoggedIn') === 'true' || !!localStorage.getItem('userToken') || !!sessionStorage.getItem('userToken');
  const userRole = localStorage.getItem('userRole') || sessionStorage.getItem('userRole') || 'CLIENT';
  const globalEdit = document.getElementById('globalEditControls');
  if (globalEdit && isLoggedIn && userRole === 'ADMIN') {
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

window.toggleChartDataset = function (index) {
  if (window.genderChart) {
    const meta = window.genderChart.getDatasetMeta(0);
    meta.data[index].hidden = !meta.data[index].hidden;
    window.genderChart.update();
    const legendEl = index === 0 ? document.getElementById('legend-male') : document.getElementById('legend-female');
    if (legendEl) {
      legendEl.style.opacity = meta.data[index].hidden ? '0.3' : '1';
    }
  }
};



function makeVenueEditor(tab, sidebarContainer) {
  const inner = tab.querySelector('.tab-content-inner');
  if (!inner) return;

  const currentAddress = inner.querySelector('.venue-address-text')?.textContent || '';
  const currentTransit = inner.querySelector('#transitContent')?.innerHTML || '';

  const editorHtml = `
    <div class="venue-editor-wrap" style="background: var(--bg-surface1); padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; border: 1px dashed var(--border-default);">
      <div style="margin-bottom: 1rem;">
        <label style="display:block; font-weight: 700; margin-bottom: 0.5rem; color:var(--text-main);">오시는 길 주소</label>
        <div style="display:flex; gap: 0.5rem; flex-direction:column;">
          <input type="text" id="venueEditAddress" class="form-control" style="width: 100%; border-radius:8px;" placeholder="예: 올림픽공원 체조경기장" value="${currentAddress === '등록된 주소가 없습니다.' ? '' : currentAddress}">
          <button type="button" class="btn btn-primary" id="btnUpdateVenueMap" style="border-radius:8px; width:100%;">지도 및 안내 업데이트</button>
        </div>
      </div>
      <div>
        <label style="display:block; font-weight: 700; margin-bottom: 0.5rem; color:var(--text-main);">대중교통 안내</label>
        <textarea id="venueEditTransit" class="form-control" style="width:100%; min-height: 100px; resize: vertical; border-radius:8px;" placeholder="지하철, 버스 등 교통 안내를 입력하세요">${currentTransit === '대중교통 정보가 등록되지 않았습니다.' ? '' : currentTransit.replace(/<br>/g, '\n')}</textarea>
      </div>
    </div>
  `;
  sidebarContainer.innerHTML = editorHtml;

  const btnUpdate = sidebarContainer.querySelector('#btnUpdateVenueMap');
  const addressInput = sidebarContainer.querySelector('#venueEditAddress');
  const transitInput = sidebarContainer.querySelector('#venueEditTransit');

  btnUpdate.addEventListener('click', () => {
    const address = addressInput.value.trim();
    const transit = transitInput.value.trim();

    const addressTextEl = inner.querySelector('.venue-address-text');
    const transitContentEl = inner.querySelector('#transitContent');
    const googleMapFrame = inner.querySelector('#googleMap');

    if (addressTextEl) addressTextEl.textContent = address || '등록된 주소가 없습니다.';
    if (transitContentEl) transitContentEl.innerHTML = transit.replace(/\n/g, '<br>') || '대중교통 정보가 등록되지 않았습니다.';

    if (googleMapFrame && address) {
      googleMapFrame.src = `https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
    }

    let linksWrap = inner.querySelector('#directionsLinksWrap');
    if (!linksWrap) {
      linksWrap = document.createElement('div');
      linksWrap.id = 'directionsLinksWrap';
      inner.appendChild(linksWrap);
    }

    if (address) {
      linksWrap.innerHTML = `
        <div style="margin-top: 1.5rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <a href="https://map.kakao.com/link/search/${encodeURIComponent(address)}" target="_blank" style="display:inline-flex; align-items:center; gap:6px; padding: 10px 16px; background: #FEE500; color: #000; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.9rem;"><svg width="16" height="16" viewBox="0 0 24 24" fill="#000"><path d="M12 3c-5.523 0-10 3.514-10 7.85 0 2.804 1.83 5.253 4.606 6.647l-1.18 4.34c-.05.18.17.33.32.22l5.12-3.41c.37.04.74.06 1.13.06 5.523 0 10-3.514 10-7.85C22 6.514 17.523 3 12 3z"/></svg>카카오맵</a>
          <a href="https://map.naver.com/v5/search/${encodeURIComponent(address)}" target="_blank" style="display:inline-flex; align-items:center; gap:6px; padding: 10px 16px; background: #03C75A; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.9rem;"><svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M16.084 12.637L8.03 2.127C7.625 1.597 7.026 1.334 6.386 1.334H2v21.332h5.922V11.233l8.053 10.51C16.42 22.316 17.02 22.58 17.658 22.58H22V1.248h-5.916v11.389z"/></svg>네이버지도</a>
          <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=transit" target="_blank" style="display:inline-flex; align-items:center; gap:6px; padding: 10px 16px; background: #4285F4; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.9rem;"><svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>구글 길찾기</a>
        </div>
      `;
    } else {
      linksWrap.innerHTML = '';
    }

    Toast.success('오시는 길 정보가 라이브 화면에 업데이트되었습니다.');
  });
}
