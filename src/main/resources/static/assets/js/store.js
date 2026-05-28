// In-Memory Database & Realtime PubSub Event Engine (Simulating Supabase/WebSockets)

// Initial Data
const initialDB = {
  activeCheckpoint: {
    event: "2026 서울 일러스트 엑스포",
    tenant: "스태프 오퍼레이션 본부"
  },
  staffs: [
    { id: "staffA", pw: "staff111", name: "게이트 스태프 A" },
    { id: "staffB", pw: "staff222", name: "매표소 스태프 B" },
    { id: "staffC", pw: "staff333", name: "F&B 스태프 C" },
    { id: "staffD", pw: "staff444", name: "굿즈 스태프 D" }
  ],
  seats: {},
  goods: [
    { id: "g1", name: "공식 일러스트 슬로건 타올", price: 18000, currentStock: 30, preAllocated: 2 },
    { id: "g2", name: "캐릭터 리미티드 에디션 키링", price: 8500, currentStock: 5, preAllocated: 0 },
    { id: "g3", name: "아티스트 리무버블 스티커팩", price: 5000, currentStock: 50, preAllocated: 0 },
    { id: "g4", name: "유니크 일러스트 엽서북 (한정판)", price: 12000, currentStock: 0, preAllocated: 0 } // 품절 예제
  ],
  food: [
    { id: "f1", name: "시그니처 아메리카노", price: 4500, outOfStock: false },
    { id: "f2", name: "얼그레이 버블 밀크티", price: 6000, outOfStock: false },
    { id: "f3", name: "버터 소금빵 & 아메리카노 세트", price: 8000, outOfStock: false },
    { id: "f4", name: "한정판 딸기 치즈 블렌디드", price: 6800, outOfStock: true }
  ],
  tickets: [
    { id: "T-1001", seat: "A-5", status: "VALID", type: "ADULT", used: false, holder: "김태희" },
    { id: "T-1002", seat: "A-6", status: "VALID", type: "CHILD", used: false, holder: "박보검" },
    { id: "T-1003", seat: "B-12", status: "VALID", type: "ADULT", used: false, holder: "이지은" },
    { id: "T-1004", seat: "B-15", status: "VALID", type: "INFANT", used: false, holder: "최우식" },
    { id: "T-1005", seat: "C-3", status: "VALID", type: "ADULT", used: true, holder: "송강호" }, // 이미 입장완료 티켓 (중복 오류용)
    { id: "T-1006", seat: "C-10", status: "VALID", type: "CHILD", used: true, holder: "한소희" }   // 이미 입장완료 티켓
  ],
  orders: [
    { id: "ORD-0001", type: "FOOD", items: [{ name: "시그니처 아메리카노", quantity: 2 }], price: 9000, status: "RECEIVED", customer: "현장 주문 #1", timestamp: new Date(Date.now() - 3600000).toLocaleTimeString() },
    { id: "ORD-0002", type: "FOOD", items: [{ name: "얼그레이 버블 밀크티", quantity: 1 }], price: 6000, status: "COOKING", customer: "모바일 주문 #2", timestamp: new Date(Date.now() - 1800000).toLocaleTimeString() },
    { id: "ORD-0003", type: "GOODS", items: [{ name: "공식 일러스트 슬로건 타올", quantity: 1 }], price: 18000, status: "ORDERED", customer: "예약 수령 #3", timestamp: new Date(Date.now() - 600000).toLocaleTimeString() },
    { id: "ORD-0004", type: "GOODS", items: [{ name: "캐릭터 리미티드 에디션 키링", quantity: 2 }], price: 17000, status: "PICKED_UP", customer: "현장 구매 #4", timestamp: new Date(Date.now() - 120000).toLocaleTimeString() }
  ],
  notifications: [
    { id: 1, type: "SYSTEM", message: "실시간 스태프 관제 시스템이 초기화되었습니다.", timestamp: new Date().toLocaleTimeString() }
  ],
  options: {
    rates: [
      { id: "r1", name: "성인 (Adult)", multiplier: 1.0 },
      { id: "r2", name: "소아 (Child - 만 12세 이하)", multiplier: 0.7 },
      { id: "r3", name: "유아 (Infant - 만 36개월 이하)", multiplier: 0.3 }
    ],
    seasons: [
      { id: "s1", name: "평수기 평일 (Standard)", basePrice: 15000, active: true },
      { id: "s2", name: "성수기/주말 (Peak)", basePrice: 22000, active: false }
    ]
  },
  websocketSimulation: false
};

