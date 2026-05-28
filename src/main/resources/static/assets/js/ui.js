// UI rendering and core control panel module
import { DB, saveDB, publish, subscribe, addNotification, toggleWebsocketSimulation } from './store.js';
import { getCurrentUser, login, logout, getStaffList, generateTemporaryAccount } from './auth.js';
import { initializeQRScanner, stopQRScanner, validateTicketState, validateExchangeQR } from './scanner.js';
import { getSeatStats, renderSeatMap, setupRealtimeSeatSync, manualReserveSeat, releaseSeat } from './seats.js';
import { calculateTicketPrice, requestTossPayment, requestRefund, acceptRefund } from './payments.js';
import { getGoodsAvailableStock, lockGoodsStock, unlockGoodsStock, finalizeGoodsPurchase, updateGoodsStock, registerGoods, toggleFoodIngredientOut, registerFood, updateSeasonalPrice, toggleActiveSeason } from './inventory.js';

// DOM selectors
const sidebar = document.getElementById("sidebar");
const toggleSidebarBtn = document.getElementById("toggle-sidebar-btn");
const mainContent = document.getElementById("main-content");
const views = document.querySelectorAll(".content-view");
const menuLinks = document.querySelectorAll(".menu-link");

const headerCheckpoint = document.getElementById("header-checkpoint");
const headerUser = document.getElementById("header-user");
const logoutBtn = document.getElementById("logout-btn");

const notifBell = document.getElementById("notif-bell");
const notifBadge = document.getElementById("notif-badge");
const notifPopover = document.getElementById("notif-popover");
const notifList = document.getElementById("notif-list");

// Init App UI
let selectedSeats = [];

export function initUI() {
  checkAuthSession("dashboard");
  _setupSharedUI();
  setupGlobalSubscriptions();
  renderCurrentView();
}

// Per-page init — called by each standalone HTML page
export function initPage(viewId) {
  const user = getCurrentUser();
  if (!user) {
    // Redirect unauthenticated users back to login
    window.location.href = "index.html";
    return;
  }

  // Show user info in header
  if (headerUser) headerUser.innerText = `스태프: ${user.name}`;
  if (headerCheckpoint) {
    headerCheckpoint.innerText = `[ ${DB.activeCheckpoint.event} / ${DB.activeCheckpoint.tenant} ]`;
  }

  // Highlight current page in sidebar
  menuLinks.forEach(link => link.classList.remove("active"));
  const currentLink = document.querySelector(`.menu-link[data-page="${viewId}"]`);
  if (currentLink) currentLink.classList.add("active");

  _setupSharedUI();
  setupGlobalSubscriptions();

  // Render this page's content
  renderViewData(viewId);
}

function _setupSharedUI() {
  // Sidebar collapse toggle
  if (toggleSidebarBtn) {
    toggleSidebarBtn.onclick = () => {
      sidebar.classList.toggle("collapsed");
      toggleSidebarBtn.innerHTML = sidebar.classList.contains("collapsed") ? "≫" : "≪";
    };
  }

  // Logout handler — always returns to index.html
  if (logoutBtn) {
    logoutBtn.onclick = () => {
      logout();
      window.location.href = "index.html";
    };
  }

  // Notification bell popover toggle
  if (notifBell) {
    notifBell.onclick = (e) => {
      e.stopPropagation();
      notifPopover.classList.toggle("active");
      notifBadge.style.display = "none";
      notifBadge.innerText = "0";
    };
  }
  document.addEventListener("click", () => {
    if (notifPopover) notifPopover.classList.remove("active");
  });
  if (notifPopover) {
    notifPopover.onclick = (e) => e.stopPropagation();
  }
}



function checkAuthSession(defaultView = "dashboard") {
  const user = getCurrentUser();
  if (!user) {
    document.body.classList.add("not-logged-in");
    renderLoginScreen();
  } else {
    document.body.classList.remove("not-logged-in");
    if (headerUser) headerUser.innerText = `스태프: ${user.name}`;
    if (headerCheckpoint) {
      headerCheckpoint.innerText = `[ ${DB.activeCheckpoint.event} / ${DB.activeCheckpoint.tenant} ]`;
    }
    const activeView = document.querySelector(".content-view.active");
    if (!activeView || activeView.id === "view-login") {
      switchView(defaultView);
    }
  }
}


// Router switcher
export function switchView(viewId) {
  const user = getCurrentUser();
  if (!user) {
    renderLoginScreen();
    return;
  }

  views.forEach(v => v.classList.remove("active"));
  menuLinks.forEach(link => link.classList.remove("active"));

  const targetView = document.getElementById(`view-${viewId}`);
  const targetLink = document.querySelector(`.menu-link[data-view="${viewId}"]`);

  if (targetView) {
    targetView.classList.add("active");
    if (targetLink) targetLink.classList.add("active");
    if (viewId === "ticketing") {
      selectedSeats = [];
    }
    renderViewData(viewId);
  }

  // Stop camera if leaving scanner screen
  if (viewId !== 'scanner') {
    stopQRScanner();
  }
}

function renderCurrentView() {
  const activeView = document.querySelector(".content-view.active");
  if (activeView) {
    const viewId = activeView.id.replace("view-", "");
    renderViewData(viewId);
  }
}

// Populate content dynamically on screen swap
function renderViewData(viewId) {
  switch (viewId) {
    case "dashboard":
      renderDashboard();
      break;
    case "scanner":
      renderScannerScreen();
      break;
    case "scan-status":
      renderScanStatusScreen();
      break;
    case "seats":
      renderSeatMapScreen();
      break;
    case "ticketing":
      renderTicketingScreen();
      break;
    case "refund":
      renderRefundScreen();
      break;

    case "orders":
      renderFnbOrdersScreen();
      break;
    case "goods":
      renderGoodsOrdersScreen();
      break;
    case "inventory-goods":
      renderGoodsInventoryScreen();
      break;
    case "inventory-fnb":
      renderFnbInventoryScreen();
      break;
  }
}

// ==========================================
// 1. LOGIN SCREEN RENDERING
// ==========================================
function renderLoginScreen() {
  const loginView = document.getElementById("view-login");
  if (!loginView) return;

  loginView.innerHTML = `
    <div class="login-box-rigid">
      <h2 class="login-title">SYSTEM LOGIN</h2>
      <div class="login-subtitle">스태프 단말기 전용 관제 시스템</div>
      
      <div id="login-error-alert" class="alert-box alert-red" style="display:none;"></div>
      
      <form id="login-form">
        <div class="form-group-rigid">
          <label>ACCESS ID (아이디)</label>
          <input type="text" id="login-id" placeholder="ID 입력" required class="input-rigid">
        </div>
        <div class="form-group-rigid">
          <label>SECURITY PASSWORD (비밀번호)</label>
          <input type="password" id="login-pw" placeholder="PASSWORD 입력" required class="input-rigid">
        </div>
        <button type="submit" class="btn btn-rigid btn-green" style="width:100%; margin-top:15px; font-weight:bold;">
          시스템 액세스 인증
        </button>
      </form>

      <div class="temp-accounts-box">
        <h4>임시 생성된 계정 목록 (테스트용)</h4>
        <ul id="temp-accounts-list"></ul>
        <button id="btn-gen-temp-acc" class="btn btn-rigid btn-small btn-blue" style="width:100%; margin-top:10px;">
          + 테스트용 신규 임시 계정 즉시 발급
        </button>
      </div>
    </div>
  `;

  // Render temporary list
  renderTempAccountsInLogin();

  document.getElementById("btn-gen-temp-acc").onclick = () => {
    generateTemporaryAccount();
    renderTempAccountsInLogin();
  };

  document.getElementById("login-form").onsubmit = (e) => {
    e.preventDefault();
    const id = document.getElementById("login-id").value.trim();
    const pw = document.getElementById("login-pw").value.trim();
    
    const res = login(id, pw);
    if (res.success) {
      checkAuthSession();
    } else {
      const errorBox = document.getElementById("login-error-alert");
      errorBox.innerText = res.error;
      errorBox.style.display = "block";
    }
  };
}

