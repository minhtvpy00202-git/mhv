package com.poly.mhv.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "inventory_audit_missing")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InventoryAuditMissing {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "audit_id", nullable = false)
    private InventoryAudit audit;

    @Column(name = "asset_qa_code", nullable = false, length = 20)
    private String assetQaCode;

    @Column(name = "asset_name", nullable = false, length = 255)
    private String assetName;

    @Column(name = "location_name", nullable = false, length = 100)
    private String locationName;

    @Column(name = "resolution_status", nullable = false, length = 20)
    private String resolutionStatus;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @Column(name = "resolved_by_username", length = 50)
    private String resolvedByUsername;
}
