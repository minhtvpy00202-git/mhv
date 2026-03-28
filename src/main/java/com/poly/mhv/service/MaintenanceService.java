package com.poly.mhv.service;

import com.poly.mhv.dto.maintenance.MaintenanceAssetStatusUpdateRequest;
import com.poly.mhv.dto.maintenance.MaintenanceHistoryResponse;
import com.poly.mhv.dto.maintenance.MaintenanceReportRequest;
import com.poly.mhv.dto.maintenance.MaintenanceReportResponse;
import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.Asset;
import com.poly.mhv.entity.MaintenanceRequest;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.repository.AppUserRepository;
import com.poly.mhv.repository.AssetRepository;
import com.poly.mhv.repository.MaintenanceRequestRepository;
import com.poly.mhv.security.services.UserDetailsImpl;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class MaintenanceService {

    private final MaintenanceRequestRepository maintenanceRequestRepository;
    private final AssetRepository assetRepository;
    private final AppUserRepository appUserRepository;
    private final NotificationService notificationService;

    public MaintenanceService(
            MaintenanceRequestRepository maintenanceRequestRepository,
            AssetRepository assetRepository,
            AppUserRepository appUserRepository,
            NotificationService notificationService
    ) {
        this.maintenanceRequestRepository = maintenanceRequestRepository;
        this.assetRepository = assetRepository;
        this.appUserRepository = appUserRepository;
        this.notificationService = notificationService;
    }

    @Transactional
    public MaintenanceReportResponse report(MaintenanceReportRequest request) {
        validateRequest(request);

        Asset asset = assetRepository.findById(request.getAssetQaCode())
                .orElseThrow(() -> new CustomException("Mã tài sản không tồn tại"));
        if ("Hỏng".equals(asset.getStatus())) {
            throw new CustomException("Thiết bị này đã được báo hỏng! Cảm ơn rất nhiều vì sự đóng góp của bạn!");
        }
        AppUser reportedBy = getCurrentUser();

        MaintenanceRequest maintenanceRequest = MaintenanceRequest.builder()
                .asset(asset)
                .reportedBy(reportedBy)
                .description(request.getDescription())
                .status("Mới tạo")
                .reportTime(LocalDateTime.now())
                .build();

        asset.setStatus("Hỏng");
        assetRepository.save(asset);
        MaintenanceRequest saved = maintenanceRequestRepository.save(maintenanceRequest);
        notificationService.createNotification(
                "MAINTENANCE_REPORT",
                "Báo hỏng thiết bị",
                reportedBy.getUsername() + " đã báo hỏng thiết bị " + asset.getQaCode() + ".",
                reportedBy.getUsername(),
                asset.getQaCode(),
                asset.getName(),
                Map.of(
                        "Thiết bị", asset.getQaCode() + " - " + asset.getName(),
                        "Nghiệp vụ", "Báo hỏng",
                        "Thời gian", saved.getReportTime(),
                        "Người thực hiện", reportedBy.getUsername(),
                        "Mô tả lỗi", saved.getDescription()
                )
        );
        return MaintenanceReportResponse.builder()
                .id(saved.getId())
                .assetQaCode(saved.getAsset().getQaCode())
                .reportedBy(saved.getReportedBy().getId())
                .description(saved.getDescription())
                .status(saved.getStatus())
                .reportTime(saved.getReportTime())
                .build();
    }

    @Transactional(readOnly = true)
    public List<MaintenanceHistoryResponse> getMyHistory() {
        AppUser actor = getCurrentUser();
        return maintenanceRequestRepository.findHistoryByReportedById(actor.getId()).stream()
                .map(this::mapToHistoryResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<MaintenanceHistoryResponse> getAllForAdminHistory() {
        return maintenanceRequestRepository.findAllForAdminHistory().stream()
                .map(this::mapToHistoryResponse)
                .toList();
    }

    @Transactional
    public MaintenanceHistoryResponse updateAssetStatus(Integer maintenanceId, MaintenanceAssetStatusUpdateRequest request) {
        if (maintenanceId == null) {
            throw new CustomException("maintenanceId là bắt buộc.");
        }
        if (request == null || !StringUtils.hasText(request.getAssetStatus())) {
            throw new CustomException("assetStatus là bắt buộc.");
        }
        String status = request.getAssetStatus().trim();
        if (!List.of("Đang sử dụng", "Hỏng", "Sẵn sàng", "Bảo trì").contains(status)) {
            throw new CustomException("Trạng thái tài sản không hợp lệ.");
        }
        MaintenanceRequest maintenanceRequest = maintenanceRequestRepository.findById(maintenanceId)
                .orElseThrow(() -> new CustomException("Không tìm thấy bản ghi báo hỏng."));
        Asset asset = maintenanceRequest.getAsset();
        asset.setStatus(status);
        assetRepository.save(asset);
        if ("Hỏng".equals(status)) {
            maintenanceRequest.setStatus("Đang xử lý");
            maintenanceRequest.setResolvedTime(null);
        } else {
            maintenanceRequest.setStatus("Hoàn tất");
            maintenanceRequest.setResolvedTime(LocalDateTime.now());
        }
        maintenanceRequestRepository.save(maintenanceRequest);

        AppUser actor = getCurrentUser();
        notificationService.createNotification(
                "MAINTENANCE_STATUS_UPDATE",
                "Cập nhật trạng thái thiết bị báo hỏng",
                actor.getUsername() + " đã cập nhật trạng thái " + asset.getQaCode() + " thành " + status + ".",
                actor.getUsername(),
                asset.getQaCode(),
                asset.getName(),
                Map.of(
                        "Thiết bị", asset.getQaCode() + " - " + asset.getName(),
                        "Trạng thái mới", status,
                        "Người thực hiện", actor.getUsername()
                )
        );
        return mapToHistoryResponse(maintenanceRequest);
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

    private MaintenanceHistoryResponse mapToHistoryResponse(MaintenanceRequest request) {
        String reporterFullName = request.getReportedBy().getFullName();
        if (!StringUtils.hasText(reporterFullName)) {
            reporterFullName = request.getReportedBy().getUsername();
        }
        return MaintenanceHistoryResponse.builder()
                .id(request.getId())
                .assetQaCode(request.getAsset().getQaCode())
                .assetName(request.getAsset().getName())
                .homeLocationName(request.getAsset().getHomeLocation().getRoomName())
                .currentLocationName(request.getAsset().getLocation().getRoomName())
                .reporterFullName(reporterFullName)
                .description(request.getDescription())
                .reportTime(request.getReportTime())
                .assetStatus(request.getAsset().getStatus())
                .build();
    }

    private AppUser getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new CustomException("Không xác định được người dùng đăng nhập.");
        }

        Object principal = authentication.getPrincipal();
        if (principal instanceof UserDetailsImpl userDetails) {
            return appUserRepository.findById(userDetails.getId())
                    .orElseThrow(() -> new CustomException("Không tìm thấy người dùng đăng nhập."));
        }

        String username = authentication.getName();
        return appUserRepository.findByUsername(username)
                .orElseThrow(() -> new CustomException("Không tìm thấy người dùng đăng nhập."));
    }
}
