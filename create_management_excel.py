import pandas as pd
import openpyxl

# Goods Table Data
goods_data = [
    ["table name", "goods", "테이블명", "굿즈 상품 재고 관리", "", "", "", "", ""],
    ["설명", "입점 굿즈 상품 및 실시간 재고 수량 관리", "", "", "", "", "", "", ""],
    ["no", "column name", "컬럼명", "type", "length", "제약조건", "정의/설명", "참조테이블", "비고"],
    [1, "id", "식별번호", "BIGINT", "", "PK, NN", "고유 식별자 (자동증가)", "", ""],
    [2, "product_name", "상품명", "VARCHAR", "255", "NN", "상품의 이름", "", ""],
    [3, "price", "판매가", "INT", "", "NN", "상품 판매 가격 (원)", "", ""],
    [4, "initial_stock", "최초 재고수량", "INT", "", "NN", "처음 등록된 전체 수량", "", ""],
    [5, "current_stock", "현재 재고수량", "INT", "", "NN", "물리적으로 남은 전체 재고", "", ""],
    [6, "pre_allocated_stock", "가선점 재고", "INT", "", "NN", "결제 대기 중 선점된 수량", "", "기본값: 0"],
    [7, "available_stock", "가용 재고수량", "INT", "", "NN", "실제 구매 가능 수량(현재-가선점)", "", ""],
    [8, "product_type", "상품유형", "VARCHAR", "20", "NN", "상품의 분류 타입", "", "GOODS 또는 FOOD"],
    [9, "image_url", "이미지 주소", "VARCHAR", "1000", "", "첨부된 상품 이미지 경로/URL", "", ""]
]

# F&B Table Data (기존과 동일하게 유지하거나 필요 시 확장)
fnb_data = [
    ["table name", "fnb_menu", "테이블명", "F&B 식음료 메뉴 관리", "", "", "", "", ""],
    ["설명", "식음료 메뉴 정보 및 재료 소진 상태 관리", "", "", "", "", "", "", ""],
    ["no", "column name", "컬럼명", "type", "length", "제약조건", "정의/설명", "참조테이블", "비고"],
    [1, "id", "메뉴 식별번호", "BIGINT", "", "PK, NN", "식음료 메뉴 고유 식별자 (자동증가)", "", ""],
    [2, "food_name", "메뉴명", "VARCHAR", "255", "NN", "식음료 메뉴 이름", "", ""],
    [3, "price", "가격", "INT", "", "NN", "메뉴 판매 가격 (원)", "", ""],
    [4, "image_url", "이미지 주소", "VARCHAR", "1000", "", "첨부된 메뉴 이미지 경로/URL", "", ""],
    [5, "out_of_stock", "재료소진 여부", "BOOLEAN", "", "NN", "재료 소진으로 인한 판매 불가 상태", "", "기본값: false"]
]

# Write to Excel
file_name = 'inventory_management_tables_v2.xlsx'
with pd.ExcelWriter(file_name, engine='openpyxl') as writer:
    pd.DataFrame(goods_data).to_excel(writer, index=False, header=False, sheet_name='Goods_Table')
    pd.DataFrame(fnb_data).to_excel(writer, index=False, header=False, sheet_name='FnB_Table')
    
    # Auto-adjust column widths
    for sheet_name in ['Goods_Table', 'FnB_Table']:
        worksheet = writer.sheets[sheet_name]
        for idx, col in enumerate(worksheet.columns):
            max_length = 0
            for cell in col:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            worksheet.column_dimensions[openpyxl.utils.get_column_letter(idx + 1)].width = (max_length + 2) * 1.5

print(f"'{file_name}' 파일이 성공적으로 갱신되었습니다.")
