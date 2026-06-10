package festival.support.service;

import festival.festival.domain.Festival;
import festival.festival.repository.FestivalRepository;
import festival.support.domain.PartnerInquiryVo;
import festival.festival.domain.FestivalZone;
import festival.festival.repository.FestivalZoneRepository;
import festival.support.repository.PartnerInquiryRepository;
import festival.order.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PartnerInquiryService {

    private final PartnerInquiryRepository repo;
    private final FestivalRepository festivalRepository;
    private final StoreRepository storeRepository;
    private final FestivalZoneRepository festivalZoneRepository;

    /** 전체 문의 목록 */
    public List<PartnerInquiryVo> getAll() {
        return repo.findAllByOrderByCreatedAtDesc();
    }

    /** 행사별 + 상태별 필터 조회 */
    public List<PartnerInquiryVo> getFiltered(Long festivalId, String status) {
        if (festivalId != null && status != null && !status.isBlank()) {
            return repo.findByFestivalIdAndStatusOrderByCreatedAtDesc(festivalId, status);
        } else if (festivalId != null) {
            return repo.findByFestivalIdOrderByCreatedAtDesc(festivalId);
        } else if (status != null && !status.isBlank()) {
            return repo.findByStatusOrderByCreatedAtDesc(status);
        }
        return repo.findAllByOrderByCreatedAtDesc();
    }

    /** 신규 문의 저장 (프론트엔드 폼 제출) */
    @Transactional
    public PartnerInquiryVo create(PartnerInquiryVo vo) {
        PartnerInquiryVo saved = repo.save(vo);

        // 만약 문의 유형이 'EVENT' (행사 제휴) 인 경우, 축제 테이블에 심사 대기(PENDING) 상태로 자동 입고!
        if ("EVENT".equalsIgnoreCase(vo.getInquiryType())) {
            Festival newFestival = Festival.builder()
                    .name(vo.getCompanyName()) // 신청 업체명/행사명을 축제 명칭으로 사용
                    .category("대학축제") // 기본값 매핑
                    .venue("장소 미정 (입점 제휴 검토 중)")
                    .minPrice(0L)
                    .startDate(java.time.LocalDate.now().plusMonths(2)) // 기본 개최일 자동 연장 (2개월 뒤)
                    .endDate(java.time.LocalDate.now().plusMonths(2).plusDays(2))
                    .startTime("13:00")
                    .endTime("22:00")
                    .thumbnailUrl("https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80")
                    .agency(vo.getCompanyName())
                    .reviewStatus("PENDING")
                    .operationalStatus("UPCOMING")
                    .isActive(false)
                    .proposalFileUrl(vo.getFilePath1()) // 행사 기획서 PDF 파일 경로 매핑
                    .companyIntroUrl(vo.getFilePath2()) // 회사 소개서 PDF 파일 경로 매핑
                    .build();
            festivalRepository.save(newFestival);
        }

        return saved;
    }

    /** 상태 변경 (PENDING → APPROVED | REJECTED) */
    @Transactional
    public PartnerInquiryVo updateStatus(Long id, String newStatus) {
        PartnerInquiryVo inquiry = repo.findById(id)
                .orElseThrow(() -> new RuntimeException("신청서를 찾을 수 없습니다: " + id));

        String oldStatus = inquiry.getStatus();
        inquiry.setStatus(newStatus);
        PartnerInquiryVo updated = repo.save(inquiry);

        // PENDING 상태에서 APPROVED 상태로 최종 승인 전환되는 시점에만 작동 (중복 입력 방지)
        if ("APPROVED".equalsIgnoreCase(newStatus) && !"APPROVED".equalsIgnoreCase(oldStatus)) {
            String type = inquiry.getInquiryType();

            // FOODTRUCK(먹거리) 또는 GOODS(기획상품) 입점신청인 경우 store 테이블에 자동 삽입!
            if ("FOODTRUCK".equalsIgnoreCase(type) || "GOODS".equalsIgnoreCase(type)) {
                String category = "GOODS";
                if ("FOODTRUCK".equalsIgnoreCase(type)) {
                    category = "FOOD";
                }

                // 구역 정보 조회 (기본 fallback: 1L)
                Long zoneId = 1L;
                if (inquiry.getFestivalId() != null) {
                    List<FestivalZone> zones = festivalZoneRepository.findByFestivalId(inquiry.getFestivalId());
                    if (zones != null && !zones.isEmpty()) {
                        zoneId = zones.get(0).getId();
                    }
                }

                festival.order.domain.StoreEntity newStore = festival.order.domain.StoreEntity.builder()
                        .name(inquiry.getCompanyName())
                        .category(category)
                        .festivalId(inquiry.getFestivalId()) // 신청서에 매핑된 행사 ID 연동
                        .zoneId(zoneId)
                        .mapXPercent(0.0)
                        .mapYPercent(0.0)
                        .operatingHours("10:00 - 22:00 (행사 진행 기간 운영)")
                        .isOpen(true)
                        .build();

                storeRepository.save(newStore);
            }
        }

        return updated;
    }
}
