package com.poly.mhv.repository;

import com.poly.mhv.entity.ConsumableDisposalRequest;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConsumableDisposalRequestRepository extends JpaRepository<ConsumableDisposalRequest, Long> {

    @EntityGraph(attributePaths = {"asset", "receiptLot", "receiptLot.supplier", "requestedBy", "resolvedBy", "items", "items.receiptLot", "items.receiptLot.supplier"})
    List<ConsumableDisposalRequest> findByStatusOrderByCreatedAtDescIdDesc(String status);

    @EntityGraph(attributePaths = {"asset", "receiptLot", "receiptLot.supplier", "requestedBy", "resolvedBy", "items", "items.receiptLot", "items.receiptLot.supplier"})
    List<ConsumableDisposalRequest> findAllByOrderByCreatedAtDescIdDesc();

    @Override
    @EntityGraph(attributePaths = {"asset", "receiptLot", "receiptLot.supplier", "requestedBy", "resolvedBy", "items", "items.receiptLot", "items.receiptLot.supplier"})
    Optional<ConsumableDisposalRequest> findById(Long id);
}
