package com.poly.mhv.repository;

import com.poly.mhv.entity.ConsumableReceiptLot;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConsumableReceiptLotRepository extends JpaRepository<ConsumableReceiptLot, Long> {

    @EntityGraph(attributePaths = {"asset", "supplier", "receivedBy"})
    List<ConsumableReceiptLot> findByAssetQaCodeOrderByReceivedDateDescIdDesc(String assetQaCode);

    @EntityGraph(attributePaths = {"asset", "supplier", "receivedBy"})
    List<ConsumableReceiptLot> findByAssetQaCodeAndQuantityRemainingGreaterThan(String assetQaCode, Integer quantityRemaining);

    boolean existsByAssetQaCodeAndQuantityRemainingGreaterThanAndExpirationDateIsNotNull(String assetQaCode, Integer quantityRemaining);

    boolean existsByAssetQaCodeAndQuantityRemainingGreaterThanAndExpirationDateIsNull(String assetQaCode, Integer quantityRemaining);

    void deleteByAssetQaCode(String assetQaCode);
}
