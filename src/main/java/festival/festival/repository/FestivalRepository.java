package festival.festival.repository;

import festival.festival.domain.FestivalVo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
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

    @Modifying
    @Transactional
    @Query(value = "DELETE FROM review WHERE id = :id", nativeQuery = true)
    void deleteReviewsByFestivalId(@Param("id") Long id);

    @Modifying
    @Transactional
    @Query(value = "DELETE FROM wishlist WHERE id = :id", nativeQuery = true)
    void deleteWishlistsByFestivalId(@Param("id") Long id);

    @Modifying
    @Transactional
    @Query(value = "DELETE FROM orders WHERE id = :id", nativeQuery = true)
    void deleteOrdersByFestivalId(@Param("id") Long id);

    @Modifying
    @Transactional
    @Query(value = "DELETE FROM festival_zone WHERE id = :id", nativeQuery = true)
    void deleteFestivalZonesByFestivalId(@Param("id") Long id);
}
