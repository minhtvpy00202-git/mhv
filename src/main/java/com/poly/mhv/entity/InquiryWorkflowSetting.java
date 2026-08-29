package com.poly.mhv.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "inquiry_workflow_settings")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InquiryWorkflowSetting {

    @Id
    private Integer id;

    @Column(name = "asset_response_sla_minutes", nullable = false)
    private Integer assetResponseSlaMinutes;

    @Column(name = "consumable_response_sla_minutes", nullable = false)
    private Integer consumableResponseSlaMinutes;

    @Column(name = "overdue_reminder_interval_hours", nullable = false)
    private Integer overdueReminderIntervalHours;

    @Column(name = "large_quantity_threshold", nullable = false)
    private Integer largeQuantityThreshold;

    @Column(name = "high_value_threshold", nullable = false, precision = 19, scale = 2)
    private BigDecimal highValueThreshold;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "updated_by_user_id")
    private AppUser updatedBy;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
