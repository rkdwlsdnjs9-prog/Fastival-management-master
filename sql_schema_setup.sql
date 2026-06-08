-- Supabase용 찜목록 및 장바구니 테이블 생성 스키마

-- 1. 찜목록 (Wishlist) 테이블 생성
CREATE TABLE IF NOT EXISTS wishlists (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    event_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, event_id)
);

-- 2. 장바구니 (Cart) 테이블 생성
CREATE TABLE IF NOT EXISTS cart_items (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    event_id VARCHAR(255) NOT NULL,
    zone_name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    price INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_wishlists_user_id ON wishlists (user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items (user_id);
