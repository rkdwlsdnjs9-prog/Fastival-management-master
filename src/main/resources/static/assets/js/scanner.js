// QR Ticket Scanner & Validation Module
import { DB, publish, saveDB } from './store.js';

let html5Qrcode = null;

export function initializeQRScanner(containerId, onScanSuccess, onScanFailure) {
  if (typeof Html5Qrcode === 'undefined') {
    console.error("Html5Qrcode library is not loaded.");
    return;
  }

  // If already instantiated, stop first
  if (html5Qrcode) {
    html5Qrcode.stop()
      .then(() => {
        html5Qrcode = null;
        startNewScanner(containerId, onScanSuccess, onScanFailure);
      })
      .catch(err => {
        console.log("Error stopping scanner: ", err);
        // Force reset
        html5Qrcode = null;
        startNewScanner(containerId, onScanSuccess, onScanFailure);
      });
  } else {
    startNewScanner(containerId, onScanSuccess, onScanFailure);
  }
}

function startNewScanner(containerId, onScanSuccess, onScanFailure) {
  html5Qrcode = new Html5Qrcode(containerId);
  
  html5Qrcode.start(
    { facingMode: "environment" },
    {
      fps: 10,
      qrbox: { width: 250, height: 250 }
    },
    (decodedText) => {
      playBeep(decodedText);
      onScanSuccess(decodedText);
    },
    (errorMessage) => {
      // Quietly ignore library scanning errors
    }
  ).catch(err => {
    console.error("Camera start failed: ", err);
    if (onScanFailure) onScanFailure(err);
  });
}

export function stopQRScanner() {
  if (html5Qrcode) {
    // Check if the camera is actively streaming before stopping it
    if (html5Qrcode.isScanning) {
      html5Qrcode.stop()
        .then(() => {
          html5Qrcode = null;
        })
        .catch(err => {
          console.error("Failed to stop html5-qrcode scanner: ", err);
          html5Qrcode = null;
        });
    } else {
      // If it never started successfully (e.g. no camera device), just reset the reference silently
      html5Qrcode = null;
    }
  }
}

// Play simulated sounds using browser AudioContext
function playBeep(text) {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    // Determine tone based on ticket validation state
    const result = validateTicketState(text);
    if (result.status === "VALID") {
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // High double-beep for success
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1);
      
      setTimeout(() => {
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.frequency.setValueAtTime(1200, audioCtx.currentTime);
        gain2.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc2.start();
        osc2.stop(audioCtx.currentTime + 0.1);
      }, 120);
    } else if (result.status === "ALREADY_ENTERED") {
      oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); // Mid-tone flat beep for warning
      gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.4);
    } else {
      oscillator.frequency.setValueAtTime(220, audioCtx.currentTime); // Low buzz-tone for error
      gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.5);
    }
  } catch (e) {
    console.log("Audio simulation failed, browser autoplay blocked.", e);
  }
}

// Validates ticket state and performs mutations in the Mock DB
export function validateTicketState(ticketId) {
  const ticket = DB.tickets.find(t => t.id === ticketId);
  
  if (!ticket) {
    // INVALID Ticket
    const scanLog = {
      timestamp: new Date().toLocaleTimeString(),
      ticketId: ticketId,
      status: "INVALID",
      statusText: "미등록/위조 티켓",
      color: "red",
      seatId: "-"
    };
    publish("scan-log", { ticketId, status: "INVALID", log: scanLog });
    return { status: "INVALID", message: "존재하지 않거나 올바르지 않은 티켓입니다.", log: scanLog };
  }

  if (ticket.used) {
    // ALREADY_ENTERED Ticket (Duplicate entry attempt)
    const scanLog = {
      timestamp: new Date().toLocaleTimeString(),
      ticketId: ticketId,
      status: "ALREADY_ENTERED",
      statusText: "중복 입장 (이미 사용됨)",
      color: "purple",
      seatId: ticket.seat,
      holder: ticket.holder
    };
    publish("scan-log", { ticketId, status: "ALREADY_ENTERED", log: scanLog });
    return { status: "ALREADY_ENTERED", message: "이미 입장 처리된 티켓입니다! (중복 입장 불가)", log: scanLog };
  }

  // VALID Ticket
  ticket.used = true;
  
  // Update Seat Map State
  const seatId = ticket.seat;
  if (DB.seats[seatId]) {
    DB.seats[seatId].status = "ENTERED";
    DB.seats[seatId].holder = `${ticket.holder} (입장완료)`;
  }
  
  const scanLog = {
    timestamp: new Date().toLocaleTimeString(),
    ticketId: ticketId,
    status: "VALID",
    statusText: "인증 성공 (정상 티켓)",
    color: "green",
    seatId: seatId,
    holder: ticket.holder
  };

  saveDB();
  
  // Publish changes to components
  publish("seat-change", { seatId, status: "ENTERED", seat: DB.seats[seatId] });
  publish("scan-log", { ticketId, status: "VALID", log: scanLog });

  return { status: "VALID", message: `유효성 검증 성공! [${ticket.holder}] 고객 입장 처리되었습니다. (좌석: ${seatId})`, log: scanLog };
}

// Exchange Goods or Coffee QR Scanner
export function validateExchangeQR(orderId) {
  const order = DB.orders.find(o => o.id === orderId);
  
  if (!order) {
    return { success: false, message: "존재하지 않는 주문 번호입니다." };
  }
  
  if (order.status === "PICKED_UP") {
    return { success: false, message: "이미 수령/픽업이 완료된 상품권/주문입니다." };
  }
  
  order.status = "PICKED_UP";
  saveDB();
  
  publish("order-change", { orderId: order.id, status: "PICKED_UP" });
  return { success: true, message: `주문 ${order.id}이 성공적으로 픽업 완료(PICKED UP) 처리되었습니다!`, order };
}
