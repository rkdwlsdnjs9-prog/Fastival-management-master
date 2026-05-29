document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.guide-tabs li');
  const tabContents = document.querySelectorAll('.guide-tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // 1. 모든 탭 비활성화
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      // 2. 클릭한 탭 활성화
      tab.classList.add('active');
      const targetId = tab.getAttribute('data-tab');
      document.getElementById(targetId).classList.add('active');
    });
  });

  // URL에서 tab 파라미터 확인 및 해당 탭 활성화
  const urlParams = new URLSearchParams(window.location.search);
  const tabParam = urlParams.get('tab');
  if (tabParam) {
    const targetTab = document.querySelector(`.guide-tabs li[data-tab="${tabParam}"]`);
    if (targetTab) {
      targetTab.click();
    }
  }

  // FAQ 아코디언 기능
  const faqHeaders = document.querySelectorAll('.faq-item-header');
  faqHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const parentItem = header.closest('.faq-item');

      // 이미 열려있는 항목이면 닫기
      if (parentItem.classList.contains('active')) {
        parentItem.classList.remove('active');
      } else {
        // 다른 항목 닫기 원하면 아래 주석 해제 (현재는 개별 토글 허용으로 설정)
        // document.querySelectorAll('.faq-item').forEach(item => item.classList.remove('active'));
        parentItem.classList.add('active');
      }
    });
  });

  // FAQ 검색바 토글 기능
  const searchToggleBtn = document.querySelector('.faq-search-toggle-btn');
  const searchToggleInput = document.querySelector('.faq-search-toggle-input');

  if (searchToggleBtn && searchToggleInput) {
    searchToggleBtn.addEventListener('click', () => {
      searchToggleInput.classList.toggle('active');
      if (searchToggleInput.classList.contains('active')) {
        searchToggleInput.focus();
      }
    });
  }

  // FAQ 카테고리 탭 클릭 시 활성화 및 필터링
  const faqCategoryTabs = document.querySelectorAll('.faq-category');
  const faqItems = document.querySelectorAll('.faq-item');

  // 카테고리별 실제 갯수 계산 및 업데이트
  const categoryCounts = { '전체': faqItems.length };
  faqItems.forEach(item => {
    const cat = item.querySelector('.faq-item-category').textContent.trim();
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });

  faqCategoryTabs.forEach(tab => {
    // 탭 텍스트 동적 업데이트
    const categoryName = tab.textContent.replace(/\(\d+\)/, '').trim();
    const count = categoryCounts[categoryName] || 0;
    tab.textContent = `${categoryName}(${count})`;

    tab.addEventListener('click', () => {
      // 모든 카테고리 탭 활성화 해제
      faqCategoryTabs.forEach(t => t.classList.remove('active'));
      // 클릭한 탭 활성화
      tab.classList.add('active');

      const categoryText = tab.textContent.replace(/\(\d+\)/, '').trim();

      // 리스트 필터링 로직
      faqItems.forEach(item => {
        const itemCategory = item.querySelector('.faq-item-category').textContent.trim();
        // 아코디언 모두 닫기
        item.classList.remove('active');

        if (categoryText === '전체' || itemCategory === categoryText) {
          item.style.display = 'block';
        } else {
          item.style.display = 'none';
        }
      });
    });
  });
});
