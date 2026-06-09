// UI rendering and core control panel module
import { DB, saveDB, publish, subscribe, addNotification, toggleWebsocketSimulation } from './store.js';
import { getCurrentUser, login, logout, getStaffList, generateTemporaryAccount } from './auth.js';
import { initializeQRScanner, stopQRScanner, validateTicketState, validateExchangeQR } from './scanner.js?v=totp-fix';
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

export async function loadSidebarMenu(viewId) {
  const sidebarMenu = document.querySelector(".sidebar-menu");
  if (sidebarMenu) {
    try {
      const response = await fetch("/features/user/staff/menu_aside.html");
      if (response.ok) {
        const menuHtml = await response.text();
        sidebarMenu.innerHTML = menuHtml;
        
        // Highlight current page in sidebar
        const menuLinks = sidebarMenu.querySelectorAll(".menu-link");
        menuLinks.forEach(link => link.classList.remove("active"));
        const currentLink = sidebarMenu.querySelector(`.menu-link[data-page="${viewId}"]`);
        if (currentLink) currentLink.classList.add("active");
      }
    } catch (e) {
      console.error("Failed to load sidebar menu:", e);
    }
  }
}

export function initUI() {
  checkAuthSession("dashboard");
  _setupSharedUI();
  setupGlobalSubscriptions();
  renderCurrentView();
  loadSidebarMenu("dashboard");
}

// Per-page init — called by each standalone HTML page
export async function initPage(viewId = 'dashboard') {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('camera_only') === 'true') {
    // 순수 풀스크린 카메라 전용 창 (사이드바, 헤더 없음)
    document.body.innerHTML = `
      <div style="width:100vw; height:100vh; background:#000; display:flex; flex-direction:column;">
        <div style="background:rgba(15,23,42,0.9); padding:15px; text-align:center; color:#38bdf8; font-weight:bold; font-size:16px;">
          입장 스캐너 (새창 모드)
        </div>
        <div id="qr-camera-reader" style="flex:1; width:100%; min-height:100%; border:none; background:#000;"></div>
        
        <!-- Confirm Scan Overlay -->
        <div id="scan-confirm-screen" style="display:none; position:absolute; bottom:10%; left:50%; transform:translateX(-50%); z-index:10000; width:90%; max-width:350px; background:rgba(15,23,42,0.95); border-radius:16px; box-shadow:0 15px 35px rgba(0,0,0,0.8); padding:20px; text-align:center; border:2px solid #eab308;">
          <h2 style="margin:0 0 10px 0; font-size:20px; font-weight:900; color:#eab308;">입장 처리 대기</h2>
          <div id="scan-confirm-ticket" style="font-family:var(--font-mono); color:#f8fafc; font-size:18px; margin-bottom:15px; font-weight:bold;"></div>
          <p style="margin:0 0 20px 0; font-size:15px; color:#cbd5e1;">이 티켓을 입장 처리하시겠습니까?</p>
          <div style="display:flex; gap:10px;">
            <button id="btn-cancel-scan" class="btn btn-rigid btn-red" style="flex:1;">취소</button>
            <button id="btn-confirm-scan" class="btn btn-rigid btn-green" style="flex:1;">확인</button>
          </div>
        </div>
        
        <!-- Active Validation Overlay -->
        <div id="scan-validation-screen" style="display:none; position:absolute; bottom:10%; left:50%; transform:translateX(-50%); z-index:9999; width:90%; max-width:350px; background:rgba(15,23,42,0.95); border-radius:16px; box-shadow:0 15px 35px rgba(0,0,0,0.8); padding:20px; text-align:center; border:2px solid #38bdf8;">
          <h2 id="scan-result-title" style="margin:0 0 5px 0; font-size:24px; font-weight:900;">VALID</h2>
          <div id="scan-result-ticket-number" style="font-family:var(--font-mono); color:#38bdf8; font-size:20px; margin-bottom:10px; font-weight:bold; letter-spacing:1px;"></div>
          <p id="scan-result-msg" style="margin:0; font-size:14px; color:#cbd5e1; word-break:keep-all;"></p>
          <button id="btn-close-scan-overlay" class="btn btn-rigid btn-green" style="margin-top:15px; width:100%; font-weight:bold; padding:12px;">닫기</button>
        </div>
      </div>
    `;

    function askConfirmScan(decodedText) {
      return new Promise((resolve) => {
        const confirmScreen = document.getElementById("scan-confirm-screen");
        const tNumElem = document.getElementById("scan-confirm-ticket");
        const btnOk = document.getElementById("btn-confirm-scan");
        const btnCancel = document.getElementById("btn-cancel-scan");
        
        const tNum = decodedText.startsWith("FESTIO:TICKET:") ? decodedText.split(":")[2] : decodedText;
        tNumElem.innerText = `🎫 ${tNum}`;
        
        confirmScreen.style.display = "block";
        
        btnOk.onclick = () => { confirmScreen.style.display = "none"; resolve(true); };
        btnCancel.onclick = () => { confirmScreen.style.display = "none"; resolve(false); };
      });
    }

    async function triggerScanValidationUI(ticketId) {
      const result = await validateTicketState(ticketId);
      const overlay = document.getElementById("scan-validation-screen");
      const title = document.getElementById("scan-result-title");
      const msg = document.getElementById("scan-result-msg");
      const tNum = document.getElementById("scan-result-ticket-number");
      const closeBtn = document.getElementById("btn-close-scan-overlay");

      title.innerText = result.status;
      msg.innerText = result.message;
      tNum.innerText = (result.log && result.log.ticketId) ? `🎫 티켓 번호: ${result.log.ticketId}` : `🎫 ${ticketId}`;
      closeBtn.className = "btn btn-rigid";

      if (result.status === "VALID") {
        overlay.style.borderColor = "#10b981"; title.innerText = "입장하셨습니다"; title.style.color = "#10b981"; closeBtn.classList.add("btn-green");
      } else if (result.status === "ALREADY_ENTERED") {
        overlay.style.borderColor = "#a855f7"; title.innerText = "중복 입장 불가"; title.style.color = "#a855f7"; closeBtn.classList.add("btn-purple");
      } else {
        overlay.style.borderColor = "#ef4444"; title.innerText = "입장 불가"; title.style.color = "#ef4444"; closeBtn.classList.add("btn-red");
      }

      overlay.style.display = "block";
      if (window.scanPopupTimeout) clearTimeout(window.scanPopupTimeout);
      window.scanPopupTimeout = setTimeout(() => { overlay.style.display = "none"; }, 2500);

      closeBtn.onclick = () => {
        overlay.style.display = "none";
        if (window.scanPopupTimeout) clearTimeout(window.scanPopupTimeout);
      };
      return result;
    }

    // 바로 카메라 시작
    setTimeout(() => {
        initializeQRScanner("qr-camera-reader", async (decodedText) => {
          const isConfirmed = await askConfirmScan(decodedText);
          if (isConfirmed) {
              return await triggerScanValidationUI(decodedText);
          }
          return null;
        });
    }, 500);
    
    return; // Stop running normal dashboard init
  }

  const user = getCurrentUser();
  if (!user) {
    // Redirect unauthenticated users back to login
    window.location.href = "/features/user/staff/staffindex.html";
    return;
  }

  // Cleanup old cached data from localStorage that might contain D or E zones
  Object.keys(DB.seats).forEach(key => {
    const zone = key.split('-')[0];
    if (zone !== 'A' && zone !== 'B' && zone !== 'C') {
      delete DB.seats[key];
    }
  });

  // Show user info in header
  if (headerUser) headerUser.innerText = `스태프: ${user.name}`;
  if (headerCheckpoint) {
    headerCheckpoint.innerText = `[ ${DB.activeCheckpoint.event} / ${DB.activeCheckpoint.tenant} ]`;
  }

  _setupSharedUI();
  setupGlobalSubscriptions();

  // Render this page's content
  renderViewData(viewId || 'dashboard');
  loadSidebarMenu(viewId || 'dashboard');
}

