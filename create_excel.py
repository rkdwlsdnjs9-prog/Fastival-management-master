import pandas as pd
import openpyxl

# 테이블 명세서 데이터 구성
data = [
    ["table name", "store", "테이블명", "입점 상점 정보", "", "", "", "", ""],
    ["설명", "입점 상점 정보 관리 (운영시간, 위치 등)", "", "", "", "", "", "", ""],
    ["no", "column name", "컬럼명", "type", "length", "제약조건", "정의/설명", "참조테이블", "비고"],
    [1, "store_no", "상점번호", "INT", "", "PK,NN", "상점 고유 식별자", "", ""],
    [2, "zone_no", "위치(존번호)", "INT", "", "FK", "상점이 위치한 구역(zone) 번호", "zone.zone_no", ""],
    [3, "name", "상점명", "VARCHAR", "100", "NN", "입점 상점의 이름", "", ""],
    [4, "type", "타입", "VARCHAR", "20", "NN", "FOOD 또는 GOODS", "", ""],
    [5, "operating_hours", "운영시간", "VARCHAR", "50", "", "상점 운영 시간 (예: 09:00~18:00)", "", ""]
]

# DataFrame 생성
df = pd.DataFrame(data)

# 엑셀 파일로 저장
file_name = 'store_table_schema.xlsx'
with pd.ExcelWriter(file_name, engine='openpyxl') as writer:
    df.to_excel(writer, index=False, header=False, sheet_name='Schema')
    
    # 워크시트 객체 가져오기
    worksheet = writer.sheets['Schema']
    
    # 열 너비 자동 조절 
    for idx, col in enumerate(worksheet.columns):
        max_length = 0
        column = [cell for cell in col]
        for cell in column:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        adjusted_width = (max_length + 2) * 1.5
        worksheet.column_dimensions[openpyxl.utils.get_column_letter(idx + 1)].width = adjusted_width

print(f"'{file_name}' 파일이 성공적으로 생성되었습니다.")
