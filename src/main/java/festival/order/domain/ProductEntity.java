package festival.order.domain;

import jakarta.persistence.*;

@Entity
@Table(name = "product") // 실제 재고 관리 테이블인 product로 매핑
public class ProductEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id; // 식별번호

    // DB의 'store_id' 컬럼과 매핑 (NOT NULL constraint 해결을 위해 기본값 1L 할당)
    @Column(name = "store_id", nullable = false)
    private Long storeId = 1L;

    // 기존 product 테이블에 없으므로 자동 추가될 컬럼 (기존 데이터와 충돌 방지를 위해 nullable=false 제거)
    @Column(name = "product_type", length = 20)
    private String productType; // 상품유형 (예: GOODS, FOOD)

    // DB의 'name' 컬럼과 매핑
    @Column(name = "name", nullable = false)
    private String productName; // 상품명

    // DB의 'price' 컬럼과 매핑
    @Column(nullable = false)
    private Integer price; // 판매가

    // DB의 'total_stock' 컬럼과 매핑
    @Column(name = "total_stock")
    private Integer currentStock; // 현재(총) 재고수량

    // DB의 'reserved_stock' 컬럼과 매핑
    @Column(name = "reserved_stock")
    private Integer preAllocatedStock = 0; // 가선점 재고

    // DB의 'available_stock' 컬럼과 매핑
    @Column(name = "available_stock")
    private Integer availableStock; // 가용 재고수량

    @Column(name = "image_url", columnDefinition = "TEXT")
    private String imageUrl; // 이미지 주소

    @Column(name = "status", length = 20)
    private String status; // 판매 상태 (ON_SALE, SOLD_OUT 등)

    @Column(name = "is_soldout")
    private Boolean isSoldout = false;

    @Column(name = "is_representative")
    private Boolean isRepresentative = false;

    @Column(name = "option_groups_json", length = 4000)
    private String optionGroupsJson; // 옵션 그룹 정보 (JSON 문자열)

    // 기본 생성자 (JPA 필수)
    protected ProductEntity() {
    }

    // 데이터 초기화를 위한 생성자
    public ProductEntity(String productType, String productName, Integer price, Integer currentStock, String imageUrl) {
        this.productType = productType;
        this.productName = productName;
        this.price = price;
        this.currentStock = currentStock;
        this.preAllocatedStock = 0;
        this.availableStock = currentStock;
        this.imageUrl = imageUrl;
        this.status = "ON_SALE"; // 기본 상태는 판매중
    }

    // Getters
    public Long getId() { return id; }
    public String getProductType() { return productType; }
    public String getProductName() { return productName; }
    public Integer getPrice() { return price; }
    public Integer getCurrentStock() { return currentStock; }
    public Integer getPreAllocatedStock() { return preAllocatedStock; }
    public Integer getAvailableStock() { return availableStock; }
    public String getImageUrl() { return imageUrl; }
    public String getStatus() { return status; }

    // 비즈니스 로직 예시 (가선점 처리 등)
    public void allocateStock(int quantity) {
        if (this.availableStock == null || this.availableStock - quantity < 0) {
            throw new IllegalArgumentException("가용 재고가 부족합니다.");
        }
        this.preAllocatedStock += quantity;
        this.availableStock = this.currentStock - this.preAllocatedStock;
    }

    // 데이터 수정을 위한 비즈니스 로직
    public void updateProduct(String productName, Integer price, Integer currentStock, String imageUrl) {
        if (productName != null && !productName.isEmpty()) {
            this.productName = productName;
        }
        if (price != null) {
            this.price = price;
        }
        if (currentStock != null) {
            this.currentStock = currentStock;
            this.availableStock = this.currentStock - this.preAllocatedStock;
        }
        if (imageUrl != null && !imageUrl.isEmpty()) {
            this.imageUrl = imageUrl;
        }
    }

    // F&B 식음료 상태 토글 비즈니스 로직 (상태 컬럼 사용)
    public void toggleFnbStatus() {
        if ("SOLD_OUT".equals(this.status)) {
            this.status = "ON_SALE";
            this.isSoldout = false;
        } else {
            this.status = "SOLD_OUT";
            this.isSoldout = true;
        }
    }

    public Boolean getIsSoldout() { return isSoldout != null ? isSoldout : false; }
    public void setIsSoldout(Boolean soldout) { 
        this.isSoldout = soldout; 
        this.status = soldout ? "SOLD_OUT" : "ON_SALE";
    }

    public Boolean getIsRepresentative() { return isRepresentative != null ? isRepresentative : false; }
    public void setIsRepresentative(Boolean representative) { this.isRepresentative = representative; }

    public String getOptionGroupsJson() { return optionGroupsJson; }
    public void setOptionGroupsJson(String optionGroupsJson) { this.optionGroupsJson = optionGroupsJson; }
}
