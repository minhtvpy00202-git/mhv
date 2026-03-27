package com.poly.mhv.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
}
