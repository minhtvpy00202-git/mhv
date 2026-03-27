package com.poly.mhv.repository;

import com.poly.mhv.entity.InventoryAuditItem;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InventoryAuditItemRepository extends JpaRepository<InventoryAuditItem, Integer> {
    boolean existsByAuditIdAndAssetQaCode(Integer auditId, String assetQaCode);
    long countByAuditIdAndAssetQaCode(Integer auditId, String assetQaCode);
    long countByAuditId(Integer auditId);
    List<InventoryAuditItem> findByAuditIdOrderByScannedAtDesc(Integer auditId);

    @Query("select i.assetQaCode from InventoryAuditItem i where i.audit.id = :auditId")
    List<String> findQaCodesByAuditId(@Param("auditId") Integer auditId);
}
