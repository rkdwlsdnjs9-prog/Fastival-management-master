package festival.festival.controller;

import festival.festival.domain.FestivalVo;
import festival.festival.service.FestivalService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

/**
 * Festival 도메인의 REST API 컨트롤러 클래스입니다.
 * 프론트엔드 화면과 실제 Supabase PostgreSQL DB를 유기적으로 동기화합니다.
 */
@RestController
@RequestMapping("/api/festival")
@RequiredArgsConstructor
public class FestivalController {

    private final FestivalService festivalService;

    /**
     * 전체 페스티벌 마스터 목록을 최신 순서로 조회합니다.
     * GET /api/festival
     */
    @GetMapping
    public ResponseEntity<List<FestivalVo>> getAllFestivals() {
        return ResponseEntity.ok(festivalService.getAllFestivals());
    }

    /**
     * 새로운 페스티벌을 등록합니다.
     * POST /api/festival
     */
    @PostMapping
    public ResponseEntity<FestivalVo> createFestival(@RequestBody FestivalVo festivalVo) {
        FestivalVo savedFestival = festivalService.createFestival(festivalVo);
        return ResponseEntity.ok(savedFestival);
    }

    /**
     * 특정 페스티벌의 활성화 상태(is_active)를 토글합니다.
     * PUT /api/festival/{id}/toggle
     */
    @PutMapping("/{id}/toggle")
    public ResponseEntity<FestivalVo> toggleActive(@PathVariable("id") Long id) {
        FestivalVo updatedFestival = festivalService.toggleActive(id);
        return ResponseEntity.ok(updatedFestival);
    }

    /**
     * 특정 페스티벌 마스터 데이터를 DB에서 영구 삭제합니다.
     * DELETE /api/festival/{id}
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteFestival(@PathVariable("id") Long id) {
        festivalService.deleteFestival(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * 특정 페스티벌의 심사 상태 및 운영 단계를 변경합니다.
     * PATCH /api/festival/{id}/status
     */
    @PatchMapping("/{id}/status")
    public ResponseEntity<FestivalVo> updateStatus(
            @PathVariable("id") Long id,
            @RequestBody java.util.Map<String, String> statusMap) {
        String reviewStatus = statusMap.get("reviewStatus");
        String operationalStatus = statusMap.get("operationalStatus");
        FestivalVo updatedFestival = festivalService.updateStatus(id, reviewStatus, operationalStatus);
        return ResponseEntity.ok(updatedFestival);
    }
}
