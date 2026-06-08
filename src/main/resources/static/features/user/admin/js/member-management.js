let allMembers = []; // DB에서 로드된 전체 회원 원본 목록

    // JWT 토큰 획득 헬퍼 함수
    function getAuthHeader() {
      const token = localStorage.getItem('userToken') || sessionStorage.getItem('userToken');
      return token ? 'Bearer ' + token : '';
    }

    document.addEventListener("DOMContentLoaded", () => {
      loadMembers();
    });

    /**
     * 1. 회원 전체 목록 조회 API 호출
     * GET /api/admin/members
     * 
     * [Request Headers]
     * Accept: application/json
     * 
     * [Response JSON Format]
     * [
     *   {
     *     "id": 1,
     *     "email": "user@example.com",
     *     "name": "홍길동",
     *     "role": "ROLE_USER", // ROLE_USER, ROLE_STAFF, ROLE_ADMIN
     *     "membershipGrade": "BRONZE",
     *     "balance": 1000,
     *     "createdAt": "2026-06-01T02:08:06",
     *     "status": "ACTIVE" // ACTIVE, BANNED
     *   }
     * ]
     */
    function loadMembers() {
      fetch("/api/admin/members", {
        headers: {
          "Authorization": getAuthHeader()
        }
      })
        .then(response => {
          if (!response.ok) {
            throw new Error("회원 목록 로딩 중 네트워크 에러");
          }
          return response.json();
        })
        .then(data => {
          allMembers = data;
          filterMembers();
        })
        .catch(error => {
          console.error("회원 조회 실패:", error);
          const tbody = document.getElementById("memberTableBody");
          if (tbody) {
            tbody.innerHTML = `
                <tr>
                  <td colspan="7" class="text-center text-danger py-4 fw-bold">
                    ⚠️ 백엔드 API 서버 연결 실패! 회원 목록을 불러올 수 없습니다.
                  </td>
                </tr>
              `;
          }
        });
    }

    /**
     * 2. 권한 필터, 상태 필터 및 실시간 텍스트 검색 통합 처리 함수
     */
    function filterMembers() {
      const roleVal = document.getElementById("roleFilter").value;
      const statusVal = document.getElementById("statusFilter").value;
      const searchVal = document.getElementById("memberSearchInput").value.trim().toLowerCase();

      const filtered = allMembers.filter(m => {
        // 권한 매칭
        const matchRole = (roleVal === "ALL" || m.role === roleVal);
        // 상태 매칭
        const matchStatus = (statusVal === "ALL" || m.status === statusVal);
        // 이름/이메일 검색 매칭
        const matchSearch = (!searchVal ||
          (m.name && m.name.toLowerCase().includes(searchVal)) ||
          (m.email && m.email.toLowerCase().includes(searchVal))
        );

        return matchRole && matchStatus && matchSearch;
      });

      renderMembersTable(filtered);
    }

    /**
     * 3. 필터링된 회원 목록 동적 렌더링 함수
     */
    function renderMembersTable(members) {
      const tbody = document.getElementById("memberTableBody");
      if (!tbody) return;
      tbody.innerHTML = "";

      if (members.length === 0) {
        tbody.innerHTML = `
            <tr>
              <td colspan="8" class="text-center py-5 text-muted fw-semibold">
                조건에 맞는 회원 데이터가 존재하지 않습니다.
              </td>
            </tr>
          `;
        return;
      }

      members.forEach(m => {
        // 회원 등급 시각화 매핑 (VVIP, VIP, GOLD, BRONZE 등)
        let gradeBadge = "";
        const grade = m.membershipGrade ? m.membershipGrade.toUpperCase() : "BRONZE";
        if (grade === "VVIP") {
          gradeBadge = `<span class="badge bg-label-danger fw-bold"><i class="bx bx-crown me-1"></i>VVIP</span>`;
        } else if (grade === "VIP") {
          gradeBadge = `<span class="badge bg-label-primary fw-bold"><i class="bx bx-star me-1"></i>VIP</span>`;
        } else if (grade === "GOLD") {
          gradeBadge = `<span class="badge bg-label-success fw-bold">GOLD</span>`;
        } else if (grade === "SILVER") {
          gradeBadge = `<span class="badge bg-label-info fw-bold">SILVER</span>`;
        } else {
          gradeBadge = `<span class="badge bg-label-secondary fw-bold">BRONZE</span>`;
        }

        // 권한 시각화 매핑
        let roleBadge = "";
        if (m.role === "ROLE_ADMIN") {
          roleBadge = `<span class="badge bg-label-danger fw-bold"><i class="bx bx-crown me-1"></i>관리자</span>`;
        } else if (m.role === "ROLE_STAFF") {
          roleBadge = `<span class="badge bg-label-warning fw-bold"><i class="bx bx-store me-1"></i>사장님 (공통)</span>`;
        } else if (m.role === "ROLE_FOOD_STAFF") {
          roleBadge = `<span class="badge bg-label-warning fw-bold"><i class="bx bx-bowl-hot me-1"></i>음식 사장님</span>`;
        } else if (m.role === "ROLE_GATE_STAFF") {
          roleBadge = `<span class="badge bg-label-info fw-bold"><i class="bx bx-door-open me-1"></i>출입 사장님</span>`;
        } else if (m.role === "ROLE_GOODS_STAFF") {
          roleBadge = `<span class="badge bg-label-primary fw-bold"><i class="bx bx-gift me-1"></i>굿즈 사장님</span>`;
        } else {
          roleBadge = `<span class="badge bg-label-primary fw-bold"><i class="bx bx-user me-1"></i>일반 유저</span>`;
        }

        // 계정 상태 시각화 매핑
        const statusBadge = m.status === "BANNED"
          ? `<span class="badge bg-label-danger fw-bold"><i class="bx bx-minus-circle me-1"></i>정지 (BANNED)</span>`
          : `<span class="badge bg-label-success fw-bold"><i class="bx bx-check-circle me-1"></i>정상 (ACTIVE)</span>`;

        // 가입일자 포맷팅
        const joinDate = m.createdAt ? m.createdAt.substring(0, 10) : "-";

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong class="text-secondary font-mono">#${m.id}</strong></td>
            <td class="fw-bold text-dark">${m.name || "-"}</td>
            <td class="font-mono text-secondary">${m.email || "-"}</td>
            <td>${gradeBadge}</td>
            <td>${roleBadge}</td>
            <td>${joinDate}</td>
            <td>${statusBadge}</td>
            <td class="text-end pe-3">
              <div class="d-inline-flex align-items-center gap-1.5">
                <!-- 권한 변경 인라인 드롭다운 (텍스트 깨짐 및 화살표 겹침 방지를 위해 너비 및 패딩 확보) -->
                <select class="form-select form-select-sm d-inline-block py-0 ps-2 fw-semibold fs-7" 
                        style="height: 28px; font-size: 12px; width: 145px; padding-right: 22px;" 
                        onchange="changeMemberRole(${m.id}, this.value)">
                  <option value="ROLE_USER" ${m.role === 'ROLE_USER' ? 'selected' : ''}>일반 유저</option>
                  <option value="ROLE_STAFF" ${m.role === 'ROLE_STAFF' ? 'selected' : ''}>스태프 (공통)</option>
                  <option value="ROLE_FOOD_STAFF" ${m.role === 'ROLE_FOOD_STAFF' ? 'selected' : ''}>식음료 스태프</option>
                  <option value="ROLE_GATE_STAFF" ${m.role === 'ROLE_GATE_STAFF' ? 'selected' : ''}>출입 스태프</option>
                  <option value="ROLE_GOODS_STAFF" ${m.role === 'ROLE_GOODS_STAFF' ? 'selected' : ''}>굿즈 스태프</option>
                  <option value="ROLE_ADMIN" ${m.role === 'ROLE_ADMIN' ? 'selected' : ''}>관리자</option>
                </select>
                <!-- 계정 정지 / 해제 토글 버튼 -->
                <button class="btn btn-xs ${m.status === 'BANNED' ? 'btn-outline-success' : 'btn-outline-danger'} fw-bold py-1 px-2" 
                        style="font-size: 11px; height: 28px;" 
                        onclick="toggleMemberStatus(${m.id}, '${m.status}')">
                  ${m.status === 'BANNED' ? '<i class="bx bx-check-circle me-1"></i> 해제' : '<i class="bx bx-block me-1"></i> 정지'}
                </button>
              </div>
            </td>
          `;
        tbody.appendChild(tr);
      });
    }

    /**
     * 4. 회원 계정 상태(ACTIVE / BANNED) 토글 제어 API 호출
     * PATCH /api/admin/members/{id}/status?status=...
     * 
     * [Request Query Parameters]
     * status: ACTIVE 또는 BANNED
     * 
     * [Response JSON Format]
     * {
     *   "id": 1,
     *   "email": "user@example.com",
     *   "status": "BANNED",
     *   ...
     * }
     */
    function toggleMemberStatus(id, currentStatus) {
      const nextStatus = currentStatus === "BANNED" ? "ACTIVE" : "BANNED";
      const confirmMsg = nextStatus === "BANNED"
        ? "해당 회원의 로그인을 영구 제한하고 모든 권한 행사를 즉시 차단하시겠습니까?"
        : "해당 회원의 계정 차단을 해제하고 정상 이용이 가능하도록 승인하시겠습니까?";

      if (!confirm(confirmMsg)) return;

      fetch(`/api/admin/members/${id}/status?status=${nextStatus}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": getAuthHeader()
        }
      })
        .then(response => {
          if (!response.ok) {
            throw new Error("계정 상태 변경 실패");
          }
          return response.json();
        })
        .then(updatedUser => {
          alert(`🎉 [${updatedUser.name}] 회원의 계정 상태가 [${updatedUser.status}] 상태로 성공적으로 변경되었습니다.`);

          // 전역 데이터 캐시 업데이트 및 새로고침 없이 즉각 실시간 렌더링 적용!
          const memberIndex = allMembers.findIndex(m => m.id === id);
          if (memberIndex !== -1) {
            allMembers[memberIndex].status = updatedUser.status;
          }
          filterMembers();
        })
        .catch(error => {
          console.error("상태 변경 오류:", error);
          alert("계정 상태 변경 도중 서버 오류가 발생했습니다. 백엔드 가동 상태를 확인해 주세요.");
        });
    }

    /**
     * 5. 회원 권한(ROLE_USER / ROLE_STAFF / ROLE_ADMIN) 인라인 드롭다운 변경 API 호출
     * PATCH /api/admin/members/{id}/role?role=...
     * 
     * [Request Query Parameters]
     * role: ROLE_USER, ROLE_STAFF, ROLE_ADMIN 중 하나
     * 
     * [Response JSON Format]
     * {
     *   "id": 1,
     *   "role": "ROLE_STAFF",
     *   ...
     * }
     */
    function changeMemberRole(id, newRole) {
      const confirmMsg = `해당 회원의 권한을 [${newRole}] 등급으로 격상 또는 변경하시겠습니까?`;
      if (!confirm(confirmMsg)) {
        // 취소 시 화면 리로딩 방지를 위해 원본 데이터로 테이블 다시 리셋
        filterMembers();
        return;
      }

      fetch(`/api/admin/members/${id}/role?role=${newRole}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": getAuthHeader()
        }
      })
        .then(response => {
          if (!response.ok) {
            throw new Error("회원 권한 등급 변경 실패");
          }
          return response.json();
        })
        .then(updatedUser => {
          alert(`🎉 [${updatedUser.name}] 회원의 권한 등급이 [${updatedUser.role}] 등급으로 격상 및 변경되었습니다.`);

          // 전역 데이터 캐시 업데이트
          const memberIndex = allMembers.findIndex(m => m.id === id);
          if (memberIndex !== -1) {
            allMembers[memberIndex].role = updatedUser.role;
          }
          filterMembers();
        })
        .catch(error => {
          console.error("권한 등급 변경 오류:", error);
          alert("권한 등급 변경 중 오류가 발생했습니다.");
          filterMembers(); // 오류 복원
        });
    }