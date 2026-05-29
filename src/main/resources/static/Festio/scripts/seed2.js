const SUPABASE_URL = 'https://cddfyvkilmfrbtcruklw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkZGZ5dmtpbG1mcmJ0Y3J1a2x3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NzU5MzksImV4cCI6MjA5NTM1MTkzOX0.YPkPc7wDBWE3NwE_SrUnhQIOofJjTA-N9iPzxdiEFXs';

async function seedData() {
  const events = [
    {
      event_name: '2026 프로야구 개막전 (LG 트윈스 vs KT 위즈)',
      category: '지역축제',
      venue: '잠실 야구장',
      event_date: '2026-03-23',
      start_time: '14:00:00',
      end_time: '18:00:00',
      description: '2026 KBO 리그 정규시즌 공식 개막전',
      thumbnail_url: 'https://images.unsplash.com/photo-1508344928928-7165b67de128?auto=format&fit=crop&w=400&q=80',
      badge_label: 'HOT',
      is_hot: true,
      is_active: true,
      view_count: 12000
    },
    {
      event_name: '2026 서울국제마라톤 (동아마라톤)',
      category: '지역축제',
      venue: '광화문 광장 ~ 잠실종합운동장',
      event_date: '2026-03-15',
      start_time: '08:00:00',
      end_time: '13:00:00',
      description: '세계육상연맹(WA) 플래티넘 라벨 국제 마라톤 대회',
      thumbnail_url: 'https://images.unsplash.com/photo-1552674605-15c2145fb651?auto=format&fit=crop&w=400&q=80',
      badge_label: '신규',
      is_hot: false,
      is_active: true,
      view_count: 7500
    }
  ];

  for (const ev of events) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(ev)
    });
    
    if (res.ok) {
      console.log(`Inserted: ${ev.event_name}`);
    } else {
      console.error(`Failed to insert ${ev.event_name}:`, await res.text());
    }
  }
}

seedData();
