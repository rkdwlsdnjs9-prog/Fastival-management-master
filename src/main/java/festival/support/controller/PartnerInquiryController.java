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
        
        // 업로드된 파일의 물리적 디렉토리 저장 및 엔티티 필드에 매핑
        try {
            if (fileEvent != null && !fileEvent.isEmpty()) {
                String path = festival.order.util.FileUploadUtil.saveFile("uploads", fileEvent);
                vo.setFilePath1(path);
            } else if (fileFoodtruckLicense != null && !fileFoodtruckLicense.isEmpty()) {
                String path = festival.order.util.FileUploadUtil.saveFile("uploads", fileFoodtruckLicense);
                vo.setFilePath1(path);
                if (fileFoodtruckMenu != null && !fileFoodtruckMenu.isEmpty()) {
                    String path2 = festival.order.util.FileUploadUtil.saveFile("uploads", fileFoodtruckMenu);
                    vo.setFilePath2(path2);
                }
            } else if (fileGoodsLicense != null && !fileGoodsLicense.isEmpty()) {
                String path = festival.order.util.FileUploadUtil.saveFile("uploads", fileGoodsLicense);
                vo.setFilePath1(path);
                if (fileGoodsMenu != null && !fileGoodsMenu.isEmpty()) {
                    String path2 = festival.order.util.FileUploadUtil.saveFile("uploads", fileGoodsMenu);
                    vo.setFilePath2(path2);
                }
            }
        } catch (java.io.IOException e) {
            e.printStackTrace();
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
