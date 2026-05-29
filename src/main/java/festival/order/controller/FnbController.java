package festival.order.controller;

import festival.order.domain.ProductEntity;
import festival.order.service.ProductService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/fnb")
public class FnbController {

    private final ProductService productService;

    // 생성자 주입 방식으로 Service 연결
    public FnbController(ProductService productService) {
        this.productService = productService;
    }

    /**
     * F&B 목록 조회 엔드포인트
     */
    @GetMapping("/list")
    public ResponseEntity<List<ProductEntity>> getFoodList() {
        List<ProductEntity> foods = productService.getFoodList();
        return ResponseEntity.ok(foods);
    }

    /**
     * F&B 식음료 신규 등록 폼 요청을 처리하는 엔드포인트
     */
    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> registerFood(
            @RequestParam(value = "foodImage", required = false) MultipartFile foodImage,
            @RequestParam("foodName") String foodName,
            @RequestParam("price") Integer price) {

        // 1. 이미지 실제 파일 저장 (프로젝트 루트의 uploads 폴더)
        String imageUrl = "";
        if (foodImage != null && !foodImage.isEmpty()) {
            try {
                imageUrl = festival.order.util.FileUploadUtil.saveFile("uploads", foodImage);
            } catch (java.io.IOException e) {
                e.printStackTrace();
            }
        }

        // 2. Service의 registerFood 메서드를 호출하여 실제 DB 저장을 위임
        ProductEntity savedFood = productService.registerFood(foodName, price, imageUrl);

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

    /**
     * F&B 삭제 엔드포인트
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> deleteFood(@PathVariable("id") Long id) {
        productService.deleteProduct(id);
        Map<String, String> response = new HashMap<>();
        response.put("message", "삭제되었습니다.");
        return ResponseEntity.ok(response);
    }

    /**
     * F&B 식음료 수정 엔드포인트
     */
    @PutMapping("/{id}")
    public ResponseEntity<Map<String, Object>> updateFood(
            @PathVariable("id") Long id,
            @RequestParam(value = "foodImage", required = false) MultipartFile foodImage,
            @RequestParam(value = "foodName", required = false) String foodName,
            @RequestParam(value = "price", required = false) Integer price) {

        String imageUrl = "";
        if (foodImage != null && !foodImage.isEmpty()) {
            try {
                imageUrl = festival.order.util.FileUploadUtil.saveFile("uploads", foodImage);
            } catch (java.io.IOException e) {
                e.printStackTrace();
            }
        }

        productService.updateProduct(id, foodName, price, null, imageUrl);

        Map<String, Object> response = new HashMap<>();
        response.put("status", "success");
        response.put("message", "F&B 메뉴가 수정되었습니다.");
        return ResponseEntity.ok(response);
    }

    /**
     * F&B 식음료 재료소진 상태 토글 엔드포인트
     */
    @PutMapping("/{id}/toggle-status")
    public ResponseEntity<Map<String, String>> toggleFoodStatus(@PathVariable("id") Long id) {
        productService.toggleFnbStatus(id);
        Map<String, String> response = new HashMap<>();
        response.put("message", "상태가 변경되었습니다.");
        return ResponseEntity.ok(response);
    }
}
