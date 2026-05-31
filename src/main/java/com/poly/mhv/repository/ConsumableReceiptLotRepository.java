package com.poly.mhv.repository;

import com.poly.mhv.entity.ConsumableReceiptLot;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConsumableReceiptLotRepository extends JpaRepository<ConsumableReceiptLot, Long> {

    @EntityGraph(attributePaths = {"asset", "supplier", "receivedBy"})
    List<ConsumableReceiptLot> findByAssetQaCodeOrderByReceivedDateDescIdDesc(String assetQaCode);

    @EntityGraph(attributePaths = {"asset", "supplier", "receivedBy"})
    List<ConsumableReceiptLot> findByAssetQaCodeAndQuantityRemainingGreaterThan(String assetQaCode, Integer quantityRemaining);

    @EntityGraph(attributePaths = {"asset", "supplier", "receivedBy"})
    List<ConsumableReceiptLot> findByAssetQaCodeOrderByReceivedDateAscIdAsc(String assetQaCode);

    @EntityGraph(attributePaths = {"asset", "supplier", "receivedBy"})
    List<ConsumableReceiptLot> findByQuantityRemainingGreaterThanAndExpirationDateBeforeOrderByExpirationDateAscReceivedDateAscIdAsc(
            Integer quantityRemaining,
            LocalDate expirationDate
    );

    @Override
    @EntityGraph(attributePaths = {"asset", "supplier", "receivedBy"})
    Optional<ConsumableReceiptLot> findById(Long id);

    boolean existsByAssetQaCodeAndQuantityRemainingGreaterThanAndExpirationDateIsNotNull(String assetQaCode, Integer quantityRemaining);

    boolean existsByAssetQaCodeAndQuantityRemainingGreaterThanAndExpirationDateIsNull(String assetQaCode, Integer quantityRemaining);

    void deleteByAssetQaCode(String assetQaCode);
}
