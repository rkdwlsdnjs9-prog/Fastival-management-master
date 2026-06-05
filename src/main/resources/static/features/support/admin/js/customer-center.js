let wsClient = null;
    let currentInquiryId = null;

    document.addEventListener("DOMContentLoaded", () => {
      if (window.MockWebSocket) {
        wsClient = new MockWebSocket('ws://localhost:8080/ws');
        wsClient.addEventListener('message', (e) => {
          loadAdminInquiries();
        });
      } else {
        window.addEventListener('storage', (e) => {
          if (e.key === 'mock_ws_message') loadAdminInquiries();
        });
      }
      loadAdminInquiries();
    });

    function loadAdminInquiries() {
      if (!window.InquiryStore) return;
      const allInqs = window.InquiryStore.get('inquiries_to_admin') || [];
      const sorted = allInqs.sort((a, b) => b.id - a.id);

      // 대시보드 통계 연산
      const totalInqs = sorted.length;
      const unansweredInqs = sorted.filter(q => q.status !== '답변완료').length;
      const ratedInqs = sorted.filter(q => q.rating > 0);
      const avgRating = ratedInqs.length > 0 ? (ratedInqs.reduce((acc, curr) => acc + parseFloat(curr.rating), 0) / ratedInqs.length).toFixed(1) : '0.0';
      const complaintsCount = sorted.filter(q => q.isComplaint).length;

      document.getElementById('statAdminTotal').textContent = totalInqs;
      document.getElementById('statAdminUnanswered').textContent = unansweredInqs;
      document.getElementById('statAdminAvgRating').textContent = avgRating;
      document.getElementById('statAdminComplaints').textContent = complaintsCount;

      renderQueue(sorted);

      if (currentInquiryId) {
        const selected = sorted.find(q => q.id === currentInquiryId);
        if (selected) {
          renderChatDetail(selected);
        } else {
          clearChatDetail();
        }
      }
    }

    function renderQueue(list) {
      const queueList = document.getElementById('inquiryQueueList');
      if (!queueList) return;

      if (list.length === 0) {
        queueList.innerHTML = `<div class="p-3 text-center text-muted">대기 중인 문의가 없습니다.</div>`;
        return;
      }

      queueList.innerHTML = list.map(q => {
        const isSelected = q.id === currentInquiryId;
        const statusBadge = q.status === '대기' ? '<span class="badge bg-danger rounded-pill">대기</span>' : '<span class="badge bg-secondary rounded-pill">완료</span>';
        const complaintBadge = q.isComplaint ? '<span class="badge bg-danger ms-1" style="font-size:0.7rem;">블랙</span>' : '';
                let ratingText = '';
        if (q.rating > 0) {
          if (q.rating <= 1) ratingText = '매우 불만족';
          else if (q.rating <= 2) ratingText = '불만족';
          else if (q.rating <= 3) ratingText = '보통';
          else if (q.rating <= 4) ratingText = '만족';
          else ratingText = '매우 만족';
        }
        let csMsg = '';
        if (q.rating > 0 && q.rating <= 2) {
          csMsg = '<div style="margin-top:4px; font-size:0.75rem; color:#d32f2f; background:#ffebee; padding:4px 8px; border-radius:4px; display:inline-block;">💡 고객님의 소중한 의견을 수용하여 더 나은 서비스로 개선하겠습니다.</div>';
        }
        const ratingStr = q.rating > 0 ? <div style="display:flex; flex-direction:column; gap:2px;"><span class="ms-1" style="color:#ffb400; font-size:0.75rem;">★ \ <span style="font-size:0.75rem; color:#666;">(\)</span></span>\</div> : '';
        return `
        <a href="javascript:void(0);" onclick="selectInquiry(${q.id})" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center ${isSelected ? 'active shadow-sm' : ''}" style="transition: all 0.2s;">
          <div class="d-flex flex-column" style="width: 75%;">
            <h6 class="mb-1 text-truncate ${isSelected ? 'text-white' : 'text-dark'}">${q.author === 'vendor' ? '<span class="badge bg-info me-1">업체</span>' : '<span class="badge bg-primary me-1">고객</span>'} ${q.title}</h6>
            <small class="${isSelected ? 'text-white-50' : 'text-muted'} text-truncate">${q.content}</small>
          </div>
          <div class="d-flex flex-column align-items-end">
            ${statusBadge}
            <div class="mt-1">${complaintBadge}${ratingStr}</div>
          </div>
        </a>
      `;
      }).join('');
    }

    window.selectInquiry = function (id) {
      currentInquiryId = id;
      loadAdminInquiries(); // 재렌더링하여 active 표시 및 우측 갱신
    };

    function renderChatDetail(q) {
      const headerTitle = document.getElementById('chatHeaderTitle');
      const chatBody = document.getElementById('chatBody');
      const replyInput = document.getElementById('replyInput');
      const replyBtn = document.getElementById('replyBtn');

      if (headerTitle) headerTitle.textContent = `${q.author === 'vendor' ? '가맹점' : '일반고객'} 문의 진행 중 - ${q.title}`;

      if (chatBody) {
        const dateStr = new Date(q.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        let html = `
        <div class="d-flex flex-column align-items-start mb-4">
          <div class="bg-label-secondary rounded p-2 px-3 mb-1" style="max-width: 80%;">${q.content}</div>
          <small class="text-muted">문의 작성자 - ${dateStr}</small>
        </div>
      `;

        if (q.answer) {
          html += `
          <div class="d-flex flex-column align-items-end mb-4">
            <div class="bg-primary text-white rounded p-2 px-3 mb-1" style="max-width: 80%;">${q.answer}</div>
            <small class="text-muted">관리자(나)</small>
          </div>
        `;
          if (replyInput) replyInput.disabled = true;
          if (replyInput) replyInput.placeholder = "답변이 완료되었습니다.";
          if (replyBtn) replyBtn.disabled = true;
        } else {
          if (replyInput) replyInput.disabled = false;
          if (replyInput) replyInput.placeholder = "답변을 입력해 주세요...";
          if (replyInput) replyInput.value = "";
          if (replyBtn) replyBtn.disabled = false;
          // reply btn onclick event attachment
          if (replyBtn) {
            replyBtn.onclick = function () {
              sendAdminReply(q.id);
            };
          }
          if (replyInput) {
            replyInput.onkeypress = function (e) {
              if (e.key === 'Enter') sendAdminReply(q.id);
            }
          }
        }

        chatBody.innerHTML = html;
        chatBody.scrollTop = chatBody.scrollHeight; // 스크롤 맨 아래로
      }
    }

    function clearChatDetail() {
      const headerTitle = document.getElementById('chatHeaderTitle');
      const chatBody = document.getElementById('chatBody');
      if (headerTitle) headerTitle.textContent = '선택된 문의가 없습니다';
      if (chatBody) chatBody.innerHTML = '<div class="text-center text-muted mt-5">좌측에서 문의를 선택해주세요.</div>';
    }

    window.sendAdminReply = function (id) {
      const input = document.getElementById('replyInput');
      const complaintCheck = document.getElementById('adminComplaintCheck');
      if (!input || !input.value.trim()) return;

      const answerText = input.value.trim();
      const isComplaint = complaintCheck ? complaintCheck.checked : false;

      window.InquiryStore.update('inquiries_to_admin', id, {
        answer: answerText,
        status: '답변완료',
        isComplaint: isComplaint
      });

      if (wsClient) {
        wsClient.send({ type: 'REPLY_INQUIRY', payload: { id } });
      } else {
        localStorage.setItem('mock_ws_message', JSON.stringify({ type: 'REPLY_INQUIRY' }));
        setTimeout(() => localStorage.removeItem('mock_ws_message'), 50);
      }

      input.value = '';
      if (complaintCheck) complaintCheck.checked = false;
      loadAdminInquiries();
    }