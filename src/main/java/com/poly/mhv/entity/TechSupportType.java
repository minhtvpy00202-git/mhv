package com.poly.mhv.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "tech_support_types")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TechSupportType {

    @Id
    private Integer id;

    @Column(nullable = false, unique = true, length = 100)
    private String name;
}
