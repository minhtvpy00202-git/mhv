package com.poly.mhv.repository;

import com.poly.mhv.entity.InventoryAuditMissing;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InventoryAuditMissingRepository extends JpaRepository<InventoryAuditMissing, Integer> {
    List<InventoryAuditMissing> findByAuditIdOrderByAssetQaCodeAsc(Integer auditId);
    Optional<InventoryAuditMissing> findByAuditIdAndAssetQaCode(Integer auditId, String assetQaCode);
    void deleteByAuditId(Integer auditId);
}
