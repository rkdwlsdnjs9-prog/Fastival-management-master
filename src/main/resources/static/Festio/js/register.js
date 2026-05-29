/* ============================================================
   Festival O2O — register.js
   회원가입 유효성 검증, 가상 가입 완료 처리 및 Spring Boot API 연동 가이드
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const registerForm = document.getElementById('registerForm');
  
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const emailInput = document.getElementById('registerEmail');
      const passwordInput = document.getElementById('registerPassword');
      const confirmPasswordInput = document.getElementById('registerConfirmPassword');
      const nameInput = document.getElementById('registerName');
      const phoneInput = document.getElementById('registerPhone');
      
      const email = emailInput.value.trim();
      const password = passwordInput.value.trim();
      const confirmPassword = confirmPasswordInput.value.trim();
      const name = nameInput.value.trim();
      const phone = phoneInput.value.trim();
      
      // 1. 모든 필드 필수 입력 검증
      if (!email || !password || !confirmPassword || !name || !phone) {
        showError('모든 정보를 입력해주세요.');
        return;
      }
      
      // 2. 이메일 형식 체크 (정규표현식)
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showError('올바른 이메일 형식을 입력해주세요.');
        return;
      }
      
      // 3. 비밀번호와 비밀번호 확인 일치성 검증
      if (password !== confirmPassword) {
        showError('비밀번호가 서로 다릅니다.');
        return;
      }
      
      try {
        // 1. API 전송 규격 데이터를 생성합니다. (docs/DB_DEFINITION.md 의 app_user 참조)
        const requestData = {
          email: email,
          password: password,
          name: name,
          phone: phone
        };
        
        // 2. 백엔드 회원가입 API로 POST 요청을 전달합니다.
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestData)
        });
        
        // 3. 응답 결과에 따라 분기 처리합니다.
        if (response.ok) {
          showSuccess('회원가입이 완료되었습니다! 로그인 후 이용해주세요.');
          setTimeout(() => {
            window.location.href = 'login.html';
          }, 1200);
        } else {
          const errMsg = await response.text();
          showError(errMsg || '회원가입 처리에 실패했습니다. 다시 시도해주세요.');
        }
      } catch (error) {
        console.error('회원가입 에러:', error);
        showError('회원가입 처리 중 예기치 못한 오류가 발생했습니다.');
      }
    });
  }
  
  // 에러 알림 래퍼
  function showError(msg) {
    if (window.Toast) {
      window.Toast.error(msg);
    } else {
      alert(msg);
    }
  }
  
  // 성공 알림 래퍼
  function showSuccess(msg) {
    if (window.Toast) {
      window.Toast.success(msg);
    } else {
      alert(msg);
    }
  }
});
