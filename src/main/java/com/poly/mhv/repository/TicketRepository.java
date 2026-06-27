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

        @EntityGraph(attributePaths = { "asset", "asset.location", "asset.category", "asset.category.techSupportType",
                        "reporter", "assignee" })
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
                        Sort sort);

        @EntityGraph(attributePaths = { "asset", "asset.location", "asset.category", "asset.category.techSupportType",
                        "reporter", "assignee" })
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
                        Pageable pageable);

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
                        @Param("reporterId") Integer reporterId);

        @EntityGraph(attributePaths = { "asset", "asset.location", "asset.category", "asset.category.techSupportType",
                        "reporter", "assignee" })
        @Query("select t from Ticket t where t.id = :id")
        Optional<Ticket> findDetailById(@Param("id") Integer id);

        @EntityGraph(attributePaths = { "asset", "asset.location", "asset.homeLocation", "reporter" })
        @Query("""
                        select t from Ticket t
                        join t.asset a
                        join t.reporter r
                        """)
        Page<Ticket> findForMaintenanceHistory(Pageable pageable);

        @EntityGraph(attributePaths = { "asset", "asset.location", "asset.homeLocation", "reporter" })
        @Query("""
                        select t from Ticket t
                        join t.asset a
                        join t.reporter r
                        where r.id = :reporterId
                        order by t.createdAt desc, t.id desc
                        """)
        List<Ticket> findMaintenanceHistoryByReporterId(@Param("reporterId") Integer reporterId);

        @EntityGraph(attributePaths = { "asset", "asset.location", "asset.category", "asset.category.techSupportType",
                        "reporter", "assignee" })
        Optional<Ticket> findFirstByReporterIdOrderByCreatedAtDescIdDesc(Integer reporterId);

        @EntityGraph(attributePaths = { "asset", "asset.location", "asset.category", "asset.category.techSupportType",
                        "reporter", "assignee" })
        @Query("""
                        select t from Ticket t
                        join t.reporter r
                        where r.id = :reporterId
                          and t.status = 'RESOLVED'
                          and t.satisfactionScore is null
                        order by coalesce(t.resolvedAt, t.createdAt) desc, t.id desc
                        """)
        List<Ticket> findPendingSatisfactionByReporterId(@Param("reporterId") Integer reporterId);

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
                        @Param("assigneeId") Integer assigneeId);

        @Query("""
                        select t.asset.qaCode, t.asset.name, t.asset.homeLocation.roomName, count(t)
                        from Ticket t
                        where t.createdAt >= :start and t.createdAt <= :end
                        group by t.asset.qaCode, t.asset.name, t.asset.homeLocation.roomName
                        order by count(t) desc
                        """)
        List<Object[]> getTicketStatsInPeriod(
                        @Param("start") LocalDateTime start,
                        @Param("end") LocalDateTime end);

        @EntityGraph(attributePaths = { "asset", "asset.category", "asset.category.techSupportType", "assignee" })
        @Query("select t from Ticket t")
        List<Ticket> findAllForKpi();

        long countByAssigneeIdAndStatus(Integer assigneeId, String status);

        @Query("select count(t) from Ticket t where t.assignee.id = :assigneeId and t.status = :status and t.asset.category.id = :categoryId")
        long countByAssigneeIdAndStatusAndAssetCategoryId(
                        @Param("assigneeId") Integer assigneeId,
                        @Param("status") String status,
                        @Param("categoryId") Integer categoryId);

        @Query(value = """
                        select count(*)
                        from tickets t
                        join assets a on a.qa_code = t.asset_qa_code
                        where t.created_at >= :startTime
                          and t.created_at <= :endTime
                          and (:categoryId is null or a.category_id = :categoryId)
                          and (:locationId is null or a.location_id = :locationId)
                        """, nativeQuery = true)
        long countTicketsForStatistics(
                        @Param("startTime") LocalDateTime startTime,
                        @Param("endTime") LocalDateTime endTime,
                        @Param("categoryId") Integer categoryId,
                        @Param("locationId") Integer locationId);

        @Query(value = """
                        select cast(t.created_at as date) as row_date, count(*) as row_count
                        from tickets t
                        join assets a on a.qa_code = t.asset_qa_code
                        where t.created_at >= :startTime
                          and t.created_at <= :endTime
                          and (:categoryId is null or a.category_id = :categoryId)
                          and (:locationId is null or a.location_id = :locationId)
                        group by cast(t.created_at as date)
                        order by row_date asc
                        """, nativeQuery = true)
        List<Object[]> countTicketTrendForStatistics(
                        @Param("startTime") LocalDateTime startTime,
                        @Param("endTime") LocalDateTime endTime,
                        @Param("categoryId") Integer categoryId,
                        @Param("locationId") Integer locationId);

        @Query(value = """
                        select t.status, count(*) as row_count
                        from tickets t
                        join assets a on a.qa_code = t.asset_qa_code
                        where t.created_at >= :startTime
                          and t.created_at <= :endTime
                          and (:categoryId is null or a.category_id = :categoryId)
                          and (:locationId is null or a.location_id = :locationId)
                        group by t.status
                        order by row_count desc, t.status asc
                        """, nativeQuery = true)
        List<Object[]> countTicketsByStatusForStatistics(
                        @Param("startTime") LocalDateTime startTime,
                        @Param("endTime") LocalDateTime endTime,
                        @Param("categoryId") Integer categoryId,
                        @Param("locationId") Integer locationId);

        @Query(value = """
                        select a.qa_code,
                               a.name,
                               coalesce(c.name, ''),
                               coalesce(l.room_name, ''),
                               count(*) as row_count
                        from tickets t
                        join assets a on a.qa_code = t.asset_qa_code
                        left join categories c on c.id = a.category_id
                        left join locations l on l.id = a.location_id
                        where t.created_at >= :startTime
                          and t.created_at <= :endTime
                          and (:categoryId is null or a.category_id = :categoryId)
                          and (:locationId is null or a.location_id = :locationId)
                        group by a.qa_code, a.name, coalesce(c.name, ''), coalesce(l.room_name, '')
                        order by row_count desc, a.name asc
                        limit 8
                        """, nativeQuery = true)
        List<Object[]> findTopProblemAssetsForStatistics(
                        @Param("startTime") LocalDateTime startTime,
                        @Param("endTime") LocalDateTime endTime,
                        @Param("categoryId") Integer categoryId,
                        @Param("locationId") Integer locationId);
}
