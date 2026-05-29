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
@RequestMapping("/api/goods")
public class GoodsController {

    private final OrderService orderService;

    // 생성자 주입 방식으로 Service 연결
    public GoodsController(OrderService orderService) {
        this.orderService = orderService;
    }

    /**
     * 굿즈 신규 등록 폼 요청을 처리하는 엔드포인트
     */
    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> registerGoods(
            @RequestParam(value = "productImage", required = false) MultipartFile productImage,
            @RequestParam("productName") String productName,
            @RequestParam("price") Integer price,
            @RequestParam("initialStock") Integer initialStock) {

        // 1. 이미지 파일명 추출 (실제 파일 업로드 처리 로직은 아직 배제됨)
        String imageUrl = "";
        if (productImage != null && !productImage.isEmpty()) {
            imageUrl = productImage.getOriginalFilename();
        }

        // 2. Service의 registerGoods 메서드를 호출하여 실제 DB 저장을 위임
        OrderEntity savedGoods = orderService.registerGoods(productName, price, initialStock, imageUrl);

        // 3. 클라이언트에게 반환할 성공 응답 구성
        Map<String, Object> response = new HashMap<>();
        response.put("status", "success");
        response.put("message", "굿즈 신규 등록이 성공적으로 완료되었습니다.");
        
        Map<String, Object> data = new HashMap<>();
        data.put("id", savedGoods.getId());
        data.put("productType", savedGoods.getProductType());
        data.put("productName", savedGoods.getProductName());
        data.put("price", savedGoods.getPrice());
        data.put("availableStock", savedGoods.getAvailableStock());
        
        response.put("data", data);

        return ResponseEntity.ok(response);
    }
}
