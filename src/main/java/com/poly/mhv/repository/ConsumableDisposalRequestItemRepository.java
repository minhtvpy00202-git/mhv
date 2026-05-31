package com.poly.mhv.repository;

import com.poly.mhv.entity.ConsumableDisposalRequestItem;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConsumableDisposalRequestItemRepository extends JpaRepository<ConsumableDisposalRequestItem, Long> {

    boolean existsByReceiptLotIdAndDisposalRequestStatus(Long receiptLotId, String status);
}
