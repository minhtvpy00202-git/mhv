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
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "map_import_suggestions")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MapImportSuggestion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "import_floor_id", nullable = false)
    private MapImportFloor importFloor;

    @Column(name = "suggestion_type", nullable = false, length = 30)
    private String suggestionType;

    @Column(name = "label_text", length = 255)
    private String labelText;

    @Column(name = "normalized_name", length = 255)
    private String normalizedName;

    @Column(name = "cells_json", columnDefinition = "TEXT")
    private String cellsJson;

    @Column(name = "polygon_json", columnDefinition = "TEXT")
    private String polygonJson;

    @Column(name = "color_hex", length = 20)
    private String colorHex;

    @Column(name = "has_asset_suggested")
    private Boolean hasAssetSuggested;

    @Column(name = "confidence_score")
    private Double confidenceScore;

    @Column(name = "source_method", length = 30)
    private String sourceMethod;

    @Column(name = "review_status", nullable = false, length = 20)
    private String reviewStatus;

    @Column(name = "linked_location_id")
    private Integer linkedLocationId;

    @Column(name = "notes", length = 1000)
    private String notes;
}
