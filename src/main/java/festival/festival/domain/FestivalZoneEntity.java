package festival.festival.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.persistence.*;

@Entity
@Table(name = "festival_zone")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FestivalZoneEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "festival_id", nullable = false)
    private Long festivalId;

    @Column(name = "zone_name", nullable = false, length = 50)
    private String zoneName;

    @Column(name = "svg_points")
    private String svgPoints;

    @Column(name = "safety_limit")
    private Integer safetyLimit;

    @Column(name = "current_crowd_count")
    private Integer currentCrowdCount;

    @Column(name = "density_level")
    private String densityLevel;

    @Column(name = "status")
    private String status;
}
