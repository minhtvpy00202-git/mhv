package com.poly.mhv.repository;

import com.poly.mhv.entity.UsageHistory;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UsageHistoryRepository extends JpaRepository<UsageHistory, Integer>, UsageHistoryRepositoryCustom {
    Optional<UsageHistory> findByAssetQaCodeAndEndTimeIsNull(String assetQaCode);
    List<UsageHistory> findByAssetQaCode(String assetQaCode);
    List<UsageHistory> findByUserId(Integer userId);
    long countByFromLocationIdOrToLocationId(Integer fromLocationId, Integer toLocationId);

    @Query("""
            select uh from UsageHistory uh
            join fetch uh.asset a
            join fetch a.homeLocation hl
            join fetch uh.toLocation tl
            join fetch uh.user u
            where u.id = :userId
            order by uh.startTime desc, uh.id desc
            """)
    List<UsageHistory> findByUserIdForHistory(@Param("userId") Integer userId);
    @Query("""
            select uh from UsageHistory uh
            join fetch uh.asset a
            join fetch a.homeLocation hl
            join fetch uh.toLocation tl
            join fetch uh.user u
            order by uh.startTime desc, uh.id desc
            """)
    List<UsageHistory> findAllForAdminOrderByStartTimeDesc();

    @Query("""
            select uh.asset.qaCode, count(uh)
            from UsageHistory uh
            where uh.startTime >= :start and uh.startTime <= :end
            group by uh.asset.qaCode
            """)
    List<Object[]> countUsageByAssetInPeriod(
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end
    );

    @Modifying
    @Query(value = """
            INSERT INTO usage_histories (asset_qa_code, user_id, start_time, end_time, from_location_id, to_location_id)
            VALUES (:assetQaCode, :userId, :startTime, NULL, :fromLocationId, :toLocationId)
            """, nativeQuery = true)
    int insertOpenUsageHistory(
            @Param("assetQaCode") String assetQaCode,
            @Param("userId") Integer userId,
            @Param("startTime") LocalDateTime startTime,
            @Param("fromLocationId") Integer fromLocationId,
            @Param("toLocationId") Integer toLocationId
    );

    @Query(value = """
            select cast(uh.start_time as date) as row_date, count(*) as row_count
            from usage_histories uh
            join assets a on a.qa_code = uh.asset_qa_code
            where uh.start_time >= :startTime
              and uh.start_time <= :endTime
              and (:categoryId is null or a.category_id = :categoryId)
              and (:locationId is null or uh.to_location_id = :locationId)
            group by cast(uh.start_time as date)
            order by row_date asc
            """, nativeQuery = true)
    List<Object[]> countBorrowTrendForStatistics(
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
                   count(*) as row_count
            from usage_histories uh
            join assets a on a.qa_code = uh.asset_qa_code
            left join categories c on c.id = a.category_id
            left join locations l on l.id = uh.to_location_id
            where uh.start_time >= :startTime
              and uh.start_time <= :endTime
              and (:categoryId is null or a.category_id = :categoryId)
              and (:locationId is null or uh.to_location_id = :locationId)
            group by a.qa_code, a.name, coalesce(c.name, ''), coalesce(l.room_name, '')
            order by row_count desc, a.name asc
            limit 8
            """, nativeQuery = true)
    List<Object[]> findTopBorrowedAssetsForStatistics(
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime,
            @Param("categoryId") Integer categoryId,
            @Param("locationId") Integer locationId
    );

    @Query(value = """
            select count(*)
            from usage_histories uh
            join assets a on a.qa_code = uh.asset_qa_code
            where uh.start_time >= :startTime
              and uh.start_time <= :endTime
              and (:categoryId is null or a.category_id = :categoryId)
              and (:locationId is null or uh.to_location_id = :locationId)
            """, nativeQuery = true)
    long countBorrowEventsForStatistics(
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime,
            @Param("categoryId") Integer categoryId,
            @Param("locationId") Integer locationId
    );
}
