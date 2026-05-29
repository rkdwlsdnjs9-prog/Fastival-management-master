/* ============================================================
   Festival O2O — login.js
   로그인 유효성 검증 및 가상인증 & 추후 Spring Boot API 연동 확장성 가이드
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const emailInput = document.getElementById('loginEmail');
      const passwordInput = document.getElementById('loginPassword');
      
      const email = emailInput.value.trim();
      const password = passwordInput.value.trim();
      
      // 1. 이메일 및 비밀번호 검증
      if (!email || !password) {
        if (window.Toast) {
          window.Toast.error('아이디와 비밀번호를 입력해주세요.');
        } else {
          alert('아이디와 비밀번호를 입력해주세요.');
        }
        return;
      }
      
      try {
        // 1. API 요청 데이터를 생성합니다.
        const requestData = {
          email: email,
          password: password
        };
        
        // 2. 백엔드 로그인 API(/api/auth/login)로 fetch 요청을 보냅니다.
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestData)
        });
        
        // 3. API 응답 성공 여부에 따라 분기 처리합니다.
        if (response.ok) {
          const result = await response.json();
          
          const isAdmin = email === 'admin@gmail.com';
          
          if (isAdmin) {
            localStorage.setItem('userToken', 'festio-admin-jwt-token-7777');
            localStorage.setItem('userEmail', 'admin@gmail.com');
            localStorage.setItem('email', 'admin@gmail.com');
            localStorage.setItem('userName', result.userName || '관리자');
            localStorage.setItem('userRole', 'ADMIN');
            localStorage.setItem('isLoggedIn', 'true');
          } else {
            localStorage.setItem('userToken', result.token);
            localStorage.setItem('userName', result.userName);
            localStorage.setItem('userRole', result.userRole || 'CLIENT');
            localStorage.setItem('email', result.email);
            localStorage.setItem('userPhone', result.phone || '');
            localStorage.setItem('isLoggedIn', 'true');
          }
          
          // (동기화) sessionStorage 에도 데이터 동기화 저장
          if (window.Auth) {
            window.Auth.save({
              email: isAdmin ? 'admin@gmail.com' : result.email,
              name: isAdmin ? (result.userName || '관리자') : result.userName,
              role: isAdmin ? 'ADMIN' : (result.userRole || 'CLIENT')
            });
          }
          
          const redirectUrl = 'index.html';
          const successMsg = isAdmin 
            ? '관리자 로그인 성공! 메인 화면으로 이동합니다.' 
            : '로그인에 성공하였습니다! 메인 화면으로 이동합니다.';

          if (window.Toast) {
            window.Toast.success(successMsg);
          } else {
            alert(successMsg);
          }
          
          // 약간의 딜레이를 주어 로그인 완료 토스트/알림을 볼 수 있게 한 후 메인 또는 어드민으로 리다이렉트
          setTimeout(() => {
            window.location.href = redirectUrl;
          }, 800);
        } else {
          const errText = await response.text();
          if (window.Toast) {
            window.Toast.error(errText || '로그인에 실패했습니다. 이메일 또는 비밀번호를 확인해주세요.');
          } else {
            alert(errText || '로그인에 실패했습니다. 이메일 또는 비밀번호를 확인해주세요.');
          }
        }
           
      } catch (error) {
        console.error('로그인 에러:', error);
        if (window.Toast) {
          window.Toast.error('로그인 처리 중 예기치 못한 오류가 발생했습니다.');
        } else {
          alert('로그인 처리 중 예기치 못한 오류가 발생했습니다.');
        }
      }
    });
  }
});
