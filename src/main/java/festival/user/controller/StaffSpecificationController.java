package festival.user.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * 입점사 점주 및 현장 스태프 전용 독립 포털(Staff Portal) 뷰 라우팅 컨트롤러
 * 어드민 관리 영역과 완전히 격리된 단독 라우터를 설계하여 스탭 기능 보안 검증의 뼈대를 완성합니다.
 */
@Controller
public class StaffSpecificationController {

    /**
     * 점포 설정 및 영업 관리 뷰 라우팅
     */
    @GetMapping("/features/payment/staff/store-management")
    public String storeManagement() {
        return "forward:/features/payment/staff/store-management.html";
    }

    /**
     * 메뉴 및 옵션 등록 마스터 뷰 라우팅
     */
    @GetMapping("/features/payment/staff/menu-registration")
    public String menuRegistration() {
        return "forward:/features/payment/staff/menu-registration.html";
    }

    /**
     * 실시간 재고 및 품절 제어 뷰 라우팅
     */
    @GetMapping("/features/payment/staff/inventory-control")
    public String inventoryControl() {
        return "forward:/features/payment/staff/inventory-control.html";
    }

    /**
     * O2O 실시간 주문 수락 뷰 라우팅
     */
    @GetMapping("/features/payment/staff/o2o-orders")
    public String o2oOrders() {
        return "forward:/features/payment/staff/o2o-orders.html";
    }

    /**
     * 굿즈 판매소 설정 뷰 라우팅
     */
    @GetMapping("/features/payment/staff/goods-store")
    public String goodsStore() {
        return "forward:/features/payment/staff/goods-store.html";
    }

    /**
     * MD 및 굿즈 등록 뷰 라우팅
     */
    @GetMapping("/features/payment/staff/goods-menu")
    public String goodsMenu() {
        return "forward:/features/payment/staff/goods-menu.html";
    }

    /**
     * 옵션별 재고 관리 뷰 라우팅
     */
    @GetMapping("/features/payment/staff/goods-inventory")
    public String goodsInventory() {
        return "forward:/features/payment/staff/goods-inventory.html";
    }

    /**
     * 실시간 주문 및 픽업 뷰 라우팅
     */
    @GetMapping("/features/payment/staff/goods-orders")
    public String goodsOrders() {
        return "forward:/features/payment/staff/goods-orders.html";
    }

    /**
     * 실시간 매출 및 판매 통계 대시보드 뷰 라우팅
     */
    @GetMapping("/features/payment/staff/sales-dashboard")
    public String salesDashboard() {
        return "forward:/features/payment/staff/sales-dashboard.html";
    }
}
