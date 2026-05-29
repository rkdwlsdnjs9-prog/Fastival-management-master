const SUPABASE_URL = 'https://cddfyvkilmfrbtcruklw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkZGZ5dmtpbG1mcmJ0Y3J1a2x3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NzU5MzksImV4cCI6MjA5NTM1MTkzOX0.YPkPc7wDBWE3NwE_SrUnhQIOofJjTA-N9iPzxdiEFXs';

async function seedData() {
  const events = [
    {
      event_name: '2026 연세대학교 아카라카를 온누리에',
      category: '대학축제',
      venue: '연세대학교 노천극장',
      event_date: '2026-05-25',
      start_time: '18:00:00',
      end_time: '23:00:00',
      description: '연세대학교 최대 응원제 및 축제',
      thumbnail_url: 'https://images.unsplash.com/photo-1540039155732-d6741b687cb8?auto=format&fit=crop&w=400&q=80',
      badge_label: 'HOT',
      is_hot: true,
      is_active: true,
      view_count: 15400
    },
    {
      event_name: '2026 고려대학교 입실렌티 지·야의 함성',
      category: '대학축제',
      venue: '고려대학교 녹지운동장',
      event_date: '2026-05-26',
      start_time: '17:00:00',
      end_time: '22:30:00',
      description: '고려대학교 대표 응원제 및 대동제',
      thumbnail_url: 'https://images.unsplash.com/photo-1525681530978-5e7e6f338d12?auto=format&fit=crop&w=400&q=80',
      badge_label: 'HOT',
      is_hot: true,
      is_active: true,
      view_count: 14200
    },
    {
      event_name: '성균관대학교 통합 대동제 ESKARA 2025',
      category: '대학축제',
      venue: '성균관대학교 자연과학캠퍼스 대운동장',
      event_date: '2025-09-20',
      start_time: '15:00:00',
      end_time: '23:00:00',
      description: '인문/자연 통합으로 열리는 성균관대 가을 대축제',
      thumbnail_url: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=400&q=80',
      badge_label: '종료',
      is_hot: false,
      is_active: true,
      view_count: 8500
    },
    {
      event_name: '2026 한양대학교 라치오스 (RACHIOS)',
      category: '대학축제',
      venue: '한양대학교 서울캠퍼스 노천극장',
      event_date: '2026-05-21',
      start_time: '14:00:00',
      end_time: '23:00:00',
      description: '한양대학교 봄 대동제 라치오스',
      thumbnail_url: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=400&q=80',
      badge_label: 'D-30',
      is_hot: false,
      is_active: true,
      view_count: 9200
    },
    {
      event_name: '중앙대학교 봄 대동제 LUCAUS 2026',
      category: '대학축제',
      venue: '중앙대학교 서울캠퍼스 흑석동',
      event_date: '2026-05-28',
      start_time: '12:00:00',
      end_time: '22:00:00',
      description: '청룡의 함성, 중앙대 흑석캠퍼스 대동제',
      thumbnail_url: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=400&q=80',
      badge_label: '신규',
      is_hot: true,
      is_active: true,
      view_count: 6700
    },
    {
      event_name: '부산대학교 대동제 2026',
      category: '대학축제',
      venue: '부산대학교 넉넉한터',
      event_date: '2026-05-18',
      start_time: '16:00:00',
      end_time: '22:00:00',
      description: '부산 지역 최대 규모의 대학 축제',
      thumbnail_url: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=400&q=80',
      badge_label: '',
      is_hot: false,
      is_active: true,
      view_count: 5100
    },
    {
      event_name: '경북대학교 대동제 2026',
      category: '대학축제',
      venue: '경북대학교 대운동장',
      event_date: '2026-05-22',
      start_time: '17:00:00',
      end_time: '23:00:00',
      description: '대구/경북 지역 대표 대학축제',
      thumbnail_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=400&q=80',
      badge_label: '',
      is_hot: false,
      is_active: true,
      view_count: 4800
    },
    {
      event_name: '전남대학교 용봉대동풀이 2026',
      category: '대학축제',
      venue: '전남대학교 광주캠퍼스 보조운동장',
      event_date: '2026-09-25',
      start_time: '15:00:00',
      end_time: '22:00:00',
      description: '가을 밤을 수놓는 광주 전남대 대동풀이',
      thumbnail_url: 'https://images.unsplash.com/photo-1493225457124-a1a2a5f5f92b?auto=format&fit=crop&w=400&q=80',
      badge_label: '가을축제',
      is_hot: false,
      is_active: true,
      view_count: 3200
    },
    {
      event_name: '2026 프로야구 개막전 (LG 트윈스 vs KT 위즈)',
      category: '스포츠',
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
      category: '스포츠',
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
