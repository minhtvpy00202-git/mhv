package com.poly.mhv.repository;

import com.poly.mhv.entity.AssetBorrowRequest;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.time.LocalDate;
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

    @Query("""
            select (count(b) > 0) from AssetBorrowRequest b
            where b.asset.qaCode = :assetQaCode
              and b.id <> :excludedId
              and b.status in :statuses
              and b.neededFrom <= :expectedReturnDate
              and b.expectedReturnDate >= :neededFrom
            """)
    boolean existsOverlappingSchedule(
            @Param("assetQaCode") String assetQaCode,
            @Param("neededFrom") LocalDate neededFrom,
            @Param("expectedReturnDate") LocalDate expectedReturnDate,
            @Param("statuses") Collection<String> statuses,
            @Param("excludedId") Long excludedId);
}
