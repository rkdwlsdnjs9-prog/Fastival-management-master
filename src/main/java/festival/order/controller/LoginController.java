package festival.order.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/payment/staff")
public class LoginController {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PasswordEncoder passwordEncoder;

    // ==========================================
    // [인증] 스태프 실제 로그인 연동 (Supabase app_user 기반)
    // ==========================================
    @PostMapping("/login")
    public ResponseEntity<?> loginStaff(@RequestBody Map<String, String> payload) {
        String email = payload.get("email");
        String password = payload.get("password");

        if (email == null || password == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", "이메일과 비밀번호를 입력해주세요."));
        }

        // DB에서 해당 이메일의 사용자 정보(암호화된 비밀번호 포함) 조회
        String sql = "SELECT id, email, password, name, role, store_id FROM app_user WHERE email = ?";
        List<Map<String, Object>> users;
        try {
            users = jdbcTemplate.queryForList(sql, email);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("success", false, "error", "DB 통신 오류 발생"));
        }

        // 이메일이 존재하지 않을 때
        if (users.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("success", false, "error", "이메일 또는 비밀번호가 일치하지 않습니다."));
        }

        Map<String, Object> user = users.get(0);
        String dbPassword = (String) user.get("password");

        // 입력받은 평문 비밀번호와 DB의 암호화된 비밀번호 일치 여부 비교
        if (!passwordEncoder.matches(password, dbPassword)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("success", false, "error", "이메일 또는 비밀번호가 일치하지 않습니다."));
        }

        String role = (String) user.get("role");

        if (!"ROLE_STAFF".equals(role) && !"ROLE_FOOD_STAFF".equals(role) && !"ROLE_GATE_STAFF".equals(role) && !"ROLE_GOODS_STAFF".equals(role)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("success", false, "error", "스태프 권한이 없는 계정입니다."));
        }

        String token = "festio-jwt-token-" + user.get("id");
        return ResponseEntity.ok(Map.of(
            "success", true,
            "token", token,
            "user", Map.of(
                "id", user.get("email"),
                "name", user.get("name"),
                "role", role,
                "storeId", user.get("store_id")
            )
        ));
    }
}