function renderTempAccountsInLogin() {
  const list = document.getElementById("temp-accounts-list");
  if (!list) return;
  list.innerHTML = "";
  getStaffList().forEach(staff => {
    const li = document.createElement("li");
    li.innerHTML = `<span>ID: <strong>${staff.id}</strong> / PW: <strong>${staff.pw}</strong></span> (${staff.name})`;
    li.style.cursor = "pointer";
    li.onclick = () => {
      document.getElementById("login-id").value = staff.id;
      document.getElementById("login-pw").value = staff.pw;
    };
    list.appendChild(li);
  });
}

// ==========================================
// 2. DASHBOARD RENDERING
// ==========================================
function renderDashboard() {
  const view = document.getElementById("view-dashboard");
  if (!view) return;

  const stats = getSeatStats();
  // Filter RECEIVED orders
  const receivedOrders = DB.orders.filter(o => o.status === "RECEIVED" || o.status === "ORDERED");
  
  view.innerHTML = `
    <div class="dashboard-metrics">
      <div class="metric-card metric-green">
        <div class="metric-title">당일 총 입장객 수</div>
        <div class="metric-value" id="dash-total-entered">${stats.entered}명 / ${stats.total}석</div>
        <div class="metric-footer">QR 스캔 완료 게이트 입장 완료 인원</div>
      </div>
      <div class="metric-card metric-blue">
        <div class="metric-title">총 예약건수 (좌석만)</div>
        <div class="metric-value">${stats.reserved + stats.entered}명 / ${stats.total}석</div>
        <div class="metric-footer">결제 승인 완료 및 입장 완료 전체 좌석</div>
      </div>
    </div>

    <div class="dashboard-grid-sections">
      <div class="panel-rigid">
        <div class="panel-header-rigid">
          <span>실시간 주문 대기 목록 (접수 상태)</span>
          <span class="telemetry-pulse">REALTIME BUS</span>
        </div>
        <div class="panel-body-rigid">
          <table class="table-rigid">
            <thead>
              <tr>
                <th>주문번호</th>
                <th>구분</th>
                <th>주문 내역</th>
                <th>시간</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody id="dash-wait-list">
              <!-- Render wait queue -->
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Render Wait Queue
  const waitBody = document.getElementById("dash-wait-list");
  if (receivedOrders.length === 0) {
    waitBody.innerHTML = `<tr><td colspan="5" class="text-center" style="color:#a0aec0;">대기 중인 신규 접수 주문이 없습니다.</td></tr>`;
  } else {
    receivedOrders.forEach(o => {
      const itemsText = o.items.map(item => `${item.name} (${item.quantity}개)`).join(", ");
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><strong>${o.id}</strong></td>
        <td><span class="badge ${o.type === 'GOODS' ? 'badge-blue' : 'badge-amber'}">${o.type}</span></td>
        <td>${itemsText}</td>
        <td>${o.timestamp}</td>
        <td class="text-right">
          <span class="badge badge-purple animate-pulse" style="margin-right:8px;">NEW</span>
          <button class="btn btn-rigid btn-small btn-green btn-quick-accept" data-id="${o.id}">
            접수 수락
          </button>
        </td>
      `;
      waitBody.appendChild(row);
    });
  }

  // Quick Accept Event
  document.querySelectorAll(".btn-quick-accept").forEach(btn => {
    btn.onclick = () => {
      const ordId = btn.getAttribute("data-id");
      const order = DB.orders.find(o => o.id === ordId);
      if (order) {
        if (order.type === "FOOD") {
          order.status = "COOKING";
          publish("order-change", { orderId: ordId, status: "COOKING" });
        } else {
          order.status = "PICKED_UP";
          publish("order-change", { orderId: ordId, status: "PICKED_UP" });
        }
        addNotification("ORDER", `주문 ${ordId}이 스태프 퀵패스로 승인되었습니다.`);
        renderDashboard();
      }
    };
  });
}

// ==========================================
// 3. QR TICKET SCANNER RENDERING
// ==========================================
function renderScannerScreen() {
  const view = document.getElementById("view-scanner");
  if (!view) return;

  view.innerHTML = `
    <div class="panel-rigid" style="max-width: 600px; margin: 0 auto;">
      <div class="panel-header-rigid">입장 게이트 실시간 QR 카메라 스캐너</div>
      <div class="panel-body-rigid text-center">
        <div id="qr-camera-reader-wrapper">
          <div id="qr-camera-reader" style="width: 100%; max-width: 450px; margin: 0 auto; border: 2px solid #2d3748; background:#1a202c;">
            <!-- html5-qrcode camera goes here -->
          </div>
          <div class="qr-scanner-overlay-guide"></div>
          <button id="btn-stop-camera" class="btn btn-rigid btn-red" style="display:none;">카메라 끄기 / 스캔 중단</button>
        </div>
        
        <div style="margin-top: 15px;">
          <button id="btn-start-camera" class="btn btn-rigid btn-blue">카메라 연결 및 스캔 시작</button>
        </div>
        
        <div class="manual-input-box">
          <label>QR 스캔 곤란 시 수동 티켓 ID 검증</label>
          <div style="display:flex; gap:10px; margin-top:5px;">
            <input type="text" id="manual-ticket-id" placeholder="T-XXXX 포맷 입력" class="input-rigid" style="flex:1;">
            <button id="btn-manual-verify" class="btn btn-rigid btn-green">검증 & 입장</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Active Validation Overlay -->
    <div id="scan-validation-screen" class="scan-validation-overlay" style="display:none;">
      <div class="scan-result-card" id="scan-result-card-inner">
        <h1 id="scan-result-title">VALID</h1>
        <p id="scan-result-msg"></p>
        <button id="btn-close-scan-overlay" class="btn btn-rigid btn-green" style="margin-top:20px; font-weight:bold;">확인</button>
      </div>
    </div>
  `;

  // QR Camera bindings
  const wrapper = document.getElementById("qr-camera-reader-wrapper");
  const startCamBtn = document.getElementById("btn-start-camera");
  const stopCamBtn = document.getElementById("btn-stop-camera");
  
  startCamBtn.onclick = () => {
    initializeQRScanner("qr-camera-reader", 
      (decodedText) => {
        triggerScanValidationUI(decodedText);
      }
    );
    wrapper.classList.add("fullscreen-mode");
    startCamBtn.style.display = "none";
    stopCamBtn.style.display = "inline-block";
  };

  stopCamBtn.onclick = () => {
    stopQRScanner();
    wrapper.classList.remove("fullscreen-mode");
    startCamBtn.style.display = "inline-block";
    stopCamBtn.style.display = "none";
  };

  // Manual verify binding
  document.getElementById("btn-manual-verify").onclick = () => {
    const input = document.getElementById("manual-ticket-id");
    const id = input.value.trim().toUpperCase();
    if (!id) return;
    triggerScanValidationUI(id);
    input.value = "";
  };
}

