package com.poly.mhv.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
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
@Table(name = "locations")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Location {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "room_name", nullable = false, length = 100)
    private String roomName;

    @Column(name = "has_asset", columnDefinition = "boolean default true")
    @Builder.Default
    private Boolean hasAsset = true;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "floor_id")
    @JsonIgnoreProperties({"locations", "roomShapes"})
    private MapFloor floor;

    @JsonIgnore
    @OneToMany(mappedBy = "location")
    @Builder.Default
    private List<Asset> assets = new ArrayList<>();

    @JsonIgnore
    @OneToMany(mappedBy = "fromLocation")
    @Builder.Default
    private List<UsageHistory> usageHistoriesFrom = new ArrayList<>();

    @JsonIgnore
    @OneToMany(mappedBy = "toLocation")
    @Builder.Default
    private List<UsageHistory> usageHistoriesTo = new ArrayList<>();

    @JsonIgnore
    @OneToMany(mappedBy = "location")
    @Builder.Default
    private List<RoomShape> roomShapes = new ArrayList<>();
}
