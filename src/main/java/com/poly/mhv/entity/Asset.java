package com.poly.mhv.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "assets")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Asset {

    @Id
    @Column(name = "qa_code", nullable = false, length = 20)
    private String qaCode;

    @Column(nullable = false, length = 100)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id", nullable = false)
    @JsonIgnoreProperties({"assets"})
    private Category category;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(name = "technical_status", length = 30)
    private String technicalStatus;

    @Column(name = "usage_status", length = 30)
    private String usageStatus;

    @Column(name = "tracking_mode", length = 20)
    @Builder.Default
    private String trackingMode = "ITEMIZED";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "location_id", nullable = false)
    @JsonIgnoreProperties({"assets", "usageHistoriesFrom", "usageHistoriesTo"})
    private Location location;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "home_location_id", nullable = false)
    @JsonIgnoreProperties({"assets", "usageHistoriesFrom", "usageHistoriesTo"})
    private Location homeLocation;

    @Column(columnDefinition = "TEXT")
    private String specs;

    @Column(name = "purchase_price", precision = 19, scale = 2)
    private BigDecimal purchasePrice;

    @Column(name = "purchase_date")
    private LocalDate purchaseDate;

    @Column(name = "warranty_expiration_date")
    private LocalDate warrantyExpirationDate;

    @Column(name = "expiry_tracking_enabled")
    private Boolean expiryTrackingEnabled;

    @Column(name = "expiration_date")
    private LocalDate expirationDate;

    @Column(name = "quantity_on_hand")
    private Integer quantityOnHand;

    @Column(name = "minimum_stock")
    private Integer minimumStock;

    @Column(length = 50)
    private String unit;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id")
    @JsonIgnoreProperties({"assets"})
    private Supplier supplier;

    @JsonIgnore
    @OneToMany(mappedBy = "asset")
    @Builder.Default
    private List<UsageHistory> usageHistories = new ArrayList<>();

    @JsonIgnore
    @OneToMany(mappedBy = "asset")
    @Builder.Default
    private List<ConsumableIssue> consumableIssues = new ArrayList<>();
}