function triggerScanValidationUI(ticketId) {
  const result = validateTicketState(ticketId);
  const overlay = document.getElementById("scan-validation-screen");
  const innerCard = document.getElementById("scan-result-card-inner");
  const title = document.getElementById("scan-result-title");
  const msg = document.getElementById("scan-result-msg");
  const closeBtn = document.getElementById("btn-close-scan-overlay");

  title.innerText = result.status;
  msg.innerText = result.message;

  // Clear colors
  innerCard.className = "scan-result-card";
  closeBtn.className = "btn btn-rigid";

  if (result.status === "VALID") {
    innerCard.classList.add("result-green");
    closeBtn.classList.add("btn-green");
  } else if (result.status === "ALREADY_ENTERED") {
    innerCard.classList.add("result-purple");
    closeBtn.classList.add("btn-purple");
  } else {
    innerCard.classList.add("result-red");
    closeBtn.classList.add("btn-red");
  }

  overlay.style.display = "flex";

  closeBtn.onclick = () => {
    overlay.style.display = "none";
    
    // Refresh currently active screen dynamically
    const activeView = document.querySelector(".content-view.active");
    if (activeView) {
      const viewId = activeView.id.replace("view-", "");
      renderViewData(viewId);
    }
  };
}

function updateRecentScanLogsTable() {
  const tbody = document.getElementById("scan-logs-tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  // Get recent scans from notifications of type TELEMETRY containing [QR 스캔]
  const scanLogs = DB.notifications.filter(n => n.message.includes("[QR 스캔]"));

  if (scanLogs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="color:#a0aec0;">입장 검수 이력이 존재하지 않습니다.</td></tr>`;
    return;
  }

  scanLogs.forEach(log => {
    // Parse ticket code and status from message
    // Message structure: `[QR 스캔] 티켓 T-1001: 결과 [VALID]`
    const parts = log.message.match(/티켓\s([A-Za-z0-9\-]+):\s결과\s\[([A-Z_]+)\]/);
    if (!parts) return;
    const ticketId = parts[1];
    const status = parts[2];

    const ticket = DB.tickets.find(t => t.id === ticketId);
    const seatId = ticket ? ticket.seat : "-";
    const holder = ticket ? ticket.holder : "알 수 없는 고객";

    // 티켓 유형 판별 (DB orders의 TICKET 타입 주문에 메타데이터로 매핑되어 있으면 현장발권, 없으면 예매발권)
    const isOnsite = DB.orders.some(o => o.type === "TICKET" && o.metadata && o.metadata.ticketId === ticketId);
    const ticketType = isOnsite ? "현장발권" : "예매발권";
    const ticketTypeBadge = isOnsite ? "badge-blue" : "badge-gray";

    let colorClass = "badge-red";
    let statusText = "올바르지 않은 티켓";
    let rightIndicator = "border-right-red";

    if (status === "VALID") {
      colorClass = "badge-green";
      statusText = "검증 완료 (입장 승인)";
      rightIndicator = "border-right-green";
    } else if (status === "ALREADY_ENTERED") {
      colorClass = "badge-purple";
      statusText = "입장 차단 (중복 사용)";
      rightIndicator = "border-right-purple";
    }

    const tr = document.createElement("tr");
    tr.className = rightIndicator;
    tr.innerHTML = `
      <td>${log.timestamp}</td>
      <td><strong>${ticketId}</strong></td>
      <td><span class="badge badge-gray">${seatId}</span></td>
      <td>${holder}</td>
      <td><span class="badge ${ticketTypeBadge}">${ticketType}</span></td>
      <td><strong>1개</strong></td>
      <td><span class="badge ${colorClass}">${statusText}</span></td>
      <td class="text-right">
        <span class="indicator-bar ${status.toLowerCase()}"></span>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderScanStatusScreen() {
  const view = document.getElementById("view-scan-status");
  if (!view) return;

  const stats = getSeatStats();

  view.innerHTML = `
    <!-- Active Validation Overlay -->
    <div id="scan-validation-screen" class="scan-validation-overlay" style="display:none;">
      <div class="scan-result-card" id="scan-result-card-inner">
        <h1 id="scan-result-title">VALID</h1>
        <p id="scan-result-msg"></p>
        <button id="btn-close-scan-overlay" class="btn btn-rigid btn-green" style="margin-top:20px; font-weight:bold;">확인</button>
      </div>
    </div>

    <div class="panel-rigid">
      <div class="panel-header-rigid" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <span style="display: flex; align-items: center; gap: 15px;">
          <span>실시간 게이트 입장 통계 및 최근 스캔 로그</span>
          <span class="mock-simulator-dots" style="display: flex; align-items: center; gap: 8px; border-left: 1px solid var(--border-color); padding-left: 15px;">
            <span style="font-size: 11px; color: var(--text-muted); font-weight: normal; letter-spacing: 0.5px;">모의 테스트 스캔:</span>
            <span class="mock-dot dot-green btn-mock-scan" data-id="T-1001" data-tooltip="[정상 티켓]"></span>
            <span class="mock-dot dot-purple btn-mock-scan" data-id="T-1005" data-tooltip="[중복 티켓]"></span>
            <span class="mock-dot dot-red btn-mock-scan" data-id="T-FAKE" data-tooltip="[오류 티켓]"></span>
          </span>
        </span>
        <span>실시간 입장객: <strong id="scan-entered-count">${stats.entered}</strong> / 36 석</span>
      </div>
      <div class="panel-body-rigid">
        <table class="table-rigid">
          <thead>
            <tr>
              <th>스캔 시간</th>
              <th>티켓 번호</th>
              <th>매핑 좌석</th>
              <th>고객명</th>
              <th>티켓 유형</th>
              <th>수량</th>
              <th>검증 상세 상태</th>
              <th class="text-right">결과 지표</th>
            </tr>
          </thead>
          <tbody id="scan-logs-tbody">
            <!-- Recent scans list -->
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Update recent scan logs
  updateRecentScanLogsTable();

  // Mock scan buttons binding
  document.querySelectorAll(".btn-mock-scan").forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-id");
      triggerScanValidationUI(id);
    };
  });
}

// ==========================================
// 4. REALTIME SEATING MAP RENDERING
// ==========================================
function renderSeatMapScreen() {
  const view = document.getElementById("view-seats");
  if (!view) return;

  view.innerHTML = `
    <div class="seating-layout-grid">
      <div class="panel-rigid" style="width: 100%;">
        <div class="panel-header-rigid">
          <span>실시간 좌석 배치도 및 잔여석 시각화 맵</span>
        </div>
        <div class="panel-body-rigid">
          <div class="seat-legend">
            <div class="legend-item"><span class="legend-color available"></span> 이용가능 (AVAILABLE)</div>
            <div class="legend-item"><span class="legend-color reserved"></span> 예약대기 (RESERVED)</div>
            <div class="legend-item"><span class="legend-color entered"></span> 입장완료 (ENTERED)</div>
          </div>
          
          <div id="seat-map-renderer-container">
            <!-- Seat Map Grid -->
          </div>
        </div>
      </div>
    </div>
  `;

  // Render Seating grid
  renderSeatMap("seat-map-renderer-container", (seatId) => {
    // Quick checkout link when clicked
    switchView("ticketing");
    const selector = document.getElementById("ticket-seat-select");
    if (selector) selector.value = seatId;
  });

  // Bind Realtime Sync
  setupRealtimeSeatSync();
  window.activeSeatClickHandler = (seatId) => {
    switchView("ticketing");
    setTimeout(() => {
      const selector = document.getElementById("ticket-seat-select");
      if (selector) selector.value = seatId;
    }, 100);
  };


}

// ==========================================
// 5. ON-SITE TICKETING SCREEN RENDERING
// ==========================================
function renderTicketingScreen() {
  const view = document.getElementById("view-ticketing");
  if (!view) return;

  const seasons = DB.options.seasons;
  const rates = DB.options.rates;

  const defaultSeason = seasons.find(s => s.active) || seasons[0];
  const defaultRate = rates[0];

  view.innerHTML = `
    <div class="ticketing-grid" style="display:flex; gap:20px; align-items: flex-start;">
      <div class="panel-rigid" style="flex: 1.2; min-width: 450px;">
        <div class="panel-header-rigid">현장 매표소 발권 및 티켓 커스텀 설정</div>
        <div class="panel-body-rigid">
          <form id="ticketing-form">
            <div class="form-group-rigid" style="margin-bottom: 15px;">
              <label style="display: flex; justify-content: space-between; align-items: center;">
                <span>선택된 좌석 목록 및 이용 고객 지정</span>
                <span id="selected-seats-count-lbl" style="font-size: 12px; color: var(--text-muted); font-weight: normal;">0개 선택됨</span>
              </label>
              <div class="selected-seats-table-container" style="max-height: 250px; overflow-y: auto; border: 1px solid var(--border-color); background: #1a202c; border-radius: 2px;">
                <table class="table-rigid" style="margin: 0; font-size: 12px;">
                  <thead>
                    <tr>
                      <th style="padding: 8px 10px;">좌석</th>
                      <th style="padding: 8px 10px;">요금 선택</th>
                      <th style="padding: 8px 10px;">이용 고객</th>
                      <th style="padding: 8px 10px;" class="text-right">금액</th>
                      <th style="padding: 8px 10px; width: 30px;"></th>
                    </tr>
                  </thead>
                  <tbody id="selected-seats-tbody">
                    <!-- 선택된 좌석 리스트가 여기에 렌더링됨 -->
                  </tbody>
                </table>
              </div>
            </div>

            <div class="price-display-box-rigid" style="margin-top: 15px;">
              <span>최종 합산 결제 금액</span>
              <strong id="ticket-final-price-lbl">0원</strong>
            </div>

            <button type="button" id="btn-request-ticket-pay" class="btn btn-rigid btn-green" style="width: 100%; font-weight:bold; margin-top:20px;">
              [결제요청] Toss Payments 일괄 결제창 호출
            </button>
          </form>
        </div>
      </div>

      <div class="panel-rigid" style="flex: 1.5; min-width: 500px;">
        <div class="panel-header-rigid">실시간 좌석 배치도 및 가용 좌석 모니터 (원클릭 좌석 선택)</div>
        <div class="panel-body-rigid" style="overflow-x: auto;">
          <div id="ticketing-seat-map-container" style="min-width: 620px;">
            <!-- Theater amphitheater map draws here -->
          </div>
        </div>
      </div>
    </div>
  `;

  // UI update helper
  const updateSelectedSeatsUI = () => {
    const tbody = document.getElementById("selected-seats-tbody");
    if (!tbody) return;

    tbody.innerHTML = "";
    let totalPrice = 0;

    if (selectedSeats.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center" style="color:#a0aec0; padding: 30px 0;">선택된 좌석이 없습니다.<br>배치도의 빈 좌석을 클릭하세요.</td></tr>`;
      document.getElementById("ticket-final-price-lbl").innerText = "0원";
      document.getElementById("selected-seats-count-lbl").innerText = "0개 선택됨";

      // Clear seat map highlights
      document.querySelectorAll(".seat.selected-for-ticketing").forEach(el => {
        el.classList.remove("selected-for-ticketing");
      });
      return;
    }

    document.getElementById("selected-seats-count-lbl").innerText = `${selectedSeats.length}개 선택됨`;

    selectedSeats.forEach((item, index) => {
      const price = calculateTicketPrice(item.seasonId, item.rateId);
      totalPrice += price;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="padding: 6px 10px; font-weight: bold; color: #ffd65c; vertical-align: middle;">${item.seatId}</td>
        <td style="padding: 6px 10px; vertical-align: middle;">
          <select class="seat-season-select input-rigid input-small" style="padding: 2px 4px; font-size:11px; width: 100%; min-width: 80px;" data-index="${index}">
            ${seasons.map(s => `<option value="${s.id}" ${s.id === item.seasonId ? 'selected':''}>${s.name}</option>`).join("")}
          </select>
        </td>
        <td style="padding: 6px 10px; vertical-align: middle;">
          <select class="seat-rate-select input-rigid input-small" style="padding: 2px 4px; font-size:11px; width: 100%; min-width: 80px;" data-index="${index}">
            ${rates.map(r => `<option value="${r.id}" ${r.id === item.rateId ? 'selected':''}>${r.name}</option>`).join("")}
          </select>
        </td>
        <td style="padding: 6px 10px; text-align: right; font-weight: bold; font-family: var(--font-mono); vertical-align: middle;">${price.toLocaleString()}원</td>
        <td style="padding: 6px 10px; text-align: center; vertical-align: middle;">
          <button type="button" class="btn-remove-selected-seat" data-index="${index}" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 16px; font-weight: bold; line-height: 1;">&times;</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    document.getElementById("ticket-final-price-lbl").innerText = `${totalPrice.toLocaleString()}원`;

    // Event bindings inside table
    tbody.querySelectorAll(".seat-season-select").forEach(sel => {
      sel.onchange = (e) => {
        const idx = parseInt(e.target.getAttribute("data-index"));
        selectedSeats[idx].seasonId = e.target.value;
        updateSelectedSeatsUI();
      };
    });

    tbody.querySelectorAll(".seat-rate-select").forEach(sel => {
      sel.onchange = (e) => {
        const idx = parseInt(e.target.getAttribute("data-index"));
        selectedSeats[idx].rateId = e.target.value;
        updateSelectedSeatsUI();
      };
    });

    tbody.querySelectorAll(".btn-remove-selected-seat").forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.getAttribute("data-index"));
        selectedSeats.splice(idx, 1);
        updateSelectedSeatsUI();
      };
    });

    // Update seat map highlights
    document.querySelectorAll(".seat").forEach(el => {
      const seatId = el.getAttribute("data-seat-id");
      if (selectedSeats.some(item => item.seatId === seatId)) {
        el.classList.add("selected-for-ticketing");
      } else {
        el.classList.remove("selected-for-ticketing");
      }
    });
  };

  // Handle seat toggling
  const handleSeatToggle = (seatId) => {
    const existingIdx = selectedSeats.findIndex(item => item.seatId === seatId);
    if (existingIdx > -1) {
      selectedSeats.splice(existingIdx, 1);
    } else {
      const defaultSeasonId = defaultSeason ? defaultSeason.id : (seasons[0] ? seasons[0].id : "");
      const defaultRateId = defaultRate ? defaultRate.id : (rates[0] ? rates[0].id : "");
      selectedSeats.push({
        seatId,
        seasonId: defaultSeasonId,
        rateId: defaultRateId
      });
    }
    updateSelectedSeatsUI();
  };

  // Render theater seat map
  renderSeatMap("ticketing-seat-map-container", handleSeatToggle);
  window.activeSeatClickHandler = handleSeatToggle;

  // Initial draw of selected list (empty state)
  updateSelectedSeatsUI();

  // Pay trigger
  document.getElementById("btn-request-ticket-pay").onclick = () => {
    const holder = "현장발권자";

    if (selectedSeats.length === 0) {
      alert("예매할 좌석을 최소 1개 이상 선택해 주세요.");
      return;
    }

    // Calculate total price
    let totalPrice = 0;
    selectedSeats.forEach(item => {
      totalPrice += calculateTicketPrice(item.seasonId, item.rateId);
    });

    const seatIdsText = selectedSeats.map(item => item.seatId).join(", ");
    const paymentTitle = `현장 일괄 예매 [좌석 ${seatIdsText}]`;

    // Call Toss payment simulator
    requestTossPayment({
      title: paymentTitle,
      amount: totalPrice,
      onSuccess: (paymentData) => {
        // Success payment: Process DB update for each selected seat
        selectedSeats.forEach(item => {
          const { seatId, seasonId, rateId } = item;
          const seatPrice = calculateTicketPrice(seasonId, rateId);

          DB.seats[seatId].status = "RESERVED";
          DB.seats[seatId].holder = `${holder} (입장대기)`;

          // Register matching ticket ID
          const ticketId = `T-${Math.floor(1000 + Math.random() * 9000)}`;
          const selectedRate = DB.options.rates.find(r => r.id === rateId);
          
          DB.tickets.push({
            id: ticketId,
            seat: seatId,
            status: "VALID",
            type: selectedRate ? selectedRate.name.split(" ")[0] : "ADULT",
            used: false,
            holder
          });

          // Add to orders queue for invoice records
          const newOrderId = `ORD-${Math.floor(10000 + Math.random() * 90000)}`;
          DB.orders.unshift({
            id: newOrderId,
            type: "TICKET",
            items: [{ name: `좌석 ${seatId} 예매`, quantity: 1 }],
            price: seatPrice,
            status: "PAID",
            customer: holder,
            timestamp: new Date().toLocaleTimeString(),
            metadata: { seatId, ticketId }
          });

          // Publish to Seat Map and Live dashboard logs
          publish("seat-change", { seatId, status: "RESERVED", seat: DB.seats[seatId] });
        });

        // Publish global payment complete
        publish("payment-complete", { customer: holder, amount: totalPrice });
        addNotification("TICKET", `현장 고객 ${holder}님 일괄 예매 완료: 좌석 [${seatIdsText}]`);

        saveDB();

        alert(`결제 및 좌석 ${selectedSeats.length}개 예매가 완료되었습니다!`);
        selectedSeats = [];
        renderTicketingScreen();
      },
      onCancel: (err) => {
        alert("결제가 사용자 취소되었습니다.");
      }
    });
  };
}

