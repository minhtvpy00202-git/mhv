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
@Table(name = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AppUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, unique = true, length = 50)
    private String username;

    @Column(nullable = false, length = 255)
    private String password;

    @Column(nullable = false, length = 20)
    private String role;

    @JsonIgnore
    @OneToMany(mappedBy = "user")
    @Builder.Default
    private List<UsageHistory> usageHistories = new ArrayList<>();

    @JsonIgnore
    @OneToMany(mappedBy = "reportedBy")
    @Builder.Default
    private List<MaintenanceRequest> maintenanceRequestsReported = new ArrayList<>();

    @JsonIgnore
    @OneToMany(mappedBy = "assignedTo")
    @Builder.Default
    private List<MaintenanceRequest> maintenanceRequestsAssigned = new ArrayList<>();
}
