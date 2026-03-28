package com.poly.mhv.repository;

import com.poly.mhv.entity.UsageHistory;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UsageHistoryRepository extends JpaRepository<UsageHistory, Integer> {
    Optional<UsageHistory> findByAssetQaCodeAndEndTimeIsNull(String assetQaCode);
    List<UsageHistory> findByAssetQaCode(String assetQaCode);
    List<UsageHistory> findByUserId(Integer userId);
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
            select uh from UsageHistory uh
            join fetch uh.asset a
            join fetch a.homeLocation hl
            join fetch uh.toLocation tl
            join fetch uh.user u
            where (:assetName is null or lower(a.name) like lower(concat('%', :assetName, '%')))
              and (:borrowedLocationId is null or tl.id = :borrowedLocationId)
              and (:userId is null or u.id = :userId)
              and (:startDateTime is null or uh.startTime >= :startDateTime)
              and (:endDateTime is null or uh.startTime <= :endDateTime)
            order by uh.startTime desc, uh.id desc
            """)
    List<UsageHistory> searchForAdmin(
            @Param("assetName") String assetName,
            @Param("borrowedLocationId") Integer borrowedLocationId,
            @Param("userId") Integer userId,
            @Param("startDateTime") LocalDateTime startDateTime,
            @Param("endDateTime") LocalDateTime endDateTime
    );

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
}