function renderRecentTicketsTable() {
  const tbody = document.getElementById("ticketing-recent-tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  const ticketOrders = DB.orders.filter(o => o.type === "TICKET").slice(0, 10);

  if (ticketOrders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center" style="color:#a0aec0;">최근 예매 내역이 존재하지 않습니다.</td></tr>`;
    return;
  }

  ticketOrders.forEach(o => {
    const seatId = o.metadata ? o.metadata.seatId : "-";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${o.id}</strong></td>
      <td><span class="badge badge-gray">${seatId}</span></td>
      <td>${o.customer}</td>
      <td><strong>${o.price.toLocaleString()}원</strong></td>
      <td><span class="badge badge-green">결제/예약완료</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// ==========================================
// 6. REFUND & CANCELLATION SCREEN RENDERING
// ==========================================
function renderRefundScreen() {
  const view = document.getElementById("view-refund");
  if (!view) return;

  view.innerHTML = `
    <div class="panel-rigid">
      <div class="panel-header-rigid">현장 발권 티켓 취소 및 환불 관리 데스크 (Toss Cancel API)</div>
      <div class="panel-body-rigid">
        <div class="alert-box alert-blue" style="margin-bottom:15px;">
          스태프가 환불 요청한 내역에 대해 관리자가 최종 <strong>[환불 요청 수락]</strong>을 클릭하면 토스 취소 API를 호출하며 좌석이 빈 상태로 복구됩니다.
        </div>
        
        <table class="table-rigid">
          <thead>
            <tr>
              <th>주문번호</th>
              <th>발권유형</th>
              <th>고객명</th>
              <th>내용</th>
              <th>결제금액</th>
              <th>상태</th>
              <th class="text-right">액션</th>
            </tr>
          </thead>
          <tbody id="refund-tbody">
            <!-- Table content -->
          </tbody>
        </table>
      </div>
    </div>
  `;

  const tbody = document.getElementById("refund-tbody");
  tbody.innerHTML = "";

  // Get ticket orders
  const orders = DB.orders.filter(o => o.type === "TICKET");

  if (orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="color:#a0aec0;">조회되는 결제 완료 예매가 없습니다.</td></tr>`;
    return;
  }

  orders.forEach(o => {
    let actionBtnHtml = "";
    let statusLabel = "";

    if (o.status === "PAID") {
      statusLabel = `<span class="badge badge-green">결제 완료</span>`;
      actionBtnHtml = `<button class="btn btn-rigid btn-small btn-red btn-request-ref" data-id="${o.id}">환불 요청</button>`;
    } else if (o.status === "REFUND_REQUESTED") {
      statusLabel = `<span class="badge badge-amber animate-pulse">환불대기</span>`;
      actionBtnHtml = `<button class="btn btn-rigid btn-small btn-purple btn-accept-ref" data-id="${o.id}">환불 수락 (Cancel API)</button>`;
    } else if (o.status === "REFUNDED") {
      statusLabel = `<span class="badge badge-red">환불 완료</span>`;
      actionBtnHtml = `<span style="font-size:12px; color:#a0aec0;">환불 완료됨</span>`;
    }

    const itemsText = o.items.map(i => i.name).join(", ");
    
    // 발권 유형 판별
    const isOnsite = o.metadata && o.metadata.ticketId;
    const ticketType = isOnsite ? "현장" : "예매";
    const ticketTypeBadge = isOnsite ? "badge-blue" : "badge-gray";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${o.id}</strong></td>
      <td><span class="badge ${ticketTypeBadge}">${ticketType}</span></td>
      <td>${o.customer}</td>
      <td>${itemsText}</td>
      <td><strong>${o.price.toLocaleString()}원</strong></td>
      <td>${statusLabel}</td>
      <td class="text-right">${actionBtnHtml}</td>
    `;
    tbody.appendChild(tr);
  });

  // Action Click Bindings
  document.querySelectorAll(".btn-request-ref").forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-id");
      if (confirm(`주문 ${id}에 대한 환불 요청을 작성하시겠습니까?`)) {
        requestRefund(id);
        renderRefundScreen();
      }
    };
  });

  document.querySelectorAll(".btn-accept-ref").forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-id");
      btn.innerHTML = `<span class="spinner"></span> API 요청 중...`;
      btn.disabled = true;

      acceptRefund(id, (refundedOrder) => {
        alert(`토스페이먼츠 승인 취소 응답이 성공적으로 수신되었습니다! 좌석 상태가 'AVAILABLE'로 롤백되었습니다.`);
        renderRefundScreen();
      });
    };
  });
}



