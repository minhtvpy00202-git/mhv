package com.poly.mhv.repository;

import com.poly.mhv.entity.ConsumableWarehouseTransfer;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConsumableWarehouseTransferRepository extends JpaRepository<ConsumableWarehouseTransfer, Long> {

    @EntityGraph(attributePaths = {"asset", "sourceWarehouseLocation", "targetWarehouseLocation", "transferredBy"})
    List<ConsumableWarehouseTransfer> findAllByOrderByTransferredAtDescIdDesc();

    @EntityGraph(attributePaths = {"asset", "sourceWarehouseLocation", "targetWarehouseLocation", "transferredBy"})
    List<ConsumableWarehouseTransfer> findByAssetQaCodeOrderByTransferredAtDescIdDesc(String assetQaCode);

    long countBySourceWarehouseLocationIdOrTargetWarehouseLocationId(Integer sourceWarehouseLocationId, Integer targetWarehouseLocationId);
}
