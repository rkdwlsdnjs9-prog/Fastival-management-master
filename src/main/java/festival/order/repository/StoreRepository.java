package festival.order.repository;

import festival.order.domain.StoreEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StoreRepository extends JpaRepository<StoreEntity, Long> {

    // 특정 구역(zone_id)에 속한 상점 조회
    List<StoreEntity> findByZoneId(Long zoneId);

    // 특정 축제(festival_id)에 연결된 상점들 조회
    List<StoreEntity> findByFestivalId(Long festivalId);
}