// ==========================================
// 8. F&B ORDERS QUEUE RENDERING
// ==========================================
function renderFnbOrdersScreen() {
  const view = document.getElementById("view-orders");
  if (!view) return;

  view.innerHTML = `
    <div class="panel-rigid">
      <div class="panel-header-rigid">F&B 식음료 실시간 조리 및 수령 상태 관리 큐</div>
      <div class="panel-body-rigid">
        <table class="table-rigid">
          <thead>
            <tr>
              <th>주문번호</th>
              <th>메뉴명</th>
              <th>가격</th>
              <th>수량</th>
              <th>주문자</th>
              <th>연락처</th>
              <th>상태</th>
              <th>주문일시</th>
            </tr>
          </thead>
          <tbody id="fnb-queue-tbody">
            <!-- Content -->
          </tbody>
        </table>
      </div>
    </div>
  `;

  renderFnbQueueTable();
}

function renderFnbQueueTable() {
  const tbody = document.getElementById("fnb-queue-tbody");
  if (!tbody) return;

  tbody.innerHTML = "";
  const fnbOrders = DB.orders.filter(o => o.type === "FOOD");

  if (fnbOrders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="color:#a0aec0;">접수된 식음료 주문이 없습니다.</td></tr>`;
    return;
  }

  fnbOrders.forEach(o => {
    let statusLabel = "";

    if (o.status === "RECEIVED") {
      statusLabel = `
        <div style="display:flex; flex-direction:column; align-items:flex-start; gap:4px;">
          <span class="badge badge-gray animate-pulse btn-fnb-status-toggle" data-id="${o.id}" data-next="COOKING" style="cursor:pointer;" title="클릭 시 조리 시작">접수</span>
          <button class="btn-fnb-cancel" data-id="${o.id}" style="background:none; border:none; color:#ef4444; font-size:10px; cursor:pointer; padding:0; text-decoration:underline;">[주문취소]</button>
        </div>
      `;
    } else if (o.status === "COOKING") {
      statusLabel = `<span class="badge badge-amber btn-fnb-status-toggle" data-id="${o.id}" data-next="READY" style="cursor:pointer;" title="클릭 시 조리 완료">조리 중</span>`;
    } else if (o.status === "READY") {
      statusLabel = `<span class="badge badge-green btn-fnb-status-toggle" data-id="${o.id}" data-next="PICKED_UP" style="cursor:pointer;" title="클릭 시 수령 완료">조리완료</span>`;
    } else if (o.status === "PICKED_UP") {
      statusLabel = `<span class="badge badge-blue" style="cursor:not-allowed;" title="전달 완료된 주문입니다">픽업완료</span>`;
    }

    const itemNamesText = o.items.map(i => i.name).join(", ");
    const totalQty = o.items.reduce((sum, item) => sum + item.quantity, 0);

    // 주문 ID에 기반하여 일관된 모의 휴대폰 번호 생성
    const ordNum = parseInt(o.id.replace(/[^0-9]/g, '')) || 1234;
    const mockPhone = `010-5829-${(ordNum % 9000) + 1000}`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${o.id}</strong></td>
      <td>${itemNamesText}</td>
      <td><strong>${o.price.toLocaleString()}원</strong></td>
      <td>${totalQty}개</td>
      <td>${o.customer}</td>
      <td style="font-family: var(--font-mono); color: var(--text-muted);">${mockPhone}</td>
      <td>${statusLabel}</td>
      <td>${o.timestamp}</td>
    `;
    tbody.appendChild(tr);
  });

  // Bind status toggle click handler
  document.querySelectorAll(".btn-fnb-status-toggle").forEach(el => {
    el.onclick = () => {
      const ordId = el.getAttribute("data-id");
      const nextStatus = el.getAttribute("data-next");
      const order = DB.orders.find(o => o.id === ordId);
      if (order) {
        order.status = nextStatus;
        saveDB();
        publish("order-change", { orderId: ordId, status: nextStatus });
        renderFnbOrdersScreen();
      }
    };
  });

  // Cancel Handler
  document.querySelectorAll(".btn-fnb-cancel").forEach(btn => {
    btn.onclick = () => {
      const ordId = btn.getAttribute("data-id");
      if (confirm(`주문 ${ordId}을 취소하고 환불처리 하시겠습니까?`)) {
        const order = DB.orders.find(o => o.id === ordId);
        if (order && order.status === "RECEIVED") {
          order.status = "REFUNDED";
          saveDB();
          publish("order-change", { orderId: ordId, status: "REFUNDED" });
          alert("주문 취소 및 환불 처리가 성공 완료되었습니다.");
          renderFnbOrdersScreen();
        }
      }
    };
  });
}

