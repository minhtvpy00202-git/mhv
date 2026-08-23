package com.poly.mhv.service;

import com.poly.mhv.dto.inquiry.InquiryDemandSummaryResponse;
import com.poly.mhv.dto.inquiry.InquiryReportResponse;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.Asset;
import com.poly.mhv.entity.ServiceInquiry;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.ServiceInquiryRepository;
import com.poly.mhv.util.InquiryStatusSupport;
import com.poly.mhv.util.UtcDateTimes;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class InquiryReportService {

    private static final int MAX_RANGE_DAYS = 366;

    private final ServiceInquiryRepository inquiryRepository;
    private final CurrentUserProvider currentUserProvider;

    @Transactional(readOnly = true)
    public InquiryReportResponse getReport(LocalDate fromDate, LocalDate toDate, String requestedTargetRole) {
        AppUser actor = currentUserProvider.getCurrentUser();
        if (actor == null || !List.of("Admin", "ConsumableManager").contains(actor.getRole())) {
            throw new AccessDeniedException("Bạn không có quyền xem báo cáo yêu cầu.");
        }
        LocalDate today = UtcDateTimes.now().toLocalDate();
        LocalDate normalizedTo = toDate == null ? today : toDate;
        LocalDate normalizedFrom = fromDate == null ? normalizedTo.minusDays(29) : fromDate;
        if (normalizedFrom.isAfter(normalizedTo)) {
            throw new CustomException("Ngày bắt đầu không được sau ngày kết thúc.");
        }
        if (Duration.between(normalizedFrom.atStartOfDay(), normalizedTo.plusDays(1).atStartOfDay()).toDays() > MAX_RANGE_DAYS) {
            throw new CustomException("Khoảng báo cáo không được vượt quá 366 ngày.");
        }
        String targetRole = "ConsumableManager".equals(actor.getRole())
                ? "ConsumableManager"
                : normalizeTargetRole(requestedTargetRole);
        List<ServiceInquiry> inquiries = inquiryRepository.findForReport(
                normalizedFrom.atStartOfDay(),
                normalizedTo.plusDays(1).atStartOfDay(),
                targetRole);
        LocalDateTime now = UtcDateTimes.now();

        long completed = countStatus(inquiries, InquiryStatusSupport.COMPLETED);
        long rejected = countStatus(inquiries, InquiryStatusSupport.REJECTED);
        long cancelled = countStatus(inquiries, InquiryStatusSupport.CANCELLED);
        long open = inquiries.size() - completed - rejected - cancelled;
        List<ServiceInquiry> responded = inquiries.stream()
                .filter(inquiry -> inquiry.getFirstResponseAt() != null)
                .toList();
        long slaBreaches = inquiries.stream().filter(inquiry -> isSlaBreached(inquiry, now)).count();
        long activeOverdue = inquiries.stream()
                .filter(inquiry -> !InquiryStatusSupport.isTerminal(inquiry.getStatus()))
                .filter(inquiry -> inquiry.getFirstResponseAt() == null)
                .filter(inquiry -> inquiry.getSlaResponseDueAt() != null && inquiry.getSlaResponseDueAt().isBefore(now))
                .count();
        long withinSla = responded.stream()
                .filter(inquiry -> inquiry.getSlaResponseDueAt() != null
                        && !inquiry.getFirstResponseAt().isAfter(inquiry.getSlaResponseDueAt()))
                .count();
        double averageResponseMinutes = responded.stream()
                .filter(inquiry -> inquiry.getCreatedAt() != null)
                .mapToLong(inquiry -> Math.max(0, Duration.between(inquiry.getCreatedAt(), inquiry.getFirstResponseAt()).toMinutes()))
                .average()
                .orElse(0D);
        long approved = inquiries.stream()
                .filter(inquiry -> inquiry.getLinkedEntityId() != null)
                .filter(inquiry -> !List.of(InquiryStatusSupport.REJECTED, InquiryStatusSupport.CANCELLED)
                        .contains(inquiry.getStatus()))
                .count();
        long approvalDecisions = approved + rejected;

        Map<String, Long> statusCounts = inquiries.stream().collect(Collectors.groupingBy(
                ServiceInquiry::getStatus,
                LinkedHashMap::new,
                Collectors.counting()));

        return InquiryReportResponse.builder()
                .fromDate(normalizedFrom)
                .toDate(normalizedTo)
                .targetRole(targetRole)
                .totalRequests((long) inquiries.size())
                .openRequests(open)
                .completedRequests(completed)
                .rejectedRequests(rejected)
                .cancelledRequests(cancelled)
                .respondedRequests((long) responded.size())
                .responseSlaBreaches(slaBreaches)
                .activeResponseOverdue(activeOverdue)
                .averageFirstResponseMinutes(roundOneDecimal(averageResponseMinutes))
                .responseSlaMetRate(rate(withinSla, responded.size()))
                .approvalRate(rate(approved, approvalDecisions))
                .statusCounts(statusCounts)
                .topConsumableDemand(buildConsumableDemand(inquiries))
                .generatedAt(OffsetDateTime.of(now, ZoneOffset.UTC))
                .build();
    }

    private List<InquiryDemandSummaryResponse> buildConsumableDemand(List<ServiceInquiry> inquiries) {
        Map<String, DemandAccumulator> demand = new LinkedHashMap<>();
        for (ServiceInquiry inquiry : inquiries) {
            if (!InquiryStatusSupport.CONSUMABLE_REQUEST.equals(inquiry.getInquiryType())) {
                continue;
            }
            Asset asset = Boolean.TRUE.equals(inquiry.getAlternativeAccepted()) && inquiry.getAlternativeAsset() != null
                    ? inquiry.getAlternativeAsset()
                    : inquiry.getAsset();
            int quantity = Boolean.TRUE.equals(inquiry.getAlternativeAccepted()) && inquiry.getProposedQuantity() != null
                    ? inquiry.getProposedQuantity()
                    : (inquiry.getQuantityRequested() == null ? 0 : inquiry.getQuantityRequested());
            demand.computeIfAbsent(asset.getQaCode(), ignored -> new DemandAccumulator(asset))
                    .add(quantity);
        }
        return demand.values().stream()
                .sorted((left, right) -> Long.compare(right.totalQuantity, left.totalQuantity))
                .limit(10)
                .map(DemandAccumulator::toResponse)
                .toList();
    }

    private boolean isSlaBreached(ServiceInquiry inquiry, LocalDateTime now) {
        if (inquiry.getSlaBreachedAt() != null) {
            return true;
        }
        if (inquiry.getSlaResponseDueAt() == null) {
            return false;
        }
        LocalDateTime observedAt = inquiry.getFirstResponseAt() != null ? inquiry.getFirstResponseAt() : now;
        return observedAt.isAfter(inquiry.getSlaResponseDueAt());
    }

    private long countStatus(List<ServiceInquiry> inquiries, String status) {
        return inquiries.stream().filter(inquiry -> status.equals(inquiry.getStatus())).count();
    }

    private String normalizeTargetRole(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        if ("admin".equals(normalized)) {
            return "Admin";
        }
        if ("consumablemanager".equals(normalized)) {
            return "ConsumableManager";
        }
        throw new CustomException("Bộ phận báo cáo không hợp lệ.");
    }

    private double rate(long numerator, long denominator) {
        return denominator <= 0 ? 0D : roundOneDecimal((numerator * 100D) / denominator);
    }

    private double roundOneDecimal(double value) {
        return Math.round(value * 10D) / 10D;
    }

    private static final class DemandAccumulator {
        private final Asset asset;
        private long requestCount;
        private long totalQuantity;

        private DemandAccumulator(Asset asset) {
            this.asset = asset;
        }

        private DemandAccumulator add(int quantity) {
            requestCount++;
            totalQuantity += Math.max(0, quantity);
            return this;
        }

        private InquiryDemandSummaryResponse toResponse() {
            return InquiryDemandSummaryResponse.builder()
                    .assetQaCode(asset.getQaCode())
                    .assetName(asset.getName())
                    .unit(asset.getUnit())
                    .requestCount(requestCount)
                    .totalQuantityRequested(totalQuantity)
                    .build();
        }
    }
}
