package festival.festival.service;

import festival.festival.entity.WishlistItem;
import festival.festival.repository.WishlistRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class WishlistService {

    private final WishlistRepository wishlistRepository;

    public List<WishlistItem> getWishlists(String userId) {
        return wishlistRepository.findByUserId(userId);
    }

    @Transactional
    public WishlistItem addWishlist(String userId, String eventId) {
        Optional<WishlistItem> existing = wishlistRepository.findByUserIdAndEventId(userId, eventId);
        if (existing.isPresent()) {
            return existing.get();
        }
        WishlistItem item = new WishlistItem();
        item.setUserId(userId);
        item.setEventId(eventId);
        return wishlistRepository.save(item);
    }

    @Transactional
    public void removeWishlist(String userId, String eventId) {
        wishlistRepository.deleteByUserIdAndEventId(userId, eventId);
    }
}
