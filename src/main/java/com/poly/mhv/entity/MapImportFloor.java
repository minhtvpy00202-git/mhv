package com.poly.mhv.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
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
@Table(name = "map_import_floors")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MapImportFloor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "job_id", nullable = false)
    private MapImportJob job;

    @Column(name = "source_floor_key", length = 100)
    private String sourceFloorKey;

    @Column(name = "suggested_name", nullable = false, length = 100)
    private String suggestedName;

    @Column(name = "friendly_label", length = 255)
    private String friendlyLabel;

    @Column(name = "drawing_type", length = 30)
    private String drawingType;

    @Column(name = "page_number")
    private Integer pageNumber;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private Integer sortOrder = 0;

    @Column(name = "width_px")
    private Integer widthPx;

    @Column(name = "height_px")
    private Integer heightPx;

    @Column(name = "scale_hint", length = 100)
    private String scaleHint;

    @Column(name = "background_image_url", length = 500)
    private String backgroundImageUrl;

    @Column(name = "preview_bounds_json", columnDefinition = "TEXT")
    private String previewBoundsJson;

    @Column(name = "detection_confidence")
    private Double detectionConfidence;

    @Column(name = "selected_for_analysis")
    @Builder.Default
    private Boolean selectedForAnalysis = Boolean.TRUE;

    @Column(name = "parse_status", length = 20)
    @Builder.Default
    private String parseStatus = "DISCOVERED";

    @JsonIgnore
    @OneToMany(mappedBy = "importFloor", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<MapImportSuggestion> suggestions = new ArrayList<>();
}
