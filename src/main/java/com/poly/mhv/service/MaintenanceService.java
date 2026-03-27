package com.poly.mhv.service;

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
    private final AdminAlertSseService adminAlertSseService;

    public MaintenanceService(
            MaintenanceRequestRepository maintenanceRequestRepository,
            AssetRepository assetRepository,
            AppUserRepository appUserRepository,
            NotificationService notificationService,
            AdminAlertSseService adminAlertSseService
    ) {
        this.maintenanceRequestRepository = maintenanceRequestRepository;
        this.assetRepository = assetRepository;
        this.appUserRepository = appUserRepository;
        this.notificationService = notificationService;
        this.adminAlertSseService = adminAlertSseService;
    }

    @Transactional
    public MaintenanceReportResponse report(MaintenanceReportRequest request) {
        validateRequest(request);

        Asset asset = assetRepository.findById(request.getAssetQaCode())
                .orElseThrow(() -> new CustomException("Không tìm thấy thiết bị với mã: " + request.getAssetQaCode()));
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
        adminAlertSseService.notifyMaintenanceAlert(
                "Cảnh báo: Nhân viên " + reportedBy.getUsername() + " vừa báo hỏng "
                        + asset.getName() + " tại phòng " + asset.getLocation().getRoomName() + "."
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
