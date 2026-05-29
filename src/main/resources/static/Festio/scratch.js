const fs = require('fs');
const indexContent = fs.readFileSync('index.html', 'utf-8');
const listContent = fs.readFileSync('list.html', 'utf-8');

const startMarker = '<!-- ══ 사이드 오버레이';
const endMarker = '  <!-- ══ 메인';

const startIndex = indexContent.indexOf(startMarker);
const endIndex = indexContent.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.log('Markers not found in index.html:', startIndex, endIndex);
  process.exit(1);
}

const headerContent = indexContent.substring(startIndex, endIndex);

const listBodyIndex = listContent.indexOf('<body>') + '<body>'.length;
const listTopIndex = listContent.indexOf('    <!-- 검색 및 카테고리 탭 -->');

if (listBodyIndex === -1 + '<body>'.length || listTopIndex === -1) {
  console.log('Markers not found in list.html:', listBodyIndex, listTopIndex);
  process.exit(1);
}

const newListContent = listContent.substring(0, listBodyIndex) + '\n' + headerContent + '  <div class="app-container">\n' + listContent.substring(listTopIndex);

fs.writeFileSync('list.html', newListContent, 'utf-8');
console.log('Successfully updated list.html');
