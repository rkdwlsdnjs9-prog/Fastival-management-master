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
  
  // 1. Get old zone IDs
  const zoneRes = await client.query(
    'SELECT id, zone_name FROM festival_zone WHERE festival_id = $1 AND map_bg_url IS NULL',
    [festivalId]
  );
  
  const oldZoneIds = zoneRes.rows.map(r => r.id);
  console.log('Old Zone IDs to delete:', oldZoneIds);
  console.log('Old Zone Names:', zoneRes.rows.map(r => r.zone_name));
  
  if (oldZoneIds.length === 0) {
    console.log('No old zones found.');
    await client.end();
    return;
  }
  
  // 2. Delete seats in seat_map referencing these zones
  const delSeatsRes = await client.query(
    'DELETE FROM seat_map WHERE zone_id = ANY($1)',
    [oldZoneIds]
  );
  console.log(`Deleted ${delSeatsRes.rowCount} seats from seat_map.`);
  
  // 3. Delete zones from festival_zone
  const delZonesRes = await client.query(
    'DELETE FROM festival_zone WHERE id = ANY($1)',
    [oldZoneIds]
  );
  console.log(`Deleted ${delZonesRes.rowCount} zones from festival_zone.`);
  
  await client.end();
}

main().catch(console.error);
