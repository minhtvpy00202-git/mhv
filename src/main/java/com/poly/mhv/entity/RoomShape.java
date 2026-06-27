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
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "map_room_shapes")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RoomShape {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "floor_id", nullable = false)
    @JsonIgnoreProperties({"locations", "roomShapes"})
    private MapFloor floor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "location_id", nullable = false, unique = true)
    @JsonIgnoreProperties({"assets", "usageHistoriesFrom", "usageHistoriesTo", "roomShapes"})
    private Location location;

    @Column(name = "cells_json", columnDefinition = "TEXT", nullable = false)
    private String cellsJson;

    @Column(name = "polygon_json", columnDefinition = "TEXT")
    private String polygonJson;

    @Column(name = "bounds_json", columnDefinition = "TEXT")
    private String boundsJson;

    @Column(name = "color_hex", length = 20)
    private String colorHex;

    @Column(name = "area_type_key", length = 80)
    private String areaTypeKey;

    @Column(name = "area_type_label", length = 120)
    private String areaTypeLabel;

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
