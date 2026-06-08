/**
 * Festival O2O Platform — cart.js
 */

'use strict';

let _cartItems = [];
let _selectedPayMethod = 'card';

// 장바구니 데이터 불러오기 (임시 localStorage 또는 API 연동)
async function loadCartData() {
  try {
    const res = await fetch('/api/cart');
    if (res.ok) {
      _cartItems = await res.json();
    } else {
      // Mock data for test
      _cartItems = [
        { id: 1, eventId: "1", zoneName: "VIP구역", quantity: 2, price: 150000, eventName: "K-POP 드림 콘서트 2026", img: "images/events/kpop_poster.jpg" }
      ];
    }
  } catch (e) {
    _cartItems = [
      { id: 1, eventId: "1", zoneName: "VIP구역", quantity: 2, price: 150000, eventName: "K-POP 드림 콘서트 2026", img: "https://ticketimage.interpark.com/Play/image/large/24/24003264_p.gif" }
    ];
  }
  renderCart();
}

function renderCart() {
  const container = $('#cart-list-container');
  if (!container) return;

  if (_cartItems.length === 0) {
    container.innerHTML = `
      <div class="cart-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="9" cy="21" r="1"/>
          <circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
        </svg>
        <p>장바구니가 비어 있습니다.</p>
      </div>`;
    updateSummary();
    return;
  }

  container.innerHTML = _cartItems.map(item => `
    <div class="cart-item" data-id="${item.id}">
      <img src="${item.img || 'https://via.placeholder.com/100'}" alt="포스터" class="cart-item-img">
      <div class="cart-item-info">
        <div class="cart-item-title">${item.eventName || '행사명'}</div>
        <div class="cart-item-meta">${item.zoneName}</div>
        <div class="cart-item-controls">
          <div class="qty-control">
            <button class="btn-qty-minus" onclick="updateCartQty(${item.id}, -1)">-</button>
            <span>${item.quantity}</span>
            <button class="btn-qty-plus" onclick="updateCartQty(${item.id}, 1)">+</button>
          </div>
          <div class="cart-item-price">${formatKRW(item.price * item.quantity)}</div>
        </div>
      </div>
      <button class="btn-remove-item" onclick="removeCartItem(${item.id})" aria-label="삭제">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    </div>
  `).join('');

  updateSummary();
}

async function updateCartQty(id, delta) {
  const item = _cartItems.find(i => i.id === id);
  if (!item) return;
  const newQty = item.quantity + delta;
  if (newQty < 1) return;

  // API Call
  // await fetch(`/api/cart/${id}?quantity=${newQty}`, { method: 'PUT' });

  item.quantity = newQty;
  renderCart();
}

async function removeCartItem(id) {
  // API Call
  // await fetch(`/api/cart/${id}`, { method: 'DELETE' });

  _cartItems = _cartItems.filter(i => i.id !== id);
  renderCart();
}

function updateSummary() {
  const totalGross = _cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discount = 0; // 쿠폰 로직 적용 시 계산
  const net = totalGross - discount;

  const priceEl = $('#cart-total-price');
  const discountEl = $('#cart-total-discount');
  const finalEl = $('#cart-final-price');

  if (priceEl) priceEl.textContent = formatKRW(totalGross);
  if (discountEl) discountEl.textContent = discount > 0 ? `-${formatKRW(discount)}` : '-0원';
  if (finalEl) finalEl.textContent = formatKRW(net);
}

function initCartPayment() {
  on(document, 'click', (e) => {
    const option = e.target.closest('.pay-method-btn');
    if (!option) return;
    $$('.pay-method-btn').forEach(o => o.classList.remove('selected'));
    option.classList.add('selected');
    _selectedPayMethod = option.dataset.method || 'card';

    const festioArea = $('#cart-festiopay-area');
    if (festioArea) {
      if (_selectedPayMethod === 'festiopay') {
        festioArea.classList.remove('hidden');
      } else {
        festioArea.classList.add('hidden');
      }
    }
  });

  on($('#btn-cart-charge-festiopay'), 'click', () => {
    Toast.success('50,000 포인트가 충전되었습니다.');
    const balEl = $('#cart-festiopay-balance');
    if (balEl) balEl.textContent = formatKRW(100000);
  });

  on($('#btn-cart-checkout'), 'click', async () => {
    if (_cartItems.length === 0) {
      Toast.warning('장바구니가 비어 있습니다.');
      return;
    }
    const totalGross = _cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    if (_selectedPayMethod === 'festiopay') {
      const balEl = $('#cart-festiopay-balance');
      let balance = parseInt(balEl ? balEl.textContent.replace(/[^0-9]/g, '') : 0);
      if (balance < totalGross) {
        Toast.warning('잔액이 부족합니다. 충전 후 다시 시도해주세요.');
        return;
      }
      Toast.success('FESTIO Pay로 결제되었습니다.');
      _cartItems = [];
      renderCart();
      return;
    }

    try {
      const tossPayments = TossPayments('test_ck_D5GePWvyJnrK0W0k6q8gLzN97Emo');
      const methodMap = { card: '카드', virtual: '가상계좌' };

      await tossPayments.requestPayment(methodMap[_selectedPayMethod] || '카드', {
        amount: totalGross,
        orderId: 'CART_' + Date.now(),
        orderName: _cartItems.length > 1 ? `${_cartItems[0].eventName} 외 ${_cartItems.length - 1}건` : _cartItems[0].eventName,
        customerName: '홍길동',
        successUrl: `${window.location.origin}/payment-success.html`,
        failUrl: `${window.location.origin}/payment-fail.html`,
      });
    } catch (err) {
      if (err.code !== 'USER_CANCEL') {
        Toast.error(`결제 오류: ${err.message}`);
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadCartData();
  initCartPayment();
});