// ==========================================
// 9. GOODS ORDERS & STOCK CHECKOUT
// ==========================================
function renderGoodsOrdersScreen() {
  const view = document.getElementById("view-goods");
  if (!view) return;

  view.innerHTML = `
    <div class="panel-rigid">
      <div class="panel-header-rigid">굿즈 샵 실시간 주문 내역 및 배부 큐</div>
      <div class="panel-body-rigid">
        <table class="table-rigid">
          <thead>
            <tr>
              <th>주문번호</th>
              <th>상품명</th>
              <th>가격</th>
              <th>수량</th>
              <th>주문자</th>
              <th>연락처</th>
              <th>상태</th>
              <th>주문일시</th>
            </tr>
          </thead>
          <tbody id="goods-queue-tbody">
            <!-- Content -->
          </tbody>
        </table>
      </div>
    </div>
  `;

  renderGoodsQueueTable();
}

function renderGoodsQueueTable() {
  const tbody = document.getElementById("goods-queue-tbody");
  if (!tbody) return;

  tbody.innerHTML = "";
  const goodsOrders = DB.orders.filter(o => o.type === "GOODS");

  if (goodsOrders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="color:#a0aec0; padding:30px 0;">주문 수령 대기 중인 굿즈가 없습니다.</td></tr>`;
    return;
  }

  goodsOrders.forEach(o => {
    // 결제완료(ORDERED) → 수령가능(READY) → 픽업완료(PICKED_UP)
    let statusCell = "";

    if (o.status === "ORDERED") {
      statusCell = `
        <div style="display:flex; flex-direction:column; align-items:flex-start; gap:5px;">
          <span class="badge badge-green btn-goods-toggle" data-id="${o.id}" data-next="READY"
            style="cursor:pointer;" title="클릭 → 수령가능">결제완료</span>
          <button class="btn-goods-refund" data-id="${o.id}"
            style="background:none;border:none;color:#ef4444;font-size:10px;cursor:pointer;padding:0;text-decoration:underline;">[환불/취소]</button>
        </div>`;
    } else if (o.status === "READY") {
      statusCell = `
        <div style="display:flex; flex-direction:column; align-items:flex-start; gap:5px;">
          <span class="badge badge-amber btn-goods-toggle" data-id="${o.id}" data-next="PICKED_UP"
            style="cursor:pointer;" title="클릭 → 픽업완료">수령가능</span>
          <button class="btn-goods-refund" data-id="${o.id}"
            style="background:none;border:none;color:#ef4444;font-size:10px;cursor:pointer;padding:0;text-decoration:underline;">[환불/취소]</button>
        </div>`;
    } else if (o.status === "PICKED_UP") {
      statusCell = `<span class="badge badge-blue" style="cursor:not-allowed;" title="배부 완료">픽업완료</span>`;
    } else if (o.status === "REFUNDED") {
      statusCell = `<span class="badge badge-red" style="cursor:not-allowed;">환불완료</span>`;
    }

    const itemName = o.items.map(i => i.name).join(", ");
    const itemQty  = o.items.map(i => `${i.quantity}개`).join(", ");

    const ordNum   = parseInt(o.id.replace(/\D/g, "")) || 5678;
    const phone    = `010-3849-${String((ordNum % 9000) + 1000)}`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${o.id}</strong></td>
      <td>${itemName}</td>
      <td><strong>${o.price.toLocaleString()}원</strong></td>
      <td>${itemQty}</td>
      <td>${o.customer}</td>
      <td style="font-family:var(--font-mono);color:var(--text-muted);">${phone}</td>
      <td>${statusCell}</td>
      <td>${o.timestamp}</td>
    `;
    tbody.appendChild(tr);
  });

  // 상태 토글 클릭
  tbody.querySelectorAll(".btn-goods-toggle").forEach(el => {
    el.onclick = () => {
      const order = DB.orders.find(o => o.id === el.dataset.id);
      if (!order) return;
      order.status = el.dataset.next;
      saveDB();
      publish("order-change", { orderId: order.id, status: order.status });
      renderGoodsOrdersScreen();
    };
  });

  // 환불/취소
  tbody.querySelectorAll(".btn-goods-refund").forEach(btn => {
    btn.onclick = () => {
      const ordId = btn.dataset.id;
      if (!confirm(`주문 ${ordId}을 전면 환불/취소하시겠습니까?\n(현재재고수량이 자동 복원됩니다)`)) return;
      const order = DB.orders.find(o => o.id === ordId);
      if (!order) return;
      order.items.forEach(item => {
        const g = DB.goods.find(g => g.name === item.name);
        if (g) g.currentStock += item.quantity;
      });
      order.status = "REFUNDED";
      saveDB();
      publish("order-change", { orderId: ordId, status: "REFUNDED" });
      alert("환불 처리 완료. 재고가 복구되었습니다.");
      renderGoodsOrdersScreen();
    };
  });
}

