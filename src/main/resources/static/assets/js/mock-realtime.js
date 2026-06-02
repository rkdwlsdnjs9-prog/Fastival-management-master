/**
 * Mock WebSocket (LocalStorage + StorageEvent 기반)
 * 
 * 실제 WebSocket 인터페이스를 흉내 내지만 내부적으로는 LocalStorage를 통해 통신합니다.
 * 동일 브라우저 내 다른 탭들 간에 실시간 이벤트 전송이 가능하게 합니다.
 */
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.listeners = {};

    // 타 탭에서 메시지가 오면 발생 (storage 이벤트)
    window.addEventListener('storage', (e) => {
      if (e.key === 'mock_ws_message' && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          this._emit('message', { data: JSON.stringify(data) });
        } catch (err) {
          console.error("Mock WS parse error", err);
        }
      }
    });

    // 연결 지연 시뮬레이션
    setTimeout(() => {
      this._emit('open', {});
    }, 100);
  }

  send(data) {
    // 본인 탭에도 이벤트 발생 (선택적이나, 일관성을 위해)
    // storage 이벤트는 본인 탭에선 발생하지 않으므로, 수동으로 trigger
    const messageStr = typeof data === 'string' ? data : JSON.stringify(data);

    // 로컬스토리지에 저장하여 다른 탭에 브로드캐스팅
    localStorage.setItem('mock_ws_message', messageStr);
    // 즉시 지워서 같은 메시지도 재전송 가능하게 함
    setTimeout(() => localStorage.removeItem('mock_ws_message'), 50);

    // 본인에게도 message 이벤트 발생
    setTimeout(() => {
      this._emit('message', { data: messageStr });
    }, 10);
  }

  addEventListener(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  _emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
    // on{event} 콜백 지원
    if (typeof this[`on${event}`] === 'function') {
      this[`on${event}`](data);
    }
  }
}

// Data Store Helpers
window.InquiryStore = {
  get: function (key) {
    return JSON.parse(localStorage.getItem(key) || '[]');
  },
  save: function (key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  },
  add: function (key, item) {
    const list = this.get(key);
    list.push(item);
    this.save(key, list);
  },
  update: function (key, id, newProps) {
    const list = this.get(key);
    const idx = list.findIndex(i => i.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...newProps };
      this.save(key, list);
    }
  }
};
