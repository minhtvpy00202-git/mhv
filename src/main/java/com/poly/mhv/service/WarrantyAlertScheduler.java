package com.poly.mhv.service;

import com.poly.mhv.entity.Asset;
import com.poly.mhv.repository.AssetRepository;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class WarrantyAlertScheduler {

    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final AssetRepository assetRepository;
    private final NotificationService notificationService;

    public WarrantyAlertScheduler(AssetRepository assetRepository, NotificationService notificationService) {
        this.assetRepository = assetRepository;
        this.notificationService = notificationService;
    }

    @Scheduled(cron = "0 0 7 * * *", zone = "Asia/Ho_Chi_Minh")
    public void notifyWarrantyExpiringSoon() {
        LocalDate targetDate = LocalDate.now(BUSINESS_ZONE).plusDays(3);
        List<Asset> expiringAssets = assetRepository.findByWarrantyExpirationDate(targetDate);
        for (Asset asset : expiringAssets) {
            notificationService.createNotification(
                    "WARRANTY_EXPIRING",
                    "Thiết bị sắp hết hạn bảo hành",
                    "Thiết bị " + asset.getQaCode() + " - " + asset.getName()
                            + " sẽ hết hạn bảo hành vào ngày " + targetDate.format(DATE_FORMATTER) + ".",
                    "system",
                    asset.getQaCode(),
                    asset.getName(),
                    Map.of(
                            "Thiết bị", asset.getQaCode() + " - " + asset.getName(),
                            "Ngày hết hạn bảo hành", targetDate.format(DATE_FORMATTER),
                            "Nhà cung cấp", asset.getSupplier() != null ? asset.getSupplier().getName() : "Chưa cập nhật"
                    )
            );
        }
    }
}
