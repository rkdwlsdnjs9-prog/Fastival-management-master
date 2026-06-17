package festival.user.controller;

import festival.user.domain.UserVo;
import festival.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

/**
 * 어드민 전용 회원 및 등급 관리 REST API 컨트롤러
 * 
 * GET   /api/admin/members             -> 회원 전체 목록 조회
 * PATCH /api/admin/members/{id}/status -> 회원 계정 상태(ACTIVE/BANNED) 변경
 * PATCH /api/admin/members/{id}/role   -> 회원 권한(ROLE_USER/ROLE_STAFF/ROLE_ADMIN) 변경
 */
@RestController
@RequestMapping("/api/admin/members")
@RequiredArgsConstructor
public class AdminMemberController {

    private final UserService userService;

    /**
     * 전체 회원 목록을 조회합니다.
     * GET /api/admin/members
     */
    @GetMapping
    public ResponseEntity<List<UserVo>> getAllMembers() {
        return ResponseEntity.ok(userService.getAllUsers());
    }

    /**
     * 회원의 상태를 변경합니다.
     * PATCH /api/admin/members/{id}/status?status=BANNED
     */
    @PatchMapping("/{id}/status")
    public ResponseEntity<UserVo> updateStatus(
            @PathVariable("id") String id,
            @RequestParam("status") String status) {
        try {
            UserVo updated = userService.updateStatus(id, status);
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * 회원의 권한을 변경합니다.
     * PATCH /api/admin/members/{id}/role?role=ROLE_STAFF
     */
    @PatchMapping("/{id}/role")
    public ResponseEntity<UserVo> updateRole(
            @PathVariable("id") String id,
            @RequestParam("role") String role) {
        try {
            UserVo updated = userService.updateRole(id, role);
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }
}
