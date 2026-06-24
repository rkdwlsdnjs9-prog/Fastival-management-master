const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://postgres.loqsekbplftdjphzewmx:naver.com1!@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?prepareThreshold=0',
  ssl: {
    rejectUnauthorized: false
  }
});

async function main() {
  await client.connect();
  
  const festivalId = 10;
  // Get old zone IDs (safetyLimit = 40 and map_bg_url is null)
  const zoneRes = await client.query(
    'SELECT id FROM festival_zone WHERE festival_id = $1 AND map_bg_url IS NULL',
    [festivalId]
  );
  
  const oldZoneIds = zoneRes.rows.map(r => r.id);
  console.log('Old Zone IDs:', oldZoneIds);
  
  if (oldZoneIds.length === 0) {
    console.log('No old zones to delete.');
    await client.end();
    return;
  }
  
  // Check seat_map references
  const seatRes = await client.query(
    'SELECT COUNT(*), zone_id FROM seat_map WHERE zone_id = ANY($1) GROUP BY zone_id',
    [oldZoneIds]
  );
  console.log('SeatMap references:', seatRes.rows);
  
  // Check store references (if table exists)
  try {
    const storeRes = await client.query(
      'SELECT COUNT(*), zone_id FROM store WHERE zone_id = ANY($1) GROUP BY zone_id',
      [oldZoneIds]
    );
    console.log('Store references:', storeRes.rows);
  } catch (e) {
    console.log('Store check skipped or table does not exist/different name');
  }

  await client.end();
}

main().catch(console.error);
