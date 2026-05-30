/**
 * @file partner-form.js
 * @description 메인 페이지의 제휴 신청 폼 로직을 담당합니다.
 * index.html 내 인라인 스크립트를 외부 파일로 분리하여 FRONTEND_RULES를 준수합니다.
 */
(function () {
  'use strict';

  const chips = document.querySelectorAll('.partner-chip');
  const hiddenType = document.getElementById('inquiryType');
  const festivalSelectField = document.getElementById('festivalSelectField');
  const festivalSelect = document.getElementById('festivalSelect');

  // 파일 그룹 요소들
  const fileGroupEvent = document.getElementById('fileGroupEvent');
  const fileGroupFoodtruck = document.getElementById('fileGroupFoodtruck');
  const fileGroupGoods = document.getElementById('fileGroupGoods');

  // 파일 입력 요소들
  const fileEvent = document.getElementById('fileEvent');
  const fileFoodtruckLicense = document.getElementById('fileFoodtruckLicense');
  const fileFoodtruckMenu = document.getElementById('fileFoodtruckMenu');
  const fileGoodsLicense = document.getElementById('fileGoodsLicense');
  const fileGoodsMenu = document.getElementById('fileGoodsMenu');

  /* ── 실제 DB 축제 목록 API 호출 ─────────────────────────── */
  async function loadFestivals() {
    try {
      const response = await fetch('/api/festival');
      if (!response.ok) throw new Error('API 응답 에러');
      const list = await response.json();

      if (!list || list.length === 0) {
        festivalSelect.innerHTML = '<option value="">등록된 활성 축제가 없습니다.</option>';
        return;
      }

      festivalSelect.innerHTML = '<option value="">참여를 원하는 축제를 선택해 주세요.</option>';
      list.forEach(function (f) {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = f.name;
        festivalSelect.appendChild(opt);
      });
    } catch (err) {
      console.error('[축제 로드 실패]', err);
      festivalSelect.innerHTML = '<option value="">축제 목록을 불러오지 못했습니다.</option>';
    }
  }

  /* ── 파일 선택 시 UI 변경 함수 ── */
  function setupFilePlaceholder(inputEl, wrapperId, defaultText) {
    inputEl.addEventListener('change', function () {
      const wrapper = document.getElementById(wrapperId);
      const textEl = wrapper.querySelector('.file-text');
      if (this.files && this.files.length > 0) {
        textEl.textContent = this.files[0].name;
        wrapper.classList.add('has-file');
      } else {
        textEl.textContent = defaultText;
        wrapper.classList.remove('has-file');
      }
    });
  }

  /* ── 유효성 검증 함수 ── */
  function validateForm(data) {
    if (!data.companyName.trim()) { alert('업체명 / 브랜드명을 입력해 주세요.'); return false; }
    if (!data.managerName.trim()) { alert('담당자 성함을 입력해 주세요.'); return false; }
    if (!/^\d{3}-\d{3,4}-\d{4}$/.test(data.phone.trim())) {
      alert('올바른 연락처 형식을 입력해 주세요.\n예) 010-1234-5678');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
      alert('올바른 이메일 주소 형식을 입력해 주세요.\n예) contact@festio.com');
      return false;
    }
    if (data.inquiryType !== 'EVENT' && !data.festivalId) {
      alert('참여 희망 축제를 선택해 주세요.');
      return false;
    }
    if (data.inquiryType === 'EVENT') {
      if (!fileEvent.files || fileEvent.files.length === 0) {
        alert('필수 첨부 서류를 등록해주세요 (행사 기획서 및 회사 소개서).');
        return false;
      }
    } else if (data.inquiryType === 'FOODTRUCK') {
      if (!fileFoodtruckLicense.files || fileFoodtruckLicense.files.length === 0) {
        alert('필수 첨부 서류를 등록해주세요 (사업자등록증).');
        return false;
      }
      if (!fileFoodtruckMenu.files || fileFoodtruckMenu.files.length === 0) {
        alert('필수 첨부 서류를 등록해주세요 (음식 메뉴 및 차량 사진).');
        return false;
      }
    } else if (data.inquiryType === 'GOODS') {
      if (!fileGoodsLicense.files || fileGoodsLicense.files.length === 0) {
        alert('필수 첨부 서류를 등록해주세요 (사업자등록증).');
        return false;
      }
      if (!fileGoodsMenu.files || fileGoodsMenu.files.length === 0) {
        alert('필수 첨부 서류를 등록해주세요 (판매 물품 포트폴리오 및 상품 사진).');
        return false;
      }
    }
    if (!data.content.trim() || data.content.trim().length < 10) {
      alert('상세 문의 내용을 10자 이상 입력해 주세요.');
      return false;
    }
    if (!document.getElementById('agreePrivacy').checked) {
      alert('개인정보 수집 및 이용에 동의해 주세요.');
      return false;
    }
    return true;
  }

  /* ── 결과 메시지 표시 ── */
  function showResult(type, message) {
    var el = document.getElementById('partnerResult');
    el.className = 'partner-result ' + type;
    el.textContent = message;
  }

  /* ── DOMContentLoaded 이후 초기화 ── */
  document.addEventListener('DOMContentLoaded', function () {
    loadFestivals();

    setupFilePlaceholder(fileEvent, 'wrapperEvent', '클릭하여 기획서(PPT, PDF, DOC) 첨부');
    setupFilePlaceholder(fileFoodtruckLicense, 'wrapperFoodtruckLicense', '사업자등록증 첨부');
    setupFilePlaceholder(fileFoodtruckMenu, 'wrapperFoodtruckMenu', '대표 이미지 첨부');
    setupFilePlaceholder(fileGoodsLicense, 'wrapperGoodsLicense', '사업자등록증 첨부');
    setupFilePlaceholder(fileGoodsMenu, 'wrapperGoodsMenu', '대표 이미지 첨부');

    /* ── 유형 칩 선택 및 행사/파일 영역 조건부 노출 ─────── */
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        chips.forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');

        const type = chip.dataset.type;
        hiddenType.value = type;

        if (type === 'EVENT') {
          festivalSelectField.classList.add('hidden');
          festivalSelect.required = false;
          festivalSelect.value = '';
        } else {
          festivalSelectField.classList.remove('hidden');
          festivalSelect.required = true;
        }

        fileGroupEvent.classList.add('hidden');
        fileGroupFoodtruck.classList.add('hidden');
        fileGroupGoods.classList.add('hidden');

        if (type === 'EVENT') {
          fileGroupEvent.classList.remove('hidden');
        } else if (type === 'FOODTRUCK') {
          fileGroupFoodtruck.classList.remove('hidden');
        } else if (type === 'GOODS') {
          fileGroupGoods.classList.remove('hidden');
        }
      });
    });

    /* ── 연락처 자동 포맷 ── */
    const phoneInput = document.getElementById('phone');
    if (phoneInput) {
      phoneInput.addEventListener('input', function () {
        let digits = this.value.replace(/\D/g, '');
        if (digits.length > 11) digits = digits.slice(0, 11);
        if (digits.length <= 3) {
          this.value = digits;
        } else if (digits.length <= 7) {
          this.value = digits.slice(0, 3) + '-' + digits.slice(3);
        } else {
          this.value = digits.slice(0, 3) + '-' + digits.slice(3, 7) + '-' + digits.slice(7);
        }
      });
    }

    /* ── 글자 수 카운터 ── */
    const contentArea = document.getElementById('content');
    const contentCount = document.getElementById('contentCount');
    if (contentArea && contentCount) {
      contentArea.addEventListener('input', function () {
        contentCount.textContent = this.value.length;
      });
    }

    /* ── 제출 핸들러 ── */
    const form = document.getElementById('partnerForm');
    if (form) {
      form.addEventListener('submit', async function (e) {
        e.preventDefault();

        const currentType = hiddenType.value;
        const currentFestivalVal = festivalSelect.value;

        var textData = {
          inquiryType: currentType,
          companyName: document.getElementById('companyName').value,
          managerName: document.getElementById('managerName').value,
          phone: document.getElementById('phone').value,
          email: document.getElementById('email').value,
          content: document.getElementById('content').value,
          festivalId: currentType === 'EVENT' ? null : (currentFestivalVal ? Number(currentFestivalVal) : null)
        };

        if (!validateForm(textData)) return;

        var btn = document.getElementById('partnerSubmitBtn');
        btn.disabled = true;
        btn.textContent = '전송 중...';

        const formData = new FormData();
        formData.append('inquiryType', textData.inquiryType);
        formData.append('companyName', textData.companyName);
        formData.append('managerName', textData.managerName);
        formData.append('phone', textData.phone);
        formData.append('email', textData.email);
        formData.append('content', textData.content);
        if (textData.festivalId !== null) {
          formData.append('festivalId', textData.festivalId);
        }

        if (currentType === 'EVENT') {
          formData.append('fileEvent', fileEvent.files[0]);
        } else if (currentType === 'FOODTRUCK') {
          formData.append('fileFoodtruckLicense', fileFoodtruckLicense.files[0]);
          formData.append('fileFoodtruckMenu', fileFoodtruckMenu.files[0]);
        } else if (currentType === 'GOODS') {
          formData.append('fileGoodsLicense', fileGoodsLicense.files[0]);
          formData.append('fileGoodsMenu', fileGoodsMenu.files[0]);
        }

        try {
          const response = await fetch('/api/partner/inquiry', {
            method: 'POST',
            body: formData
          });

          if (!response.ok) throw new Error('서버 에러가 발생했습니다.');
          await response.json();

          showResult('success', '문의가 성공적으로 접수되었습니다! 영업일 기준 2-3일 이내로 담당자가 연락드리겠습니다.');

          document.getElementById('partnerForm').reset();
          contentCount.textContent = '0';

          document.querySelectorAll('.custom-file-input').forEach(function (el) {
            el.classList.remove('has-file');
          });
          document.getElementById('wrapperEvent').querySelector('.file-text').textContent = '클릭하여 기획서(PPT, PDF, DOC) 첨부';
          document.getElementById('wrapperFoodtruckLicense').querySelector('.file-text').textContent = '사업자등록증 첨부';
          document.getElementById('wrapperFoodtruckMenu').querySelector('.file-text').textContent = '대표 이미지 첨부';
          document.getElementById('wrapperGoodsLicense').querySelector('.file-text').textContent = '사업자등록증 첨부';
          document.getElementById('wrapperGoodsMenu').querySelector('.file-text').textContent = '대표 이미지 첨부';

          chips.forEach(function (c) { c.classList.remove('active'); });
          document.querySelector('[data-type="EVENT"]').classList.add('active');
          hiddenType.value = 'EVENT';
          festivalSelectField.classList.add('hidden');

          fileGroupEvent.classList.remove('hidden');
          fileGroupFoodtruck.classList.add('hidden');
          fileGroupGoods.classList.add('hidden');

        } catch (err) {
          console.error('[제휴 문의 API Multipart 전송 오류]', err);
          showResult('error', '전송 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
          btn.disabled = false;
          btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="partner-submit-icon"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> 제휴 신청하기`;
        }
      });
    }
  });
})();
