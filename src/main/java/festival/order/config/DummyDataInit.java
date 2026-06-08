package festival.order.config;

import festival.order.service.ProductService;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DummyDataInit {

    @Bean
    public CommandLineRunner initDatabase(ProductService productService, org.springframework.jdbc.core.JdbcTemplate jdbcTemplate) {
        return args -> {
            System.out.println("==================================================");
            System.out.println("   [데이터 초기화] 현재 데이터 주입/삭제 기능은 비활성화되어 있습니다...");
            System.out.println("   [데이터베이스 스키마 업데이트] orders 테이블에 qr_code, is_entered, ticket_type 속성 추가 시도 중...");
            try {
                jdbcTemplate.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS qr_code VARCHAR(255) UNIQUE;");
                jdbcTemplate.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_entered BOOLEAN DEFAULT FALSE;");
                jdbcTemplate.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS ticket_type VARCHAR(50);");
                System.out.println("   [데이터베이스 스키마 업데이트] 완료!");
            } catch (Exception e) {
                System.out.println("   [데이터베이스 스키마 업데이트] 실패 (또는 이미 존재함): " + e.getMessage());
            }
            System.out.println("==================================================");
        };
    }
}
