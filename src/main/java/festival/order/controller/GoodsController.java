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
@RequestMapping("/api/goods")
public class GoodsController {

    private final ProductService productService;

    // 생성자 주입 방식으로 Service 연결
    public GoodsController(ProductService productService) {
        this.productService = productService;
    }

    /**
     * 굿즈 목록 조회 엔드포인트
     */
    @GetMapping("/list")
    public ResponseEntity<List<ProductEntity>> getGoodsList() {
        List<ProductEntity> goods = productService.getGoodsList();
        return ResponseEntity.ok(goods);
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

        // 1. 이미지 실제 파일 저장 (프로젝트 루트의 uploads 폴더)
        String imageUrl = "";
        if (productImage != null && !productImage.isEmpty()) {
            try {
                imageUrl = festival.order.util.FileUploadUtil.saveFile("uploads", productImage);
            } catch (java.io.IOException e) {
                e.printStackTrace();
                // 이미지 업로드 실패시 기본 이미지나 빈 값 처리 가능
            }
        }

        // 2. Service의 registerGoods 메서드를 호출하여 실제 DB 저장을 위임
        ProductEntity savedGoods = productService.registerGoods(productName, price, initialStock, imageUrl);

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

    /**
     * 굿즈 삭제 엔드포인트
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> deleteGoods(@PathVariable("id") Long id) {
        productService.deleteProduct(id);
        Map<String, String> response = new HashMap<>();
        response.put("message", "삭제되었습니다.");
        return ResponseEntity.ok(response);
    }

    /**
     * 굿즈 수정 엔드포인트
     */
    @PutMapping("/{id}")
    public ResponseEntity<Map<String, Object>> updateGoods(
            @PathVariable("id") Long id,
            @RequestParam(value = "productImage", required = false) MultipartFile productImage,
            @RequestParam(value = "productName", required = false) String productName,
            @RequestParam(value = "price", required = false) Integer price,
            @RequestParam(value = "initialStock", required = false) Integer currentStock) {

        String imageUrl = "";
        if (productImage != null && !productImage.isEmpty()) {
            try {
                imageUrl = festival.order.util.FileUploadUtil.saveFile("uploads", productImage);
            } catch (java.io.IOException e) {
                e.printStackTrace();
            }
        }

        productService.updateProduct(id, productName, price, currentStock, imageUrl);

        Map<String, Object> response = new HashMap<>();
        response.put("status", "success");
        response.put("message", "굿즈가 수정되었습니다.");
        return ResponseEntity.ok(response);
    }
}
