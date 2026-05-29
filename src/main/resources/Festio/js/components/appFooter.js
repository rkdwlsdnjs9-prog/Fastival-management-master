/**
 * @file appFooter.js
 * @description 전역 하단 푸터(Footer) 컴포넌트입니다.
 * 고객센터 및 1:1 문의 정보를 포함하며, 모든 페이지의 하단에 렌더링됩니다.
 */
(function () {
  const phoneSvg = `<svg class="footer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`;
  const editSvg = `<svg class="footer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>`;

  const footerHtml = `
    <style>
      @media (max-width: 768px) {
        .app-footer {
          display: none !important;
        }
      }
    </style>
    <footer class="app-footer">
      <!-- 상단 푸터 메뉴 -->
      <div class="footer-corp-menu-wrap" style="border-top: 1px solid #eaeaea; border-bottom: 1px solid #eaeaea; background: #fff;">
        <div class="footer-corp-menu" style="max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; padding: 15px 20px;">
          <ul class="corp-menu-list" style="display: flex; gap: 20px; list-style: none; padding: 0; margin: 0;">
            <li><a href="#" style="text-decoration: none; color: #555; font-size: 14px;">회사소개</a></li>
            <li><a href="#" style="text-decoration: none; color: #555; font-size: 14px;">이용약관</a></li>
            <li><a href="#" style="text-decoration: none; color: #555; font-size: 14px; font-weight: 700;">개인정보처리방침</a></li>
            <li><a href="#" id="btn-youth-policy" style="text-decoration: none; color: #555; font-size: 14px;">청소년보호정책</a></li>
            <li><a href="guide.html" style="text-decoration: none; color: #555; font-size: 14px;">이용안내</a></li>
            <li><a href="guide.html?tab=tab-partner" style="text-decoration: none; color: #555; font-size: 14px;">티켓판매안내</a></li>
          </ul>
          <div class="family-site">
            <select style="padding: 5px 30px 5px 10px; border: 1px solid #ccc; color: #666; font-size: 13px; background: #fff; outline: none;">
              <option>Family Site</option>
            </select>
          </div>
        </div>
      </div>
      
      <div class="footer-main-wrap" style="padding: 40px 0; background: #fff;">
        <div class="footer-main-container" style="max-width: 1200px; margin: 0 auto; padding: 0 20px; display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; flex-wrap: nowrap;">
          
          <!-- 1. 좌측: 로고 및 회사 정보 (FESTIO) -->
          <div class="footer-corp-left" style="display: flex; gap: 20px; flex: 1 1 400px; padding-right: 40px; min-width: 0;">
            <div class="corp-logo" style="width: 100px; flex-shrink: 0;">
              <span style="font-size:28px; font-weight:900; color:#a0a0a0; letter-spacing:-2px; font-family: 'Arial Black', sans-serif;">FESTIO</span>
            </div>
            <div class="corp-text-wrap" style="flex: 1; min-width: 0;">
              <p class="corp-name" style="font-weight: 700; color: #555; margin-bottom: 8px; font-size: 13px;">FESTIO(주)</p>
              <div class="corp-text-inline-wrap" style="color: #777; font-size: 12px; line-height: 1.8; margin-bottom: 5px; word-break: keep-all;">
대표 : 강진원, 오하율, 임소희<br>이메일 : FESTIO@festio.com<br>주소 : 서울특별시 마포구 월드컵북로 123<br>(상암동, 페스티오빌딩)<br>사업자등록번호 : 123-45-67890<br>통신판매업신고 : 제2026-서울마포-1234호<br><a href="#" style="color: #555; text-decoration: none;">사업자 정보확인 &gt;</a><br>호스팅 서비스사업자 : FESTIO(주)
              </div>
              <p class="corp-copyright" style="font-size: 12px; color: #999; margin-top: 10px; line-height: 1.6;">
Copyright © FESTIO Corp.<br>All Rights Reserved.
              </p>
            </div>
          </div>
          
          <div class="footer-corp-right" style="display: flex; gap: 20px; flex: 0 0 auto; flex-wrap: wrap;">
            <!-- 2. 중앙 좌측: SGI서울보증 -->
            <div class="footer-sgi-center" style="box-sizing: border-box; width: 220px; flex-shrink: 0; padding-top: 2px; border-left: 1px solid #eaeaea; padding-left: 20px;">
              <div class="sgi-title" style="font-size: 12px; font-weight: bold; color: #555; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
                <span style="font-weight:bold; color:#666;">SGI서울보증</span>
                <a href="#" style="color: #555; text-decoration: none;">서비스가입사실확인 &gt;</a>
              </div>
              <p class="sgi-text" style="font-size: 11px; color: #888; line-height: 1.5; margin: 0; text-align: left; word-break: keep-all;">
                고객님은 안전거래를 위한 현금 등으로 결제 시<br>저희 쇼핑몰에서 가입한 구매안전서비스를 이용하실 수 있습니다.
              </p>
            </div>
            
            <!-- 3. 중앙 우측: 고객센터 -->
            <div class="footer-section cs-section" style="box-sizing: border-box; display: flex; align-items: flex-start; gap: 12px; width: 190px; flex-shrink: 0; border-left: 1px solid #eaeaea; padding-left: 20px;">
              <div class="footer-icon-wrap" style="width: 32px; height: 32px; border-radius: 50%; border: 1px solid #d5d5d5; background: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                ${phoneSvg}
              </div>
              <div class="footer-content">
                <h3 class="footer-title" style="font-size: 14px; font-weight: bold; color: #333; margin-bottom: 12px; border-bottom: 2px solid #e96d2b; padding-bottom: 6px; display: inline-block;">고객센터</h3>
                <p class="footer-text" style="font-size: 12px; color: #555; margin-bottom: 3px;">전화문의 : 1588-0000</p>
                <p class="footer-text" style="font-size: 12px; color: #555; margin-bottom: 3px;">평일 09:00~18:00</p>
                <p class="footer-text" style="font-size: 12px; color: #555; margin-bottom: 3px;">토요일 09:00~17:00</p>
                <p class="footer-text footer-subtext" style="font-size: 11px; color: #888; margin-top: 4px;">(점심시간 12:00~13:00 / 일요일,공휴일 휴무)</p>
              </div>
            </div>
            
            <!-- 4. 우측 끝: 1:1 문의 -->
            <div class="footer-section inquiry-section" style="box-sizing: border-box; display: flex; align-items: flex-start; gap: 12px; width: 190px; flex-shrink: 0; border-left: 1px solid #eaeaea; padding-left: 20px;">
              <div class="footer-icon-wrap" style="width: 32px; height: 32px; border-radius: 50%; border: 1px solid #d5d5d5; background: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                ${editSvg}
              </div>
              <div class="footer-content">
                <div class="footer-title-row" style="display: inline-flex; align-items: center; gap: 8px; margin-bottom: 12px; border-bottom: 2px solid #e96d2b; padding-bottom: 6px;">
                  <h3 class="footer-title" style="font-size: 14px; font-weight: bold; color: #333; margin: 0;">1:1 문의</h3>
                  <a href="#" class="btn-inquiry" style="font-size: 11px; color: #e96d2b; border: 1px solid #e96d2b; padding: 2px 6px; border-radius: 2px; text-decoration: none;">문의하기</a>
                </div>
                <p class="footer-text" style="font-size: 12px; color: #555; margin-bottom: 4px; line-height: 1.4;">오후 5시 이후 문의는<br>당일 답변이 어려울 수 있습니다.</p>
                <div class="footer-highlight-wrap" style="margin-top: 10px; font-size: 11px; color: #777; line-height: 1.5; word-break: keep-all;">
                  <div style="display: inline-flex; align-items: center; gap: 3px; color: #e96d2b; font-weight: 700; font-size: 12px; margin-right: 4px; vertical-align: top;">
                    <svg class="footer-highlight-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
                      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                      <circle cx="8" cy="11.5" r="1.5" fill="currentColor" stroke="none"></circle>
                      <circle cx="12" cy="11.5" r="1.5" fill="currentColor" stroke="none"></circle>
                      <circle cx="16" cy="11.5" r="1.5" fill="currentColor" stroke="none"></circle>
                    </svg>
                    <span style="border-bottom: 1px solid #e96d2b; padding-bottom: 1px;">잠깐!</span>
                  </div>
                  1:1 문의 전 FAQ를 먼저 확인해보세요.
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </footer>

    <!-- 청소년보호정책 모달 -->
    <div class="modal-overlay modal-center" id="youth-policy-modal" style="background: rgba(0,0,0,0.5);">
      <div class="modal-sheet" style="background: #ffffff !important; border: 1px solid #ddd; max-width: 800px; width: 90%; opacity: 1;">
        <div class="modal-header">
          <h2 class="modal-title" style="text-align: center; width: 100%; font-size: 24px;">FESTIO 청소년보호정책</h2>
          <button class="modal-close-btn" id="btn-close-youth-policy">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div class="modal-body" style="padding: 30px;">
          <p style="margin-bottom: 10px; font-size: 14px; color: #555;">① FESTIO 주식회사(이하 회사)는 불건전한 유해매체물로부터 청소년을 보호하기 위하여, [청소년보호법], [정보통신망 이용촉진 및 정보보호등에 관한 법률] 등에 근거하여 청소년보호책임자를 지정하고 청소년보호정책을 시행하고 있습니다.</p>
          <p style="margin-bottom: 30px; font-size: 14px; color: #555;">② 회사는 정보통신윤리위원회 심의규정 및 청소년유해매체물 기준에 따라, 19세 미만의 청소년들이 유해매체물에 접근할 수 없도록 방지하고 있습니다.</p>
          
          <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 15px; color: #333;">제1조 유해정보에 대한 청소년접근제한 및 관리조치</h3>
          <p style="margin-bottom: 10px; font-size: 14px; color: #555;">① 회사는 청소년이 불법, 유해한 매체물 유통 등으로 인한 피해를 입지 않도록 청소년 유해매체물에 대하여 별도의 성인인증 장치를 적용하며, 청소년 유해정보가 노출되지 않도록 예방합니다.</p>
          <p style="margin-bottom: 30px; font-size: 14px; color: #555;">② 회사는 게시물을 포함하여 회사가 제공하는 서비스의 금칙어 및 청소년 보호와 관련된 모니터링을 실시하며 주기적으로 관리하고 있습니다.</p>
          
          <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 15px; color: #333;">제2조 유해정보로부터의 청소년보호를 위한 업무 담당자 교육</h3>
          <p style="margin-bottom: 30px; font-size: 14px; color: #555;">회사는 정보통신업무 종사자를 대상으로 청소년 보호와 관련된 법령 및 제재기준, 유해정보 발견시 대처방법, 위반사항 처리에 대한 보고절차 등을 교육하고 있습니다.</p>
          
          <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 15px; color: #333;">제3조 유해정보로 인한 피해상담 및 고충처리</h3>
          <p style="margin-bottom: 10px; font-size: 14px; color: #555;">① 회사는 청소년 유해매체물의 유통으로 인한 피해신고 및 처리를 위하여 신고센터를 통한 신고를 접수 받고 있습니다.</p>
          <p style="margin-bottom: 10px; font-size: 14px; color: #555;">② 청소년 유해매체물 신고센터 메일주소는 '청소년보호정책'에 명시되어 언제든지 확인 할 수 있습니다.</p>
          <p style="margin-bottom: 30px; font-size: 14px; color: #555;">③ 청소년 유해매체물로 확인되는 경우 매체물 등록자에게 경고조치 또는 위법성을 검토하여 삭제 등의 조치를 취합니다.</p>
          
          <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 15px; color: #333;">제4조 청소년보호 책임 및 담당자</h3>
          <p style="margin-bottom: 15px; font-size: 14px; color: #555;">FESTIO 주식회사는 청소년들이 정신적·신체적으로 유해한 환경으로부터 보호받을 수 있도록 최선의 노력을 다하고 있습니다.</p>
          
          <table style="width: 100%; border-collapse: collapse; border-top: 2px solid #ddd; border-bottom: 1px solid #ddd; margin-bottom: 20px;">
            <colgroup>
              <col style="width: 30%;">
              <col style="width: 70%;">
            </colgroup>
            <tbody>
              <tr>
                <th style="background-color: #f9f9f9; padding: 15px; font-size: 14px; color: #333; border-bottom: 1px solid #eee; text-align: center; font-weight: bold;">청소년 보호책임자</th>
                <td style="padding: 15px; font-size: 14px; color: #555; border-bottom: 1px solid #eee;">
                  <ul style="list-style: none; padding: 0; margin: 0; line-height: 1.8;">
                    <li>· 성 명 : 강진원</li>
                    <li>· 소속부서 : 플랫폼본부</li>
                    <li>· 직 위 : 팀장</li>
                    <li>· 전화번호 : 1588-0000</li>
                    <li>· 이 메 일 : teensafe@festio.com</li>
                  </ul>
                </td>
              </tr>
              <tr>
                <th style="background-color: #f9f9f9; padding: 15px; font-size: 14px; color: #333; text-align: center; font-weight: bold;">청소년 보호담당자</th>
                <td style="padding: 15px; font-size: 14px; color: #555;">
                  <ul style="list-style: none; padding: 0; margin: 0; line-height: 1.8;">
                    <li>· 성 명 : 오하율</li>
                    <li>· 소속부서 : 플랫폼본부</li>
                    <li>· 전화번호 : 1588-0000</li>
                    <li>· 이 메 일 : teensafe@festio.com</li>
                  </ul>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  document.write(footerHtml);

  // 청소년보호정책 모달 이벤트 처리
  window.addEventListener('DOMContentLoaded', function () {
    const btnYouthPolicy = document.getElementById('btn-youth-policy');
    const modalYouthPolicy = document.getElementById('youth-policy-modal');
    const btnCloseYouthPolicy = document.getElementById('btn-close-youth-policy');

    if (btnYouthPolicy && modalYouthPolicy && btnCloseYouthPolicy) {
      btnYouthPolicy.addEventListener('click', function (e) {
        e.preventDefault();
        modalYouthPolicy.classList.add('active');
      });

      btnCloseYouthPolicy.addEventListener('click', function () {
        modalYouthPolicy.classList.remove('active');
      });

      // 배경 클릭 시 닫기
      modalYouthPolicy.addEventListener('click', function (e) {
        if (e.target === modalYouthPolicy) {
          modalYouthPolicy.classList.remove('active');
        }
      });
    }
  });
})();
