package com.poly.mhv.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "consumable_warehouse_transfers")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConsumableWarehouseTransfer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "asset_qa_code", nullable = false)
    @JsonIgnoreProperties({"consumableIssues", "usageHistories"})
    private Asset asset;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_warehouse_location_id", nullable = false)
    @JsonIgnoreProperties({"assets", "roomShapes"})
    private Location sourceWarehouseLocation;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "target_warehouse_location_id", nullable = false)
    @JsonIgnoreProperties({"assets", "roomShapes"})
    private Location targetWarehouseLocation;

    @Column(name = "quantity_transferred", nullable = false)
    private Integer quantityTransferred;

    @Column(name = "unit_price", precision = 19, scale = 2)
    private BigDecimal unitPrice;

    @Column(name = "transferred_at", nullable = false)
    private LocalDateTime transferredAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "transferred_by_user_id", nullable = false)
    @JsonIgnoreProperties({"techSupportTypes"})
    private AppUser transferredBy;

    @Column(name = "note", columnDefinition = "TEXT")
    private String note;
}
