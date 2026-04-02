package com.poly.mhv.repository;

import com.poly.mhv.entity.AppUser;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AppUserRepository extends JpaRepository<AppUser, Integer> {
    Optional<AppUser> findByUsername(String username);
    List<AppUser> findByRole(String role);
    List<AppUser> findByRoleAndTechSupportTypeId(String role, Integer techTypeId);
    List<AppUser> findAllByOrderByUsernameAsc();
    boolean existsByUsername(String username);

    @Query("""
            SELECT u FROM AppUser u
            WHERE (:keyword IS NULL OR LOWER(u.username) LIKE LOWER(CONCAT('%', :keyword, '%'))
                OR LOWER(COALESCE(u.fullName, '')) LIKE LOWER(CONCAT('%', :keyword, '%')))
              AND (:role IS NULL OR u.role = :role)
              AND (:status IS NULL OR u.status = :status)
            ORDER BY u.id DESC
            """)
    Page<AppUser> searchForAdmin(
            @Param("keyword") String keyword,
            @Param("role") String role,
            @Param("status") String status,
            Pageable pageable
    );
}