function _setupSharedUI() {
  // Sidebar collapse toggle
  if (toggleSidebarBtn) {
    toggleSidebarBtn.onclick = () => {
      sidebar.classList.toggle("collapsed");
    };
  }

  // Logout handler — always returns to index.html
  if (logoutBtn) {
    logoutBtn.onclick = () => {
      logout();
      window.location.href = "/features/user/staff/staffindex.html";
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
      <h2 class="login-title" style="background: linear-gradient(90deg, #38bdf8, #10b981); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-weight: 900; font-size: 28px; margin-bottom: 5px; letter-spacing: 1px;">FESTIO STAFF SYSTEM</h2>
      <div class="login-subtitle">스태프 단말기 전용 관제 시스템</div>
      
      <div id="login-error-alert" class="alert-box alert-red" style="display:none;"></div>
      
      <form id="login-form">
        <div class="form-group-rigid">
          <label>ACCESS ID (아이디)</label>
          <input type="text" id="login-id" placeholder="ID 입력" required class="input-rigid">
        </div>
        <div class="form-group-rigid">
          <label>SECURITY PASSWORD (비밀번호)</label>
          <div style="position: relative;">
            <input type="password" id="login-pw" placeholder="PASSWORD 입력" required class="input-rigid" style="padding-right: 40px; width: 100%; box-sizing: border-box;">
            <button type="button" id="toggle-pw-visibility" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #a0aec0; font-size: 16px; padding: 0;">
              👁️
            </button>
          </div>
        </div>
        <div style="display: flex; gap: 10px; margin-top: 15px;">
          <button type="submit" class="btn btn-rigid btn-green" style="flex: 1; font-weight:bold;">
            시스템 액세스 인증
          </button>
          <button type="button" class="btn btn-rigid btn-red" id="btn-secondary-login" style="flex: 1; font-weight:bold;">
            로그인
          </button>
        </div>
        <div style="color: #ef4444; font-size: 11px; margin-top: 15px; line-height: 1.5; text-align: left;">
          * 시스템 액세스 인증은 임시 계정으로 로그인이 가능합니다.<br>
          * 로그인은 supabase에서 app_user table 계정으로 로그인이 가능합니다.
        </div>
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

  const togglePwBtn = document.getElementById("toggle-pw-visibility");
  const pwInput = document.getElementById("login-pw");
  if (togglePwBtn && pwInput) {
    togglePwBtn.onclick = () => {
      if (pwInput.type === "password") {
        pwInput.type = "text";
        togglePwBtn.innerText = "👀";
      } else {
        pwInput.type = "password";
        togglePwBtn.innerText = "👁️";
      }
    };
  }

  const secondaryLoginBtn = document.getElementById("btn-secondary-login");
  if (secondaryLoginBtn) {
    secondaryLoginBtn.onclick = async (e) => {
      e.preventDefault();
      const id = document.getElementById("login-id").value.trim();
      const pw = document.getElementById("login-pw").value.trim();

      if (!id || !pw) {
        const errorBox = document.getElementById("login-error-alert");
        errorBox.innerText = "이메일과 비밀번호를 모두 입력해주세요.";
        errorBox.style.display = "block";
        return;
      }

      try {
        const response = await fetch('/api/payment/staff/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: id, password: pw })
        });
        
        const res = await response.json();
        if (response.ok && res.success) {
          // sessionStorage 기반 기존 로직 호환 (auth.js의 구조)
          sessionStorage.setItem("STAFF_CURRENT_USER", JSON.stringify(res.user));
          sessionStorage.setItem("festio_staff_token", res.token);
          
          import('./store.js').then(module => {
            module.addNotification("AUTH", `[실제 DB 로그인 성공] ${res.user.name} 계정`);
          });
          checkAuthSession();
        } else {
          const errorBox = document.getElementById("login-error-alert");
          errorBox.innerText = res.error || "이메일 또는 비밀번호가 올바르지 않습니다.";
          errorBox.style.display = "block";
        }
      } catch (err) {
        const errorBox = document.getElementById("login-error-alert");
        errorBox.innerText = "서버 통신 중 오류가 발생했습니다.";
        errorBox.style.display = "block";
      }
    };
  }
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
async function renderDashboard() {
  const view = document.getElementById("view-dashboard");
  if (!view) return;

  let fnbOrders = [];
  let goodsOrders = [];
  try {
    const [fnbRes, goodsRes, seatsRes] = await Promise.all([
      fetch('/api/order/fnb'),
      fetch('/api/order/goods'),
      fetch('/api/order/seats?zones=A,B,C')
    ]);
    if (fnbRes.ok) fnbOrders = await fnbRes.json();
    if (goodsRes.ok) goodsOrders = await goodsRes.json();
    
    if (seatsRes.ok) {
      const allSeats = await seatsRes.json();
      DB.seats = {}; // Completely rebuild seats map from DB
      allSeats.forEach(s => {
        DB.seats[s.id] = {
          status: s.isReserved ? "RESERVED" : "AVAILABLE",
          holder: s.isReserved ? "예약됨" : null
        };
      });
    }
  } catch (e) {
    console.error("Failed to fetch dashboard data", e);
  }

  const stats = getSeatStats();
  
  // Stats calculations
  const enteredPercent = stats.total > 0 ? Math.round((stats.entered / stats.total) * 100) : 0;
  const reservedTotal = stats.reserved + stats.entered;
  const reservedPercent = stats.total > 0 ? Math.round((reservedTotal / stats.total) * 100) : 0;

  fnbOrders = fnbOrders.filter(o => o.status !== "REFUNDED");
  const activeFnbCount = fnbOrders.filter(o => o.status === "RECEIVED" || o.status === "COOKING" || o.status === "READY").length;
  const activeGoodsCount = goodsOrders.filter(o => o.status === "ORDERED" || o.status === "READY").length;

  view.innerHTML = `
    <!-- Top KPI Dashboard Cards -->
    <div class="dashboard-metrics" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 25px;">
      <div class="metric-card metric-green">
        <div class="metric-title" style="display: flex; justify-content: space-between; align-items: center;">
          <span>🚶 당일 실시간 입장객 현황</span>
          <span class="badge badge-green">${enteredPercent}% 완료</span>
        </div>
        <div class="metric-value" id="dash-total-entered" style="font-size: 28px;">${stats.entered}명 <span style="font-size: 14px; color: var(--text-muted); font-weight: normal;">/ ${stats.total}석</span></div>
        <div style="width: 100%; background: #0d1117; border: 1px solid var(--border-color); height: 6px; border-radius: 3px; overflow: hidden; margin-bottom: 8px;">
          <div style="width: ${enteredPercent}%; background: var(--color-green); height: 100%; box-shadow: 0 0 8px var(--color-green); transition: width 0.5s ease;"></div>
        </div>
        <div class="metric-footer">QR 코드 리더 검증 통과 게이트 실시간 통계</div>
      </div>

      <div class="metric-card metric-blue">
        <div class="metric-title" style="display: flex; justify-content: space-between; align-items: center;">
          <span>🎟️ 좌석 예매 및 발권 완료</span>
          <span class="badge badge-blue">${reservedPercent}% 예약</span>
        </div>
        <div class="metric-value" style="font-size: 28px;">${reservedTotal}석 <span style="font-size: 14px; color: var(--text-muted); font-weight: normal;">/ ${stats.total}석</span></div>
        <div style="width: 100%; background: #0d1117; border: 1px solid var(--border-color); height: 6px; border-radius: 3px; overflow: hidden; margin-bottom: 8px;">
          <div style="width: ${reservedPercent}%; background: var(--color-blue); height: 100%; box-shadow: 0 0 8px var(--color-blue); transition: width 0.5s ease;"></div>
        </div>
        <div class="metric-footer">예매 완료 및 입장권 발매 전체 세그먼트</div>
      </div>

      <div class="metric-card metric-amber">
        <div class="metric-title" style="display: flex; justify-content: space-between; align-items: center;">
          <span>🍔 식음료(F&B) 주문 관리</span>
          <span class="badge badge-amber">${activeFnbCount}건 대기</span>
        </div>
        <div class="metric-value" style="font-size: 28px;">총 ${fnbOrders.length}건 <span style="font-size: 14px; color: var(--text-muted); font-weight: normal;">/ 활성: ${activeFnbCount}건</span></div>
        <div style="width: 100%; background: #0d1117; border: 1px solid var(--border-color); height: 6px; border-radius: 3px; overflow: hidden; margin-bottom: 8px;">
          <div style="width: ${fnbOrders.length > 0 ? Math.min(100, Math.round((activeFnbCount / fnbOrders.length) * 100)) : 0}%; background: var(--color-amber); height: 100%; box-shadow: 0 0 8px var(--color-amber); transition: width 0.5s ease;"></div>
        </div>
        <div class="metric-footer">식음료 매장 대기 및 완료 실시간 주문 흐름</div>
      </div>
    </div>

    <!-- Main Live Queue Section (Two Column Grid) -->
    <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px; margin-bottom: 25px;">
      <!-- Left Panel: Goods Reservation List -->
      <div class="panel-rigid">
        <div class="panel-header-rigid">
          <span style="display: flex; align-items: center; gap: 8px;">
            <span>🎁 굿즈 예약/수령 관리 목록</span>
            <span class="badge badge-blue">${activeGoodsCount}건 대기 중</span>
          </span>
          <span class="telemetry-pulse" style="font-family: var(--font-mono); color: var(--color-blue);">GOODS SYSTEM</span>
        </div>
        <div class="panel-body-rigid" style="padding: 10px; max-height: 380px; overflow-y: auto;">
          <table class="table-rigid" style="font-size: 12px;">
            <thead>
              <tr>
                <th>주문번호</th>
                <th>고객명</th>
                <th>굿즈 상품 내역</th>
                <th>상태</th>
                <th class="text-right">스태프 액션</th>
              </tr>
            </thead>
            <tbody id="dash-goods-list">
              <!-- Dynamically rendered goods -->
            </tbody>
          </table>
        </div>
      </div>

      <!-- Right Panel: F&B Cook & Pickup Queue -->
      <div class="panel-rigid">
        <div class="panel-header-rigid">
          <span style="display: flex; align-items: center; gap: 8px;">
            <span>🍔 실시간 F&B 주문 접수 대기열</span>
            <span class="badge badge-amber">${activeFnbCount}건 조리 중</span>
          </span>
          <span class="telemetry-pulse" style="font-family: var(--font-mono); color: var(--color-amber);">F&B KITCHEN</span>
        </div>
        <div class="panel-body-rigid" style="padding: 10px; max-height: 380px; overflow-y: auto;">
          <table class="table-rigid" style="font-size: 12px;">
            <thead>
              <tr>
                <th>주문번호</th>
                <th>고객명</th>
                <th>주문 품목</th>
                <th class="text-right">상태 업데이트</th>
              </tr>
            </thead>
            <tbody id="dash-fnb-list">
              <!-- Dynamically rendered active F&B -->
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Bottom Panel: Scan logs & Telemetry console -->
    <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px;">
      <!-- Scan Logs Panel -->
      <div class="panel-rigid">
        <div class="panel-header-rigid" style="display: flex; justify-content: space-between; align-items: center;">
          <span style="display: flex; align-items: center; gap: 8px;">
            <span style="display: inline-block; width: 8px; height: 8px; background-color: var(--color-green); border-radius: 50%; box-shadow: 0 0 6px var(--color-green);" class="animate-pulse"></span>
            <span>📸 최근 티켓 스캔 및 게이트 입장 현황</span>
          </span>
          <span style="font-family: var(--font-mono); color: var(--color-green); font-size: 11px;">GATE SYNC: ON</span>
        </div>
        <div class="panel-body-rigid" style="padding: 10px; max-height: 180px; overflow-y: auto;">
          <table class="table-rigid" style="font-size: 11px;">
            <thead>
              <tr>
                <th>스캔시간</th>
                <th>티켓번호</th>
                <th>매핑좌석</th>
                <th>고객명</th>
                <th class="text-right">검증결과</th>
              </tr>
            </thead>
            <tbody id="dash-scan-logs-tbody">
              <!-- Scan logs rendered here -->
            </tbody>
          </table>
        </div>
      </div>

      <!-- Telemetry Logs Panel -->
      <div class="panel-rigid">
        <div class="panel-header-rigid" style="display: flex; justify-content: space-between; align-items: center;">
          <span style="display: flex; align-items: center; gap: 8px;">
            <span style="display: inline-block; width: 8px; height: 8px; background-color: var(--color-blue); border-radius: 50%; box-shadow: 0 0 6px var(--color-blue);" class="animate-pulse"></span>
            <span>🔌 실시간 통합 관제 시스템 텔레메트리 피드</span>
          </span>
          <span style="font-family: var(--font-mono); color: var(--text-muted); font-size: 11px;">WEBSOCKET LIVE</span>
        </div>
        <div class="panel-body-rigid" style="padding: 0;">
          <div class="telemetry-terminal" id="dash-telemetry-logs" style="height: 180px; max-height: 180px; overflow-y: auto;">
            <!-- Telemetry logs are rendered here -->
          </div>
        </div>
      </div>
    </div>
  `;

  // Render Goods List
  const goodsListBody = document.getElementById("dash-goods-list");
  if (goodsOrders.length === 0) {
    goodsListBody.innerHTML = `<tr><td colspan="5" class="text-center" style="color:var(--text-muted); padding: 20px 0;">등록된 굿즈 예약 내역이 없습니다.</td></tr>`;
  } else {
    goodsOrders.forEach(o => {
      const itemsText = o.items.map(item => `${item.name} (${item.quantity}개)`).join(", ");
      
      let statusBadge = "";
      let actionBtn = "";

      if (o.status === "ORDERED") {
        statusBadge = `<span class="badge badge-gray animate-pulse">결제완료</span>`;
        actionBtn = `<button class="btn btn-rigid btn-small btn-blue btn-goods-action" data-id="${o.id}" data-next="READY">수령대기 처리</button>`;
      } else if (o.status === "READY") {
        statusBadge = `<span class="badge badge-amber animate-pulse">수령가능</span>`;
        actionBtn = `<button class="btn btn-rigid btn-small btn-green btn-goods-action" data-id="${o.id}" data-next="PICKED_UP">수령완료 처리</button>`;
      } else if (o.status === "PICKED_UP") {
        statusBadge = `<span class="badge badge-blue">픽업완료</span>`;
        actionBtn = `<span style="color:var(--text-muted); font-size:11px;">전달 완료</span>`;
      } else if (o.status === "REFUNDED") {
        statusBadge = `<span class="badge badge-red">환불완료</span>`;
        actionBtn = `<span style="color:var(--color-red); font-size:11px;">취소됨</span>`;
      }

      const row = document.createElement("tr");
      row.innerHTML = `
        <td><strong>${o.id}</strong></td>
        <td>${o.customer}</td>
        <td title="${itemsText}">${itemsText.length > 25 ? itemsText.substring(0, 25) + "..." : itemsText}</td>
        <td>${statusBadge}</td>
        <td class="text-right">${actionBtn}</td>
      `;
      goodsListBody.appendChild(row);
    });
  }

  // Render F&B List (Only show incomplete orders to save space on dashboard)
  const activeFnbOrders = fnbOrders.filter(o => o.status !== "PICKED_UP" && o.status !== "REFUNDED");
  const fnbListBody = document.getElementById("dash-fnb-list");
  if (activeFnbOrders.length === 0) {
    fnbListBody.innerHTML = `<tr><td colspan="4" class="text-center" style="color:var(--text-muted); padding: 20px 0;">대기 중인 활성 식음료 주문이 없습니다.</td></tr>`;
  } else {
    activeFnbOrders.forEach(o => {
      const itemsText = o.items.map(item => `${item.name} (${item.quantity}개)`).join(", ");
      
      let statusBtn = "";
      if (o.status === "RECEIVED") {
        statusBtn = `<button class="btn btn-rigid btn-small btn-amber btn-fnb-action" data-id="${o.id}" data-next="COOKING" style="width: 90px;">조리 시작</button>`;
      } else if (o.status === "COOKING") {
        statusBtn = `<button class="btn btn-rigid btn-small btn-green btn-fnb-action" data-id="${o.id}" data-next="READY" style="width: 90px;">조리 완료</button>`;
      } else if (o.status === "READY") {
        statusBtn = `<button class="btn btn-rigid btn-small btn-blue btn-fnb-action" data-id="${o.id}" data-next="PICKED_UP" style="width: 90px;">픽업 완료</button>`;
      }

      const row = document.createElement("tr");
      row.innerHTML = `
        <td><strong>${o.id}</strong></td>
        <td>${o.customer}</td>
        <td title="${itemsText}">${itemsText.length > 20 ? itemsText.substring(0, 20) + "..." : itemsText}</td>
        <td class="text-right">${statusBtn}</td>
      `;
      fnbListBody.appendChild(row);
    });
  }

  // Render Scan Logs
  const scanLogs = DB.notifications.filter(n => n.message.includes("[QR 스캔]")).slice(0, 5);
  const scanLogsTbody = document.getElementById("dash-scan-logs-tbody");
  if (scanLogsTbody) {
    if (scanLogs.length === 0) {
      scanLogsTbody.innerHTML = `<tr><td colspan="5" class="text-center" style="color:var(--text-muted); padding: 15px 0;">최근 스캔 기록이 없습니다.</td></tr>`;
    } else {
      scanLogs.forEach(log => {
        const parts = log.message.match(/티켓\s([A-Za-z0-9\-]+):\s결과\s\[([A-Z_]+)\]/);
        if (!parts) return;
        const ticketId = parts[1];
        const status = parts[2];

        const ticket = DB.tickets.find(t => t.id === ticketId);
        const seatId = ticket ? ticket.seat : "-";
        const holder = ticket ? ticket.holder : "알 수 없는 고객";

        let badgeClass = "badge-red";
        let statusText = "검증오류";
        if (status === "VALID") {
          badgeClass = "badge-green";
          statusText = "입장 승인";
        } else if (status === "ALREADY_ENTERED") {
          badgeClass = "badge-purple";
          statusText = "중복 입장";
        }

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${log.timestamp}</td>
          <td><strong>${ticketId}</strong></td>
          <td><span class="badge badge-gray">${seatId}</span></td>
          <td>${holder}</td>
          <td class="text-right"><span class="badge ${badgeClass}">${statusText}</span></td>
        `;
        scanLogsTbody.appendChild(tr);
      });
    }
  }

  // Render Telemetry logs at the bottom
  const logsContainer = document.getElementById("dash-telemetry-logs");
  if (logsContainer) {
    logsContainer.innerHTML = DB.notifications.map(n => `
      <div class="log-line log-${n.type.toLowerCase()}">
        <span class="log-time">[${n.timestamp}]</span>
        <span class="log-badge" style="margin: 0 6px;">${n.type}</span>
        <span class="log-message">${n.message}</span>
      </div>
    `).join("");
    // Auto-scroll to bottom of logs
    setTimeout(() => {
      logsContainer.scrollTop = logsContainer.scrollHeight;
    }, 50);
  }

  // Bind Goods Actions
  document.querySelectorAll(".btn-goods-action").forEach(btn => {
    btn.onclick = async () => {
      const ordId = btn.getAttribute("data-id");
      const nextStatus = btn.getAttribute("data-next");
      
      try {
        await fetch(`/api/order/goods/${ordId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus })
        });
      } catch (e) {}

      addNotification("ORDER", `굿즈 주문 ${ordId} 상태 변경 -> ${nextStatus}`);
      renderDashboard();
    };
  });

  // Bind F&B Actions
  document.querySelectorAll(".btn-fnb-action").forEach(btn => {
    btn.onclick = async () => {
      const ordId = btn.getAttribute("data-id");
      const nextStatus = btn.getAttribute("data-next");
      
      try {
        await fetch(`/api/order/fnb/${ordId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus })
        });
      } catch (e) {}

      addNotification("ORDER", `식음료 주문 ${ordId} 상태 변경 -> ${nextStatus}`);
      renderDashboard();
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
        <div id="qr-camera-reader-wrapper" style="position:relative;">
          <div id="qr-camera-reader" style="width: 100%; max-width: 450px; margin: 0 auto; border: 2px solid #2d3748; background:#1a202c;">
            <!-- html5-qrcode camera goes here -->
          </div>
          <button id="btn-stop-camera" class="btn btn-rigid btn-red" style="display:none; margin-top:10px;">카메라 끄기 / 스캔 중단</button>
          
          <!-- Confirm Scan Overlay (Removed to speed up line) -->
          
          <!-- Active Validation Overlay (Floating over camera) -->
          <div id="scan-validation-screen" style="display:none; position:absolute; bottom:10%; left:50%; transform:translateX(-50%); z-index:9999; width:90%; max-width:350px; background:rgba(15,23,42,0.95); border-radius:16px; box-shadow:0 15px 35px rgba(0,0,0,0.8); padding:20px; text-align:center; border:2px solid #38bdf8;">
            <div id="scan-result-card-inner" style="background:transparent; padding:0; box-shadow:none;">
              <h2 id="scan-result-title" style="margin:0 0 5px 0; font-size:24px; font-weight:900;">VALID</h2>
              <div id="scan-result-ticket-number" style="display:none;"></div>
              <p id="scan-result-msg" style="margin:0; font-size:14px; color:#cbd5e1; word-break:keep-all;"></p>
              <button id="btn-close-scan-overlay" class="btn btn-rigid btn-green" style="margin-top:15px; width:100%; font-weight:bold; padding:12px;">확인 및 계속 스캔</button>
            </div>
          </div>
        </div>
        <div style="margin-top: 15px;">
          <button id="btn-start-camera" class="btn btn-rigid btn-blue">카메라 연결 및 스캔 시작</button>
        </div>
      </div>
    </div>
  `;

  // QR Camera bindings
  const wrapper = document.getElementById("qr-camera-reader-wrapper");
  const startCamBtn = document.getElementById("btn-start-camera");
  const stopCamBtn = document.getElementById("btn-stop-camera");
  
  // Confirmation Prompt Logic (Bypassed for speed)
  function askConfirmScan(decodedText) {
    return Promise.resolve(true); // 항상 즉시 승인 (팝업 안 띄움)
  }

  startCamBtn.onclick = () => {
    initializeQRScanner("qr-camera-reader", 
      async (decodedText) => {
        return await triggerScanValidationUI(decodedText);
      }
    );
    
    // CSS Transform 버그 회피: wrapper를 body 최상단으로 강제 이동
    const wrapper = document.getElementById("qr-camera-reader-wrapper");
    if (!document.getElementById("qr-wrapper-placeholder")) {
        const placeholder = document.createElement("div");
        placeholder.id = "qr-wrapper-placeholder";
        wrapper.parentNode.insertBefore(placeholder, wrapper);
    }
    document.body.appendChild(wrapper);
    
    // 확실한 100% 꽉찬 화면을 위해 강제로 인라인 스타일 적용
    wrapper.classList.add("fullscreen-mode");
    wrapper.style.position = "fixed";
    wrapper.style.top = "0";
    wrapper.style.left = "0";
    wrapper.style.width = "100vw";
    wrapper.style.height = "100vh";
    wrapper.style.backgroundColor = "#000";
    wrapper.style.zIndex = "999999";
    wrapper.style.display = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.justifyContent = "center";
    wrapper.style.alignItems = "center";
    
    // 강제로 빈 여백 없이 늘리기 위한 설정
    const reader = document.getElementById("qr-camera-reader");
    if(reader) {
        reader.style.width = "100vw";
        reader.style.height = "100vh";
        reader.style.maxWidth = "none";
        reader.style.maxHeight = "none";
    }
    
    // 비디오 강제 확장을 위한 스타일 주입
    if (!document.getElementById("fullscreen-video-style")) {
        const style = document.createElement("style");
        style.id = "fullscreen-video-style";
        style.innerHTML = `
            #qr-camera-reader__scan_region, #qr-camera-reader video {
                width: 100vw !important;
                height: 100vh !important;
                object-fit: cover !important;
            }
        `;
        document.head.appendChild(style);
    }
    
    startCamBtn.style.display = "none";
    
    // 버튼 스타일이 망가지지 않도록 기본 인라인 속성만 지정 (나머지는 CSS가 처리)
    stopCamBtn.style.display = "inline-block";
    stopCamBtn.style.zIndex = "1000000";
  };

  stopCamBtn.onclick = () => {
    stopQRScanner();
    
    // 원래 위치로 복귀
    const wrapper = document.getElementById("qr-camera-reader-wrapper");
    const placeholder = document.getElementById("qr-wrapper-placeholder");
    if (wrapper && placeholder) {
        placeholder.parentNode.insertBefore(wrapper, placeholder);
    }
    
    wrapper.classList.remove("fullscreen-mode");
    wrapper.style = "position:relative;"; // 스타일 초기화
    
    const reader = document.getElementById("qr-camera-reader");
    if(reader) {
        reader.style = "width: 100%; max-width: 450px; margin: 0 auto; border: 2px solid #2d3748; background:#1a202c;";
    }
    
    const styleElem = document.getElementById("fullscreen-video-style");
    if (styleElem) styleElem.remove();
    
    startCamBtn.style.display = "inline-block";
  };
}

async function triggerScanValidationUI(ticketId) {
  const result = await validateTicketState(ticketId);
  const overlay = document.getElementById("scan-validation-screen");
  const title = document.getElementById("scan-result-title");
  const msg = document.getElementById("scan-result-msg");
  const tNum = document.getElementById("scan-result-ticket-number");
  const closeBtn = document.getElementById("btn-close-scan-overlay");

  title.innerText = result.status;
  msg.innerText = result.message;
  
  if (result.log && result.log.ticketId) {
      tNum.innerText = `🎫 티켓 번호: ${result.log.ticketId}`;
  } else {
      tNum.innerText = `🎫 ${ticketId}`;
  }

  // Clear colors
  closeBtn.className = "btn btn-rigid";

  if (result.status === "VALID") {
    overlay.style.borderColor = "#10b981"; // Green
    title.innerText = "입장하셨습니다";
    title.style.color = "#10b981";
    closeBtn.classList.add("btn-green");
  } else if (result.status === "ALREADY_ENTERED") {
    overlay.style.borderColor = "#a855f7"; // Purple
    title.innerText = "중복 입장 불가";
    title.style.color = "#a855f7";
    closeBtn.classList.add("btn-purple");
  } else {
    overlay.style.borderColor = "#ef4444"; // Red
    title.innerText = "입장 불가";
    title.style.color = "#ef4444";
    closeBtn.classList.add("btn-red");
  }

  overlay.style.display = "block";

  // 2.5초 후 팝업 자동 닫기 (새로운 스캔을 방해하지 않음)
  if (window.scanPopupTimeout) clearTimeout(window.scanPopupTimeout);
  window.scanPopupTimeout = setTimeout(() => {
    overlay.style.display = "none";
  }, 2500);

  closeBtn.onclick = () => {
    overlay.style.display = "none";
    if (window.scanPopupTimeout) clearTimeout(window.scanPopupTimeout);
    
    // Refresh currently active screen dynamically
    const activeView = document.querySelector(".content-view.active");
    if (activeView) {
      const viewId = activeView.id.replace("view-", "");
      renderViewData(viewId);
    }
  };
  
  return result;
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
        <span>실시간 입장객: <strong id="scan-entered-count">${stats.entered}</strong> / ${stats.total} 석</span>
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
async function renderSeatMapScreen() {
  const view = document.getElementById("view-seats");
  if (!view) return;

  try {
    const res = await fetch('/api/order/seats?zones=A,B,C');
    if (res.ok) {
      const allSeats = await res.json();
      DB.seats = {};
      allSeats.forEach(s => {
        DB.seats[s.id] = {
          status: s.isReserved ? "RESERVED" : "AVAILABLE",
          holder: s.isReserved ? "예약됨" : null
        };
      });
    }
  } catch(e) {
    console.error("Failed to fetch reserved seats", e);
  }

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
  renderSeatMap("seat-map-renderer-container", null);

  // Bind Realtime Sync
  setupRealtimeSeatSync();
  window.activeSeatClickHandler = null;


}

// ==========================================
// 5. ON-SITE TICKETING SCREEN RENDERING
// ==========================================
async function renderTicketingScreen() {
  const view = document.getElementById("view-ticketing");
  if (!view) return;

  try {
    const res = await fetch('/api/order/seats?zones=A,B,C');
    if (res.ok) {
      const allSeats = await res.json();
      DB.seats = {};
      allSeats.forEach(s => {
        DB.seats[s.id] = {
          status: s.isReserved ? "RESERVED" : "AVAILABLE",
          holder: s.isReserved ? "예약됨" : null
        };
      });
    }
  } catch(e) {
    console.error("Failed to fetch reserved seats", e);
  }

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
      onSuccess: async (paymentData) => {
        // Success payment: Send to backend
        const seatIds = selectedSeats.map(s => s.seatId);
        
        try {
          const res = await fetch('/api/order/ticket', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              totalPrice: totalPrice,
              seats: seatIds
            })
          });

          if (!res.ok) throw new Error("API Error");
          const result = await res.json();

          // Publish global payment complete
          publish("payment-complete", { customer: holder, amount: totalPrice });
          addNotification("TICKET", `현장 고객 ${holder}님 일괄 예매 완료: 좌석 [${seatIdsText}]`);

          // ================= [ 방안 3: 영수증 프린터로 모바일 접속용 QR 인쇄 ] =================
          const secretStr = result.qrPayload.replace('SECRET:', '');
          const ticketUrl = `${window.location.origin}/features/user/ticket/view.html?orderId=${result.orderId}&secret=${secretStr}`;
          const qrImgSrc = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(ticketUrl)}`;
          
          const printWindow = window.open('', '_blank', 'width=400,height=700');
          const receiptHtml = `
            <html>
            <head>
              <title>영수증 티켓 출력</title>
              <style>
                body { font-family: 'Malgun Gothic', 'Courier New', monospace; width: 300px; margin: 0 auto; padding: 20px; text-align: center; color: black; background: white; }
                .divider { border-bottom: 1px dashed black; margin: 15px 0; }
                .title { font-size: 22px; font-weight: bold; margin-bottom: 5px; }
                .qrcode { margin: 20px 0; }
                .info { font-size: 14px; text-align: left; line-height: 1.6; }
                .footer { font-size: 12px; margin-top: 20px; }
                @media print {
                  @page { margin: 0; }
                  body { width: 100%; margin: 0; padding: 0; }
                }
              </style>
            </head>
            <body>
              <div class="title">FESTIO 영수증 티켓</div>
              <div>[ 현장결제 완료 ]</div>
              <div class="divider"></div>
              <div class="info">
                <strong>주문번호:</strong> ORD-${result.orderId}<br>
                <strong>좌석정보:</strong> ${seatIdsText}<br>
                <strong>티켓번호:</strong> ${result.ticketNumber}<br>
                <strong>결제금액:</strong> ${totalPrice.toLocaleString()}원
              </div>
              <div class="divider"></div>
              <div class="qrcode">
                <img src="${qrImgSrc}" width="160" height="160" onload="window.print();" />
              </div>
              <div style="font-weight: bold; font-size: 16px; margin-bottom: 10px;">스마트폰으로 스캔하세요!</div>
              <div class="footer">
                카메라 앱으로 위 QR코드를 스캔하시면<br>입장용 움직이는 모바일 티켓이 열립니다.<br><br>
                입장 게이트 스태프에게<br>폰 화면을 보여주세요.
              </div>
              <div class="divider"></div>
              <div>감사합니다</div>
            </body>
            </html>
          `;
          printWindow.document.write(receiptHtml);
          printWindow.document.close();
          // ==============================================================================

          selectedSeats = [];
          
          // Re-render to fetch newly reserved seats from backend
          renderTicketingScreen();
          renderDashboard(); // Update dashboard counts
          
        } catch (e) {
          alert("서버 오류: 예매를 저장하지 못했습니다.");
          console.error(e);
        }
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
async function renderRefundScreen() {
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
              <th>내용 (좌석 번호)</th>
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

  try {
    const res = await fetch('/api/order/tickets');
    const tbody = document.getElementById("refund-tbody");
    if (!res.ok) throw new Error("API 오류");
    
    const orders = await res.json();
    
    if (orders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="color:#a0aec0;">조회되는 결제 완료 예매가 없습니다.</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    orders.forEach(o => {
    let actionBtnHtml = "";
    let statusLabel = "";

    if (o.payment_status === "PAID") {
      statusLabel = `<span class="badge badge-green">결제 완료</span>`;
      actionBtnHtml = `<button class="btn btn-rigid btn-small btn-red btn-request-ref" data-id="${o.id}">환불 요청</button>`;
    } else if (o.payment_status === "REFUND_REQUESTED") {
      statusLabel = `<span class="badge badge-amber animate-pulse">환불 접수</span>`;
      actionBtnHtml = `<button class="btn btn-rigid btn-small btn-purple btn-accept-ref" data-id="${o.id}">환불 수락 (Cancel API)</button>`;
    } else if (o.payment_status === "REFUNDED") {
      statusLabel = `<span class="badge badge-red">환불 완료</span>`;
      actionBtnHtml = `<span style="font-size:12px; color:#a0aec0;">환불 완료됨</span>`;
    }

    let dateStr = "";
    if (Array.isArray(o.created_at)) {
      dateStr = o.created_at.slice(0, 3).join('-') + ' ' + o.created_at.slice(3, 5).join(':');
    } else {
      dateStr = new Date(o.created_at).toLocaleString();
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>ORD-${o.id}</strong></td>
      <td><span class="badge badge-blue">현장예매</span></td>
      <td>현장 고객</td>
      <td>좌석: <strong>${o.seat_ids || '정보 없음'}</strong></td>
      <td><strong>${Number(o.total_price).toLocaleString()}원</strong></td>
      <td>${statusLabel}<br><span style="font-size:10px; color:var(--text-muted);">${dateStr}</span></td>
      <td class="text-right">${actionBtnHtml}</td>
    `;
    tbody.appendChild(tr);
  });
  
  } catch (e) {
    const tbody = document.getElementById("refund-tbody");
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="color:#ef4444;">데이터를 불러오지 못했습니다.</td></tr>`;
  }

  // Action Click Bindings
  document.querySelectorAll(".btn-request-ref").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute("data-id");
      if (confirm(`주문 ${id}에 대한 환불을 즉시 완료 처리하시겠습니까?`)) {
        try {
          await fetch(`/api/order/tickets/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: "REFUNDED" })
          });
          alert(`주문 ${id}이(가) 환불 완료 처리되었습니다.`);
        } catch (e) {
          console.error(e);
        }
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

