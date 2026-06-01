package festival.support.service;

import festival.festival.domain.FestivalVo;
import festival.festival.repository.FestivalRepository;
import festival.support.domain.PartnerInquiryVo;
import festival.support.repository.PartnerInquiryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PartnerInquiryService {

    private final PartnerInquiryRepository repo;
    private final FestivalRepository festivalRepository;

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
            FestivalVo newFestival = FestivalVo.builder()
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
        inquiry.setStatus(newStatus);
        return repo.save(inquiry);
    }
}
