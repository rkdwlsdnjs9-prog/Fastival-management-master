package festival.festival.repository;

import festival.festival.domain.FestivalZoneEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FestivalZoneRepository extends JpaRepository<FestivalZoneEntity, Long> {
    List<FestivalZoneEntity> findByFestivalId(Long festivalId);
}