async function renderFnbQueueTable() {
  const tbody = document.getElementById("fnb-queue-tbody");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="color:#a0aec0;">로딩 중...</td></tr>`;

  let fnbOrders = [];
  try {
    const res = await fetch('/api/order/fnb');
    if (res.ok) {
      fnbOrders = await res.json();
    }
  } catch (e) {
    console.error("Failed to fetch F&B orders", e);
  }

  if (fnbOrders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="color:#a0aec0;">접수된 식음료 주문이 없습니다.</td></tr>`;
    return;
  }
  tbody.innerHTML = "";

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
    el.onclick = async () => {
      const ordId = el.getAttribute("data-id");
      const nextStatus = el.getAttribute("data-next");
      
      try {
        await fetch(`/api/order/fnb/${ordId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus })
        });
      } catch (e) {
        console.error("Failed to update status", e);
      }

      const order = DB.orders.find(o => o.id === ordId);
      if (order) {
        order.status = nextStatus;
        saveDB();
        publish("order-change", { orderId: ordId, status: nextStatus });
      }
      renderFnbOrdersScreen();
    };
  });

  // Cancel Handler
  document.querySelectorAll(".btn-fnb-cancel").forEach(btn => {
    btn.onclick = async () => {
      const ordId = btn.getAttribute("data-id");
      if (confirm(`주문 ${ordId}을 취소하고 환불처리 하시겠습니까?`)) {
        try {
          await fetch(`/api/order/fnb/${ordId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: "REFUNDED" })
          });
        } catch (e) {
          console.error("Failed to cancel order", e);
        }

        const order = DB.orders.find(o => o.id === ordId);
        if (order) {
          order.status = "REFUNDED";
          saveDB();
          publish("order-change", { orderId: ordId, status: "REFUNDED" });
        }
        alert("주문 취소 및 환불 처리가 성공 완료되었습니다.");
        renderFnbOrdersScreen();
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

