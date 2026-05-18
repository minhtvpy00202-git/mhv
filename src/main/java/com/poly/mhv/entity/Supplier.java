package com.poly.mhv.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
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
import org.hibernate.annotations.Nationalized;

@Entity
@Table(name = "suppliers")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Supplier {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, length = 150, unique = true)
    @Nationalized
    private String name;

    @Column(length = 255)
    @Nationalized
    private String address;

    @Column(name = "phone_number", length = 20)
    private String phoneNumber;

    @JsonIgnore
    @OneToMany(mappedBy = "supplier", fetch = FetchType.LAZY)
    @Builder.Default
    private List<Asset> assets = new ArrayList<>();
}
