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

    @Column(name = "category", nullable = false, length = 50)
    private String legacyCategoryName;

    @Column(nullable = false, length = 20)
    private String status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "location_id", nullable = false)
    @JsonIgnoreProperties({"assets", "usageHistoriesFrom", "usageHistoriesTo"})
    private Location location;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "home_location_id", nullable = false)
    @JsonIgnoreProperties({"assets", "usageHistoriesFrom", "usageHistoriesTo"})
    private Location homeLocation;

    @JsonIgnore
    @OneToMany(mappedBy = "asset")
    @Builder.Default
    private List<UsageHistory> usageHistories = new ArrayList<>();

    @JsonIgnore
    @OneToMany(mappedBy = "asset")
    @Builder.Default
    private List<MaintenanceRequest> maintenanceRequests = new ArrayList<>();
}