async function renderGoodsQueueTable() {
  const tbody = document.getElementById("goods-queue-tbody");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="color:#a0aec0; padding:30px 0;">로딩 중...</td></tr>`;
  
  let goodsOrders = [];
  try {
    const res = await fetch('/api/order/goods');
    if (res.ok) {
      goodsOrders = await res.json();
    }
  } catch (e) {
    console.error("Failed to fetch GOODS orders", e);
  }

  if (goodsOrders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="color:#a0aec0; padding:30px 0;">주문 수령 대기 중인 굿즈가 없습니다.</td></tr>`;
    return;
  }
  tbody.innerHTML = "";

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
    el.onclick = async () => {
      const ordId = el.dataset.id;
      const nextStatus = el.dataset.next;
      
      try {
        await fetch(`/api/order/goods/${ordId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus })
        });
      } catch (e) {
        console.error("Failed to update goods status", e);
      }

      const order = DB.orders.find(o => o.id === ordId);
      if (order) {
        order.status = nextStatus;
        saveDB();
        publish("order-change", { orderId: ordId, status: nextStatus });
      }
      renderGoodsOrdersScreen();
    };
  });

  // 환불/취소
  tbody.querySelectorAll(".btn-goods-refund").forEach(btn => {
    btn.onclick = async () => {
      const ordId = btn.dataset.id;
      if (!confirm(`주문 ${ordId}을 전면 환불/취소하시겠습니까?\n(현재재고수량이 자동 복원됩니다)`)) return;
      
      try {
        await fetch(`/api/order/goods/${ordId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: "REFUNDED" })
        });
      } catch (e) {
        console.error("Failed to refund goods order", e);
      }
      
      const order = DB.orders.find(o => o.id === ordId);
      if (order) {
        order.items.forEach(item => {
          const g = DB.goods.find(g => g.name === item.name);
          if (g) g.currentStock += item.quantity;
        });
        order.status = "REFUNDED";
        saveDB();
        publish("order-change", { orderId: ordId, status: "REFUNDED" });
      }
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
            <div class="form-group-rigid" style="margin-top: 15px; padding-top: 15px; border-top: 1px dashed #e2e8f0;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <label style="margin: 0;">옵션 등록 (선택)</label>
                <button type="button" class="btn btn-small btn-blue btn-add-g-option" style="padding: 2px 8px; font-size: 12px; border-radius: 4px;">+ 옵션 추가</button>
              </div>
              <div id="goods-options-container" style="display: flex; flex-direction: column; gap: 8px;">
                <!-- Options will be added here -->
              </div>
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
  
  // Options logic
  const btnAddGOpt = document.querySelector(".btn-add-g-option");
  const gOptContainer = document.getElementById("goods-options-container");
  if (btnAddGOpt) {
    btnAddGOpt.onclick = () => {
      const row = document.createElement("div");
      row.className = "option-row";
      row.style.cssText = "display: flex; gap: 10px; align-items: center;";
      row.innerHTML = `
        <input type="text" placeholder="옵션사항 (예: 사이즈업)" class="input-rigid opt-name" style="flex: 2;">
        <input type="number" placeholder="추가가격 (예: 500)" class="input-rigid opt-price" style="flex: 1;">
        <button type="button" class="btn btn-small btn-green btn-opt-soldout" data-soldout="false" style="padding: 2px 6px; font-size: 11px; white-space: nowrap;">판매중</button>
        <button type="button" class="btn-remove-option" style="background:none; border:none; color:#ef4444; font-size:16px; cursor:pointer;" title="삭제">&times;</button>
      `;
      gOptContainer.appendChild(row);
      row.querySelector(".btn-remove-option").onclick = () => row.remove();
      row.querySelector(".btn-opt-soldout").onclick = function() {
        if (this.dataset.soldout === "false") {
          this.dataset.soldout = "true";
          this.className = "btn btn-small btn-red btn-opt-soldout";
          this.innerText = "품절";
        } else {
          this.dataset.soldout = "false";
          this.className = "btn btn-small btn-green btn-opt-soldout";
          this.innerText = "판매중";
        }
      };
    };
  }
  gOptContainer.querySelectorAll(".btn-remove-option").forEach(btn => {
    btn.onclick = () => btn.parentElement.remove();
  });
  gOptContainer.querySelectorAll(".btn-opt-soldout").forEach(btn => {
    btn.onclick = function() {
      if (this.dataset.soldout === "false") {
        this.dataset.soldout = "true";
        this.className = "btn btn-small btn-red btn-opt-soldout";
        this.innerText = "품절";
      } else {
        this.dataset.soldout = "false";
        this.className = "btn btn-small btn-green btn-opt-soldout";
        this.innerText = "판매중";
      }
    };
  });

  document.getElementById("btn-open-goods-modal").onclick = () => {
    document.getElementById("new-goods-form").reset();
    document.getElementById("new-goods-form").removeAttribute("data-edit-id");
    // 초기화 시 빈 공간으로 유지 (옵션 기본창 없음)
    gOptContainer.innerHTML = "";

    document.querySelector("#goods-modal-overlay .registration-modal-header span").innerText = "굿즈 신규 등록";
    document.querySelector("#new-goods-form button[type='submit']").innerText = "등록";
    modal.style.display = "flex";
  };
  
  const closeModal = () => { modal.style.display = "none"; };
  document.getElementById("btn-close-goods-modal").onclick = closeModal;
  document.getElementById("btn-cancel-goods").onclick = closeModal;

  document.getElementById("new-goods-form").onsubmit = (e) => {
    e.preventDefault();
    const form = document.getElementById("new-goods-form");
    const editId = form.getAttribute("data-edit-id");
    const fileInput = document.getElementById("new-g-image-file");
    const name = document.getElementById("new-g-name").value.trim();
    const price = document.getElementById("new-g-price").value;
    const stock = document.getElementById("new-g-stock").value;

    const formData = new FormData();
    formData.append("productName", name);
    formData.append("price", price);
    formData.append("initialStock", stock);
    if (fileInput.files && fileInput.files[0]) {
      formData.append("productImage", fileInput.files[0]);
    }

    const url = editId ? `/api/goods/${editId}` : `/api/goods/register`;
    const method = editId ? 'PUT' : 'POST';

    fetch(url, {
      method: method,
      body: formData
    })
    .then(response => response.json())
    .then(data => {
      alert(data.message || (editId ? "굿즈가 수정되었습니다." : "신규 굿즈가 성공적으로 등록되었습니다."));
      closeModal();
      // 로컬 화면 갱신 (추후 서버 조회 로직으로 대체 권장)
      renderGoodsInventoryScreen();
    })
    .catch(error => {
      console.error('Error:', error);
      alert("굿즈 등록에 실패했습니다.");
    });
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
            <div class="form-group-rigid" style="margin-top: 15px; padding-top: 15px; border-top: 1px dashed #e2e8f0;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <label style="margin: 0;">옵션 등록 (선택)</label>
                <button type="button" class="btn btn-small btn-blue btn-add-f-option" style="padding: 2px 8px; font-size: 12px; border-radius: 4px;">+ 옵션 추가</button>
              </div>
              <div id="food-options-container" style="display: flex; flex-direction: column; gap: 8px;">
                <!-- Options will be added here -->
              </div>
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

  // Options logic
  const btnAddFOpt = document.querySelector(".btn-add-f-option");
  const fOptContainer = document.getElementById("food-options-container");
  if (btnAddFOpt) {
    btnAddFOpt.onclick = () => {
      const row = document.createElement("div");
      row.className = "option-row";
      row.style.cssText = "display: flex; gap: 10px; align-items: center;";
      row.innerHTML = `
        <input type="text" placeholder="옵션사항 (예: 샷추가)" class="input-rigid opt-name" style="flex: 2;">
        <input type="number" placeholder="추가가격 (예: 500)" class="input-rigid opt-price" style="flex: 1;">
        <button type="button" class="btn btn-small btn-green btn-opt-soldout" data-soldout="false" style="padding: 2px 6px; font-size: 11px; white-space: nowrap;">판매중</button>
        <button type="button" class="btn-remove-option" style="background:none; border:none; color:#ef4444; font-size:16px; cursor:pointer;" title="삭제">&times;</button>
      `;
      fOptContainer.appendChild(row);
      row.querySelector(".btn-remove-option").onclick = () => row.remove();
      row.querySelector(".btn-opt-soldout").onclick = function() {
        if (this.dataset.soldout === "false") {
          this.dataset.soldout = "true";
          this.className = "btn btn-small btn-red btn-opt-soldout";
          this.innerText = "품절";
        } else {
          this.dataset.soldout = "false";
          this.className = "btn btn-small btn-green btn-opt-soldout";
          this.innerText = "판매중";
        }
      };
    };
  }
  fOptContainer.querySelectorAll(".btn-remove-option").forEach(btn => {
    btn.onclick = () => btn.parentElement.remove();
  });

  document.getElementById("btn-open-food-modal").onclick = () => {
    document.getElementById("new-food-form").reset();
    document.getElementById("new-food-form").removeAttribute("data-edit-id");
    // 초기화 시 빈 공간으로 유지 (옵션 기본창 없음)
    fOptContainer.innerHTML = "";

    document.querySelector("#food-modal-overlay .registration-modal-header span").innerText = "F&B 신규 등록";
    document.querySelector("#new-food-form button[type='submit']").innerText = "등록";
    modal.style.display = "flex";
  };
  
  const closeModal = () => { modal.style.display = "none"; };
  document.getElementById("btn-close-food-modal").onclick = closeModal;
  document.getElementById("btn-cancel-food").onclick = closeModal;

  document.getElementById("new-food-form").onsubmit = (e) => {
    e.preventDefault();
    const form = document.getElementById("new-food-form");
    const editId = form.getAttribute("data-edit-id");
    const fileInput = document.getElementById("new-f-image-file");
    const name = document.getElementById("new-f-name").value.trim();
    const price = document.getElementById("new-f-price").value;

    const formData = new FormData();
    formData.append("foodName", name);
    formData.append("price", price);
    if (fileInput.files && fileInput.files[0]) {
      formData.append("foodImage", fileInput.files[0]);
    }

    const url = editId ? `/api/fnb/${editId}` : `/api/fnb/register`;
    const method = editId ? 'PUT' : 'POST';

    fetch(url, {
      method: method,
      body: formData
    })
    .then(response => response.json())
    .then(data => {
      alert(data.message || (editId ? "F&B 메뉴가 수정되었습니다." : "신규 F&B 메뉴가 등록되었습니다."));
      closeModal();
      // 로컬 화면 갱신 (추후 서버 조회 로직으로 대체 권장)
      renderFnbInventoryScreen();
    })
    .catch(error => {
      console.error('Error:', error);
      alert("F&B 메뉴 등록에 실패했습니다.");
    });
  };
}


