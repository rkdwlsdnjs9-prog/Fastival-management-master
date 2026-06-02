package festival.order.repository;

import festival.order.domain.ProductEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * ProductEntity(굿즈, 식음료 통합)의 데이터베이스 접근을 위한 레포지토리 인터페이스입니다.
 */
@Repository
public interface ProductRepository extends JpaRepository<ProductEntity, Long> {

    /**
     * 상품 유형(product_type)을 기준으로 상품 목록을 조회합니다.
     * (예: "GOODS" 전달 시 굿즈만, "FOOD" 전달 시 식음료만 반환)
     */
    List<ProductEntity> findByProductType(String productType);

    /**
     * 가용 재고(available_stock)가 0보다 큰, 즉 현재 구매 가능한 상품들만 조회합니다.
     */
    List<ProductEntity> findByAvailableStockGreaterThan(Integer stock);

    /**
     * 특정 상점/부스 ID(store_id)를 가진 상품 목록을 조회합니다.
     */
    List<ProductEntity> findByStoreId(Long storeId);
}
