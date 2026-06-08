// Global cache for inventory menus
    let allInventoryMenusCache = [];

    // Token Getter
    function getAuthHeader() {
      const token = localStorage.getItem('userToken') || sessionStorage.getItem('userToken');
      return token ? 'Bearer ' + token : '';
    }

    // API 호출 전 세션 토큰 유효성 검사 및 리다이렉트
    function checkSession() {
      const token = getAuthHeader();
      if (!token) {
        alert("로그인 세션이 만료되었거나 권한이 없습니다. 로그인 페이지로 이동합니다.");
        location.href = "/features/payment/staff/store-management.html"; // 로그인 유도
        return false;
      }
      return true;
    }

    // 가용 실재고 수량별 배민 스타일 상태 배지 반환
    function getBadgeHtml(availableStock, isSoldout) {
      if (isSoldout) {
        return `<span class="badge bg-danger py-2 px-3 fs-7"><i class="bx bx-x-circle me-1"></i>수동 품절</span>`;
      }
      if (availableStock >= 50) {
        return `<span class="badge bg-success py-2 px-3 fs-7"><i class="bx bx-check-circle me-1"></i>🟢 안전</span>`;
      } else if (availableStock > 0) {
        return `<span class="badge bg-warning text-dark py-2 px-3 fs-7"><i class="bx bx-error me-1"></i>🟡 품절 임박</span>`;
      } else {
        return `<span class="badge bg-danger py-2 px-3 fs-7"><i class="bx bx-block me-1"></i>🔴 완전 품절</span>`;
      }
    }

    // 실시간 재고 데이터 로드
    function loadInventory() {
      if (!checkSession()) return;

      fetch('/api/payment/staff/menus', {
        method: 'GET',
        headers: {
          'Authorization': getAuthHeader()
        }
      })
        .then(response => {
          if (response.status === 401 || response.status === 403) {
            throw new Error("UNAUTHORIZED");
          }
          if (!response.ok) throw new Error("재고 데이터를 불러오는데 실패했습니다.");
          return response.json();
        })
        .then(menus => {
          allInventoryMenusCache = menus;
          renderInventory(menus);
        })
        .catch(error => {
          console.error(error);
          if (error.message === "UNAUTHORIZED") {
            alert("세션이 만료되었습니다. 다시 로그인해주세요.");
            location.href = "/Festio/login.html";
          } else {
            alert("재고 데이터를 불러오는 중 오류가 발생했습니다.");
          }
        });
    }

    // UI 동적 렌더링
    function renderInventory(menus) {
      const isGoodsStaff = (localStorage.getItem('userSpecificRole') || sessionStorage.getItem('userSpecificRole')) === 'ROLE_GOODS_STAFF';

      if (isGoodsStaff) {
        document.querySelector('.table-responsive').style.setProperty('display', 'none', 'important');
        document.querySelector('.d-block.d-md-none').style.setProperty('display', 'none', 'important');
        document.getElementById('goods-accordion-container').style.display = 'block';
        renderGoodsAccordion(menus);
      } else {
        document.querySelector('.table-responsive').style.removeProperty('display');
        document.querySelector('.d-block.d-md-none').style.removeProperty('display');
        document.getElementById('goods-accordion-container').style.display = 'none';
        renderNormalInventory(menus);
      }
    }

    // 푸드 스태프 / 일반 뷰 렌더링
    function renderNormalInventory(menus) {
      const desktopTbody = document.getElementById('desktop-inventory-tbody');
      const mobileList = document.getElementById('mobile-inventory-list');

      desktopTbody.innerHTML = '';
      mobileList.innerHTML = '';

      if (menus.length === 0) {
        const emptyRow = `<tr><td colspan="6" class="text-center py-4 text-muted fs-6"><i class="bx bx-info-circle me-1"></i>등록된 메뉴가 없습니다. 신규 메뉴를 등록해주세요.</td></tr>`;
        desktopTbody.innerHTML = emptyRow;

        const emptyCard = `<div class="col-12 text-center py-4 text-muted fs-6 bg-white rounded border"><i class="bx bx-info-circle me-1"></i>등록된 메뉴가 없습니다.</div>`;
        mobileList.innerHTML = emptyCard;
        return;
      }

      menus.forEach(item => {
        const totalStock = item.total_stock !== undefined ? item.total_stock : 0;
        const reservedStock = item.reserved_stock !== undefined ? item.reserved_stock : 0;
        const availableStock = item.available_stock !== undefined ? item.available_stock : 0;
        const isSoldout = item.is_soldout === true || item.status === "SOLD_OUT";

        const badgeHtml = getBadgeHtml(availableStock, isSoldout);

        // 1. Desktop & Large Tablet Landscape Row
        const row = document.createElement('tr');
        if (isSoldout) {
          row.className = 'table-light text-muted';
        } else if (availableStock < 50) {
          row.className = 'table-warning';
        }

        row.innerHTML = `
        <td><strong class="fs-6 ${isSoldout ? 'text-muted' : 'text-dark'}">${item.name}</strong></td>
        <td>
          <div class="d-flex align-items-center gap-1">
            <button class="btn btn-sm btn-outline-secondary px-2" onclick="changeStock(${item.id}, ${totalStock}, -10)" ${isSoldout ? 'disabled' : ''}>-10</button>
            <input type="number" class="form-control form-control-sm text-center fw-bold" value="${totalStock}" style="width: 75px;" onchange="updateStock(${item.id}, this.value)" ${isSoldout ? 'disabled' : ''} />
            <button class="btn btn-sm btn-outline-primary px-2" onclick="changeStock(${item.id}, ${totalStock}, 10)" ${isSoldout ? 'disabled' : ''}>+10</button>
          </div>
        </td>
        <td class="fs-6 text-muted">${reservedStock} 개</td>
        <td><span class="fw-bold ${isSoldout ? 'text-muted' : (availableStock < 50 ? 'text-danger' : 'text-primary')} fs-5">${availableStock} 개</span></td>
        <td class="text-center">${badgeHtml}</td>
        <td class="text-end pe-4">
          <div class="form-check form-switch d-inline-block">
            <input class="form-check-input status-toggle-api" type="checkbox" ${isSoldout ? '' : 'checked'} onchange="toggleSoldout(${item.id}, '${item.name.replace(/'/g, "\\'")}', this.checked)" style="transform: scale(1.6); cursor: pointer;" />
          </div>
        </td>
      `;
        desktopTbody.appendChild(row);

        // 2. Tablet Portrait & Mobile Card Layout
        const card = document.createElement('div');
        card.className = 'col-12';

        let cardBorderClass = 'border-success';
        if (isSoldout) {
          cardBorderClass = 'bg-light border-light';
        } else if (availableStock < 50) {
          cardBorderClass = 'border-warning bg-warning bg-opacity-10';
        }

        card.innerHTML = `
        <div class="card shadow-sm border border-2 ${cardBorderClass}">
          <div class="card-body p-4">
            <div class="d-flex justify-content-between align-items-start mb-3">
              <div>
                <h5 class="fw-bold ${isSoldout ? 'text-muted' : 'text-dark'} mb-1">${item.name}</h5>
                ${badgeHtml}
              </div>
              <div class="form-check form-switch">
                <input class="form-check-input status-toggle-api" type="checkbox" ${isSoldout ? '' : 'checked'} onchange="toggleSoldout(${item.id}, '${item.name.replace(/'/g, "\\'")}', this.checked)" style="transform: scale(1.75); cursor: pointer; margin-right: 8px;" />
              </div>
            </div>
            <div class="bg-white rounded p-3 mb-3 d-flex justify-content-between text-center border">
              <div>
                <small class="text-muted d-block mb-1">총 재고</small>
                <span class="fw-bold ${isSoldout ? 'text-muted' : 'text-dark'} fs-6">${totalStock}개</span>
              </div>
              <div class="border-start"></div>
              <div>
                <small class="text-muted d-block mb-1">가선점</small>
                <span class="fw-bold text-muted fs-6">${reservedStock}개</span>
              </div>
              <div class="border-start"></div>
              <div>
                <small class="${isSoldout ? 'text-muted' : (availableStock < 50 ? 'text-danger' : 'text-primary')} d-block mb-1 fw-bold">가용 실재고</small>
                <span class="fw-bold ${isSoldout ? 'text-muted' : (availableStock < 50 ? 'text-danger' : 'text-primary')} fs-5">${availableStock}개</span>
              </div>
            </div>
            <div class="d-flex gap-2">
              <button class="btn btn-outline-secondary btn-lg flex-grow-1 py-3 fw-bold" onclick="changeStock(${item.id}, ${totalStock}, -10)" ${isSoldout || totalStock <= 0 ? 'disabled' : ''}><i class="bx bx-minus me-1"></i> 10개</button>
              <button class="btn btn-outline-primary btn-lg flex-grow-1 py-3 fw-bold" onclick="changeStock(${item.id}, ${totalStock}, 10)" ${isSoldout ? 'disabled' : ''}><i class="bx bx-plus me-1"></i> 10개</button>
            </div>
          </div>
        </div>
      `;
        mobileList.appendChild(card);
      });
    }

    // 굿즈 사장님용 아코디언 뷰 렌더링
    function renderGoodsAccordion(menus) {
      const accordionContainer = document.getElementById('inventoryAccordion');
      accordionContainer.innerHTML = '';

      if (menus.length === 0) {
        accordionContainer.innerHTML = `
          <div class="text-center py-5 text-muted bg-white rounded border">
            <i class="bx bx-info-circle fs-1 mb-2 text-secondary"></i>
            <p class="m-0 fs-7">등록된 상품이 없습니다.</p>
          </div>
        `;
        return;
      }

      menus.forEach((item, index) => {
        let optionGroups = [];
        try {
          if (item.option_groups_json || item.optionGroupsJson) {
            optionGroups = JSON.parse(item.option_groups_json || item.optionGroupsJson);
          }
        } catch (e) {
          console.error("Error parsing option_groups_json:", e);
        }

        const hasRealOptions = optionGroups.length > 0;
        if (!hasRealOptions) {
          optionGroups = [{
            groupName: "단일 옵션",
            items: [{
              name: "기본 단품",
              price: 0,
              total_stock: item.total_stock !== undefined ? item.total_stock : 0,
              reserved_stock: item.reserved_stock !== undefined ? item.reserved_stock : 0,
              available_stock: item.available_stock !== undefined ? item.available_stock : 0,
              is_soldout: item.is_soldout === true || item.status === "SOLD_OUT"
            }]
          }];
        }

        let totalStockSum = 0;
        let reservedStockSum = 0;
        let availableStockSum = 0;
        let allSoldout = true;

        optionGroups.forEach(g => {
          g.items.forEach(opt => {
            const t = opt.total_stock !== undefined ? opt.total_stock : (opt.totalStock !== undefined ? opt.totalStock : 0);
            const r = opt.reserved_stock !== undefined ? opt.reserved_stock : (opt.reservedStock !== undefined ? opt.reservedStock : 0);
            const a = opt.available_stock !== undefined ? opt.available_stock : (opt.availableStock !== undefined ? opt.availableStock : t - r);
            const s = opt.is_soldout === true || opt.isSoldout === true;

            totalStockSum += t;
            reservedStockSum += r;
            availableStockSum += a;
            if (!s && a > 0) {
              allSoldout = false;
            }
          });
        });

        const isSoldout = item.is_soldout === true || item.status === "SOLD_OUT" || allSoldout;
        const imageUrl = item.image_url || item.imageUrl || 'https://images.unsplash.com/photo-1489641493513-ba4ee84ccea9?auto=format&fit=crop&w=150&h=150&q=80';

        let badgeHtml = '';
        if (isSoldout) {
          badgeHtml = `<span class="badge bg-danger py-1 px-2 fs-8"><i class="bx bx-x-circle me-1"></i>품절</span>`;
        } else if (availableStockSum <= 10) {
          badgeHtml = `<span class="badge bg-warning text-dark py-1 px-2 fs-8"><i class="bx bx-error me-1"></i>품절 임박</span>`;
        } else {
          badgeHtml = `<span class="badge bg-success py-1 px-2 fs-8"><i class="bx bx-check-circle me-1"></i>판매 중</span>`;
        }

        const accordionId = `accItem_${item.id}`;
        const collapseId = `accCollapse_${item.id}`;

        let optionsRowsHtml = '';
        optionGroups.forEach((g, gIdx) => {
          g.items.forEach((opt, optIdx) => {
            const oTotal = opt.total_stock !== undefined ? opt.total_stock : (opt.totalStock !== undefined ? opt.totalStock : 0);
            const oReserved = opt.reserved_stock !== undefined ? opt.reserved_stock : (opt.reservedStock !== undefined ? opt.reservedStock : 0);
            const oAvailable = opt.available_stock !== undefined ? opt.available_stock : (opt.availableStock !== undefined ? opt.availableStock : oTotal - oReserved);
            const oSoldout = opt.is_soldout === true || opt.isSoldout === true;

            const displayName = hasRealOptions ? `${g.groupName} - ${opt.name}` : opt.name;

            optionsRowsHtml += `
              <div class="row g-2 align-items-center py-3 border-bottom option-variant-row">
                <div class="col-md-4 col-12">
                  <span class="fw-bold text-dark fs-7 d-block">${displayName}</span>
                  ${opt.price > 0 ? `<small class="text-muted">+ ₩${opt.price.toLocaleString()}</small>` : ''}
                </div>
                <div class="col-md-5 col-8">
                  <div class="d-flex align-items-center gap-2">
                    <div class="d-flex align-items-center">
                      <button type="button" class="btn btn-sm btn-outline-secondary px-2 py-1" 
                              onclick="adjustOptionStock(${item.id}, ${gIdx}, ${optIdx}, -5)" ${oSoldout ? 'disabled' : ''}>-5</button>
                      <input type="number" class="form-control form-control-sm text-center fw-bold mx-1" 
                             value="${oTotal}" style="width: 65px; height: 31px;" 
                             onchange="setOptionStock(${item.id}, ${gIdx}, ${optIdx}, this.value)" ${oSoldout ? 'disabled' : ''} />
                      <button type="button" class="btn btn-sm btn-outline-primary px-2 py-1" 
                              onclick="adjustOptionStock(${item.id}, ${gIdx}, ${optIdx}, 5)" ${oSoldout ? 'disabled' : ''}>+5</button>
                    </div>
                    <span class="fs-8 text-muted text-nowrap ms-2">
                      (가선점: ${oReserved} | 가용: <strong class="${oAvailable <= 5 ? 'text-danger' : 'text-primary'}">${oAvailable}</strong>)
                    </span>
                  </div>
                </div>
                <div class="col-md-3 col-4 text-end">
                  <div class="form-check form-switch d-inline-block">
                    <input class="form-check-input option-soldout-toggle" type="checkbox" 
                           ${oSoldout ? '' : 'checked'} 
                           onchange="toggleOptionSoldout(${item.id}, ${gIdx}, ${optIdx}, this.checked)" 
                           style="transform: scale(1.3); cursor: pointer;" />
                    <label class="form-check-label fs-8 text-muted ms-1">${oSoldout ? '품절' : '판매중'}</label>
                  </div>
                </div>
              </div>
            `;
          });
        });

        const accordionItemHtml = `
          <div class="accordion-item card mb-3 border shadow-none" style="overflow: hidden;">
            <h2 class="accordion-header" id="heading_${accordionId}">
              <div class="accordion-button collapsed py-3 px-4 d-flex justify-content-between align-items-center" 
                   data-bs-toggle="collapse" data-bs-target="#${collapseId}" 
                   aria-expanded="false" aria-controls="${collapseId}" style="cursor: pointer;">
                
                <div class="d-flex align-items-center flex-grow-1">
                  <div class="avatar avatar-md me-3" style="width: 48px; height: 48px;">
                    <img src="${imageUrl}" class="rounded-3 w-100 h-100 object-fit-cover" 
                         onerror="this.src='https://images.unsplash.com/photo-1489641493513-ba4ee84ccea9?auto=format&fit=crop&w=150&h=150&q=80';" />
                  </div>
                  <div class="d-flex flex-column gap-1 text-start">
                    <span class="fw-bold text-dark fs-6 d-block">${item.name}</span>
                    <div class="d-flex align-items-center gap-2 flex-wrap">
                      ${badgeHtml}
                      <span class="fs-8 text-muted">총 재고: <strong>${totalStockSum}</strong>개</span>
                      <span class="fs-8 text-muted">가용 실재고: <strong>${availableStockSum}</strong>개</span>
                    </div>
                  </div>
                </div>

                <div class="me-3 d-flex align-items-center" onclick="event.stopPropagation();">
                  <div class="form-check form-switch m-0">
                    <input class="form-check-input" type="checkbox" ${isSoldout ? '' : 'checked'} 
                           onchange="toggleSoldout(${item.id}, '${item.name.replace(/'/g, "\\'")}', this.checked)" 
                           style="transform: scale(1.4); cursor: pointer;" title="전체 품절/판매개시 토글" />
                  </div>
                </div>

              </div>
            </h2>
            <div id="${collapseId}" class="accordion-collapse collapse" aria-labelledby="heading_${accordionId}" data-bs-parent="#inventoryAccordion">
              <div class="accordion-body bg-white border-top px-4 py-2">
                <div class="mb-2 border-bottom pb-2 text-start">
                  <h6 class="fw-bold text-secondary fs-7 m-0"><i class="bx bx-list-ul me-1"></i>상세 옵션별 재고 조정</h6>
                </div>
                ${optionsRowsHtml}
              </div>
            </div>
          </div>
        `;

        accordionContainer.insertAdjacentHTML('beforeend', accordionItemHtml);
      });
    }

    // 옵션 재고 증감 조정
    function adjustOptionStock(menuId, groupIdx, optIdx, delta) {
      const menu = allInventoryMenusCache.find(x => x.id === menuId);
      if (!menu) return;

      let optionGroups = [];
      try {
        if (menu.option_groups_json || menu.optionGroupsJson) {
          optionGroups = JSON.parse(menu.option_groups_json || menu.optionGroupsJson);
        }
      } catch (e) {
        console.error(e);
      }

      const hasRealOptions = optionGroups.length > 0;
      if (!hasRealOptions) {
        const currentStock = menu.total_stock !== undefined ? menu.total_stock : 0;
        const newStock = Math.max(0, currentStock + delta);
        updateStock(menuId, newStock);
        return;
      }

      const opt = optionGroups[groupIdx].items[optIdx];
      const currentVal = opt.total_stock !== undefined ? opt.total_stock : (opt.totalStock !== undefined ? opt.totalStock : 0);
      const newVal = Math.max(0, currentVal + delta);

      opt.total_stock = newVal;
      opt.totalStock = newVal;
      opt.available_stock = Math.max(0, newVal - (opt.reserved_stock || 0));
      opt.availableStock = opt.available_stock;

      saveGoodsStock(menuId, optionGroups);
    }

    // 옵션 재고 직접 설정
    function setOptionStock(menuId, groupIdx, optIdx, val) {
      const menu = allInventoryMenusCache.find(x => x.id === menuId);
      if (!menu) return;

      const parsed = parseInt(val);
      if (isNaN(parsed) || parsed < 0) {
        alert("올바른 재고 수량을 입력해주세요.");
        loadInventory();
        return;
      }

      let optionGroups = [];
      try {
        if (menu.option_groups_json || menu.optionGroupsJson) {
          optionGroups = JSON.parse(menu.option_groups_json || menu.optionGroupsJson);
        }
      } catch (e) {
        console.error(e);
      }

      const hasRealOptions = optionGroups.length > 0;
      if (!hasRealOptions) {
        updateStock(menuId, parsed);
        return;
      }

      const opt = optionGroups[groupIdx].items[optIdx];
      opt.total_stock = parsed;
      opt.totalStock = parsed;
      opt.available_stock = Math.max(0, parsed - (opt.reserved_stock || 0));
      opt.availableStock = opt.available_stock;

      saveGoodsStock(menuId, optionGroups);
    }

    // 옵션 개별 품절 토글
    function toggleOptionSoldout(menuId, groupIdx, optIdx, isChecked) {
      const menu = allInventoryMenusCache.find(x => x.id === menuId);
      if (!menu) return;

      let optionGroups = [];
      try {
        if (menu.option_groups_json || menu.optionGroupsJson) {
          optionGroups = JSON.parse(menu.option_groups_json || menu.optionGroupsJson);
        }
      } catch (e) {
        console.error(e);
      }

      const hasRealOptions = optionGroups.length > 0;
      if (!hasRealOptions) {
        toggleSoldout(menuId, menu.name, isChecked);
        return;
      }

      const opt = optionGroups[groupIdx].items[optIdx];
      opt.is_soldout = !isChecked;
      opt.isSoldout = !isChecked;

      saveGoodsStock(menuId, optionGroups);
    }

    // 굿즈 사장님 옵션 기반 재고 통합 저장 API 호출
    function saveGoodsStock(menuId, optionGroups) {
      if (!checkSession()) return;

      let totalStockSum = 0;
      optionGroups.forEach(g => {
        g.items.forEach(opt => {
          const t = opt.total_stock !== undefined ? opt.total_stock : (opt.totalStock !== undefined ? opt.totalStock : 0);
          totalStockSum += t;
        });
      });

      fetch(`/api/payment/staff/menus/${menuId}/stock`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': getAuthHeader()
        },
        body: JSON.stringify({
          totalStock: totalStockSum,
          optionGroups: optionGroups
        })
      })
        .then(response => {
          if (!response.ok) throw new Error("재고 및 옵션 업데이트에 실패했습니다.");
          return response.json();
        })
        .then(data => {
          loadInventory();
        })
        .catch(error => {
          console.error(error);
          alert(error.message);
          loadInventory();
        });
    }

    // 재고 편차 조정 함수
    function changeStock(menuId, currentTotal, delta) {
      const newTotal = Math.max(0, currentTotal + delta);
      updateStock(menuId, newTotal);
    }

    // 초기 재고량 업데이트 요청 API 호출
    function updateStock(menuId, totalStock) {
      if (!checkSession()) return;

      const parsedStock = parseInt(totalStock);
      if (isNaN(parsedStock) || parsedStock < 0) {
        alert("올바른 재고 수량을 입력해주세요.");
        loadInventory();
        return;
      }

      fetch(`/api/payment/staff/menus/${menuId}/stock`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': getAuthHeader()
        },
        body: JSON.stringify({ totalStock: parsedStock })
      })
        .then(response => {
          if (!response.ok) throw new Error("재고 업데이트에 실패했습니다.");
          return response.json();
        })
        .then(data => {
          // 갱신 후 자연스럽게 재고 리로드
          loadInventory();
        })
        .catch(error => {
          console.error('재고 업데이트 오류:', error);
          alert(error.message);
        });
    }

    // 배민 스타일 수동 품절 토글
    function toggleSoldout(menuId, menuName, isChecked) {
      if (!checkSession()) return;
      const isSoldout = !isChecked;

      fetch(`/api/payment/staff/menus/${menuId}/soldout`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': getAuthHeader()
        },
        body: JSON.stringify({ isSoldout: isSoldout })
      })
        .then(response => {
          if (!response.ok) throw new Error("품절 상태 제어에 실패했습니다.");
          return response.json();
        })
        .then(data => {
          const activeSoldout = data.isSoldout;
          if (activeSoldout) {
            alert(`🔴 [${menuName}] 상품이 [수동 품절] 처리되었습니다.\n소비자 모바일 화면에서 즉시 주문 버튼이 비활성화되었습니다.`);
          } else {
            alert(`🟢 [${menuName}] 상품이 [판매 개시] 처리되었습니다.\n소비자가 정상적으로 모바일 주문을 넣을 수 있습니다.`);
          }
          loadInventory(); // 상태 스타일 실시간 동기화
        })
        .catch(error => {
          console.error('품절 처리 API 오류:', error);
          alert(error.message);
          loadInventory(); // 오류 발생 시 이전 값 복구
        });
    }

    // DOM 로드 시 즉시 데이터 바인딩 실행
    document.addEventListener('DOMContentLoaded', () => {
      loadInventory();
    });