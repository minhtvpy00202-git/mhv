package com.poly.mhv.repository;

import com.poly.mhv.entity.Ticket;
import java.time.LocalDateTime;
import java.util.List;
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
}
