package com.poly.mhv.service;

import com.poly.mhv.dto.inquiry.InquiryWorkflowSettingRequest;
import com.poly.mhv.dto.inquiry.InquiryWorkflowSettingResponse;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.InquiryWorkflowSetting;
import com.poly.mhv.repository.InquiryWorkflowSettingRepository;
import com.poly.mhv.util.InquiryStatusSupport;
import com.poly.mhv.util.UtcDateTimes;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class InquiryWorkflowSettingService {

    private static final int SETTINGS_ID = 1;
    private static final int DEFAULT_REMINDER_HOURS = 24;
    private static final int DEFAULT_LARGE_QUANTITY = 20;
    private static final BigDecimal DEFAULT_HIGH_VALUE = new BigDecimal("5000000");

    private final InquiryWorkflowSettingRepository repository;
    private final CurrentUserProvider currentUserProvider;

    @Transactional(readOnly = true)
    public EffectiveSettings getEffectiveSettings() {
        return repository.findById(SETTINGS_ID)
                .map(this::toEffective)
                .orElseGet(this::defaults);
    }

    @Transactional(readOnly = true)
    public InquiryWorkflowSettingResponse getForAdmin() {
        requireAdmin();
        return repository.findById(SETTINGS_ID)
                .map(this::mapResponse)
                .orElseGet(() -> mapEffective(defaults()));
    }

    @Transactional
    public InquiryWorkflowSettingResponse update(InquiryWorkflowSettingRequest request) {
        AppUser admin = requireAdmin();
        InquiryWorkflowSetting settings = repository.findById(SETTINGS_ID)
                .orElseGet(() -> InquiryWorkflowSetting.builder().id(SETTINGS_ID).build());
        settings.setAssetResponseSlaMinutes(request.getAssetResponseSlaMinutes());
        settings.setConsumableResponseSlaMinutes(request.getConsumableResponseSlaMinutes());
        settings.setOverdueReminderIntervalHours(request.getOverdueReminderIntervalHours());
        settings.setLargeQuantityThreshold(request.getLargeQuantityThreshold());
        settings.setHighValueThreshold(request.getHighValueThreshold());
        settings.setUpdatedBy(admin);
        settings.setUpdatedAt(UtcDateTimes.now());
        return mapResponse(repository.save(settings));
    }

    private AppUser requireAdmin() {
        AppUser actor = currentUserProvider.getCurrentUser();
        if (actor == null || !"Admin".equals(actor.getRole())) {
            throw new AccessDeniedException("Chỉ Admin được cấu hình workflow yêu cầu.");
        }
        return actor;
    }

    private EffectiveSettings toEffective(InquiryWorkflowSetting settings) {
        return new EffectiveSettings(
                settings.getAssetResponseSlaMinutes(),
                settings.getConsumableResponseSlaMinutes(),
                settings.getOverdueReminderIntervalHours(),
                settings.getLargeQuantityThreshold(),
                settings.getHighValueThreshold());
    }

    private EffectiveSettings defaults() {
        return new EffectiveSettings(
                InquiryStatusSupport.ASSET_BORROW_RESPONSE_SLA_MINUTES,
                InquiryStatusSupport.CONSUMABLE_RESPONSE_SLA_MINUTES,
                DEFAULT_REMINDER_HOURS,
                DEFAULT_LARGE_QUANTITY,
                DEFAULT_HIGH_VALUE);
    }

    private InquiryWorkflowSettingResponse mapResponse(InquiryWorkflowSetting settings) {
        AppUser updater = settings.getUpdatedBy();
        String updaterName = updater != null && StringUtils.hasText(updater.getFullName())
                ? updater.getFullName().trim()
                : (updater != null ? updater.getUsername() : null);
        return InquiryWorkflowSettingResponse.builder()
                .assetResponseSlaMinutes(settings.getAssetResponseSlaMinutes())
                .consumableResponseSlaMinutes(settings.getConsumableResponseSlaMinutes())
                .overdueReminderIntervalHours(settings.getOverdueReminderIntervalHours())
                .largeQuantityThreshold(settings.getLargeQuantityThreshold())
                .highValueThreshold(settings.getHighValueThreshold())
                .updatedByUserId(updater != null ? updater.getId() : null)
                .updatedByName(updaterName)
                .updatedAt(toOffset(settings.getUpdatedAt()))
                .build();
    }

    private InquiryWorkflowSettingResponse mapEffective(EffectiveSettings settings) {
        return InquiryWorkflowSettingResponse.builder()
                .assetResponseSlaMinutes(settings.assetResponseSlaMinutes())
                .consumableResponseSlaMinutes(settings.consumableResponseSlaMinutes())
                .overdueReminderIntervalHours(settings.overdueReminderIntervalHours())
                .largeQuantityThreshold(settings.largeQuantityThreshold())
                .highValueThreshold(settings.highValueThreshold())
                .build();
    }

    private OffsetDateTime toOffset(LocalDateTime value) {
        return value == null ? null : value.atOffset(ZoneOffset.UTC);
    }

    public record EffectiveSettings(
            int assetResponseSlaMinutes,
            int consumableResponseSlaMinutes,
            int overdueReminderIntervalHours,
            int largeQuantityThreshold,
            BigDecimal highValueThreshold) {
    }
}
