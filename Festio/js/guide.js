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
});
