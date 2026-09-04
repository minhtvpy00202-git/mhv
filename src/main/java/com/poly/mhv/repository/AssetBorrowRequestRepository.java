package com.poly.mhv.repository;

import com.poly.mhv.entity.AssetBorrowRequest;
import jakarta.persistence.LockModeType;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AssetBorrowRequestRepository extends JpaRepository<AssetBorrowRequest, Long> {

    @EntityGraph(attributePaths = {"inquiry", "asset", "requester", "approvedBy", "destinationLocation"})
    List<AssetBorrowRequest> findByRequesterIdOrderByCreatedAtDesc(Integer requesterId);

    @EntityGraph(attributePaths = {"inquiry", "asset", "requester", "approvedBy", "destinationLocation"})
    List<AssetBorrowRequest> findAllByOrderByCreatedAtDesc();

    @EntityGraph(attributePaths = {"inquiry", "asset", "requester", "approvedBy", "destinationLocation"})
    @Query("select b from AssetBorrowRequest b where b.id = :id")
    Optional<AssetBorrowRequest> findDetailById(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"inquiry", "asset", "requester", "approvedBy", "destinationLocation"})
    @Query("select b from AssetBorrowRequest b where b.id = :id")
    Optional<AssetBorrowRequest> findForUpdateById(@Param("id") Long id);

    boolean existsByAssetQaCodeAndStatusIn(String assetQaCode, Collection<String> statuses);

    boolean existsByAssetQaCodeAndRequesterIdAndStatusIn(
            String assetQaCode,
            Integer requesterId,
            Collection<String> statuses
    );

    @EntityGraph(attributePaths = {"inquiry", "asset", "requester", "approvedBy", "destinationLocation"})
    Optional<AssetBorrowRequest> findFirstByAssetQaCodeAndRequesterIdAndStatusOrderByCreatedAtDesc(
            String assetQaCode,
            Integer requesterId,
            String status
    );

    @EntityGraph(attributePaths = {"inquiry", "asset", "requester", "approvedBy", "destinationLocation"})
    Optional<AssetBorrowRequest> findFirstByAssetQaCodeAndRequesterIdAndStatusInOrderByCreatedAtDesc(
            String assetQaCode,
            Integer requesterId,
            Collection<String> statuses
    );

    @EntityGraph(attributePaths = {"inquiry", "asset", "requester", "approvedBy", "destinationLocation"})
    @Query("""
            select b from AssetBorrowRequest b
            where b.status = 'CHECKED_OUT'
              and b.expectedReturnDate < :today
              and (b.lastOverdueReminderAt is null or b.lastOverdueReminderAt < :threshold)
            order by b.expectedReturnDate asc, b.createdAt asc
            """)
    List<AssetBorrowRequest> findCheckedOutOverdueForReminder(
            @Param("today") LocalDate today,
            @Param("threshold") LocalDateTime threshold
    );
}
