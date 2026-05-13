package com.poly.mhv.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinTable;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Nationalized;

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

    @Column(name = "full_name", length = 100)
    @Nationalized
    private String fullName;

    @Column(name = "birthday")
    private LocalDate birthday;

    @Column(length = 20)
    private String phone;

    @Column(nullable = false, length = 20)
    @Nationalized
    private String status;

    @ManyToMany
    @JoinTable(
            name = "user_tech_support_types",
            joinColumns = @JoinColumn(name = "user_id"),
            inverseJoinColumns = @JoinColumn(name = "tech_type_id")
    )
    @Builder.Default
    private List<TechSupportType> techSupportTypes = new ArrayList<>();

    @JsonIgnore
    @OneToMany(mappedBy = "user")
    @Builder.Default
    private List<UsageHistory> usageHistories = new ArrayList<>();
}
