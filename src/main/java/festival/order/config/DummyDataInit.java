package festival.order.config;

import festival.order.service.ProductService;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DummyDataInit {

    @Bean
    public CommandLineRunner initDatabase(ProductService productService) {
        return args -> {
            System.out.println("==================================================");
            System.out.println("   [테스트] Supabase DB에 더미 데이터 주입을 시작합니다...");
            System.out.println("==================================================");

            try {
                // 굿즈(GOODS) 더미 데이터 생성
                productService.registerGoods("페스티벌 공식 야광봉", 15000, 100, "lightstick.png");
                productService.registerGoods("2026 한정판 후드티", 45000, 50, "hoodie.png");

                // 식음료(FOOD) 더미 데이터 생성
                productService.registerFood("매콤달콤 닭강정", 12000, "chicken.png");
                productService.registerFood("시원한 얼음 생맥주", 5000, "beer.png");

                System.out.println(">> 데이터 주입 성공! Supabase의 'order_item' 테이블을 확인해주세요.");
            } catch (Exception e) {
                System.out.println(">> 데이터 주입 실패: " + e.getMessage());
                e.printStackTrace();
            }
        };
    }
}
