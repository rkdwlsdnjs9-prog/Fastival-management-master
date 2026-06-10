package festival.festival.repository;

import festival.festival.domain.FestivalZone;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FestivalZoneRepository extends JpaRepository<FestivalZone, Long> {
    List<FestivalZone> findByFestivalId(Long festivalId);
}
