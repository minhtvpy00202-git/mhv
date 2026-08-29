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
import jakarta.persistence.Version;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "tickets")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Ticket {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "asset_qa_code", nullable = false)
    @JsonIgnoreProperties({"usageHistories", "location", "homeLocation"})
    private Asset asset;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reporter_id", nullable = false)
    @JsonIgnoreProperties({"usageHistories", "password"})
    private AppUser reporter;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assignee_id")
    @JsonIgnoreProperties({"usageHistories", "password"})
    private AppUser assignee;

    @Column(nullable = false, length = 1000)
    private String description;

    @Column(name = "image_url", columnDefinition = "TEXT")
    private String imageUrl;

    @Column(nullable = false, length = 20)
    private String priority;

    @Column(nullable = false, length = 40)
    @Builder.Default
    private String status = "PENDING";

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "due_date")
    private LocalDateTime dueDate;

    @Column(name = "sla_min_minutes")
    private Integer slaMinMinutes;

    @Column(name = "sla_max_minutes")
    private Integer slaMaxMinutes;

    @Column(name = "accepted_at")
    private LocalDateTime acceptedAt;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @Column(name = "closed_at")
    private LocalDateTime closedAt;

    @Column(name = "closed_reason", length = 1000)
    private String closedReason;

    @Column(name = "confirmation_due_at")
    private LocalDateTime confirmationDueAt;

    @Column(name = "confirmed_at")
    private LocalDateTime confirmedAt;

    @Column(name = "resolution_outcome", length = 30)
    private String resolutionOutcome;

    @Column(name = "resolution_note", length = 1000)
    private String resolutionNote;

    @Column(name = "resolution_image_url", columnDefinition = "TEXT")
    private String resolutionImageUrl;

    @Column(name = "asset_technical_status_before_report", length = 30)
    private String assetTechnicalStatusBeforeReport;

    @Column(name = "asset_status_before_report", length = 30)
    private String assetStatusBeforeReport;

    @Column(name = "reopened_from_ticket_id")
    private Integer reopenedFromTicketId;

    @Column(name = "satisfaction_score")
    private Integer satisfactionScore;

    @Column(name = "satisfaction_comment", length = 1000)
    private String satisfactionComment;

    @Version
    @Column(columnDefinition = "bigint default 0")
    private Long version;

    @JsonIgnore
    @OneToMany(mappedBy = "ticket")
    @Builder.Default
    private List<ChatMessage> chatMessages = new ArrayList<>();
}
