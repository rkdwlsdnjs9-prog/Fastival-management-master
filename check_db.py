import psycopg2

try:
    conn = psycopg2.connect(
        host="aws-1-ap-northeast-1.pooler.supabase.com",
        port="6543",
        database="postgres",
        user="postgres.loqsekbplftdjphzewmx",
        password="naver.com1!"
    )
    cursor = conn.cursor()
    cursor.execute("SELECT name, price, product_type FROM product ORDER BY id DESC LIMIT 5;")
    rows = cursor.fetchall()
    
    print("--- [ 최근 등록된 product 확인 ] ---")
    if len(rows) == 0:
        print("데이터가 없습니다.")
    else:
        for row in rows:
            print(f"- 이름: {row[0]}, 가격: {row[1]}, 타입: {row[2]}")
            
    conn.close()
except Exception as e:
    print("DB 오류:", e)