// Initialize seating grid: 3 zones (A, B, C) with 12 seats each
const zones = ["A", "B", "C"];
zones.forEach(zone => {
  for (let i = 1; i <= 12; i++) {
    const seatId = `${zone}-${i}`;
    // Pre-populate some reserved seats
    let status = "AVAILABLE";
    let holder = null;
    if (seatId === "A-5" || seatId === "A-6" || seatId === "B-12" || seatId === "B-15") {
      status = "RESERVED";
      holder = "예약완료 (입장대기)";
    } else if (seatId === "C-3" || seatId === "C-10") {
      status = "ENTERED";
      holder = "입장완료";
    }
    initialDB.seats[seatId] = {
      status,
      price: 15000,
      holder
    };
  }
});

// Load DB from localStorage if exists, else load initial
let localDB = localStorage.getItem("STAFF_PROJECT_DB");
export const DB = localDB ? JSON.parse(localDB) : initialDB;

// Force override staffs list to apply the new 4 roles immediately
DB.staffs = initialDB.staffs;

// Cleanup deprecated food fields
DB.food.forEach(f => {
  delete f.currentStock;
  delete f.preAllocated;
});
saveDB();

// Save helper
export function saveDB() {
  localStorage.setItem("STAFF_PROJECT_DB", JSON.stringify(DB));
}

// PubSub System (Realtime Event Bus)
const listeners = {};

export function subscribe(event, callback) {
  if (!listeners[event]) {
    listeners[event] = [];
  }
  listeners[event].push(callback);
}

export function publish(event, data) {
  if (listeners[event]) {
    listeners[event].forEach(callback => callback(data));
  }
  // Also push a system notification in DB for live telemetry logs
  if (event !== "notification") {
    let logMsg = "";
    if (event === "seat-change") {
      logMsg = `[좌석 상태 변경] 좌석 ${data.seatId} -> ${data.status}`;
    } else if (event === "scan-log") {
      logMsg = `[QR 스캔] 티켓 ${data.ticketId}: 결과 [${data.status}]`;
    } else if (event === "payment-complete") {
      logMsg = `[결제 완료] ${data.customer} / ${data.amount.toLocaleString()}원 승인`;
    } else if (event === "inventory-change") {
      logMsg = `[재고 갱신] ${data.name}: 재고 ${data.stock}개 (가용: ${data.available})`;
    } else if (event === "food-soldout") {
      logMsg = `[메뉴 소진] ${data.name} 상태 변경 -> ${data.outOfStock ? '재료소진' : '판매중'}`;
    } else if (event === "order-change") {
      logMsg = `[주문 상태 변경] 주문 ${data.orderId} -> ${data.status}`;
    }

    if (logMsg) {
      addNotification("TELEMETRY", logMsg);
    }
  }
  saveDB();
}

export function addNotification(type, message) {
  const newNotif = {
    id: Date.now(),
    type,
    message,
    timestamp: new Date().toLocaleTimeString()
  };
  DB.notifications.unshift(newNotif);
  if (DB.notifications.length > 50) {
    DB.notifications.pop();
  }
  saveDB();
  // Notify bell icon listeners
  if (listeners["notification"]) {
    listeners["notification"].forEach(callback => callback(newNotif));
  }
}

// WebSockets Background Simulation
let simInterval = null;
export function toggleWebsocketSimulation(enable) {
  DB.websocketSimulation = enable;
  saveDB();
  if (enable) {
    simInterval = setInterval(() => {
      // Pick a random seat and toggle it
      const seatIds = Object.keys(DB.seats);
      const randomSeatId = seatIds[Math.floor(Math.random() * seatIds.length)];
      const currentSeat = DB.seats[randomSeatId];
      
      // Simulate booking or releasing (only for seats not already occupied/entered)
      if (currentSeat.status === "AVAILABLE") {
        currentSeat.status = "RESERVED";
        currentSeat.holder = "가상 예약고객 (실시간)";
        publish("seat-change", { seatId: randomSeatId, status: "RESERVED", seat: currentSeat });
      } else if (currentSeat.status === "RESERVED" && currentSeat.holder === "가상 예약고객 (실시간)") {
        currentSeat.status = "AVAILABLE";
        currentSeat.holder = null;
        publish("seat-change", { seatId: randomSeatId, status: "AVAILABLE", seat: currentSeat });
      }
    }, 4000); // Trigger every 4 seconds
    addNotification("SYSTEM", "실시간 웹소켓(WebSockets) 시뮬레이션 모드가 켜졌습니다.");
  } else {
    if (simInterval) {
      clearInterval(simInterval);
      simInterval = null;
    }
    addNotification("SYSTEM", "실시간 웹소켓(WebSockets) 시뮬레이션 모드가 꺼졌습니다.");
  }
}

// Restart simulation on reload if saved as true
if (DB.websocketSimulation) {
  toggleWebsocketSimulation(true);
}
