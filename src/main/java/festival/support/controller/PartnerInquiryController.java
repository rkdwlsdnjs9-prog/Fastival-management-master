package festival.support.controller;

import festival.support.domain.PartnerInquiryVo;
import festival.support.service.PartnerInquiryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

/**
 * 파트너 제휴·입점 문의 REST API 컨트롤러
 *
 * GET  /api/partner/inquiry               → 전체 조회
 * GET  /api/partner/inquiry?festivalId=1&status=PENDING → 필터 조회
 * POST /api/partner/inquiry               → 신규 문의 저장
 * PUT  /api/partner/inquiry/{id}/status   → 상태 변경 (관리자)
 */
@RestController
@RequestMapping("/api/partner/inquiry")
@RequiredArgsConstructor
@CrossOrigin
public class PartnerInquiryController {

    private final PartnerInquiryService service;

    /** 목록 조회 (행사ID, 상태 필터 선택적) */
    @GetMapping
    public ResponseEntity<List<PartnerInquiryVo>> getInquiries(
            @RequestParam(required = false) Long festivalId,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(service.getFiltered(festivalId, status));
    }

    /** 신규 문의 접수 (프론트엔드 폼 제출 - Multipart 데이터 대응) */
    @PostMapping(consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PartnerInquiryVo> create(
            @ModelAttribute PartnerInquiryVo vo,
            @RequestParam(value = "fileEvent", required = false) org.springframework.web.multipart.MultipartFile fileEvent,
            @RequestParam(value = "fileFoodtruckLicense", required = false) org.springframework.web.multipart.MultipartFile fileFoodtruckLicense,
            @RequestParam(value = "fileFoodtruckMenu", required = false) org.springframework.web.multipart.MultipartFile fileFoodtruckMenu,
            @RequestParam(value = "fileGoodsLicense", required = false) org.springframework.web.multipart.MultipartFile fileGoodsLicense,
            @RequestParam(value = "fileGoodsMenu", required = false) org.springframework.web.multipart.MultipartFile fileGoodsMenu) {
        
        // 업로드된 파일의 파일명을 추출하여 엔티티 필드에 매핑
        if (fileEvent != null && !fileEvent.isEmpty()) {
            vo.setFilePath1(fileEvent.getOriginalFilename());
        } else if (fileFoodtruckLicense != null && !fileFoodtruckLicense.isEmpty()) {
            vo.setFilePath1(fileFoodtruckLicense.getOriginalFilename());
            if (fileFoodtruckMenu != null && !fileFoodtruckMenu.isEmpty()) {
                vo.setFilePath2(fileFoodtruckMenu.getOriginalFilename());
            }
        } else if (fileGoodsLicense != null && !fileGoodsLicense.isEmpty()) {
            vo.setFilePath1(fileGoodsLicense.getOriginalFilename());
            if (fileGoodsMenu != null && !fileGoodsMenu.isEmpty()) {
                vo.setFilePath2(fileGoodsMenu.getOriginalFilename());
            }
        }

        return ResponseEntity.ok(service.create(vo));
    }

    /** 상태 변경 — 관리자 전용 (PENDING → APPROVED | REJECTED) */
    @PutMapping("/{id}/status")
    public ResponseEntity<PartnerInquiryVo> updateStatus(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        String newStatus = body.get("status");
        return ResponseEntity.ok(service.updateStatus(id, newStatus));
    }
}
