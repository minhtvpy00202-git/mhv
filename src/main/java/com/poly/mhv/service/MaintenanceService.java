package com.poly.mhv.service;

import com.poly.mhv.dto.maintenance.MaintenanceHistoryResponse;
import com.poly.mhv.dto.maintenance.MaintenanceReportRequest;
import com.poly.mhv.dto.maintenance.MaintenanceReportResponse;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.Asset;
import com.poly.mhv.entity.Ticket;
import com.poly.mhv.dto.ticket.TicketCreateRequest;
import com.poly.mhv.dto.ticket.TicketResponse;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.TicketRepository;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class MaintenanceService {

    private final TicketRepository ticketRepository;
    private final TicketService ticketService;
    private final CurrentUserProvider currentUserProvider;

    public MaintenanceService(
            TicketRepository ticketRepository,
            TicketService ticketService,
            CurrentUserProvider currentUserProvider
    ) {
        this.ticketRepository = ticketRepository;
        this.ticketService = ticketService;
        this.currentUserProvider = currentUserProvider;
    }

    @Transactional
    public MaintenanceReportResponse report(MaintenanceReportRequest request) {
        validateRequest(request);
        TicketResponse saved = ticketService.createTicket(TicketCreateRequest.builder()
                .assetQaCode(request.getAssetQaCode())
                .description(request.getDescription())
                .priority(StringUtils.hasText(request.getPriority()) ? request.getPriority().trim().toUpperCase() : "MEDIUM")
                .imageUrl(request.getImageUrl())
                .build());
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
        return ticketRepository.findByReporterIdOrderByCreatedAtDesc(actor.getId()).stream()
                .map(this::mapToHistoryResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<MaintenanceHistoryResponse> getAllForAdminHistory() {
        return ticketRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::mapToHistoryResponse)
                .toList();
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
                .imageUrl(ticket.getImageUrl())
                .reportTime(ticket.getCreatedAt())
                .assetStatus(asset.getStatus())
                .build();
    }

}