function renderAdminGoodsList() {
  const tbody = document.getElementById("admin-goods-tbody");
  tbody.innerHTML = "<tr><td colspan='8'>데이터를 불러오는 중...</td></tr>";

  fetch('/api/goods/list')
    .then(res => res.json())
    .then(data => {
      tbody.innerHTML = "";
      data.forEach(g => {
        const avail = g.availableStock || 0;
        
        let statusText = `<span class="badge badge-green">판매중</span>`;
        if (avail <= 0) {
          statusText = `<span class="badge badge-red">품절(SOLD OUT)</span>`;
        }

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td style="display: flex; align-items: center; gap: 10px;">
            ${g.imageUrl ? `<img src="${g.imageUrl}" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover;">` : `<div style="width: 40px; height: 40px; border-radius: 4px; background: #2d3748; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #a0aec0;">NO IMG</div>`}
            <strong>${g.productName}</strong>
          </td>
          <td>${(g.price || 0).toLocaleString()}원</td>
          <td>${g.currentStock}</td>
          <td><span style="color:#8b5cf6;">${g.preAllocatedStock || 0}</span></td>
          <td><strong>${avail}</strong></td>
          <td>${statusText}</td>
          <td class="text-right">
            <button class="btn btn-rigid btn-small btn-orange btn-force-soldout-g" data-id="${g.id}" ${avail <= 0 ? 'disabled' : ''}>품절</button>
            <button class="btn btn-rigid btn-small btn-gray btn-edit-g" data-id="${g.id}" data-name="${g.productName}" data-price="${g.price || 0}" data-stock="${g.currentStock}">수정</button>
            <button class="btn btn-rigid btn-small btn-red btn-delete-g" data-id="${g.id}">삭제</button>
          </td>
        `;
        tbody.appendChild(tr);
      });

      // Force Sold Out binding
      document.querySelectorAll(".btn-force-soldout-g").forEach(btn => {
        btn.onclick = () => {
          if(confirm("해당 굿즈의 재고를 0으로 만들어 품절 처리하시겠습니까?")) {
            const id = btn.getAttribute("data-id");
            const formData = new FormData();
            formData.append("initialStock", 0); // 수량을 0으로 덮어씀

            fetch('/api/goods/' + id, { method: 'PUT', body: formData })
              .then(res => res.json())
              .then(() => {
                alert("품절 처리되었습니다.");
                renderAdminGoodsList();
              });
          }
        };
      });

      // Edit binding
      document.querySelectorAll(".btn-edit-g").forEach(btn => {
        btn.onclick = () => {
          const id = btn.getAttribute("data-id");
          document.getElementById("new-g-name").value = btn.getAttribute("data-name");
          document.getElementById("new-g-price").value = btn.getAttribute("data-price");
          document.getElementById("new-g-stock").value = btn.getAttribute("data-stock");
          
          document.getElementById("new-goods-form").setAttribute("data-edit-id", id);
          document.querySelector("#goods-modal-overlay .registration-modal-header span").innerText = "굿즈 수정";
          document.querySelector("#new-goods-form button[type='submit']").innerText = "수정하기";
          
          document.getElementById("goods-modal-overlay").style.display = "flex";
        };
      });

      // Delete binding
      document.querySelectorAll(".btn-delete-g").forEach(btn => {
        btn.onclick = () => {
          if(confirm("정말 삭제하시겠습니까?")) {
            const id = btn.getAttribute("data-id");
            fetch('/api/goods/' + id, { method: 'DELETE' })
              .then(res => res.json())
              .then(() => {
                alert("삭제 완료");
                renderAdminGoodsList();
              });
          }
        };
      });
    })
    .catch(err => {
      console.error(err);
      tbody.innerHTML = "<tr><td colspan='8'>데이터를 불러오지 못했습니다.</td></tr>";
    });
}

function renderAdminFoodList() {
  const tbody = document.getElementById("admin-food-tbody");
  tbody.innerHTML = "<tr><td colspan='5'>데이터를 불러오는 중...</td></tr>";

  fetch('/api/fnb/list')
    .then(res => res.json())
    .then(data => {
      tbody.innerHTML = "";
      data.forEach(f => {
        // 백엔드 DB의 status 컬럼 값을 기준으로 품절 여부 판단
        const isOutOfStock = f.status === 'SOLD_OUT';
        const statusText = isOutOfStock 
          ? `<span class="badge badge-red animate-pulse">재료소진(SOLD OUT)</span>` 
          : `<span class="badge badge-green">판매가능</span>`;

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td style="display: flex; align-items: center; gap: 10px;">
            ${f.imageUrl ? `<img src="${f.imageUrl}" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover;">` : `<div style="width: 40px; height: 40px; border-radius: 4px; background: #2d3748; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #a0aec0;">NO IMG</div>`}
            <strong>${f.productName}</strong>
          </td>
          <td>${(f.price || 0).toLocaleString()}원</td>
          <td>${statusText}</td>
          <td class="text-right">
            <button class="btn btn-rigid btn-small ${isOutOfStock ? 'btn-green' : 'btn-red'} btn-toggle-f-status" data-id="${f.id}">
              ${isOutOfStock ? '재료소진 해제' : '재료소진'}
            </button>
            <button class="btn btn-rigid btn-small btn-gray btn-edit-f" data-id="${f.id}" data-name="${f.productName}" data-price="${f.price || 0}">수정</button>
            <button class="btn btn-rigid btn-small btn-red btn-delete-f" data-id="${f.id}">삭제</button>
          </td>
        `;
        tbody.appendChild(tr);
      });

      // Toggle Ingredient Out binding
      document.querySelectorAll(".btn-toggle-f-status").forEach(btn => {
        btn.onclick = () => {
          const id = btn.getAttribute("data-id");
          fetch('/api/fnb/' + id + '/toggle-status', { method: 'PUT' })
            .then(res => res.json())
            .then(data => {
              renderAdminFoodList(); // 목록 새로고침 (수정된 상태 반영)
            })
            .catch(err => console.error(err));
        };
      });

      // Edit binding
      document.querySelectorAll(".btn-edit-f").forEach(btn => {
        btn.onclick = () => {
          const id = btn.getAttribute("data-id");
          document.getElementById("new-f-name").value = btn.getAttribute("data-name");
          document.getElementById("new-f-price").value = btn.getAttribute("data-price");
          
          document.getElementById("new-food-form").setAttribute("data-edit-id", id);
          document.querySelector("#food-modal-overlay .registration-modal-header span").innerText = "F&B 수정";
          document.querySelector("#new-food-form button[type='submit']").innerText = "수정하기";
          
          document.getElementById("food-modal-overlay").style.display = "flex";
        };
      });

      // Delete binding
      document.querySelectorAll(".btn-delete-f").forEach(btn => {
        btn.onclick = () => {
          if(confirm("정말 삭제하시겠습니까?")) {
            const id = btn.getAttribute("data-id");
            fetch('/api/fnb/' + id, { method: 'DELETE' })
              .then(res => res.json())
              .then(() => {
                alert("삭제 완료");
                renderAdminFoodList();
              });
          }
        };
      });
    })
    .catch(err => {
      console.error(err);
      tbody.innerHTML = "<tr><td colspan='5'>데이터를 불러오지 못했습니다.</td></tr>";
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
