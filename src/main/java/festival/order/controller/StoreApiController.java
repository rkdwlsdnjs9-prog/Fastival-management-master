package festival.order.controller;

import festival.order.domain.ProductEntity;
import festival.order.domain.StoreEntity;
import festival.order.service.ProductService;
import festival.order.service.StoreService;
import festival.festival.domain.FestivalZoneEntity;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/stores")
public class StoreApiController {

    private final StoreService storeService;
    private final ProductService productService;

    public StoreApiController(StoreService storeService, ProductService productService) {
        this.storeService = storeService;
        this.productService = productService;
    }

    /**
     * 특정 행사(festivalId)에 참여하는 상점 목록 조회
     */
    @GetMapping
    public ResponseEntity<List<StoreEntity>> getStoresByFestival(
            @RequestParam(value = "festivalId", required = false) Long festivalId) {
        
        if (festivalId == null) {
            return ResponseEntity.ok(storeService.getAllStores());
        }
        
        List<StoreEntity> stores = storeService.getStoresByFestival(festivalId);
        return ResponseEntity.ok(stores);
    }

    /**
     * 특정 행사의 구역(Zone) 목록 조회 (상점 구역 배치를 위한 드롭다운 소스)
     */
    @GetMapping("/zones")
    public ResponseEntity<List<FestivalZoneEntity>> getZonesByFestival(@RequestParam("festivalId") Long festivalId) {
        List<FestivalZoneEntity> zones = storeService.getZonesByFestival(festivalId);
        return ResponseEntity.ok(zones);
    }

    /**
     * 상점 배치 정보(구역 및 부스 번호) 업데이트
     */
    @PutMapping("/{id}/placement")
    public ResponseEntity<Map<String, Object>> updateStorePlacement(
            @PathVariable("id") Long id,
            @RequestBody Map<String, Object> payload) {
        
        Long zoneId = null;
        if (payload.get("zoneId") != null && !payload.get("zoneId").toString().isEmpty()) {
            zoneId = Long.valueOf(payload.get("zoneId").toString());
        }
        
        String boothNumber = payload.get("boothNumber") != null ? payload.get("boothNumber").toString() : "";

        StoreEntity updated = storeService.updateStoreZoneAndBooth(id, zoneId, boothNumber);

        Map<String, Object> response = new HashMap<>();
        response.put("status", "success");
        response.put("message", "구역 배치 정보가 성공적으로 업데이트되었습니다.");
        response.put("data", updated);

        return ResponseEntity.ok(response);
    }

    /**
     * 특정 상점의 상세 상품/메뉴 목록 조회
     */
    @GetMapping("/{id}/products")
    public ResponseEntity<List<ProductEntity>> getStoreProducts(@PathVariable("id") Long id) {
        List<ProductEntity> products = productService.getProductsByStore(id);
        return ResponseEntity.ok(products);
    }
}
