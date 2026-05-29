package festival.order.controller;

import festival.order.domain.OrderEntity;
import festival.order.service.OrderService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/fnb")
public class FnbController {

    private final OrderService orderService;

    // 생성자 주입 방식으로 Service 연결
    public FnbController(OrderService orderService) {
        this.orderService = orderService;
    }

    /**
     * F&B 식음료 신규 등록 폼 요청을 처리하는 엔드포인트
     */
    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> registerFood(
            @RequestParam(value = "foodImage", required = false) MultipartFile foodImage,
            @RequestParam("foodName") String foodName,
            @RequestParam("price") Integer price) {

        // 1. 이미지 파일명 추출
        String imageUrl = "";
        if (foodImage != null && !foodImage.isEmpty()) {
            imageUrl = foodImage.getOriginalFilename();
        }

        // 2. Service의 registerFood 메서드를 호출하여 실제 DB 저장을 위임
        OrderEntity savedFood = orderService.registerFood(foodName, price, imageUrl);

        // 3. 클라이언트에게 반환할 성공 응답 구성
        Map<String, Object> response = new HashMap<>();
        response.put("status", "success");
        response.put("message", "F&B 식음료 신규 등록이 성공적으로 완료되었습니다.");
        
        Map<String, Object> data = new HashMap<>();
        data.put("id", savedFood.getId());
        data.put("productType", savedFood.getProductType());
        data.put("productName", savedFood.getProductName());
        data.put("price", savedFood.getPrice());
        
        response.put("data", data);

        return ResponseEntity.ok(response);
    }
}
