package com.poly.mhv.repository;

import com.poly.mhv.entity.Ticket;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TicketRepository extends JpaRepository<Ticket, Integer> {
    List<Ticket> findByAssetQaCode(String assetQaCode);
    List<Ticket> findByAssetQaCodeOrderByCreatedAtDesc(String assetQaCode);
    List<Ticket> findByStatus(String status);
    List<Ticket> findByAssigneeId(Integer assigneeId);
    List<Ticket> findByStatusAndAssigneeId(String status, Integer assigneeId);
    List<Ticket> findByReporterIdOrderByCreatedAtDesc(Integer reporterId);
    List<Ticket> findAllByOrderByCreatedAtDesc();
    List<Ticket> findByImageUrlIsNotNullOrderByIdAsc();

    @EntityGraph(attributePaths = {"asset", "asset.location", "asset.category", "asset.category.techSupportType", "reporter", "assignee"})
    @Query("""
            select t from Ticket t
            join t.asset a
            join t.reporter r
            left join t.assignee assignee
            where (:status is null or t.status = :status)
              and (:assigneeId is null or assignee.id = :assigneeId)
              and (coalesce(:assetQaCode, '') = '' or a.qaCode = :assetQaCode)
              and (:reporterId is null or r.id = :reporterId)
            """)
    List<Ticket> searchForListing(
            @Param("status") String status,
            @Param("assigneeId") Integer assigneeId,
            @Param("assetQaCode") String assetQaCode,
            @Param("reporterId") Integer reporterId,
            Sort sort
    );

    @EntityGraph(attributePaths = {"asset", "asset.location", "asset.category", "asset.category.techSupportType", "reporter", "assignee"})
    @Query("""
            select t from Ticket t
            join t.asset a
            join t.reporter r
            left join t.assignee assignee
            where (:status is null or t.status = :status)
              and (:assigneeId is null or assignee.id = :assigneeId)
              and (coalesce(:assetQaCode, '') = '' or a.qaCode = :assetQaCode)
              and (:reporterId is null or r.id = :reporterId)
            """)
    Page<Ticket> searchForAdmin(
            @Param("status") String status,
            @Param("assigneeId") Integer assigneeId,
            @Param("assetQaCode") String assetQaCode,
            @Param("reporterId") Integer reporterId,
            Pageable pageable
    );

    @Query("""
            select t.status, count(t) from Ticket t
            join t.asset a
            join t.reporter r
            left join t.assignee assignee
            where (:status is null or t.status = :status)
              and (:assigneeId is null or assignee.id = :assigneeId)
              and (coalesce(:assetQaCode, '') = '' or a.qaCode = :assetQaCode)
              and (:reporterId is null or r.id = :reporterId)
            group by t.status
            """)
    List<Object[]> countByStatusForAdmin(
            @Param("status") String status,
            @Param("assigneeId") Integer assigneeId,
            @Param("assetQaCode") String assetQaCode,
            @Param("reporterId") Integer reporterId
    );

    @EntityGraph(attributePaths = {"asset", "asset.location", "asset.category", "asset.category.techSupportType", "reporter", "assignee"})
    @Query("select t from Ticket t where t.id = :id")
    Optional<Ticket> findDetailById(@Param("id") Integer id);

    @EntityGraph(attributePaths = {"asset", "asset.location", "asset.homeLocation", "reporter"})
    @Query("""
            select t from Ticket t
            join t.asset a
            join t.reporter r
            """)
    Page<Ticket> findForMaintenanceHistory(Pageable pageable);

    @EntityGraph(attributePaths = {"asset", "asset.location", "asset.homeLocation", "reporter"})
    @Query("""
            select t from Ticket t
            join t.asset a
            join t.reporter r
            where r.id = :reporterId
            order by t.createdAt desc, t.id desc
            """)
    List<Ticket> findMaintenanceHistoryByReporterId(@Param("reporterId") Integer reporterId);

    @EntityGraph(attributePaths = {"asset", "asset.location", "asset.category", "asset.category.techSupportType", "reporter", "assignee"})
    Optional<Ticket> findFirstByReporterIdOrderByCreatedAtDescIdDesc(Integer reporterId);

    @Modifying
    @Query(value = """
            UPDATE tickets
            SET assignee_id = :assigneeId,
                status = 'IN_PROGRESS',
                resolved_at = NULL
            WHERE id = :ticketId
              AND status = 'PENDING'
              AND assignee_id IS NULL
            """, nativeQuery = true)
    int claimTicketIfPending(
            @Param("ticketId") Integer ticketId,
            @Param("assigneeId") Integer assigneeId
    );

    @Query("""
            select t.asset.qaCode, t.asset.name, t.asset.homeLocation.roomName, count(t)
            from Ticket t
            where t.createdAt >= :start and t.createdAt <= :end
            group by t.asset.qaCode, t.asset.name, t.asset.homeLocation.roomName
            order by count(t) desc
            """)
    List<Object[]> getTicketStatsInPeriod(
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end
    );

    @EntityGraph(attributePaths = {"asset", "asset.category", "asset.category.techSupportType", "assignee"})
    @Query("select t from Ticket t")
    List<Ticket> findAllForKpi();
}
