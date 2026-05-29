package festival.support.domain;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * 파트너 제휴·입점 문의 엔티티 (partner_inquiry 테이블)
 * festival_id 외래키로 특정 행사와 연결됩니다.
 */
@Entity
@Table(name = "partner_inquiry")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PartnerInquiryVo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 연결된 행사 ID (festival 테이블 외래키) */
    @Column(name = "festival_id")
    private Long festivalId;

    /** 문의 유형: EVENT | FOODTRUCK | GOODS */
    @Column(name = "inquiry_type", nullable = false, length = 20)
    private String inquiryType;

    /** 업체명 / 브랜드명 */
    @Column(name = "company_name", nullable = false, length = 100)
    private String companyName;

    /** 담당자 성함 */
    @Column(name = "manager_name", nullable = false, length = 50)
    private String managerName;

    /** 연락처 */
    @Column(nullable = false, length = 20)
    private String phone;

    /** 이메일 */
    @Column(nullable = false, length = 100)
    private String email;

    /** 상세 문의 내용 */
    @Column(columnDefinition = "TEXT")
    private String content;

    /** 심사 상태: PENDING | APPROVED | REJECTED */
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "PENDING";

    @Column(name = "file_path_1", length = 255)
    private String filePath1;

    @Column(name = "file_path_2", length = 255)
    private String filePath2;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        if (this.status == null) this.status = "PENDING";
    }
}
