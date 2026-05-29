package festival.festival.domain;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Festival 도메인의 JPA 엔티티 객체입니다.
 * Supabase의 festival 테이블 명세와 100% 매칭됩니다.
 */
@Entity
@Table(name = "festival")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FestivalVo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "map_image_url", columnDefinition = "TEXT")
    private String mapImageUrl;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = true, length = 100)
    private String category; // '콘서트/뮤지컬', '지역축제', '대학축제', '박람회', '스포츠'
    @Column(nullable = true, length = 255)
    private String venue; // DCC 대전컨벤션센터 등
    @Column(name = "start_time")
    private String startTime; // ex: "18:00:00"
    @Column(name = "end_time")
    private String endTime; // ex: "23:00:00"
    @Column(name = "min_price")
    private Long minPrice; // 최소 티켓 가격 (ex: 55000)
    @Column(name = "thumbnail_url", columnDefinition = "TEXT")
    private String thumbnailUrl; // 행사 대표 포스터 썸네일 이미지
    @Column(name = "badge_label", length = 50)
    private String badgeLabel; // 'HOT', '신규', '타임세일' 등
    @Column(name = "is_hot")
    private Boolean isHot = false;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        if (this.isActive == null) {
            this.isActive = true;
        }
    }
}
