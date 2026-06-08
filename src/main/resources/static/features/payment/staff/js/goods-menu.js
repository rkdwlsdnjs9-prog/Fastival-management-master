let optionGroupCount = 0;
      let allGoodsCache = [];

      function getAuthHeader() {
        return localStorage.getItem('userToken') || sessionStorage.getItem('userToken') || 'festio-admin-jwt-token-7777';
      }

      document.addEventListener('DOMContentLoaded', () => {
        loadMyGoods();
        setupOptionGroupBtn();
        setupGoodsOptionGenerator();
        setupRegisterGoodsBtn();
        setupImageUpload();
      });

      function setupImageUpload() {
        const manualFileInput = document.getElementById('manualFileInput');
        const goodsImagePreview = document.getElementById('goodsImagePreview');
        const goodsImageUrlInput = document.getElementById('goodsImageUrlInput');
        const clearImageBtn = document.getElementById('clearImageBtn');
        const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1489641493513-ba4ee84ccea9?auto=format&fit=crop&w=150&h=150&q=80';

        manualFileInput.addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (!file) return;
          if (file.size > 5 * 1024 * 1024) {
            alert('⚠️ 이미지 용량은 최대 5MB를 넘을 수 없습니다!');
            manualFileInput.value = '';
            return;
          }

          const reader = new FileReader();
          reader.onload = function(evt) {
            goodsImageUrlInput.value = evt.target.result;
            goodsImagePreview.src = evt.target.result;
            clearImageBtn.style.display = 'block';
          };
          reader.readAsDataURL(file);
        });

        clearImageBtn.addEventListener('click', () => {
          manualFileInput.value = '';
          goodsImageUrlInput.value = '';
          goodsImagePreview.src = DEFAULT_IMAGE;
          clearImageBtn.style.display = 'none';
        });
      }

      function setupGoodsOptionGenerator() {
        document.getElementById('generateOptBtn').addEventListener('click', () => {
          const optName = document.getElementById('optGenName').value.trim();
          const optValuesRaw = document.getElementById('optGenValues').value.trim();

          if (!optName) { alert('⚠️ 옵션명을 입력해 주세요! (예: 사이즈)'); return; }
          if (!optValuesRaw) { alert('⚠️ 옵션값을 입력해 주세요! (예: S, M, L)'); return; }

          const values = optValuesRaw.split(',').map(v => v.trim()).filter(v => v.length > 0);
          if (values.length === 0) { alert('⚠️ 올바른 옵션값을 입력해 주세요!'); return; }

          optionGroupCount++;
          const container = document.getElementById('optionGroupsContainer');
          const groupId = `optGroup_${optionGroupCount}`;

          let itemsHtml = '';
          values.forEach(val => {
            itemsHtml += `
              <div class="row g-2 mb-2 option-item-row">
                <div class="col-6"><input type="text" class="form-control form-control-sm option-item-name" value="${val}" style="font-size:0.9rem;" /></div>
                <div class="col-4"><input type="number" class="form-control form-control-sm option-item-price" value="0" style="font-size:0.9rem;" /></div>
                <div class="col-2 d-flex align-items-center">
                  <button type="button" class="btn btn-sm btn-outline-secondary w-100" onclick="removeOptionItem(this)"><i class="bx bx-minus"></i></button>
                </div>
              </div>
            `;
          });

          const groupHtml = `
            <div class="border border-2 rounded-3 p-4 mb-3 bg-light" id="${groupId}">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <div class="d-flex align-items-center gap-2 flex-grow-1 me-3">
                  <strong class="text-dark fs-6 text-nowrap">그룹 ${optionGroupCount}:</strong>
                  <input type="text" class="form-control form-control-sm option-group-name" value="${optName}" style="font-size:0.9rem;" />
                </div>
                <button type="button" class="btn btn-sm btn-link text-danger p-0 fw-bold" onclick="removeOptionGroup('${groupId}')">
                  <i class="bx bx-trash me-1"></i>삭제
                </button>
              </div>
              <div class="option-items-wrapper">
                ${itemsHtml}
              </div>
              <button type="button" class="btn btn-sm btn-outline-info mt-2" onclick="addOptionItem(this)">
                <i class="bx bx-plus me-1"></i>옵션 항목 추가
              </button>
            </div>
          `;
          container.insertAdjacentHTML('beforeend', groupHtml);

          // 입력 초기화
          document.getElementById('optGenName').value = '';
          document.getElementById('optGenValues').value = '';
        });
      }

      function setupOptionGroupBtn() {
        document.getElementById('addOptionGroupBtn').addEventListener('click', () => {
          optionGroupCount++;
          const container = document.getElementById('optionGroupsContainer');
          const groupId = `optGroup_${optionGroupCount}`;

          const groupHtml = `
            <div class="border border-2 rounded-3 p-4 mb-3 bg-light" id="${groupId}">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <div class="d-flex align-items-center gap-2 flex-grow-1 me-3">
                  <strong class="text-dark fs-6 text-nowrap">그룹 ${optionGroupCount}:</strong>
                  <input type="text" class="form-control form-control-sm option-group-name" placeholder="그룹명 (예: 사이즈 선택)" style="font-size:0.9rem;" />
                </div>
                <button type="button" class="btn btn-sm btn-link text-danger p-0 fw-bold" onclick="removeOptionGroup('${groupId}')">
                  <i class="bx bx-trash me-1"></i>삭제
                </button>
              </div>
              <div class="option-items-wrapper">
                <div class="row g-2 mb-2 option-item-row">
                  <div class="col-6"><input type="text" class="form-control form-control-sm option-item-name" placeholder="옵션값" style="font-size:0.9rem;" /></div>
                  <div class="col-4"><input type="number" class="form-control form-control-sm option-item-price" placeholder="추가금액" value="0" style="font-size:0.9rem;" /></div>
                  <div class="col-2 d-flex align-items-center">
                    <button type="button" class="btn btn-sm btn-outline-secondary w-100" onclick="removeOptionItem(this)"><i class="bx bx-minus"></i></button>
                  </div>
                </div>
              </div>
              <button type="button" class="btn btn-sm btn-outline-info mt-2" onclick="addOptionItem(this)">
                <i class="bx bx-plus me-1"></i>옵션 항목 추가
              </button>
            </div>
          `;
          container.insertAdjacentHTML('beforeend', groupHtml);
        });
      }

      window.addOptionItem = function(btn) {
        const wrapper = btn.closest('.border').querySelector('.option-items-wrapper');
        const rowHtml = `
          <div class="row g-2 mb-2 option-item-row">
            <div class="col-6"><input type="text" class="form-control form-control-sm option-item-name" placeholder="옵션값" style="font-size:0.9rem;" /></div>
            <div class="col-4"><input type="number" class="form-control form-control-sm option-item-price" placeholder="추가금액" value="0" style="font-size:0.9rem;" /></div>
            <div class="col-2 d-flex align-items-center">
              <button type="button" class="btn btn-sm btn-outline-secondary w-100" onclick="removeOptionItem(this)"><i class="bx bx-minus"></i></button>
            </div>
          </div>
        `;
        wrapper.insertAdjacentHTML('beforeend', rowHtml);
      }

      window.removeOptionItem = function(btn) {
        const row = btn.closest('.option-item-row');
        if (row) row.remove();
      }

      window.removeOptionGroup = function(groupId) {
        const group = document.getElementById(groupId);
        if (group) group.remove();
      }

      function collectOptionGroups() {
        const groups = [];
        document.querySelectorAll('#optionGroupsContainer .border').forEach(group => {
          const groupName = group.querySelector('.option-group-name')?.value.trim() || '옵션';
          const items = [];
          group.querySelectorAll('.option-item-row').forEach(row => {
            const name = row.querySelector('.option-item-name')?.value.trim();
            const price = parseInt(row.querySelector('.option-item-price')?.value || '0', 10);
            if (name) items.push({ name, price });
          });
          if (items.length > 0) groups.push({ groupName, items });
        });
        return groups;
      }

      function setupRegisterGoodsBtn() {
        document.getElementById('registerGoodsBtn').addEventListener('click', () => {
          const nameInput = document.getElementById('goodsNameInput');
          const priceInput = document.getElementById('goodsPriceInput');
          const categorySelect = document.getElementById('goodsCategorySelect');

          const name = nameInput.value.trim();
          const price = parseInt(priceInput.value || '0', 10);
          const productType = categorySelect.value;
          const optionGroups = collectOptionGroups();
          const imageUrl = document.getElementById('goodsImageUrlInput').value;

          if (!name) { alert('⚠️ 상품명을 입력해 주세요!'); nameInput.focus(); return; }
          if (isNaN(price) || price < 0) { alert('⚠️ 유효한 판매 가격을 입력해 주세요!'); priceInput.focus(); return; }

          const btn = document.getElementById('registerGoodsBtn');
          btn.disabled = true;
          btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>등록 중...';

          fetch('/api/payment/staff/menus', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': getAuthHeader()
            },
            body: JSON.stringify({ name, price, productType, optionGroups, imageUrl })
          })
          .then(res => {
            if (!res.ok) return res.json().then(err => { throw new Error(err.message || '등록 실패'); });
            return res.json();
          })
          .then(data => {
            alert(`✅ 공식 굿즈가 정상 등록되었습니다!\n📦 상품명: ${data.name}`);
            
            nameInput.value = '';
            priceInput.value = '';
            document.getElementById('optionGroupsContainer').innerHTML = '';
            optionGroupCount = 0;
            document.getElementById('clearImageBtn').click();

            loadMyGoods();
          })
          .catch(err => {
            console.error(err);
            alert('❌ 상품 등록 중 오류가 발생했습니다.\n' + err.message);
          })
          .finally(() => {
            btn.disabled = false;
            btn.innerHTML = '<i class="bx bx-check-circle me-2 fs-5"></i>신규 상품(굿즈) 마스터 최종 등록';
          });
        });
      }

      function loadMyGoods() {
        const container = document.getElementById('goodsItemContainer');
        container.innerHTML = `
          <div class="text-center py-5">
            <div class="spinner-border text-primary" role="status"></div>
            <p class="mt-2 text-muted fs-7">공식 MD 리스트 로딩 중...</p>
          </div>
        `;

        fetch('/api/payment/staff/menus', {
          headers: { 'Authorization': getAuthHeader() }
        })
        .then(res => { if (!res.ok) throw new Error('MD 로드 실패'); return res.json(); })
        .then(goodsList => {
          allGoodsCache = goodsList;
          renderGoods('all');
        })
        .catch(err => {
          console.error(err);
          container.innerHTML = `<div class="text-center text-danger py-4">상품 목록을 불러오지 못했습니다.</div>`;
        });
      }

      window.filterGoods = function(cat) {
        document.querySelectorAll('[id^="filter-"]').forEach(btn => {
          btn.classList.remove('active-filter-goods');
        });
        const activeBtn = document.getElementById(`filter-${cat.toLowerCase()}`);
        if (activeBtn) activeBtn.classList.add('active-filter-goods');

        renderGoods(cat);
      }

      function renderGoods(categoryFilter) {
        const container = document.getElementById('goodsItemContainer');
        container.innerHTML = '';

        const filtered = allGoodsCache.filter(item => {
          if (categoryFilter === 'all') return true;
          return item.product_type === categoryFilter;
        });

        if (filtered.length === 0) {
          container.innerHTML = `<div class="text-center text-muted py-5 fs-7">해당 카테고리에 등록된 상품이 없습니다.</div>`;
          return;
        }

        filtered.forEach(item => {
          const optText = item.option_groups_json ? JSON.parse(item.option_groups_json) : [];
          let optionPreview = '';
          if (optText && optText.length > 0) {
            optionPreview = `
              <div class="mt-2 small text-primary">
                ${optText.map(g => `<strong>${g.groupName}</strong>: ${g.items.map(i => i.name).join(', ')}`).join('<br>')}
              </div>
            `;
          }

          const cardHtml = `
            <div class="d-flex align-items-center p-3 border rounded-3 bg-white hover-shadow transition-all" style="gap:12px;">
              <img src="${item.image_url || 'https://images.unsplash.com/photo-1489641493513-ba4ee84ccea9?auto=format&fit=crop&w=150&h=150&q=80'}" class="rounded object-fit-cover border" style="width: 64px; height: 64px;" />
              <div class="flex-grow-1">
                <div class="d-flex justify-content-between align-items-start">
                  <h6 class="mb-1 fw-bold text-dark text-truncate" style="max-width: 180px;">${item.name}</h6>
                  <span class="badge badge-goods-label fs-8">${item.product_type || 'GOODS'}</span>
                </div>
                <div class="fw-bold text-dark text-primary">₩${(item.price || 0).toLocaleString()}</div>
                ${optionPreview}
              </div>
              <div>
                <button type="button" class="btn btn-sm btn-icon btn-outline-danger" onclick="deleteGoods(${item.id})"><i class="bx bx-trash"></i></button>
              </div>
            </div>
          `;
          container.insertAdjacentHTML('beforeend', cardHtml);
        });
      }

      window.deleteGoods = function(goodsId) {
        if (!confirm('정말로 이 상품을 삭제하시겠습니까?')) return;

        fetch(`/api/payment/staff/menus/${goodsId}`, {
          method: 'DELETE',
          headers: { 'Authorization': getAuthHeader() }
        })
        .then(res => { if (!res.ok) throw new Error('삭제 실패'); return res.json(); })
        .then(data => {
          alert('🗑️ 상품이 삭제되었습니다.');
          loadMyGoods();
        })
        .catch(err => {
          console.error(err);
          alert('삭제 중 오류가 발생했습니다.');
        });
      }