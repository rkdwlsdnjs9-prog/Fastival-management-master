package festival.order.service;

import festival.order.domain.StoreEntity;
import festival.order.repository.StoreRepository;
import festival.festival.domain.FestivalZone;
import festival.festival.repository.FestivalZoneRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@Transactional(readOnly = true)
public class StoreService {

    private final StoreRepository storeRepository;
    private final FestivalZoneRepository festivalZoneRepository;

    public StoreService(StoreRepository storeRepository, FestivalZoneRepository festivalZoneRepository) {
        this.storeRepository = storeRepository;
        this.festivalZoneRepository = festivalZoneRepository;
    }

    // 행사별 상점 목록 조회
    public List<StoreEntity> getStoresByFestival(Long festivalId) {
        return storeRepository.findByFestivalId(festivalId);
    }

    // 상점 조회
    public Optional<StoreEntity> getStore(Long storeId) {
        return storeRepository.findById(storeId);
    }

    // 상점 구역 및 부스 번호 업데이트
    @Transactional
    public StoreEntity updateStoreZoneAndBooth(Long storeId, Long zoneId, String boothNumber) {
        StoreEntity store = storeRepository.findById(storeId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 가맹점입니다. ID: " + storeId));
        store.setZoneId(zoneId);
        store.setBoothNumber(boothNumber);
        return storeRepository.save(store);
    }

    // 특정 축제의 모든 구역 리스트 조회
    public List<FestivalZone> getZonesByFestival(Long festivalId) {
        return festivalZoneRepository.findByFestivalId(festivalId);
    }
    
    // 전체 상점 조회
    public List<StoreEntity> getAllStores() {
        return storeRepository.findAll();
    }
}
