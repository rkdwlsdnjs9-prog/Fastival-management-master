import psycopg2

try:
    # Supabase PostgreSQL 연결
    conn = psycopg2.connect(
        host="aws-1-ap-northeast-1.pooler.supabase.com",
        port="6543",
        database="postgres",
        user="postgres.loqsekbplftdjphzewmx",
        password="naver.com1!"
    )
    cursor = conn.cursor()
    
    # orders 테이블 구조 조회
    print("--- [ orders 테이블 구조 확인 ] ---")
    cursor.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'orders';")
    rows = cursor.fetchall()
    
    if len(rows) == 0:
        print("orders 테이블이 아직 생성되지 않았거나 찾을 수 없습니다.")
    else:
        for row in rows:
            print(f"- 컬럼명: {row[0].ljust(20)} | 타입: {row[1]}")
            
    conn.close()
except Exception as e:
    print("DB 연결 오류:", e)
