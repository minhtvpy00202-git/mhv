package com.poly.mhv.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(
        name = "consumable_inquiry_fulfillments",
        indexes = {
                @Index(name = "idx_consumable_fulfillment_status", columnList = "status,updated_at"),
                @Index(name = "idx_consumable_fulfillment_active_request", columnList = "active_consumable_request_id")
        })
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConsumableInquiryFulfillment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "inquiry_id", nullable = false, unique = true)
    private ServiceInquiry inquiry;

    @Column(name = "original_consumable_request_id", nullable = false)
    private Long originalConsumableRequestId;

    @Column(name = "active_consumable_request_id", nullable = false)
    private Long activeConsumableRequestId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "source_warehouse_location_id", nullable = false)
    private Location sourceWarehouseLocation;

    @Column(name = "requested_quantity", nullable = false)
    private Integer requestedQuantity;

    @Column(name = "fulfilled_quantity", nullable = false)
    @Builder.Default
    private Integer fulfilledQuantity = 0;

    @Column(name = "prepared_quantity")
    private Integer preparedQuantity;

    @Column(nullable = false, length = 30)
    private String status;

    @Column(name = "requires_admin_approval", nullable = false)
    private Boolean requiresAdminApproval;

    @Column(name = "admin_approved", nullable = false)
    private Boolean adminApproved;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "admin_approved_by_user_id")
    private AppUser adminApprovedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "prepared_by_user_id")
    private AppUser preparedBy;

    @Column(name = "admin_approved_at")
    private LocalDateTime adminApprovedAt;

    @Column(name = "prepared_at")
    private LocalDateTime preparedAt;

    @Column(name = "ready_at")
    private LocalDateTime readyAt;

    @Column(name = "fulfilled_at")
    private LocalDateTime fulfilledAt;

    @Column(name = "closed_partial", nullable = false)
    @Builder.Default
    private Boolean closedPartial = false;

    @Column(name = "decision_note", columnDefinition = "TEXT")
    private String decisionNote;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Version
    private Long version;
}
