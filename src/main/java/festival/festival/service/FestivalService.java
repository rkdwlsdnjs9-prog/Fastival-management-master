package festival.festival.service;

import festival.festival.domain.FestivalVo;
import festival.festival.repository.FestivalRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

/**
 * Festival 도메인의 비즈니스 로직을 처리하는 서비스 클래스입니다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class FestivalService {

    private final FestivalRepository festivalRepository;

    /**
     * 모든 페스티벌 목록을 조회합니다. 최신 등록 순서대로 조회됩니다.
     */
    public List<FestivalVo> getAllFestivals() {
        return festivalRepository.findAllByOrderByIdDesc();
    }

    /**
     * 신규 페스티벌을 등록합니다.
     */
    @Transactional
    public FestivalVo createFestival(FestivalVo festival) {
        return festivalRepository.save(festival);
    }

    /**
     * 특정 페스티벌의 활성화 상태(is_active)를 토글합니다.
     */
    @Transactional
    public FestivalVo toggleActive(Long id) {
        FestivalVo festival = festivalRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 페스티벌 ID입니다: " + id));
        festival.setIsActive(!festival.getIsActive());
        return festival;
    }

    /**
     * 특정 페스티벌 데이터를 영구적으로 삭제합니다.
     */
    @Transactional
    public void deleteFestival(Long id) {
        if (!festivalRepository.existsById(id)) {
            throw new IllegalArgumentException("존재하지 않는 페스티벌 ID입니다: " + id);
        }
        festivalRepository.deleteById(id);
    }
}
