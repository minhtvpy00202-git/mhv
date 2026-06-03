package com.poly.mhv.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.util.ArrayList;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.ColumnDefault;

@Entity
@Table(name = "map_floors")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MapFloor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private Integer sortOrder = 0;

    @Column(name = "grid_rows", nullable = false)
    @Builder.Default
    private Integer gridRows = 12;

    @Column(name = "grid_cols", nullable = false)
    @Builder.Default
    private Integer gridCols = 20;

    @Column(name = "canvas_background_color", length = 20)
    @Builder.Default
    private String canvasBackgroundColor = "#FFFFFF";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @ColumnDefault("'GRID'")
    @Builder.Default
    private MapFloorMode mode = MapFloorMode.GRID;

    @Column(name = "background_image_url", columnDefinition = "TEXT")
    private String backgroundImageUrl;

    @Column(name = "image_width")
    private Integer imageWidth;

    @Column(name = "image_height")
    private Integer imageHeight;

    @JsonIgnore
    @OneToMany(mappedBy = "floor")
    @Builder.Default
    private List<Location> locations = new ArrayList<>();

    @JsonIgnore
    @OneToMany(mappedBy = "floor")
    @Builder.Default
    private List<RoomShape> roomShapes = new ArrayList<>();
}
