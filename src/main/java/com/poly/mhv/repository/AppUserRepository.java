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
    List<AppUser> findAllByOrderByUsernameAsc();
    boolean existsByUsername(String username);

    @Query("""
            SELECT DISTINCT u FROM AppUser u
            JOIN u.techSupportTypes t
            WHERE u.role = :role AND t.id = :techTypeId
            ORDER BY u.username ASC
            """)
    List<AppUser> findByRoleAndTechSupportTypeId(@Param("role") String role, @Param("techTypeId") Integer techTypeId);

    @Query("""
            select count(distinct u.id) from AppUser u
            join u.techSupportTypes t
            where t.id = :techTypeId
            """)
    long countUsersByTechSupportTypeId(@Param("techTypeId") Integer techTypeId);

    @Query("""
            SELECT u FROM AppUser u
            WHERE (COALESCE(:keyword, '') = '' OR LOWER(u.username) LIKE LOWER(CONCAT('%', :keyword, '%'))
                OR LOWER(COALESCE(u.fullName, '')) LIKE LOWER(CONCAT('%', :keyword, '%')))
              AND (COALESCE(:role, '') = '' OR u.role = :role)
              AND (COALESCE(:status, '') = '' OR u.status = :status)
            ORDER BY u.id DESC
            """)
    Page<AppUser> searchForAdmin(
            @Param("keyword") String keyword,
            @Param("role") String role,
            @Param("status") String status,
            Pageable pageable
    );

    @Query("""
            select distinct u from AppUser u
            left join fetch u.techSupportTypes
            where u.id in :ids
            """)
    List<AppUser> findAllWithTechSupportTypesByIdIn(@Param("ids") List<Integer> ids);

    @Query("""
            select t.id, count(distinct u.id) from AppUser u
            join u.techSupportTypes t
            where t.id in :techTypeIds
            group by t.id
            """)
    List<Object[]> countUsersByTechSupportTypeIds(@Param("techTypeIds") List<Integer> techTypeIds);
}
