package com.poly.mhv.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "asset_map_area_types")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AreaTypeCatalog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "type_key", nullable = false, unique = true, length = 80)
    private String typeKey;

    @Column(name = "label", nullable = false, unique = true, length = 120)
    private String label;

    @Column(name = "description", length = 255)
    private String description;

    @Column(name = "default_has_asset", nullable = false)
    @Builder.Default
    private Boolean defaultHasAsset = true;

    @Column(name = "built_in", nullable = false)
    @Builder.Default
    private Boolean builtIn = false;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private Integer sortOrder = 0;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
