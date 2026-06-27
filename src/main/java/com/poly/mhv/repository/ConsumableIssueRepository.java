package com.poly.mhv.repository;

import com.poly.mhv.entity.ConsumableIssue;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ConsumableIssueRepository extends JpaRepository<ConsumableIssue, Long> {

    @EntityGraph(attributePaths = {"asset", "issuedToLocation", "issuedBy"})
    List<ConsumableIssue> findByAssetQaCodeOrderByIssuedAtDescIdDesc(String assetQaCode);

    @EntityGraph(attributePaths = {"asset", "issuedToLocation", "issuedBy"})
    List<ConsumableIssue> findByIssuedToLocationIdOrderByIssuedAtDescIdDesc(Integer issuedToLocationId);

    @EntityGraph(attributePaths = {"asset", "issuedToLocation", "issuedBy"})
    @Query("""
            select issue from ConsumableIssue issue
            join issue.issuedToLocation location
            where lower(trim(location.roomName)) <> 'kho'
            order by issue.issuedAt desc, issue.id desc
            """)
    List<ConsumableIssue> findAllTrackableRoomIssuesOrderByIssuedAtDesc();

    @Query(value = """
            select cast(ci.issued_at as date) as row_date,
                   sum(ci.quantity) as row_count
            from consumable_issues ci
            join assets a on a.qa_code = ci.asset_qa_code
            where ci.issued_at >= :startTime
              and ci.issued_at <= :endTime
              and (:categoryId is null or a.category_id = :categoryId)
              and (:locationId is null or ci.issued_to_location_id = :locationId)
            group by cast(ci.issued_at as date)
            order by row_date asc
            """, nativeQuery = true)
    List<Object[]> countIssuanceTrendForStatistics(
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime,
            @Param("categoryId") Integer categoryId,
            @Param("locationId") Integer locationId
    );

    @Query(value = """
            select a.qa_code,
                   a.name,
                   coalesce(c.name, ''),
                   coalesce(l.room_name, ''),
                   sum(ci.quantity) as total_qty
            from consumable_issues ci
            join assets a on a.qa_code = ci.asset_qa_code
            left join categories c on c.id = a.category_id
            left join locations l on l.id = ci.issued_to_location_id
            where ci.issued_at >= :startTime
              and ci.issued_at <= :endTime
              and (:categoryId is null or a.category_id = :categoryId)
              and (:locationId is null or ci.issued_to_location_id = :locationId)
            group by a.qa_code, a.name, coalesce(c.name, ''), coalesce(l.room_name, '')
            order by total_qty desc, a.name asc
            limit 8
            """, nativeQuery = true)
    List<Object[]> findTopDispensedConsumablesForStatistics(
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime,
            @Param("categoryId") Integer categoryId,
            @Param("locationId") Integer locationId
    );
}