// ==========================================
// 10a. GOODS STOCK MANAGEMENT RENDERING
// ==========================================
function renderGoodsInventoryScreen() {
  const view = document.getElementById("view-inventory-goods");
  if (!view) return;

  view.innerHTML = `
    <div class="panel-rigid">
      <div class="panel-header-rigid" style="display: flex; justify-content: space-between; align-items: center;">
        <span>굿즈 상품 재고 현황판 및 등록 (재고수량 0=품절 자동화)</span>
        <button id="btn-open-goods-modal" class="btn btn-rigid btn-small btn-blue">+ 굿즈 신규등록</button>
      </div>
      <div class="panel-body-rigid">
        <table class="table-rigid">
          <thead>
            <tr>
              <th>ID</th>
              <th>상품명</th>
              <th>가격</th>
              <th>현재 재고</th>
              <th>가선점</th>
              <th>가용재고</th>
              <th>상태</th>
              <th class="text-right">수량 수정</th>
            </tr>
          </thead>
          <tbody id="admin-goods-tbody">
            <!-- Goods content -->
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Overlay -->
    <div id="goods-modal-overlay" class="registration-modal-overlay" style="display:none;">
      <div class="registration-modal-card">
        <div class="registration-modal-header">
          <span>굿즈 신규 등록</span>
          <button type="button" id="btn-close-goods-modal" style="background:none; border:none; color:#fff; font-size:20px; cursor:pointer;">&times;</button>
        </div>
        <form id="new-goods-form">
          <div class="registration-modal-body">
            <div class="file-input-wrapper">
              <label style="font-size:11px; font-weight:800; color:var(--text-muted); margin-bottom:6px; display:block;">상품 이미지 첨부 (선택)</label>
              <input type="file" id="new-g-image-file" accept="image/*">
            </div>
            <div class="form-group-rigid">
              <label>상품명</label>
              <input type="text" id="new-g-name" placeholder="상품명 입력" class="input-rigid" required>
            </div>
            <div class="form-group-rigid">
              <label>판매가 (원)</label>
              <input type="number" id="new-g-price" placeholder="예: 15000" class="input-rigid" required>
            </div>
            <div class="form-group-rigid">
              <label>최초 재고수량</label>
              <input type="number" id="new-g-stock" placeholder="예: 50" class="input-rigid" required>
            </div>
          </div>
          <div class="registration-modal-footer">
            <button type="button" id="btn-cancel-goods" class="btn btn-rigid btn-red">취소</button>
            <button type="submit" class="btn btn-rigid btn-green">등록</button>
          </div>
        </form>
      </div>
    </div>
  `;

  renderAdminGoodsList();

  const modal = document.getElementById("goods-modal-overlay");
  document.getElementById("btn-open-goods-modal").onclick = () => {
    modal.style.display = "flex";
  };
  
  const closeModal = () => { modal.style.display = "none"; };
  document.getElementById("btn-close-goods-modal").onclick = closeModal;
  document.getElementById("btn-cancel-goods").onclick = closeModal;

  document.getElementById("new-goods-form").onsubmit = (e) => {
    e.preventDefault();
    const fileInput = document.getElementById("new-g-image-file");
    const name = document.getElementById("new-g-name").value.trim();
    const price = document.getElementById("new-g-price").value;
    const stock = document.getElementById("new-g-stock").value;

    if (fileInput.files && fileInput.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        registerGoods(name, price, stock, ev.target.result);
        alert("신규 굿즈가 성공적으로 등록되었습니다.");
        renderGoodsInventoryScreen();
      };
      reader.readAsDataURL(fileInput.files[0]);
    } else {
      registerGoods(name, price, stock, "");
      alert("신규 굿즈가 성공적으로 등록되었습니다.");
      renderGoodsInventoryScreen();
    }
  };
}

// ==========================================
// 10b. F&B FOOD MANAGEMENT RENDERING
// ==========================================
function renderFnbInventoryScreen() {
  const view = document.getElementById("view-inventory-fnb");
  if (!view) return;

  view.innerHTML = `
    <div class="panel-rigid">
      <div class="panel-header-rigid" style="display: flex; justify-content: space-between; align-items: center;">
        <span>F&B 식음료 품목 관리 ([재료소진] 즉시 토글)</span>
        <button id="btn-open-food-modal" class="btn btn-rigid btn-small btn-blue">+ F&B 신규등록</button>
      </div>
      <div class="panel-body-rigid">
        <table class="table-rigid">
          <thead>
            <tr>
              <th>ID</th>
              <th>식음료 메뉴명</th>
              <th>가격</th>
              <th>상태 지표</th>
              <th class="text-right">재료소진 스위치</th>
            </tr>
          </thead>
          <tbody id="admin-food-tbody">
            <!-- Food content -->
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Overlay -->
    <div id="food-modal-overlay" class="registration-modal-overlay" style="display:none;">
      <div class="registration-modal-card">
        <div class="registration-modal-header">
          <span>F&B 신규 등록</span>
          <button type="button" id="btn-close-food-modal" style="background:none; border:none; color:#fff; font-size:20px; cursor:pointer;">&times;</button>
        </div>
        <form id="new-food-form">
          <div class="registration-modal-body">
            <div class="file-input-wrapper">
              <label style="font-size:11px; font-weight:800; color:var(--text-muted); margin-bottom:6px; display:block;">상품 이미지 첨부 (선택)</label>
              <input type="file" id="new-f-image-file" accept="image/*">
            </div>
            <div class="form-group-rigid">
              <label>식음료 메뉴명</label>
              <input type="text" id="new-f-name" placeholder="메뉴명 입력" class="input-rigid" required>
            </div>
            <div class="form-group-rigid">
              <label>가격 (원)</label>
              <input type="number" id="new-f-price" placeholder="예: 6000" class="input-rigid" required>
            </div>
          </div>
          <div class="registration-modal-footer">
            <button type="button" id="btn-cancel-food" class="btn btn-rigid btn-red">취소</button>
            <button type="submit" class="btn btn-rigid btn-green">등록</button>
          </div>
        </form>
      </div>
    </div>
  `;

  renderAdminFoodList();

  const modal = document.getElementById("food-modal-overlay");
  document.getElementById("btn-open-food-modal").onclick = () => {
    modal.style.display = "flex";
  };
  
  const closeModal = () => { modal.style.display = "none"; };
  document.getElementById("btn-close-food-modal").onclick = closeModal;
  document.getElementById("btn-cancel-food").onclick = closeModal;

  document.getElementById("new-food-form").onsubmit = (e) => {
    e.preventDefault();
    const fileInput = document.getElementById("new-f-image-file");
    const name = document.getElementById("new-f-name").value.trim();
    const price = document.getElementById("new-f-price").value;

    if (fileInput.files && fileInput.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        registerFood(name, price, ev.target.result);
        alert("신규 F&B 메뉴가 등록되었습니다.");
        renderFnbInventoryScreen();
      };
      reader.readAsDataURL(fileInput.files[0]);
    } else {
      registerFood(name, price, "");
      alert("신규 F&B 메뉴가 등록되었습니다.");
      renderFnbInventoryScreen();
    }
  };
}


