let allInventoryCache = [];

      function getAuthHeader() {
        return localStorage.getItem('userToken') || sessionStorage.getItem('userToken') || 'festio-admin-jwt-token-7777';
      }

      document.addEventListener('DOMContentLoaded', () => {
        loadInventory();
      });

      function loadInventory() {
        fetch('/api/payment/staff/menus', {
          headers: { 'Authorization': getAuthHeader() }
        })
        .then(res => {
          if (!res.ok) throw new Error('재고 데이터 로드 실패');
          return res.json();
        })
        .then(menus => {
          allInventoryCache = menus;
          renderGoodsAccordion(menus);
        })
        .catch(err => {
          console.error(err);
          document.getElementById('inventoryAccordion').innerHTML = `<div class="text-center text-danger py-5">재고 데이터를 불러오지 못했습니다.</div>`;
        });
      }

      function renderGoodsAccordion(menus) {
        const accordion = document.getElementById('inventoryAccordion');
        accordion.innerHTML = '';

        if (menus.length === 0) {
          accordion.innerHTML = '<div class="text-center text-muted py-5">등록된 굿즈 상품이 없습니다. MD 및 굿즈 등록에서 상품을 먼저 추가해 주세요.</div>';
          return;
        }

        menus.forEach((menu, index) => {
          const collapseId = `collapse_${menu.id}`;
          const headerId = `heading_${menu.id}`;
          
          let optionGroups = [];
          try {
            if (menu.option_groups_json) {
              optionGroups = JSON.parse(menu.option_groups_json);
            }
          } catch(e) {
            console.error('옵션 파싱 에러', e);
          }

          let optionRowsHtml = '';
          if (optionGroups.length === 0) {
            // 단일 상품 (옵션 없음)
            optionRowsHtml = `
              <div class="row align-items-center py-3 border-bottom g-3">
                <div class="col-md-4 col-12">
                  <span class="badge bg-label-secondary me-2">단품</span>
                  <span class="fw-bold text-dark">기본 규격 (No Option)</span>
                </div>
                <div class="col-md-5 col-8 d-flex align-items-center gap-2">
                  <div class="input-group input-group-sm" style="max-width: 200px;">
                    <span class="input-group-text">총 물리재고</span>
                    <input type="number" class="form-control text-center" id="total_stock_${menu.id}_none" value="${menu.total_stock || 0}" min="0">
                    <button class="btn btn-primary" onclick="updateStockSingle(${menu.id})">적용</button>
                  </div>
                  <div class="fs-7 text-muted ms-2">
                    대기: <strong class="text-warning">${menu.reserved_stock || 0}</strong> | 
                    가용: <strong class="text-success">${menu.available_stock || 0}</strong>
                  </div>
                </div>
                <div class="col-md-3 col-4 text-end">
                  <div class="form-check form-switch d-inline-block">
                    <input class="form-check-input" type="checkbox" id="soldout_${menu.id}_none" ${menu.is_soldout ? 'checked' : ''} onchange="toggleSoldoutSingle(${menu.id}, this.checked)" style="transform: scale(1.3); cursor: pointer;" />
                    <label class="form-check-label ms-1 text-danger fw-bold" for="soldout_${menu.id}_none">품절 처리</label>
                  </div>
                </div>
              </div>
            `;
          } else {
            // 옵션/규격 목록 렌더링
            optionGroups.forEach((group, gIdx) => {
              group.items.forEach((item, iIdx) => {
                const totalStock = item.total_stock !== undefined ? item.total_stock : 999;
                const reservedStock = item.reserved_stock !== undefined ? item.reserved_stock : 0;
                const availableStock = item.available_stock !== undefined ? item.available_stock : 999;
                const isSoldout = item.is_soldout === true || item.is_soldout === 'true';

                optionRowsHtml += `
                  <div class="row align-items-center py-3 border-bottom g-3 option-item-row" data-group-name="${group.groupName}" data-item-name="${item.name}">
                    <div class="col-md-4 col-12">
                      <span class="badge bg-label-primary me-2">${group.groupName}</span>
                      <span class="fw-bold text-dark">${item.name}</span>
                      <small class="text-muted ms-1">(+₩${(item.price || 0).toLocaleString()})</small>
                    </div>
                    <div class="col-md-5 col-8 d-flex align-items-center gap-2">
                      <div class="input-group input-group-sm" style="max-width: 200px;">
                        <span class="input-group-text">총 물리재고</span>
                        <input type="number" class="form-control text-center opt-total-stock-input" value="${totalStock}" min="0">
                        <button class="btn btn-primary" onclick="updateStockNested(${menu.id}, ${gIdx}, ${iIdx}, this)">적용</button>
                      </div>
                      <div class="fs-7 text-muted ms-2">
                        대기: <strong class="text-warning">${reservedStock}</strong> | 
                        가용: <strong class="text-success">${availableStock}</strong>
                      </div>
                    </div>
                    <div class="col-md-3 col-4 text-end">
                      <div class="form-check form-switch d-inline-block">
                        <input class="form-check-input opt-soldout-toggle" type="checkbox" ${isSoldout ? 'checked' : ''} onchange="toggleSoldoutNested(${menu.id}, ${gIdx}, ${iIdx}, this.checked)" style="transform: scale(1.3); cursor: pointer;" />
                        <label class="form-check-label ms-1 text-danger fw-bold">품절 처리</label>
                      </div>
                    </div>
                  </div>
                `;
              });
            });
          }

          const cardHtml = `
            <div class="accordion-item goods-card border-0 mb-3 overflow-hidden shadow-sm">
              <h2 class="accordion-header" id="${headerId}">
                <button class="accordion-button collapsed fw-bold d-flex justify-content-between align-items-center" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="false" aria-controls="${collapseId}">
                  <div class="d-flex align-items-center gap-3 w-100 me-3">
                    <img src="${menu.image_url || 'https://images.unsplash.com/photo-1489641493513-ba4ee84ccea9?auto=format&fit=crop&w=150&h=150&q=80'}" class="rounded border" style="width: 42px; height: 42px; object-fit: cover;" />
                    <div class="flex-grow-1">
                      <span class="text-dark fs-6">${menu.name}</span>
                      <span class="badge badge-goods-label ms-2">${menu.product_type || 'GOODS'}</span>
                    </div>
                    <div class="text-end text-muted fs-7">
                      가격: ₩${(menu.price || 0).toLocaleString()} | 
                      총 가용재고: <span class="badge bg-success">${menu.available_stock || 0}</span>
                    </div>
                  </div>
                </button>
              </h2>
              <div id="${collapseId}" class="accordion-collapse collapse" aria-labelledby="${headerId}" data-bs-parent="#inventoryAccordion">
                <div class="accordion-body bg-white border-top p-4">
                  ${optionRowsHtml}
                </div>
              </div>
            </div>
          `;
          accordion.insertAdjacentHTML('beforeend', cardHtml);
        });
      }

      // 단품 재고 적용
      window.updateStockSingle = function(menuId) {
        const val = parseInt(document.getElementById(`total_stock_${menuId}_none`).value, 10);
        if (isNaN(val) || val < 0) { alert('유효한 재고 수량을 입력해 주세요.'); return; }

        fetch(`/api/payment/staff/menus/${menuId}/stock`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': getAuthHeader() },
          body: JSON.stringify({ totalStock: val })
        })
        .then(res => { if (!res.ok) throw new Error('재고 수정 실패'); return res.json(); })
        .then(data => {
          alert('재고가 정상 저장되었습니다.');
          loadInventory();
        })
        .catch(err => { console.error(err); alert('재고 조정 중 오류가 발생했습니다.'); });
      }

      // 단품 품절 토글
      window.toggleSoldoutSingle = function(menuId, isChecked) {
        fetch(`/api/payment/staff/menus/${menuId}/soldout`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': getAuthHeader() },
          body: JSON.stringify({ isSoldout: isChecked })
        })
        .then(res => { if (!res.ok) throw new Error('품절 상태 제어 실패'); return res.json(); })
        .then(data => {
          alert(data.isSoldout ? '🔴 품절 처리 완료' : '🟢 판매 개시 완료');
          loadInventory();
        })
        .catch(err => {
          console.error(err);
          alert('품절 제어 중 오류가 발생했습니다.');
        });
      }

      // 중첩 옵션 규격 재고 적용
      window.updateStockNested = function(menuId, gIdx, iIdx, btnElement) {
        const row = btnElement.closest('.option-item-row');
        const inputVal = parseInt(row.querySelector('.opt-total-stock-input').value, 10);
        if (isNaN(inputVal) || inputVal < 0) { alert('유효한 재고 수량을 입력해 주세요.'); return; }

        const menu = allInventoryCache.find(m => m.id === menuId);
        if (!menu) return;

        let optionGroups = JSON.parse(menu.option_groups_json);
        const item = optionGroups[gIdx].items[iIdx];
        
        // 데이터 업데이트
        const oldReserved = item.reserved_stock !== undefined ? item.reserved_stock : 0;
        item.total_stock = inputVal;
        item.available_stock = inputVal - oldReserved;
        if (item.available_stock < 0) item.available_stock = 0;

        // 전체 총 재고 합산 업데이트
        let newTotalSum = 0;
        optionGroups.forEach(g => {
          g.items.forEach(it => {
            newTotalSum += (it.total_stock || 0);
          });
        });

        fetch(`/api/payment/staff/menus/${menuId}/stock`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': getAuthHeader() },
          body: JSON.stringify({
            totalStock: newTotalSum,
            optionGroups: optionGroups
          })
        })
        .then(res => { if (!res.ok) throw new Error('재고 수정 실패'); return res.json(); })
        .then(data => {
          alert('해당 옵션 규격의 재고가 수정되었습니다.');
          loadInventory();
        })
        .catch(err => { console.error(err); alert('재고 수정 실패'); });
      }

      // 중첩 옵션 규격 품절 처리 토글
      window.toggleSoldoutNested = function(menuId, gIdx, iIdx, isChecked) {
        const menu = allInventoryCache.find(m => m.id === menuId);
        if (!menu) return;

        let optionGroups = JSON.parse(menu.option_groups_json);
        optionGroups[gIdx].items[iIdx].is_soldout = isChecked;

        // 하나라도 판매 중이면 상품 자체는 판매 가능하도록 처리하기 위해,
        // 모든 옵션 항목이 품절이면 상품 자체도 SOLD_OUT 처리
        let allSoldout = true;
        optionGroups.forEach(g => {
          g.items.forEach(it => {
            if (!it.is_soldout) allSoldout = false;
          });
        });

        fetch(`/api/payment/staff/menus/${menuId}/stock`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': getAuthHeader() },
          body: JSON.stringify({
            totalStock: menu.total_stock,
            optionGroups: optionGroups
          })
        })
        .then(res => { if (!res.ok) throw new Error('재고 수정 실패'); return res.json(); })
        .then(data => {
          // 필요 시 상품 전체 상태도 강제 조정
          return fetch(`/api/payment/staff/menus/${menuId}/soldout`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': getAuthHeader() },
            body: JSON.stringify({ isSoldout: allSoldout })
          });
        })
        .then(res => res.json())
        .then(data => {
          alert(isChecked ? '🔴 해당 규격이 품절처리 되었습니다.' : '🟢 해당 규격이 다시 판매 개시되었습니다.');
          loadInventory();
        })
        .catch(err => { console.error(err); alert('품절 처리 중 오류 발생'); });
      }