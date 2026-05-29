package festival.user.repository;

import festival.user.domain.UserVo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<UserVo, Long> {
    Optional<UserVo> findByEmail(String email);
    boolean existsByEmail(String email);
}
