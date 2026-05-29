package festival.order.service;

import festival.order.domain.OrderEntity;
import festival.order.repository.OrderRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class OrderService {

    private final OrderRepository orderRepository;

    // 생성자 주입 방식으로 의존성 주입
    public OrderService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    /**
     * 1. 굿즈 신규 등록 로직
     */
    @Transactional
    public OrderEntity registerGoods(String productName, Integer price, Integer initialStock, String imageUrl) {
        // 엔티티 객체(포장 상자) 생성. 굿즈이므로 "GOODS" 타입 지정
        OrderEntity newGoods = new OrderEntity("GOODS", productName, price, initialStock, imageUrl);
        
        // Repository를 통해 DB에 저장
        return orderRepository.save(newGoods);
    }

    /**
     * 2. 식음료(F&B) 신규 등록 로직
     */
    @Transactional
    public OrderEntity registerFood(String foodName, Integer price, String imageUrl) {
        // 식음료는 재고 관리를 따로 하지 않으므로 0을 임의로 넣습니다.
        // 타입은 "FOOD"로 지정
        OrderEntity newFood = new OrderEntity("FOOD", foodName, price, 0, imageUrl);
        
        // DB에 저장
        return orderRepository.save(newFood);
    }

    /**
     * 3. 굿즈 목록 전체 조회 로직
     */
    @Transactional(readOnly = true)
    public List<OrderEntity> getGoodsList() {
        return orderRepository.findByProductType("GOODS");
    }

    /**
     * 4. 식음료(F&B) 목록 전체 조회 로직
     */
    @Transactional(readOnly = true)
    public List<OrderEntity> getFoodList() {
        return orderRepository.findByProductType("FOOD");
    }
}
