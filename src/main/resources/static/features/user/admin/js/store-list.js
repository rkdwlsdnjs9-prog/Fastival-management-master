// JWT 토큰 획득 헬퍼 함수
      function getAuthHeader() {
        const token = localStorage.getItem('userToken') || sessionStorage.getItem('userToken');
        return token ? 'Bearer ' + token : '';
      }

      // 구역(Zone) 목록을 전역 보관하여, 상점 렌더링 시 드롭다운 매핑용으로 재사용
      let festivalZonesCache = [];
      let activeFestivals = [];
      let currentFestivalId = null;

      document.addEventListener("DOMContentLoaded", function() {
        loadFestivals();
      });

      /**
       * DB에 저장된 실제 대표 이미지(thumbnail_url / thumbnailUrl) 반환 및 정밀 검증 함수
       */
      function getFestivalPoster(f) {
        const dbThumbnail = f.thumbnailUrl || f.thumbnail_url;
        if (dbThumbnail && dbThumbnail.trim() !== "") {
          if (dbThumbnail.startsWith("data:")) {
            try {
              const parts = dbThumbnail.split(",");
              if (parts.length < 2 || !parts[0].includes("base64")) {
                throw new Error("Invalid format");
              }
              window.atob(parts[1].replace(/\s/g, ""));
            } catch (e) {
              return "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=500";
            }
          }
          return dbThumbnail;
        }
        return "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=500";
      }

      // 1. 전체 페스티벌 조회 및 가로형 카드 그리드 렌더링
      function loadFestivals() {
        fetch("/api/festival", {
          headers: {
            "Authorization": getAuthHeader()
          }
        })
          .then(res => {
            if (!res.ok) throw new Error("페스티벌 로드 실패");
            return res.json();
          })
          .then(festivals => {
            // UPCOMING 상태인 축제들만 필터링하여 노출 (동일한 디자인 일관성 유지)
            activeFestivals = festivals.length > 0 
              ? festivals.filter(f => f.operationalStatus === 'UPCOMING' || f.operational_status === 'UPCOMING') 
              : [];

            renderFestivalGrid();

            // 첫 번째 행사 데이터 즉시 로드 및 선택
            if (activeFestivals.length > 0) {
              selectFestival(activeFestivals[0].id);
            } else {
              renderEmptyStores("등록된 모집 대상(UPCOMING) 축제가 존재하지 않습니다.");
            }
          })
          .catch(err => {
            console.error("축제 목록 조회 오류:", err);
            renderEmptyStores("행사 정보를 불러오는 중 오류가 발생했습니다.");
          });
      }

      // 2. 가로형 프리미엄 축제 카드 동적 렌더러
      function renderFestivalGrid() {
        const gridContainer = document.getElementById("festivalCardGrid");
        gridContainer.innerHTML = "";

        if (activeFestivals.length === 0) {
          gridContainer.innerHTML = '<div class="text-muted fs-7 py-3 px-2"><i class="bx bx-info-circle me-1"></i>현재 모집 대기인 축제가 없습니다.</div>';
          return;
        }

        activeFestivals.forEach(f => {
          const cardHtml = `
            <div class="card festival-select-card cursor-pointer flex-shrink-0" 
                 id="fest-card-${f.id}" 
                 style="width: 380px; max-width: 380px;" 
                 data-id="${f.id}">
              <div class="row g-0 h-100">
                <div class="col-4 position-relative overflow-hidden" style="min-height: 110px;">
                  <img src="${getFestivalPoster(f)}" 
                       class="img-fluid rounded-start h-100 object-fit-cover" 
                       style="height: 100%; min-height: 110px; width: 100%; object-fit: cover;" 
                       alt="축제 포스터" 
                       onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=500';" />
                </div>
                <div class="col-8">
                  <div class="card-body p-3 d-flex flex-column justify-content-between h-100">
                    <div>
                      <h6 class="card-title fw-bold text-dark mb-1 text-truncate" style="font-size: 14.5px;">${f.name}</h6>
                      <p class="card-text text-muted mb-2 font-semibold" style="font-size: 12px;">
                        <i class="bx bx-calendar-event me-1 text-secondary"></i>${f.startDate} ~ ${f.endDate}
                      </p>
                    </div>
                    <div class="d-flex align-items-center justify-content-between mt-2 pt-1 border-top" style="border-color: #f3f4f6 !important;">
                      <span class="badge bg-label-info rounded-pill px-2 py-1" style="font-size: 9px; letter-spacing: 0.5px;">UPCOMING</span>
                      <span class="badge bg-light text-secondary rounded-pill px-2 py-1" style="font-size: 10px;">가맹점 관리</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          `;
          gridContainer.insertAdjacentHTML("beforeend", cardHtml);
        });

        // 카드들에 클릭 이벤트 바인딩
        gridContainer.querySelectorAll(".festival-select-card").forEach(card => {
          card.addEventListener("click", () => {
            selectFestival(Number(card.dataset.id));
          });
        });
      }

      // 3. 축제 선택 핸들러
      function selectFestival(id) {
        activeFestivals.forEach(f => {
          const card = document.getElementById(`fest-card-${f.id}`);
          if (card) card.classList.remove("active");
        });

        const selectedCard = document.getElementById(`fest-card-${id}`);
        if (selectedCard) {
          selectedCard.classList.add("active");
        }

        currentFestivalId = id;

        // 하단 가맹점 정보 리로드
        loadStoresForFestival(id);
      }

      // 4. 선택된 행사의 상점(가맹점) 목록 및 구역 정보 로드
      function loadStoresForFestival(festivalId) {
        if (!festivalId) return;

        const container = document.getElementById("storeContainer");
        container.innerHTML = `
          <div class="col-12 text-center py-6">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">로딩 중...</span>
            </div>
            <p class="mt-2 text-muted">행사 입점 가맹점을 불러오는 중입니다...</p>
          </div>
        `;

        // 구역(Zone) 정보 먼저 동기적으로 로드 후, 상점 목록 조회
        fetch(`/api/admin/stores/zones?festivalId=${festivalId}`, {
          headers: {
            "Authorization": getAuthHeader()
          }
        })
          .then(res => {
            if (!res.ok) throw new Error("구역 로드 실패");
            return res.json();
          })
          .then(zones => {
            festivalZonesCache = zones;
            return fetch(`/api/admin/stores?festivalId=${festivalId}`, {
              headers: {
                "Authorization": getAuthHeader()
              }
            });
          })
          .then(res => {
            if (!res.ok) throw new Error("가맹점 로드 실패");
            return res.json();
          })
          .then(stores => {
            document.getElementById("storeCountBadge").innerText = `입점 업체: ${stores.length}개`;
            renderStoreList(stores);
          })
          .catch(err => {
            console.error("데이터 로드 중 오류:", err);
            renderEmptyStores("입점 가맹점 목록을 로드하는 중 실패했습니다. DB 환경을 확인해 주세요.");
          });
      }

      // 5. 가맹점 카드 리스트 동적 렌더링
      function renderStoreList(stores) {
        const container = document.getElementById("storeContainer");
        container.innerHTML = "";

        if (stores.length === 0) {
          renderEmptyStores("입점 승인된 가맹점이 없습니다.");
          return;
        }

        stores.forEach(store => {
          // 카테고리 뱃지 색상
          let categoryBadge = "bg-label-info";
          if (store.category === "FOOD" || store.category === "DRINK") {
            categoryBadge = "bg-label-primary";
          } else if (store.category === "GATE") {
            categoryBadge = "bg-label-danger";
          } else if (store.category === "GOODS") {
            categoryBadge = "bg-label-warning";
          }
          const statusBadge = store.isOpen ? "bg-success" : "bg-secondary";
          const statusText = store.isOpen ? "영업 중" : "준비 중";

          // 구역 드롭다운 옵션 HTML 생성
          let zoneOptionsHtml = '<option value="">(구역 미정)</option>';
          festivalZonesCache.forEach(zone => {
            const isSelected = zone.id === store.zoneId ? "selected" : "";
            zoneOptionsHtml += `<option value="${zone.id}" ${isSelected}>${zone.zoneName}</option>`;
          });

          const cardHtml = `
            <div class="col-md-6 col-lg-4 mb-6">
              <div class="card h-100 border border-primary shadow-sm">
                <div class="card-header d-flex justify-content-between align-items-center pb-2">
                  <span class="badge ${categoryBadge}">${store.category}</span>
                  <span class="badge ${statusBadge}">${statusText}</span>
                </div>
                <div class="card-body d-flex flex-column justify-content-between">
                  <div>
                    <h5 class="card-title fw-bold mb-2 cursor-pointer text-primary hover-underline" onclick="showProductDrawer(${store.id}, '${store.name}')">
                      <i class="bx bx-store me-1"></i> ${store.name}
                    </h5>
                    <p class="card-text text-muted mb-4 fs-7">
                      <i class="bx bx-time-five me-1"></i>${store.operatingHours || '운영 시간 정보 없음'}
                    </p>
                    <hr class="my-3" />
                    
                    <!-- 구역 배치 정보 폼 -->
                    <div class="mb-3">
                      <label class="form-label fs-7 fw-bold text-secondary">📍 배치 구역 설정</label>
                      <select class="form-select form-select-sm border-primary" id="zone-select-${store.id}">
                        ${zoneOptionsHtml}
                      </select>
                    </div>
                    <div class="mb-4">
                      <label class="form-label fs-7 fw-bold text-secondary">🔢 부스 번호 지정</label>
                      <input type="text" class="form-control form-control-sm border-primary" id="booth-input-${store.id}" value="${store.boothNumber || ''}" placeholder="ex: 1호, A-3" />
                    </div>
                  </div>
                  <div class="d-flex gap-2">
                    <button class="btn btn-warning text-white btn-sm flex-grow-1 fw-bold shadow-sm" style="font-size: 11px;" onclick="savePlacement(${store.id})">
                      <i class="bx bx-save me-1"></i> 구역 저장
                    </button>
                    <button class="btn btn-primary btn-sm flex-grow-1 fw-bold shadow-sm" style="font-size: 11px;" onclick="issueStaffCredentials(${store.id})">
                      <i class="bx bx-key me-1"></i> 스탭 권한 발급
                    </button>
                  </div>
                </div>
              </div>
            </div>
          `;
          container.insertAdjacentHTML("beforeend", cardHtml);
        });
      }

      // 6. 비어 있는 화면 경고 메시지 렌더러
      function renderEmptyStores(message) {
        const container = document.getElementById("storeContainer");
        container.innerHTML = `
          <div class="col-12">
            <div class="card border border-dashed border-secondary py-6 text-center">
              <div class="card-body">
                <div class="mb-3">
                  <i class="bx bx-store-alt text-muted" style="font-size: 4rem;"></i>
                </div>
                <h5 class="fw-bold text-secondary mb-1">${message}</h5>
                <p class="text-muted fs-7 mb-0">현재 선택된 행사에 배치되거나 등록된 가맹점 정보가 존재하지 않습니다.</p>
              </div>
            </div>
          </div>
        `;
      }

      // 7. 구역 배치 및 부스 번호 비동기 저장
      function savePlacement(storeId) {
        const zoneSelect = document.getElementById(`zone-select-${storeId}`);
        const boothInput = document.getElementById(`booth-input-${storeId}`);

        const zoneId = zoneSelect.value;
        const boothNumber = boothInput.value.trim();

        if (!zoneId) {
          alert("📍 배치를 원하는 구역을 필수로 선택해 주세요.");
          return;
        }

        const payload = {
          zoneId: parseInt(zoneId),
          boothNumber: boothNumber
        };

        fetch(`/api/admin/stores/${storeId}/placement`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": getAuthHeader()
          },
          body: JSON.stringify(payload)
        })
        .then(res => {
          if (!res.ok) throw new Error("배치 저장 실패");
          return res.json();
        })
        .then(data => {
          alert(`🟢 [${data.data.name}] 가맹점의 구역 배치 및 부스 번호가 성공적으로 저장되었습니다!`);
          
          // 실시간 화면 새로고침
          loadStoresForFestival(currentFestivalId);
        })
        .catch(err => {
          console.error("배치 저장 오류:", err);
          alert("❌ 구역 저장 중 오류가 발생했습니다. 백엔드/DB 커넥션을 확인하십시오.");
        });
      }

      // 6. 상세 메뉴 동적 조회 및 사이드 드로어 활성화
      function showProductDrawer(storeId, storeName) {
        document.getElementById("drawerStoreName").innerText = storeName;
        const drawerBody = document.getElementById("drawerProductBody");
        const emptyMsg = document.getElementById("drawerEmptyMsg");

        drawerBody.innerHTML = "";
        emptyMsg.classList.add("d-none");

        // Bootstrap Offcanvas 인스턴스 가져오기 및 열기
        const myOffcanvas = new bootstrap.Offcanvas(document.getElementById('productDrawer'));
        myOffcanvas.show();

        fetch(`/api/admin/stores/${storeId}/products`, {
          headers: {
            "Authorization": getAuthHeader()
          }
        })
          .then(res => {
            if (!res.ok) throw new Error("메뉴 로드 실패");
            return res.json();
          })
          .then(products => {
            if (products.length === 0) {
              emptyMsg.classList.remove("d-none");
              return;
            }

            products.forEach(prod => {
              const statusBadge = prod.isSoldout ? "bg-label-danger" : "bg-label-success";
              const statusText = prod.isSoldout ? "품절" : "판매중";
              const formattedPrice = prod.price.toLocaleString();

              const rowHtml = `
                <tr>
                  <td>
                    <div class="d-flex align-items-center gap-2">
                      <img src="${prod.imageUrl || '/assets/img/elements/18.jpg'}" alt="product" class="rounded" style="width: 42px; height: 42px; object-fit: cover;" />
                      <div>
                        <div class="fw-bold fs-7 text-dark">${prod.productName}</div>
                        <small class="text-muted">가용재고: ${prod.availableStock || 0}개</small>
                      </div>
                    </div>
                  </td>
                  <td class="text-end fw-bold text-primary fs-7">₩ ${formattedPrice}</td>
                  <td class="text-center">
                    <span class="badge ${statusBadge} fs-8">${statusText}</span>
                  </td>
                </tr>
              `;
              drawerBody.insertAdjacentHTML("beforeend", rowHtml);
            });
          })
          .catch(err => {
            console.error("메뉴 로드 오류:", err);
            drawerBody.innerHTML = `
              <tr>
                <td colspan="3" class="text-center py-4 text-danger fw-semibold">
                  <i class="bx bx-error me-1"></i> 상품/메뉴 목록 조회에 실패했습니다.
                </td>
              </tr>
            `;
          });
      }

      // 스탭 권한 발급 및 계정 확인 모달 송출 함수
      function issueStaffCredentials(storeId) {
        if (!confirm("🔑 해당 입점사에 대해 스탭 로그인 권한 및 계정을 생성/활성화하시겠습니까?")) {
          return;
        }

        fetch(`/api/admin/stores/${storeId}/staff-credentials`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": getAuthHeader()
          }
        })
        .then(res => {
          if (!res.ok) throw new Error("스탭 권한 발급 실패");
          return res.json();
        })
        .then(data => {
          // 모달 데이터 매핑
          document.getElementById("credentialStoreName").innerText = data.storeName;
          document.getElementById("credentialEmail").value = data.email;
          document.getElementById("credentialPassword").value = data.password;

          // 모달 창 활성화
          const staffModal = new bootstrap.Modal(document.getElementById('staffCredentialsModal'));
          staffModal.show();
        })
        .catch(err => {
          console.error("스탭 권한 발급 중 오류:", err);
          alert("❌ 스탭 권한 계정 생성 중 오류가 발생했습니다. DB 및 백엔드 로그를 확인해 주십시오.");
        });
      }

      // 텍스트 복사 헬퍼 함수
      function copyText(elementId) {
        const inputEl = document.getElementById(elementId);
        inputEl.select();
        inputEl.setSelectionRange(0, 99999); // 모바일 디바이스 지원

        try {
          navigator.clipboard.writeText(inputEl.value);
          alert("📋 클립보드에 성공적으로 복사되었습니다!");
        } catch (err) {
          // navigator.clipboard 미지원 브라우저 대비 fallback
          document.execCommand('copy');
          alert("📋 복사되었습니다!");
        }
      }