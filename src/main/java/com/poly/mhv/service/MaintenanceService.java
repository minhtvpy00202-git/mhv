package com.poly.mhv.service;

import com.poly.mhv.dto.maintenance.MaintenanceHistoryResponse;
import com.poly.mhv.dto.maintenance.MaintenanceReportRequest;
import com.poly.mhv.dto.maintenance.MaintenanceReportResponse;
import com.poly.mhv.dto.common.PagedResponse;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.Asset;
import com.poly.mhv.entity.Ticket;
import com.poly.mhv.dto.ticket.TicketCreateRequest;
import com.poly.mhv.dto.ticket.TicketResponse;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.TicketRepository;
import com.poly.mhv.util.AssetStatusSupport;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service
public class MaintenanceService {

    private final TicketRepository ticketRepository;
    private final TicketService ticketService;
    private final CurrentUserProvider currentUserProvider;
    private final TicketImageStorageService ticketImageStorageService;

    public MaintenanceService(
            TicketRepository ticketRepository,
            TicketService ticketService,
            CurrentUserProvider currentUserProvider,
            TicketImageStorageService ticketImageStorageService
    ) {
        this.ticketRepository = ticketRepository;
        this.ticketService = ticketService;
        this.currentUserProvider = currentUserProvider;
        this.ticketImageStorageService = ticketImageStorageService;
    }

    @Transactional
    public MaintenanceReportResponse report(MaintenanceReportRequest request) {
        return report(request, null);
    }

    @Transactional
    public MaintenanceReportResponse report(MaintenanceReportRequest request, MultipartFile imageFile) {
        validateRequest(request);
        TicketResponse saved = ticketService.createTicket(TicketCreateRequest.builder()
                .assetQaCode(request.getAssetQaCode())
                .description(request.getDescription())
                .priority(StringUtils.hasText(request.getPriority()) ? request.getPriority().trim().toUpperCase() : "MEDIUM")
                .imageUrl(request.getImageUrl())
                .build(), imageFile);
        return MaintenanceReportResponse.builder()
                .id(saved.getId())
                .assetQaCode(saved.getAssetQaCode())
                .reportedBy(saved.getReporterId())
                .description(saved.getDescription())
                .status(saved.getStatus())
                .reportTime(saved.getCreatedAt())
                .build();
    }

    @Transactional(readOnly = true)
    public List<MaintenanceHistoryResponse> getMyHistory() {
        AppUser actor = currentUserProvider.getCurrentUser();
        return ticketRepository.findMaintenanceHistoryByReporterId(actor.getId()).stream()
                .map(this::mapToHistoryResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public PagedResponse<MaintenanceHistoryResponse> getAllForAdminHistory(int page, int size) {
        Page<Ticket> ticketPage = ticketRepository.findForMaintenanceHistory(
                PageRequest.of(
                        Math.max(0, page),
                        Math.max(1, Math.min(size, 100)),
                        Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "id"))
                )
        );
        return new PagedResponse<>(
                ticketPage.getContent().stream()
                        .map(this::mapToHistoryResponse)
                        .toList(),
                ticketPage.getNumber(),
                ticketPage.getSize(),
                Math.max(1, ticketPage.getTotalPages()),
                ticketPage.getTotalElements()
        );
    }

    @Transactional(readOnly = true)
    public TicketResponse getLatestReportedTicket() {
        AppUser actor = currentUserProvider.getCurrentUser();
        Ticket ticket = ticketRepository.findFirstByReporterIdOrderByCreatedAtDescIdDesc(actor.getId())
                .orElse(null);
        return ticket == null ? null : ticketService.getTicketById(ticket.getId());
    }

    private void validateRequest(MaintenanceReportRequest request) {
        if (request == null) {
            throw new CustomException("Dữ liệu báo hỏng không được để trống.");
        }
        if (!StringUtils.hasText(request.getAssetQaCode())) {
            throw new CustomException("assetQaCode là bắt buộc.");
        }
        if (!StringUtils.hasText(request.getDescription())) {
            throw new CustomException("description là bắt buộc.");
        }
    }

    private MaintenanceHistoryResponse mapToHistoryResponse(Ticket ticket) {
        Asset asset = ticket.getAsset();
        String reporterFullName = ticket.getReporter().getFullName();
        if (!StringUtils.hasText(reporterFullName)) {
            reporterFullName = ticket.getReporter().getUsername();
        }
        return MaintenanceHistoryResponse.builder()
                .id(ticket.getId())
                .assetQaCode(asset.getQaCode())
                .assetName(asset.getName())
                .homeLocationName(asset.getHomeLocation().getRoomName())
                .currentLocationName(asset.getLocation().getRoomName())
                .reporterFullName(reporterFullName)
                .description(ticket.getDescription())
                .imageUrl(ticketImageStorageService.toPublicImageUrl(ticket.getImageUrl()))
                .reportTime(ticket.getCreatedAt())
                .assetStatus(AssetStatusSupport.deriveDisplayStatus(
                        resolveTechnicalStatus(asset),
                        resolveUsageStatus(asset),
                        AssetStatusSupport.isRepairInProgress(asset.getStatus())
                ))
                .technicalStatus(resolveTechnicalStatus(asset))
                .usageStatus(resolveUsageStatus(asset))
                .build();
    }

    private String resolveTechnicalStatus(Asset asset) {
        if (asset == null) {
            return AssetStatusSupport.TECHNICAL_STATUS_GOOD;
        }
        return AssetStatusSupport.resolveTechnicalStatus(asset.getTechnicalStatus(), asset.getStatus());
    }

    private String resolveUsageStatus(Asset asset) {
        if (asset == null) {
            return AssetStatusSupport.USAGE_STATUS_HOME;
        }
        Integer locationId = asset.getLocation() == null ? null : asset.getLocation().getId();
        Integer homeLocationId = asset.getHomeLocation() == null ? null : asset.getHomeLocation().getId();
        return AssetStatusSupport.resolveUsageStatus(
                asset.getUsageStatus(),
                asset.getStatus(),
                locationId,
                homeLocationId
        );
    }

}
