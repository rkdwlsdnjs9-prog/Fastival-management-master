package festival.festival.domain;

import lombok.*;
import jakarta.persistence.*;

@Entity
@Table(name = "seat_map")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SeatMap {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "zone_id", nullable = false)
    private Long zoneId;

    @Column(name = "seat_row", nullable = false, length = 10)
    private String seatRow;

    @Column(name = "seat_number", nullable = false)
    private Integer seatNumber;

    @Column(nullable = false)
    private Integer price;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "빈자리";

    @Column(name = "is_reserved", nullable = false)
    @Builder.Default
    private Boolean isReserved = false;

    @Version
    @Column(nullable = false)
    @Builder.Default
    private Long version = 0L;
}
