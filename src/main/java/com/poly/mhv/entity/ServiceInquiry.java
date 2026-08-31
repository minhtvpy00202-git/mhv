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
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(
        name = "service_inquiries",
        indexes = {
                @Index(name = "idx_inquiry_requester", columnList = "requester_id,updated_at"),
                @Index(name = "idx_inquiry_target_role", columnList = "target_role,status,updated_at"),
                @Index(name = "idx_inquiry_assignee", columnList = "assignee_id,status"),
                @Index(name = "idx_inquiry_response_sla", columnList = "sla_response_due_at,first_response_at,status")
        })
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ServiceInquiry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "inquiry_type", nullable = false, length = 30)
    private String inquiryType;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "requester_id", nullable = false)
    private AppUser requester;

    @Column(name = "target_role", nullable = false, length = 30)
    private String targetRole;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assignee_id")
    private AppUser assignee;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "asset_qa_code", nullable = false)
    private Asset asset;

    @Column(name = "quantity_requested", nullable = false)
    private Integer quantityRequested;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "destination_location_id", nullable = false)
    private Location destinationLocation;

    @Column(name = "needed_from", nullable = false)
    private LocalDate neededFrom;

    @Column(name = "expected_return_date")
    private LocalDate expectedReturnDate;

    @Column(name = "purpose", nullable = false, columnDefinition = "TEXT")
    private String purpose;

    @Column(name = "status", nullable = false, length = 30)
    private String status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "alternative_asset_qa_code")
    private Asset alternativeAsset;

    @Column(name = "proposed_quantity")
    private Integer proposedQuantity;

    @Column(name = "alternative_accepted")
    private Boolean alternativeAccepted;

    @Column(name = "decision_note", columnDefinition = "TEXT")
    private String decisionNote;

    @Column(name = "linked_entity_type", length = 40)
    private String linkedEntityType;

    @Column(name = "linked_entity_id")
    private Long linkedEntityId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "claimed_at")
    private LocalDateTime claimedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "received_at")
    private LocalDateTime receivedAt;

    @Column(name = "sla_response_due_at")
    private LocalDateTime slaResponseDueAt;

    @Column(name = "approval_quantity_threshold")
    private Integer approvalQuantityThreshold;

    @Column(name = "approval_value_threshold", precision = 19, scale = 2)
    private BigDecimal approvalValueThreshold;

    @Column(name = "first_response_at")
    private LocalDateTime firstResponseAt;

    @Column(name = "sla_breached_at")
    private LocalDateTime slaBreachedAt;

    @Column(name = "last_overdue_reminder_at")
    private LocalDateTime lastOverdueReminderAt;

    @Column(name = "overdue_reminder_count")
    @Builder.Default
    private Integer overdueReminderCount = 0;

    @Version
    private Long version;
}
