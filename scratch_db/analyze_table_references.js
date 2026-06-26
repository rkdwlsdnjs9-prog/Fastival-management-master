const fs = require('fs');
const path = require('path');

// 34개의 Supabase 테이블 목록
const tables = [
  'app_user', 'cart_items', 'comment_likes', 'comment_reports', 'coupon', 
  'emergency_broadcast', 'event_comments', 'event_revisions', 'festival', 
  'festival_history', 'festival_zone', 'inquiry', 'inventory', 'order_item', 
  'orders', 'partner_inquiry', 'product', 'review', 'scan_log', 
  'seat_map', 'settlement', 'shop_cart', 'shop_notifications', 'shop_order_items', 
  'shop_orders', 'shop_products', 'shop_profiles', 'shop_store_settings', 'store', 
  'store_wait_time_logs', 'user_coupon', 'user_notifications', 'wallet_history', 'wishlists'
];

// 스네이크 케이스를 카멜 케이스로 변환 (클래스명 매칭용)
function toCamelCase(str) {
  return str.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
}

// 검사 대상 폴더
const srcDir = path.join(__dirname, '..', 'src');

// 분석에서 제외할 파일/폴더 패턴
const excludePatterns = [
  /\\static\\shop\\sql\\/i,  // SQL 마이그레이션 폴더 제외
  /\.sql$/i,                  // 모든 SQL 파일 제외
  /check_empty_tables\.js$/i, // 분석용 임시 스크립트 제외
  /analyze_table_references\.js$/i,
  /query\.js$/i,
  /delete\.js$/i
];

// 프로젝트의 모든 소스 파일 목록 수집
function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      // 제외 패턴 검사
      const shouldExclude = excludePatterns.some(pattern => pattern.test(filePath));
      if (!shouldExclude) {
        fileList.push(filePath);
      }
    }
  });
  return fileList;
}

async function analyze() {
  const files = getAllFiles(srcDir);
  console.log(`Analyzing ${files.length} source files for table references...`);

  // 각 테이블별 참조 정보 초기화
  const tableReferences = {};
  tables.forEach(t => {
    tableReferences[t] = {
      tableNamesSearched: [t],
      camelCaseName: toCamelCase(t),
      references: [] // { file: string, matches: string[] }
    };
  });

  // 파일별 내용 검색
  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(path.join(__dirname, '..'), filePath);

    tables.forEach(t => {
      const camel = tableReferences[t].camelCaseName;
      const matches = [];

      // 1. 소문자 스네이크 케이스 테이블명 검색
      // 테이블명이 다른 단어의 일부로 우연히 들어가지 않도록 단어 경계(\b) 또는 따옴표로 감싸진 형태 검색
      const snakeRegexStr = `(?:\\b${t}\\b|['"\`]${t}['"\`])`;
      const snakeRegex = new RegExp(snakeRegexStr, 'g');
      const snakeMatches = content.match(snakeRegex);
      if (snakeMatches) {
        matches.push(...snakeMatches);
      }

      // 2. 자바 Entity 클래스명 검색 (카멜 케이스)
      // 변수명이나 다른 단어로 쓰이는 경우를 방지하기 위해 단어 경계 지정
      // 단, 단일 문자이거나 너무 범용적인 이름(예: 'Store', 'Orders', 'Product')은 클래스 정의나 어노테이션, 리포지토리 명에서 확실히 쓰이는지 검사
      const classRegex = new RegExp(`\\b${camel}\\b`, 'g');
      const classMatches = content.match(classRegex);
      if (classMatches) {
        matches.push(...classMatches);
      }

      // 3. 자바 어노테이션이나 Supabase 클라이언트에서 명시적 조회 형태
      // 예: supabase.from('table') 또는 @Table(name = "table")
      const explicitRegex = new RegExp(`(?:from\\(['"\\b]${t}['"\\b]\\)|@Table\\(\\s*name\\s*=\\s*['"]${t}['"]\\))`, 'i');
      if (explicitRegex.test(content)) {
        matches.push(`explicit_match_in_code`);
      }

      if (matches.length > 0) {
        // 단, 너무 흔한 단어(store, product, orders)의 경우 단순 텍스트 매칭이 잘못되었을 수 있으므로 추가 정밀 필터링 적용
        let isRealMatch = true;

        if (['store', 'product', 'orders', 'inquiry', 'review', 'coupon'].includes(t)) {
          // 이 테이블들은 자바 파일에서 클래스(Store, Product 등), @Table 어노테이션, 
          // 또는 JS 파일에서 supabase.from('...') 형태로 쓰이는 경우만 진짜 참조로 처리
          const hasTableAnnotation = content.includes(`@Table(name = "${t}")`) || content.includes(`@Table(name = '${t}')`);
          const hasJoinTableAnnotation = content.includes(`@JoinTable(name = "${t}")`) || content.includes(`@JoinTable(name = '${t}')`);
          const hasSupabaseFrom = content.includes(`from('${t}')`) || content.includes(`from("${t}")`);
          const hasRepository = content.includes(`${camel}Repository`);
          const hasVoOrDto = content.includes(`${camel}Vo`) || content.includes(`${camel}Dto`) || content.includes(`${camel}Entity`);
          const isJavaClassDef = content.includes(`class ${camel}`) || content.includes(`interface ${camel}`);
          const hasExplicitSql = new RegExp(`(select|insert|update|delete).*\\b${t}\\b`, 'i').test(content);

          if (!hasTableAnnotation && !hasJoinTableAnnotation && !hasSupabaseFrom && !hasRepository && !hasVoOrDto && !isJavaClassDef && !hasExplicitSql) {
            isRealMatch = false;
          }
        }

        if (isRealMatch) {
          tableReferences[t].references.push({
            file: relativePath,
            matchCount: matches.length
          });
        }
      }
    });
  }

  // 결과 리포트 출력
  console.log('\n======================================');
  console.log('      TABLE REFERENCE ANALYSIS        ');
  console.log('======================================');

  const unreferenced = [];
  const referenced = [];

  tables.forEach(t => {
    const refs = tableReferences[t].references;
    if (refs.length === 0) {
      unreferenced.push(t);
    } else {
      referenced.push({
        name: t,
        filesCount: refs.length,
        files: refs.map(r => r.file)
      });
    }
  });

  console.log(`\n[Unreferenced Tables (코드에서 참조되지 않는 테이블 - 총 ${unreferenced.length}개)]`);
  unreferenced.forEach(t => {
    console.log(`- ${t}`);
  });

  console.log(`\n[Referenced Tables (코드에서 사용 중인 테이블 - 총 ${referenced.length}개)]`);
  referenced.forEach(r => {
    console.log(`- ${r.name} (참조 파일 수: ${r.filesCount})`);
  });
}

analyze().catch(console.error);
