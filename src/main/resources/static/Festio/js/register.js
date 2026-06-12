/* ============================================================
   Festival O2O — register.js
   회원가입 유효성 검증, UI 인터랙션 및 API 연동
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM 요소 참조 ---
  const registerForm = document.getElementById('registerForm');

  // 비밀번호 토글
  const togglePassword = document.getElementById('togglePassword');
  const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');
  const pwInput = document.getElementById('registerPassword');
  const pwConfirmInput = document.getElementById('registerConfirmPassword');

  // 약관 동의
  const agreeAll = document.getElementById('agreeAll');
  const agreeTerms = document.getElementById('agreeTerms');
  const agreePrivacy = document.getElementById('agreePrivacy');
  const agreeMarketing = document.getElementById('agreeMarketing');
  const individualCheckboxes = [agreeTerms, agreePrivacy, agreeMarketing];

  // 이메일 인증
  const btnSendAuthCode = document.getElementById('btnSendAuthCode');
  const authCodeSection = document.getElementById('authCodeSection');
  const emailAuthCodeInput = document.getElementById('emailAuthCode');
  const btnResendAuthCode = document.getElementById('btnResendAuthCode');
  const btnConfirmAuthCode = document.getElementById('btnConfirmAuthCode');
  const authTimer = document.getElementById('authTimer');
  const authStatus = document.getElementById('authStatus');
  const emailInput = document.getElementById('registerEmail');

  // 기타 입력란
  const phoneInput = document.getElementById('registerPhone');
  const nameInput = document.getElementById('registerName');

  // 비밀번호 강도 인디케이터
  const pwStrengthText = document.getElementById('pwStrengthText');
  const pwStrengthBar = document.getElementById('pwStrengthBar');
  const pwStrengthFill = document.getElementById('pwStrengthFill');
  const pwErrorText = document.getElementById('pwErrorText');

  // --- 상태 변수 ---
  let authTimerInterval = null;
  let timerSeconds = 180; // 3분
  let isEmailVerified = false;

  // --- 1. 비밀번호 표시 토글 ---
  function setupPasswordToggle(btn, input) {
    if (!btn || !input) return;
    btn.addEventListener('click', () => {
      const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
      input.setAttribute('type', type);

      const eyeIcon = btn.querySelector('.eye-icon');
      if (type === 'text') {
        eyeIcon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" />';
      } else {
        eyeIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />';
      }
    });
  }
  setupPasswordToggle(togglePassword, pwInput);
  setupPasswordToggle(toggleConfirmPassword, pwConfirmInput);

  // --- 2. 약관 동의 로직 ---
  if (agreeAll) {
    agreeAll.addEventListener('change', function () {
      const isChecked = this.checked;
      individualCheckboxes.forEach(cb => {
        if (cb) cb.checked = isChecked;
      });
    });

    individualCheckboxes.forEach(cb => {
      if (cb) {
        cb.addEventListener('change', function () {
          const allChecked = individualCheckboxes.every(item => item.checked);
          agreeAll.checked = allChecked;
        });
      }
    });
  }

  // --- 3. 휴대폰 번호 자동 하이픈 ---
  if (phoneInput) {
    phoneInput.addEventListener('input', function (e) {
      let val = this.value.replace(/[^0-9]/g, '');
      let res = '';
      if (val.length < 4) {
        res = val;
      } else if (val.length < 7) {
        res = val.substr(0, 3) + '-' + val.substr(3);
      } else if (val.length < 11) {
        res = val.substr(0, 3) + '-' + val.substr(3, 3) + '-' + val.substr(6);
      } else {
        res = val.substr(0, 3) + '-' + val.substr(3, 4) + '-' + val.substr(7);
      }
      this.value = res;
      // 휴대폰 번호 변경 시 비밀번호 유효성 재검사 (전화번호 포함 여부 확인)
      if (pwInput && pwInput.value) validatePassword(pwInput.value);
    });
  }

  // --- 4. 이메일 인증 로직 ---
  function startTimer() {
    clearInterval(authTimerInterval);
    timerSeconds = 180;
    authTimer.textContent = '03:00';
    btnConfirmAuthCode.disabled = false;

    authTimerInterval = setInterval(() => {
      timerSeconds--;
      const m = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
      const s = String(timerSeconds % 60).padStart(2, '0');
      authTimer.textContent = `${m}:${s}`;

      if (timerSeconds <= 0) {
        clearInterval(authTimerInterval);
        btnConfirmAuthCode.disabled = true;
        authStatus.innerHTML = '<span class="auth-error">인증 시간이 초과되었습니다. 재발송해주세요.</span>';
      }
    }, 1000);
  }

  async function sendAuthEmail() {
    const email = emailInput.value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError('올바른 이메일 주소를 입력해주세요.');
      return;
    }

    // 버튼 상태 변경
    btnSendAuthCode.disabled = true;
    btnSendAuthCode.textContent = '발송 중...';

    try {
      // SMTP API 연동 (가상)
      // const response = await fetch('/api/auth/send-email', { ... });
      await new Promise(resolve => setTimeout(resolve, 1000)); // 통신 지연 시뮬레이션

      authCodeSection.classList.remove('hidden');
      authStatus.innerHTML = '<span class="auth-success">인증번호가 발송되었습니다.</span>';
      btnSendAuthCode.textContent = '재발송';
      btnSendAuthCode.disabled = false;

      startTimer();
    } catch (error) {
      console.error('이메일 발송 실패:', error);
      showError('인증번호 발송에 실패했습니다. 잠시 후 다시 시도해주세요.');
      btnSendAuthCode.textContent = '인증번호 발송';
      btnSendAuthCode.disabled = false;
    }
  }

  if (btnSendAuthCode) btnSendAuthCode.addEventListener('click', sendAuthEmail);
  if (btnResendAuthCode) btnResendAuthCode.addEventListener('click', sendAuthEmail);

  if (btnConfirmAuthCode) {
    btnConfirmAuthCode.addEventListener('click', async () => {
      const code = emailAuthCodeInput.value.trim();
      if (code.length !== 6) {
        showError('인증번호 6자리를 입력해주세요.');
        return;
      }

      try {
        // SMTP 인증 확인 API (가상)
        // const response = await fetch('/api/auth/verify-email', { ... });
        await new Promise(resolve => setTimeout(resolve, 500));

        clearInterval(authTimerInterval);
        isEmailVerified = true;
        authTimer.textContent = '';
        btnConfirmAuthCode.disabled = true;
        btnConfirmAuthCode.textContent = '인증완료';
        btnResendAuthCode.disabled = true;
        emailAuthCodeInput.readOnly = true;

        authStatus.innerHTML = '<span class="auth-success">이메일 인증이 완료되었습니다.</span>';
      } catch (error) {
        showError('잘못된 인증번호입니다.');
      }
    });
  }

  // --- 5. 비밀번호 강도 검증 ---
  function hasConsecutiveNumbers(pw) {
    // 3자리 이상 연속된 숫자 (123, 789 등) 또는 동일 숫자 반복 (111, 222)
    for (let i = 0; i < pw.length - 2; i++) {
      const c1 = pw.charCodeAt(i);
      const c2 = pw.charCodeAt(i + 1);
      const c3 = pw.charCodeAt(i + 2);

      // 모두 숫자인지 확인
      if (c1 >= 48 && c1 <= 57 && c2 >= 48 && c2 <= 57 && c3 >= 48 && c3 <= 57) {
        // 동일 반복 (예: 111)
        if (c1 === c2 && c2 === c3) return true;
        // 연속 증가 (예: 123)
        if (c1 + 1 === c2 && c2 + 1 === c3) return true;
        // 연속 감소 (예: 321)
        if (c1 - 1 === c2 && c2 - 1 === c3) return true;
      }
    }
    return false;
  }

  function hasPhoneNumberSequence(pw) {
    const phone = phoneInput ? phoneInput.value.replace(/[^0-9]/g, '') : '';
    if (phone.length >= 4) {
      // 휴대폰 번호의 중간자리, 끝자리 등 의미있는 연속 배열이 포함되었는지 (보통 4자리 기준)
      if (pw.includes(phone.substr(3, 4))) return true;
      if (phone.length >= 11 && pw.includes(phone.substr(7, 4))) return true;
    }
    return false;
  }

  function validatePassword(pw) {
    // 강도 인디케이터 초기화 및 표시
    pwStrengthText.classList.remove('hidden');
    pwStrengthBar.classList.remove('hidden');

    // 조건 변수
    const hasLength = pw.length >= 8;
    const hasUpper = /[A-Z]/.test(pw);
    const hasNum = /[0-9]/.test(pw);
    const hasSpecial = /[!@#$%^&*]/.test(pw);
    const isConsecutive = hasConsecutiveNumbers(pw);
    const isPhoneMatch = hasPhoneNumberSequence(pw);

    // 만족하는 조건 수 (길이 제외한 대/소/특수문자 중)
    let conditionsMet = 0;
    if (hasUpper) conditionsMet++;
    if (hasNum) conditionsMet++;
    if (hasSpecial) conditionsMet++;

    // 강도 판단
    let strength = 'weak'; // weak, fair, good
    let text = '보안취약';
    let isValid = false;

    if (!hasLength || conditionsMet <= 1 || isConsecutive || isPhoneMatch) {
      strength = 'weak';
      text = '보안취약';
    } else if (conditionsMet === 2) {
      strength = 'fair';
      text = '불안';
    } else if (conditionsMet === 3 && hasLength && !isConsecutive && !isPhoneMatch) {
      strength = 'good';
      text = '양호';
      isValid = true;
    }

    // UI 업데이트
    pwStrengthText.textContent = text;
    pwStrengthText.className = `pw-strength-text ${strength}`;
    pwStrengthFill.className = `pw-strength-fill ${strength}`;

    // 실시간 에러 메시지 처리 (입력 중이므로 에러 숨김)
    pwErrorText.classList.add('hidden');

    return isValid;
  }

  if (pwInput) {
    pwInput.addEventListener('input', function () {
      if (this.value.length > 0) {
        validatePassword(this.value);
      } else {
        // 비어있으면 인디케이터 숨김
        pwStrengthText.classList.add('hidden');
        pwStrengthBar.classList.add('hidden');
        pwErrorText.classList.add('hidden');
      }
    });

    pwInput.addEventListener('blur', function () {
      if (this.value.length > 0) {
        const isValid = validatePassword(this.value);
        if (!isValid) {
          pwErrorText.classList.remove('hidden');
        }
      }
    });
  }

  // --- 6. 폼 제출 검증 ---
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = emailInput.value.trim();
      const password = pwInput.value.trim();
      const confirmPassword = pwConfirmInput.value.trim();
      const name = nameInput.value.trim();
      const phone = phoneInput.value.trim();

      if (!email || !password || !confirmPassword || !name || !phone) {
        showError('모든 필수 정보를 입력해주세요.');
        return;
      }

      if (!isEmailVerified) {
        showError('이메일 인증을 완료해주세요.');
        return;
      }

      const isPwValid = validatePassword(password);
      if (!isPwValid) {
        pwErrorText.classList.remove('hidden');
        showError('비밀번호가 조건에 맞지 않습니다.');
        pwInput.focus();
        return;
      }

      if (password !== confirmPassword) {
        showError('비밀번호가 서로 다릅니다.');
        return;
      }

      if (!agreeTerms.checked || !agreePrivacy.checked) {
        showError('필수 약관에 동의해주세요.');
        return;
      }

      try {
        const requestData = { email, password, name, phone };

        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestData)
        });
        
        if (response.ok) {
          showSuccess('회원가입이 완료되었습니다! 로그인 후 이용해주세요.');
          setTimeout(() => { window.location.href = 'login.html'; }, 1200);
        } else {
          const errMsg = await response.text();
          showError(errMsg || '회원가입 처리에 실패했습니다.');
        }

      } catch (error) {
        console.error('회원가입 에러:', error);
        showError('회원가입 처리 중 예기치 못한 오류가 발생했습니다.');
      }
    });
  }

  function showError(msg) {
    if (window.Toast) window.Toast.error(msg);
    else alert(msg);
  }

  function showSuccess(msg) {
    if (window.Toast) window.Toast.success(msg);
    else alert(msg);
  }

  // --- 7. 소셜 로그인 버튼 처리 ---
  const socialButtons = document.querySelectorAll('#btnSocialRegister');
  socialButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // 발표용 시연 연출: 유료 API 연동 후 성공 처리 및 로그인 상태로 메인페이지 이동 시뮬레이션
      const platform = btn.textContent.trim().split(' ')[0]; // 네이버, 카카오, 구글, 토스
      showSuccess(`${platform} 계정으로 간편 가입 및 로그인이 완료되었습니다!`);

      // 로그인 상태 부여
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('userName', `${platform}회원`);
      localStorage.setItem('userToken', 'social_mock_token'); // 마이페이지 진입을 위한 토큰 추가

      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1200);
    });
  });
});
