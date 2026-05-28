package festival.festival.repository;

import festival.festival.domain.FestivalVo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

/**
 * Festival 도메인의 데이터베이스 접근 JPA 레포지토리 인터페이스입니다.
 */
@Repository
public interface FestivalRepository extends JpaRepository<FestivalVo, Long> {
    
    /**
     * ID 역순으로(최신 등록 순서) 전체 페스티벌 목록을 조회합니다.
     */
    List<FestivalVo> findAllByOrderByIdDesc();
}
