package festival;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class Fastival1Application {

	public static void main(String[] args) {
		SpringApplication.run(Fastival1Application.class, args);
	}

	@org.springframework.context.annotation.Bean
	public org.springframework.boot.CommandLineRunner migrateStaffRoles(org.springframework.jdbc.core.JdbcTemplate jdbcTemplate) {
		return args -> {
			try {
				System.out.println("[Migration] Starting migration of existing ROLE_STAFF roles...");
				String sql = "UPDATE app_user u " +
				             "SET role = CASE " +
				             "    WHEN s.category IN ('FOOD', 'DRINK') THEN 'ROLE_FOOD_STAFF' " +
				             "    WHEN s.category = 'GATE' THEN 'ROLE_GATE_STAFF' " +
				             "    WHEN s.category = 'GOODS' THEN 'ROLE_GOODS_STAFF' " +
				             "    ELSE 'ROLE_STAFF' " +
				             "END " +
				             "FROM store s " +
				             "WHERE u.store_id = s.id AND (u.role = 'ROLE_STAFF' OR u.role = 'STAFF')";
				int updatedRows = jdbcTemplate.update(sql);
				System.out.println("[Migration] Successfully migrated " + updatedRows + " ROLE_STAFF users to granular roles.");
				
				System.out.println("====== [DEBUG STORES & STAFF USERS] ======");
				jdbcTemplate.query("SELECT id, name, category FROM store", (rs, rowNum) -> {
					System.out.println("[Debug Store] ID: " + rs.getLong("id") + ", Name: " + rs.getString("name") + ", Category: " + rs.getString("category"));
					return null;
				});
				jdbcTemplate.query("SELECT id, email, role, store_id FROM app_user WHERE role LIKE '%STAFF%' OR email = 'admin@gmail.com'", (rs, rowNum) -> {
					System.out.println("[Debug User] ID: " + rs.getLong("id") + ", Email: " + rs.getString("email") + ", Role: " + rs.getString("role") + ", StoreID: " + rs.getLong("store_id"));
					return null;
				});
				System.out.println("=========================================");
			} catch (Exception e) {
				System.err.println("[Migration] Error during ROLE_STAFF migration: " + e.getMessage());
			}
		};
	}
}
