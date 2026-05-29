// Seat Map Renderer & Realtime WebSockets Visualizer
import { DB, publish, saveDB, subscribe } from './store.js';

export function getSeatStats() {
  const stats = {
    total: 36,
    available: 0,
    reserved: 0,
    entered: 0,
    byZone: {
      A: { available: 0, total: 12 },
      B: { available: 0, total: 12 },
      C: { available: 0, total: 12 }
    }
  };

  Object.entries(DB.seats).forEach(([seatId, data]) => {
    const zone = seatId.split("-")[0];
    if (data.status === "AVAILABLE") {
      stats.available++;
      stats.byZone[zone].available++;
    } else if (data.status === "RESERVED") {
      stats.reserved++;
    } else if (data.status === "ENTERED") {
      stats.entered++;
    }
  });

  return stats;
}

export function renderSeatMap(containerId, onSeatClick) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div class="theater-shell">
      <!-- Top exits -->
      <div class="exit-indicator top-left">◀ 출입구</div>
      <div class="exit-indicator top-right">출입구 ▶</div>

      <!-- Stage -->
      <div class="theater-stage">무 대 (STAGE)</div>

      <!-- Zone Name Indicators -->
      <div class="zone-badge-header">
        <div class="zone-badge badge-a">가</div>
        <div class="zone-badge badge-b">나</div>
        <div class="zone-badge badge-c">다</div>
      </div>

      <!-- Layout Grid -->
      <div class="theater-layout-grid">
        <!-- Zone 가 (Left, Zone A) -->
        <div class="theater-zone zone-left-wing" id="theater-zone-a">
          <!-- Zone A Seats render here -->
        </div>

        <!-- Central Row Index Circle Column -->
        <div class="row-indicators-column left-indicators">
          <span class="row-badge" style="background-color: #ffd65c; color: #000;">B</span>
          <span class="row-badge" style="background-color: #10b981; color: #fff;">C</span>
          <span class="row-badge" style="background-color: #3b82f6; color: #fff;">D</span>
          <span class="row-badge" style="background-color: #8b5cf6; color: #fff;">E</span>
        </div>

        <!-- Zone 나 (Center, Zone B) -->
        <div class="theater-zone zone-center-wing" id="theater-zone-b">
          <!-- Zone B Seats render here -->
        </div>

        <!-- Right Row Index Circle Column -->
        <div class="row-indicators-column right-indicators">
          <span class="row-badge" style="background-color: #ffd65c; color: #000;">B</span>
          <span class="row-badge" style="background-color: #10b981; color: #fff;">C</span>
          <span class="row-badge" style="background-color: #3b82f6; color: #fff;">D</span>
          <span class="row-badge" style="background-color: #8b5cf6; color: #fff;">E</span>
        </div>

        <!-- Zone 다 (Right, Zone C) -->
        <div class="theater-zone zone-right-wing" id="theater-zone-c">
          <!-- Zone C Seats render here -->
        </div>
      </div>

      <!-- Bottom wheelchair rows and bottom exits -->
      <div class="theater-footer-row">
        <div class="wheelchair-bay left-bay">
          <span class="wc-seat" title="장애인 전용석">♿</span>
          <span class="wc-seat" title="장애인 전용석">♿</span>
          <span class="wc-seat" title="장애인 전용석">♿</span>
        </div>
        
        <div class="exit-indicator bottom-left">◀ 출입구</div>
        <div class="exit-indicator bottom-right">출입구 ▶</div>

        <div class="wheelchair-bay right-bay">
          <span class="wc-seat" title="장애인 전용석">♿</span>
          <span class="wc-seat" title="장애인 전용석">♿</span>
          <span class="wc-seat" title="장애인 전용석">♿</span>
        </div>
      </div>
    </div>
  `;

  const zones = ["A", "B", "C"];
  zones.forEach(zone => {
    const zoneContainer = document.getElementById(`theater-zone-${zone.toLowerCase()}`);
    if (!zoneContainer) return;

    // Filter and sort seats in this zone
    const zoneSeats = Object.keys(DB.seats)
      .filter(id => id.startsWith(zone))
      .sort((a, b) => parseInt(a.split("-")[1]) - parseInt(b.split("-")[1]));

    zoneSeats.forEach(seatId => {
      const seatData = DB.seats[seatId];
      const seatEl = document.createElement("div");
      seatEl.className = `seat seat-${seatData.status.toLowerCase()}`;
      seatEl.setAttribute("data-seat-id", seatId);
      seatEl.id = `seat-node-${seatId}`;
      
      // Show short seat display e.g. "A-5" as "5"
      const seatNumOnly = seatId.split("-")[1];
      
      seatEl.innerHTML = `
        <span class="seat-number">${seatNumOnly}</span>
        <span class="seat-tooltip">좌석: ${seatId}<br>${getStatusLabel(seatData.status)}<br>${seatData.holder || '지정 고객 없음'}</span>
      `;

      // Click binding
      if (seatData.status === "AVAILABLE") {
        if (onSeatClick) {
          seatEl.style.cursor = "pointer";
          seatEl.addEventListener("click", () => {
            onSeatClick(seatId);
          });
        } else {
          seatEl.style.cursor = "default";
        }
      } else {
        seatEl.style.cursor = "not-allowed";
      }

      zoneContainer.appendChild(seatEl);
    });
  });
}

function getStatusLabel(status) {
  switch (status) {
    case "AVAILABLE": return "이용 가능 (AVAILABLE)";
    case "RESERVED": return "예매 완료 (RESERVED)";
    case "ENTERED": return "입장 완료 (ENTERED)";
    default: return status;
  }
}

// Bind realtime update subscription to the DOM nodes directly
export function setupRealtimeSeatSync() {
  subscribe("seat-change", (data) => {
    const seatEl = document.getElementById(`seat-node-${data.seatId}`);
    if (seatEl) {
      // Clear all classes and add updated class
      seatEl.className = `seat seat-${data.status.toLowerCase()} animate-pulse-telemetry`;
      
      // Update Tooltip
      const tooltip = seatEl.querySelector(".seat-tooltip");
      if (tooltip) {
        tooltip.innerHTML = `${data.seatId}<br>${getStatusLabel(data.status)}<br>${data.seat.holder || '지정 고객 없음'}`;
      }

      // Update pointer/actions
      if (data.status === "AVAILABLE") {
        const clickHandler = window.activeSeatClickHandler;
        seatEl.style.cursor = clickHandler ? "pointer" : "default";
        // To prevent multiple bindings, clone and replace
        const newSeatEl = seatEl.cloneNode(true);
        newSeatEl.style.cursor = clickHandler ? "pointer" : "default";
        if (clickHandler) {
          newSeatEl.addEventListener("click", () => {
            clickHandler(data.seatId);
          });
        }
        seatEl.parentNode.replaceChild(newSeatEl, seatEl);
      } else {
        seatEl.style.cursor = "not-allowed";
        // Remove click event
        const newSeatEl = seatEl.cloneNode(true);
        newSeatEl.style.cursor = "not-allowed";
        seatEl.parentNode.replaceChild(newSeatEl, seatEl);
      }

      // Add a visual flash overlay highlighting the realtime websocket change
      setTimeout(() => {
        const freshNode = document.getElementById(`seat-node-${data.seatId}`);
        if (freshNode) freshNode.classList.remove("animate-pulse-telemetry");
      }, 1500);
    }
  });
}

export function manualReserveSeat(seatId, holderName) {
  if (DB.seats[seatId] && DB.seats[seatId].status === "AVAILABLE") {
    DB.seats[seatId].status = "RESERVED";
    DB.seats[seatId].holder = holderName;
    saveDB();
    publish("seat-change", { seatId, status: "RESERVED", seat: DB.seats[seatId] });
    return true;
  }
  return false;
}

export function releaseSeat(seatId) {
  if (DB.seats[seatId]) {
    DB.seats[seatId].status = "AVAILABLE";
    DB.seats[seatId].holder = null;
    saveDB();
    publish("seat-change", { seatId, status: "AVAILABLE", seat: DB.seats[seatId] });
    return true;
  }
  return false;
}
