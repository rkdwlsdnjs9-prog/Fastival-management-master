package festival.festival.service;

import festival.festival.entity.CartItem;
import festival.festival.repository.CartItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CartService {

    private final CartItemRepository cartItemRepository;

    public List<CartItem> getCartItems(String userId) {
        return cartItemRepository.findByUserId(userId);
    }

    @Transactional
    public CartItem addCartItem(String userId, String eventId, String zoneName, int quantity, int price) {
        CartItem item = new CartItem();
        item.setUserId(userId);
        item.setEventId(eventId);
        item.setZoneName(zoneName);
        item.setQuantity(quantity);
        item.setPrice(price);
        return cartItemRepository.save(item);
    }

    @Transactional
    public CartItem updateCartItemQuantity(Long cartItemId, int quantity) {
        CartItem item = cartItemRepository.findById(cartItemId)
                .orElseThrow(() -> new IllegalArgumentException("Invalid cart item ID"));
        item.setQuantity(quantity);
        return cartItemRepository.save(item);
    }

    @Transactional
    public void removeCartItem(Long cartItemId) {
        cartItemRepository.deleteById(cartItemId);
    }
}
