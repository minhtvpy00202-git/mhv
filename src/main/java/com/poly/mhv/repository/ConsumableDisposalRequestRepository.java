package com.poly.mhv.repository;

import com.poly.mhv.entity.ConsumableDisposalRequest;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ConsumableDisposalRequestRepository extends JpaRepository<ConsumableDisposalRequest, Long> {

    @EntityGraph(attributePaths = {"asset", "receiptLot", "receiptLot.supplier", "requestedBy", "resolvedBy", "items", "items.receiptLot", "items.receiptLot.supplier"})
    List<ConsumableDisposalRequest> findByStatusOrderByCreatedAtDescIdDesc(String status);

    @EntityGraph(attributePaths = {"asset", "receiptLot", "receiptLot.supplier", "requestedBy", "resolvedBy", "items", "items.receiptLot", "items.receiptLot.supplier"})
    List<ConsumableDisposalRequest> findAllByOrderByCreatedAtDescIdDesc();

    @Override
    @EntityGraph(attributePaths = {"asset", "receiptLot", "receiptLot.supplier", "requestedBy", "resolvedBy", "items", "items.receiptLot", "items.receiptLot.supplier"})
    Optional<ConsumableDisposalRequest> findById(Long id);

    @Query("""
            select count(request)
            from ConsumableDisposalRequest request
            join request.asset a
            where request.status = :status
              and (:categoryId is null or a.category.id = :categoryId)
              and (:locationId is null or a.location.id = :locationId)
            """)
    long countByStatusForStatistics(
            @Param("status") String status,
            @Param("categoryId") Integer categoryId,
            @Param("locationId") Integer locationId
    );
}
