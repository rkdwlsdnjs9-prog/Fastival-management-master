package festival.order.service;

import festival.order.domain.ProductEntity;
import festival.order.repository.ProductRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ProductService {

    private final ProductRepository productRepository;

    // 생성자 주입 방식으로 의존성 주입
    public ProductService(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    /**
     * 1. 굿즈 신규 등록 로직
     */
    @Transactional
    public ProductEntity registerGoods(String productName, Integer price, Integer initialStock, String imageUrl) {
        // 엔티티 객체(포장 상자) 생성. 굿즈이므로 "GOODS" 타입 지정
        ProductEntity newGoods = new ProductEntity("GOODS", productName, price, initialStock, imageUrl);
        
        // Repository를 통해 DB에 저장
        return productRepository.save(newGoods);
    }

    /**
     * 2. 식음료(F&B) 신규 등록 로직
     */
    @Transactional
    public ProductEntity registerFood(String foodName, Integer price, String imageUrl) {
        // 식음료는 재고 관리를 따로 하지 않으므로 0을 임의로 넣습니다.
        // 타입은 "FOOD"로 지정
        ProductEntity newFood = new ProductEntity("FOOD", foodName, price, 0, imageUrl);
        
        // DB에 저장
        return productRepository.save(newFood);
    }

    /**
     * 3. 굿즈 목록 전체 조회 로직
     */
    @Transactional(readOnly = true)
    public List<ProductEntity> getGoodsList() {
        return productRepository.findByProductType("GOODS");
    }

    /**
     * 4. 식음료(F&B) 목록 전체 조회 로직
     */
    @Transactional(readOnly = true)
    public List<ProductEntity> getFoodList() {
        return productRepository.findByProductType("FOOD");
    }

    /**
     * 5. 상품(굿즈/식음료) 공통 삭제 로직
     */
    @Transactional
    public void deleteProduct(Long id) {
        productRepository.deleteById(id);
    }

    /**
     * 6. 상품(굿즈/식음료) 공통 수정 로직
     */
    @Transactional
    public ProductEntity updateProduct(Long id, String productName, Integer price, Integer currentStock, String imageUrl) {
        ProductEntity product = productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("상품이 존재하지 않습니다. ID: " + id));
        
        product.updateProduct(productName, price, currentStock, imageUrl);
        return product;
    }

    /**
     * 7. F&B 상태 토글 로직
     */
    @Transactional
    public void toggleFnbStatus(Long id) {
        ProductEntity product = productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("상품이 존재하지 않습니다. ID: " + id));
        product.toggleFnbStatus();
    }
}
