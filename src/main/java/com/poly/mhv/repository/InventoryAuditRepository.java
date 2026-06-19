package com.poly.mhv.repository;

import com.poly.mhv.entity.InventoryAudit;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InventoryAuditRepository extends JpaRepository<InventoryAudit, Integer> {
    @Query("""
            select ia from InventoryAudit ia
            join fetch ia.location l
            join fetch ia.createdBy u
            where (coalesce(:status, '') = '' or ia.status = :status)
            order by ia.startedAt desc, ia.id desc
            """)
    List<InventoryAudit> findForAdmin(@Param("status") String status);

    @EntityGraph(attributePaths = {"location", "createdBy"})
    @Query("""
            select ia from InventoryAudit ia
            where (coalesce(:status, '') = '' or ia.status = :status)
            """)
    Page<InventoryAudit> findForAdminPage(@Param("status") String status, Pageable pageable);

    @Query("""
            select ia from InventoryAudit ia
            join fetch ia.location l
            join fetch ia.createdBy u
            where ia.id = :id
            """)
    Optional<InventoryAudit> findDetailById(@Param("id") Integer id);

    @Query("""
            select ia from InventoryAudit ia
            join fetch ia.location l
            join fetch ia.createdBy u
            where u.id = :createdById
            order by ia.startedAt desc, ia.id desc
            """)
    List<InventoryAudit> findByCreatedByIdForHistory(@Param("createdById") Integer createdById);

    @Query("""
            select distinct ia from InventoryAudit ia
            join fetch ia.location l
            join fetch ia.createdBy u
            left join InventoryAuditItem i on i.audit.id = ia.id
            where u.id = :createdById or i.scannedByUsername = :username
            order by ia.startedAt desc, ia.id desc
            """)
    List<InventoryAudit> findByUserParticipationForHistory(
            @Param("createdById") Integer createdById,
            @Param("username") String username
    );

    boolean existsByLocationIdAndStatus(Integer locationId, String status);

    @Query(value = """
            select coalesce(ia.status, 'UNKNOWN') as row_value, count(*) as row_count
            from inventory_audits ia
            where ia.started_at >= :startTime
              and ia.started_at <= :endTime
              and (:locationId is null or ia.location_id = :locationId)
            group by coalesce(ia.status, 'UNKNOWN')
            order by row_count desc, row_value asc
            """, nativeQuery = true)
    List<Object[]> countAuditsByStatusForStatistics(
            @Param("startTime") java.time.LocalDateTime startTime,
            @Param("endTime") java.time.LocalDateTime endTime,
            @Param("locationId") Integer locationId
    );

    @Query(value = """
            select count(*)
            from inventory_audits ia
            where ia.started_at >= :startTime
              and ia.started_at <= :endTime
              and (:locationId is null or ia.location_id = :locationId)
            """, nativeQuery = true)
    long countAuditsForStatistics(
            @Param("startTime") java.time.LocalDateTime startTime,
            @Param("endTime") java.time.LocalDateTime endTime,
            @Param("locationId") Integer locationId
    );

    @Query(value = """
            select coalesce(sum(coalesce(ia.missing_count, 0)), 0)
            from inventory_audits ia
            where ia.started_at >= :startTime
              and ia.started_at <= :endTime
              and (:locationId is null or ia.location_id = :locationId)
            """, nativeQuery = true)
    long sumMissingCountForStatistics(
            @Param("startTime") java.time.LocalDateTime startTime,
            @Param("endTime") java.time.LocalDateTime endTime,
            @Param("locationId") Integer locationId
    );

    @Query(value = """
            select ia.id,
                   coalesce(l.room_name, ''),
                   ia.status,
                   coalesce(ia.expected_count, 0),
                   coalesce(ia.scanned_count, 0),
                   coalesce(ia.missing_count, 0),
                   ia.started_at,
                   ia.completed_at
            from inventory_audits ia
            left join locations l on l.id = ia.location_id
            where ia.started_at >= :startTime
              and ia.started_at <= :endTime
              and (:locationId is null or ia.location_id = :locationId)
            order by ia.started_at desc, ia.id desc
            limit 6
            """, nativeQuery = true)
    List<Object[]> findRecentAuditsForStatistics(
            @Param("startTime") java.time.LocalDateTime startTime,
            @Param("endTime") java.time.LocalDateTime endTime,
            @Param("locationId") Integer locationId
    );
}