function renderAdminGoodsList() {
  const tbody = document.getElementById("admin-goods-tbody");
  tbody.innerHTML = "";

  DB.goods.forEach(g => {
    const avail = g.currentStock - g.preAllocated;
    
    // Auto Sold Out label logic
    let statusText = `<span class="badge badge-green">판매중</span>`;
    if (avail <= 0) {
      statusText = `<span class="badge badge-red">품절(SOLD OUT)</span>`;
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${g.id}</td>
      <td style="display: flex; align-items: center; gap: 10px;">
        ${g.image ? `<img src="${g.image}" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover;">` : `<div style="width: 40px; height: 40px; border-radius: 4px; background: #2d3748; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #a0aec0;">NO IMG</div>`}
        <strong>${g.name}</strong>
      </td>
      <td>${g.price.toLocaleString()}원</td>
      <td>
        <input type="number" class="input-rigid input-small change-g-stock" data-id="${g.id}" value="${g.currentStock}" style="width:70px;">
      </td>
      <td><span style="color:#8b5cf6;">${g.preAllocated}</span></td>
      <td><strong>${avail}</strong></td>
      <td>${statusText}</td>
      <td class="text-right">
        <button class="btn btn-rigid btn-small btn-blue btn-save-g-stock" data-id="${g.id}">저장</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Save stock change binding
  document.querySelectorAll(".btn-save-g-stock").forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-id");
      const input = document.querySelector(`.change-g-stock[data-id="${id}"]`);
      const newVal = parseInt(input.value) || 0;
      updateGoodsStock(id, newVal);
      alert("재고 수량이 업데이트되었습니다.");
      renderGoodsInventoryScreen();
    };
  });
}

function renderAdminFoodList() {
  const tbody = document.getElementById("admin-food-tbody");
  tbody.innerHTML = "";

  DB.food.forEach(f => {
    const statusText = f.outOfStock 
      ? `<span class="badge badge-red animate-pulse">재료소진(SOLD OUT)</span>` 
      : `<span class="badge badge-green">판매가능</span>`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${f.id}</td>
      <td style="display: flex; align-items: center; gap: 10px;">
        ${f.image ? `<img src="${f.image}" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover;">` : `<div style="width: 40px; height: 40px; border-radius: 4px; background: #2d3748; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #a0aec0;">NO IMG</div>`}
        <strong>${f.name}</strong>
      </td>
      <td>${f.price.toLocaleString()}원</td>
      <td>${statusText}</td>
      <td class="text-right">
        <button class="btn btn-rigid btn-small ${f.outOfStock ? 'btn-green' : 'btn-red'} btn-toggle-f-status" data-id="${f.id}">
          ${f.outOfStock ? '재료소진 해제' : '재료소진 설정'}
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Toggle Ingredient Out binding
  document.querySelectorAll(".btn-toggle-f-status").forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-id");
      toggleFoodIngredientOut(id);
      renderFnbInventoryScreen();
    };
  });
}


// ==========================================
// 11. GLOBAL REALTIME SUBSCRIPTIONS & NOTIFICATIONS

// ==========================================
// 12. GLOBAL REALTIME SUBSCRIPTIONS & NOTIFICATIONS
// ==========================================
function setupGlobalSubscriptions() {
  // 1. Notification Event (Bell and badge)
  subscribe("notification", (n) => {
    // Show badge
    if (notifBadge) {
      notifBadge.style.display = "block";
      const current = parseInt(notifBadge.innerText) || 0;
      notifBadge.innerText = current + 1;
      
      // Trigger micro shaking animation on bell
      notifBell.classList.add("animate-shake");
      setTimeout(() => {
        notifBell.classList.remove("animate-shake");
      }, 500);
    }

    // Render list in popover
    populatePopoverNotifications();

    // If currently viewing dashboard, re-render dashboard terminal logs instantly!
    const activeView = document.querySelector(".content-view.active");
    if (activeView && activeView.id === "view-dashboard") {
      renderDashboard();
    }
  });

  // 2. Realtime Order status listener
  subscribe("order-change", () => {
    // Re-render relevant view if active
    const activeView = document.querySelector(".content-view.active");
    if (activeView) {
      if (activeView.id === "view-dashboard") renderDashboard();
      if (activeView.id === "view-orders") renderFnbQueueTable();
      if (activeView.id === "view-goods") renderGoodsQueueTable();
      if (activeView.id === "view-refund") renderRefundScreen();
    }
  });

  // 3. Realtime Inventory update listener
  subscribe("inventory-change", () => {
    const activeView = document.querySelector(".content-view.active");
    if (activeView) {
      if (activeView.id === "view-inventory-goods") {
        renderAdminGoodsList();
      }
    }
  });

  // 4. Realtime Food ingredient out listener
  subscribe("food-soldout", () => {
    const activeView = document.querySelector(".content-view.active");
    if (activeView) {
      if (activeView.id === "view-inventory-fnb") {
        renderAdminFoodList();
      }
    }
  });

  // Populate first list
  populatePopoverNotifications();
}

function populatePopoverNotifications() {
  if (!notifList) return;
  notifList.innerHTML = "";
  if (DB.notifications.length === 0) {
    notifList.innerHTML = `<div class="notif-item text-center" style="color:#a0aec0; padding:15px;">신규 수신된 알림이 없습니다.</div>`;
    return;
  }
  
  DB.notifications.slice(0, 10).forEach(n => {
    const div = document.createElement("div");
    div.className = `notif-item type-${n.type.toLowerCase()}`;
    div.innerHTML = `
      <div style="font-size:11px; color:#a0aec0;">${n.timestamp} [${n.type}]</div>
      <div style="font-size:12px; font-weight:bold; margin-top:2px;">${n.message}</div>
    `;
    notifList.appendChild(div);
  });
}
