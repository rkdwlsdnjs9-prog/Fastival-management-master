function getAuthHeader() {
        return localStorage.getItem('userToken') || sessionStorage.getItem('userToken') || 'festio-admin-jwt-token-7777';
      }

      document.addEventListener('DOMContentLoaded', () => {
        loadOrders();
        // 5초 주기 자동 갱신 설정
        setInterval(loadOrders, 5000);
      });

      function loadOrders() {
        fetch('/api/payment/staff/orders', {
          headers: { 'Authorization': getAuthHeader() }
        })
        .then(res => { if (!res.ok) throw new Error('주문 로드 실패'); return res.json(); })
        .then(orders => {
          renderOrders(orders);
        })
        .catch(err => {
          console.error(err);
        });
      }

      function renderOrders(orders) {
        const newCol = document.getElementById('newOrdersCol');
        const prepCol = document.getElementById('prepOrdersCol');
        const readyCol = document.getElementById('readyOrdersCol');

        newCol.innerHTML = '';
        prepCol.innerHTML = '';
        readyCol.innerHTML = '';

        let newCnt = 0;
        let prepCnt = 0;
        let readyCnt = 0;

        orders.forEach(order => {
          const optText = order.items && order.items[0] && order.items[0].options ? order.items[0].options : '';
          let optBadgeHtml = '';
          if (optText) {
            optBadgeHtml = `<div class="goods-option-text"><i class="bx bx-purchase-tag me-1"></i>선택 규격: ${optText}</div>`;
          }

          const timeStr = order.timestamp ? order.timestamp.replace('T', ' ').substring(11, 16) : '';

          const cardHtml = `
            <div class="card order-card p-3" id="order_${order.id}">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="badge bg-label-secondary fs-8 fw-bold">${order.orderCode}</span>
                <span class="text-muted small">${timeStr}</span>
              </div>
              <h6 class="fw-bold text-dark mb-1">${order.items[0].name} <strong class="text-primary">${order.items[0].quantity}개</strong></h6>
              ${optBadgeHtml}
              <div class="d-flex justify-content-between align-items-center mt-3">
                <span class="fw-bold text-dark">₩${(order.price || 0).toLocaleString()}</span>
                ${getActionButtons(order.id, order.status)}
              </div>
            </div>
          `;

          // 상태별 분류 매핑 (ORDERED ➡️ 신규, COOKING ➡️ 준비중, READY ➡️ 수령대기, Finished/SERVED/COMPLETE ➡️ 노출안함)
          if (order.status === 'ORDERED') {
            newCol.insertAdjacentHTML('beforeend', cardHtml);
            newCnt++;
          } else if (order.status === 'COOKING') {
            prepCol.insertAdjacentHTML('beforeend', cardHtml);
            prepCnt++;
          } else if (order.status === 'READY') {
            readyCol.insertAdjacentHTML('beforeend', cardHtml);
            readyCnt++;
          }
        });

        // 카운터 갱신
        document.getElementById('newCount').innerText = newCnt;
        document.getElementById('prepCount').innerText = prepCnt;
        document.getElementById('readyCount').innerText = readyCnt;

        document.getElementById('badgeNew').innerText = newCnt;
        document.getElementById('badgePrep').innerText = prepCnt;
        document.getElementById('badgeReady').innerText = readyCnt;
      }

      function getActionButtons(orderId, status) {
        if (status === 'ORDERED') {
          return `<button class="btn btn-sm btn-goods-primary py-2 px-3" onclick="updateStatus(${orderId}, 'COOKING')"><i class="bx bx-check me-1"></i>주문 접수 (수락)</button>`;
        } else if (status === 'COOKING') {
          return `<button class="btn btn-sm btn-goods-success py-2 px-3" onclick="updateStatus(${orderId}, 'READY')"><i class="bx bx-gift me-1"></i>포장 완료 (픽업 대기)</button>`;
        } else if (status === 'READY') {
          return `<button class="btn btn-sm btn-goods-complete py-2 px-3" onclick="updateStatus(${orderId}, 'SERVED')"><i class="bx bx-user-check me-1"></i>인도 완료</button>`;
        }
        return '';
      }

      window.updateStatus = function(orderId, nextStatus) {
        let confirmMsg = '';
        if (nextStatus === 'COOKING') confirmMsg = '해당 주문을 접수하고 패키징 준비 상태로 변경하시겠습니까?';
        else if (nextStatus === 'READY') confirmMsg = '굿즈 포장이 완료되었습니까? 고객 앱에 픽업 알림이 전송됩니다.';
        else if (nextStatus === 'SERVED') confirmMsg = '고객이 현장에서 굿즈를 정상 수령하였습니까? 거래가 최종 종결됩니다.';

        if (!confirm(confirmMsg)) return;

        fetch(`/api/payment/staff/orders/${orderId}/status`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': getAuthHeader()
          },
          body: JSON.stringify({ status: nextStatus })
        })
        .then(res => { if (!res.ok) throw new Error('상태 변경 실패'); return res.json(); })
        .then(data => {
          loadOrders();
        })
        .catch(err => {
          console.error(err);
          alert('주문 상태 업데이트 중 오류 발생');
        });
      }