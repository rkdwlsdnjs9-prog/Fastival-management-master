package festival.support.repository;

import festival.support.domain.PartnerInquiryVo;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PartnerInquiryRepository extends JpaRepository<PartnerInquiryVo, Long> {

    /** 전체 목록 조회 */
    List<PartnerInquiryVo> findAllByOrderByCreatedAtDesc();

    /** 행사별 조회 */
    List<PartnerInquiryVo> findByFestivalIdOrderByCreatedAtDesc(Long festivalId);

    /** 행사별 + 상태별 조회 */
    List<PartnerInquiryVo> findByFestivalIdAndStatusOrderByCreatedAtDesc(Long festivalId, String status);

    /** 상태별 조회 */
    List<PartnerInquiryVo> findByStatusOrderByCreatedAtDesc(String status);
}
