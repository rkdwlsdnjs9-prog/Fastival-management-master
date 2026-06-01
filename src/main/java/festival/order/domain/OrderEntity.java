package festival.order.domain;

import jakarta.persistence.*;

@Entity
@Table(name = "order_item") // 재고(order_item) 테이블로 이름 변경
public class OrderEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id; // 식별번호

    @Column(name = "product_type", length = 20)
    private String productType; // 상품유형 (예: GOODS, FOOD)

    @Column(name = "current_stock")
    private Integer currentStock; // 현재 재고수량

    @Column(name = "pre_allocated_stock")
    private Integer preAllocatedStock = 0; // 가선점 재고

    @Column(name = "available_stock")
    private Integer availableStock; // 가용 재고수량

    @Column(name = "image_url", length = 1000)
    private String imageUrl; // 이미지 주소

    // 기본 생성자 (JPA 필수)
    protected OrderEntity() {
    }

    public OrderEntity(String productType, Integer currentStock, String imageUrl) {
        this.productType = productType;
        this.currentStock = currentStock;
        this.preAllocatedStock = 0;
        // 가용 재고는 초기 생성 시 현재 재고와 동일
        this.availableStock = currentStock;
        this.imageUrl = imageUrl;
    }

    // Getters
    public Long getId() { return id; }
    public String getProductType() { return productType; }
    public Integer getCurrentStock() { return currentStock; }
    public Integer getPreAllocatedStock() { return preAllocatedStock; }
    public Integer getAvailableStock() { return availableStock; }
    public String getImageUrl() { return imageUrl; }

    // 비즈니스 로직 예시 (가선점 처리 등)
    public void allocateStock(int quantity) {
        if (this.availableStock == null || this.availableStock - quantity < 0) {
            throw new IllegalArgumentException("가용 재고가 부족합니다.");
        }
        this.preAllocatedStock += quantity;
        this.availableStock = this.currentStock - this.preAllocatedStock;
    }
}
