package festival.order.controller;

import festival.order.domain.ProductEntity;
import festival.order.domain.StoreEntity;
import festival.order.service.ProductService;
import festival.order.service.StoreService;
import festival.festival.domain.FestivalZoneEntity;
import festival.user.domain.UserVo;
import festival.user.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/admin/stores")
public class StoreApiController {

    private final StoreService storeService;
    private final ProductService productService;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public StoreApiController(StoreService storeService, ProductService productService,
                              UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.storeService = storeService;
        this.productService = productService;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
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

    /**
     * 어드민 입점 승인 시 업주(STAFF) 권한 발급 및 계정 정보 반환 API
     */
    @PostMapping("/{id}/staff-credentials")
    public ResponseEntity<Map<String, Object>> issueStaffCredentials(@PathVariable("id") Long id) {
        StoreEntity store = storeService.getStore(id).orElse(null);
        if (store == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "상점 정보를 찾을 수 없습니다."));
        }

        // 임시 이메일과 비밀번호 생성 규칙
        String email = "staff_store" + id + "@fastival.com";
        String rawPassword = "staff" + id + "!";
        String encodedPassword = passwordEncoder.encode(rawPassword);

        // 기존 해당 storeId로 가입된 스탭이 있는지 조회
        Optional<UserVo> existingUser = userRepository.findByStoreId(id);
        UserVo user;

        if (existingUser.isPresent()) {
            user = existingUser.get();
            user.setEmail(email);
            user.setPassword(encodedPassword);
            user.setRole("ROLE_STAFF");
            user.setStatus("ACTIVE");
        } else {
            // 이메일 중복 체크 후 조치
            Optional<UserVo> duplicateEmailUser = userRepository.findByEmail(email);
            if (duplicateEmailUser.isPresent()) {
                user = duplicateEmailUser.get();
                user.setPassword(encodedPassword);
                user.setRole("ROLE_STAFF");
                user.setStatus("ACTIVE");
                user.setStoreId(id);
            } else {
                user = UserVo.builder()
                        .email(email)
                        .password(encodedPassword)
                        .name(store.getName() + " 점주")
                        .phone("010-0000-0000")
                        .role("ROLE_STAFF")
                        .status("ACTIVE")
                        .storeId(id)
                        .membershipGrade("BRONZE")
                        .balance(0)
                        .build();
            }
        }

        userRepository.save(user);

        Map<String, Object> response = new HashMap<>();
        response.put("status", "success");
        response.put("email", email);
        response.put("password", rawPassword);
        response.put("storeName", store.getName());

        return ResponseEntity.ok(response);
    }
}
