const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://postgres.loqsekbplftdjphzewmx:naver.com1!@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?prepareThreshold=0',
  ssl: {
    rejectUnauthorized: false
  }
});

async function main() {
  await client.connect();
  console.log('Successfully connected to Supabase Database.');

  // public 스키마 내의 모든 테이블 목록 조회
  const tablesRes = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  const tables = tablesRes.rows.map(r => r.table_name);
  console.log(`Found ${tables.length} tables. Checking row counts...`);

  const emptyTables = [];
  const nonEmptyTables = [];

  for (const table of tables) {
    try {
      const countRes = await client.query(`SELECT COUNT(*) FROM "${table}"`);
      const count = parseInt(countRes.rows[0].count, 10);
      console.log(`- ${table}: ${count} rows`);
      if (count === 0) {
        emptyTables.push(table);
      } else {
        nonEmptyTables.push({ table, count });
      }
    } catch (err) {
      console.error(`Error querying table "${table}":`, err.message);
    }
  }

  console.log('\n--- Empty Tables (Row Count is 0) ---');
  if (emptyTables.length === 0) {
    console.log('No empty tables found.');
  } else {
    emptyTables.forEach(t => console.log(`- ${t}`));
  }

  await client.end();
}

main().catch(async (err) => {
  console.error('An error occurred:', err);
  try {
    await client.end();
  } catch (e) {}
});
