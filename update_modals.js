const fs = require('fs');
const files = ['index.html', 'list.html', 'guide.html', 'privacy.html', 'terms.html'];
files.forEach(f => {
  const path = 'c:/Users/admin/Fastival-management-master/src/main/resources/static/Festio/' + f;
  if (!fs.existsSync(path)) return;
  let t = fs.readFileSync(path, 'utf8');
  if (t.includes('modal-mobile-search')) {
    const oldHeader = /<div class="modal-header search-modal-header">[\s\S]*?<\/button>\s*<\/div>/;
    const newHeader = `<div class="modal-header search-modal-header" style="display:flex; justify-content:space-between; align-items:center;">
        <h3 style="font-size:18px; font-weight:bold; margin:0;">통합 검색</h3>
        <button class="modal-close-btn" data-close-modal="modal-mobile-search" aria-label="닫기" style="width:32px; height:32px; background:rgba(255,255,255,0.1); border-radius:50%; display:flex; align-items:center; justify-content:center;">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px; height:18px;">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>`;
    t = t.replace(oldHeader, newHeader);
    fs.writeFileSync(path, t);
    console.log('Updated ' + f);
  }
});
