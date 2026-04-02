package com.poly.mhv.service;

import com.poly.mhv.entity.Asset;
import com.poly.mhv.entity.Category;
import com.poly.mhv.entity.InventoryAudit;
import com.poly.mhv.entity.InventoryAuditItem;
import com.poly.mhv.entity.InventoryAuditMissing;
import com.poly.mhv.entity.UsageHistory;
import com.poly.mhv.repository.AssetRepository;
import com.poly.mhv.repository.InventoryAuditItemRepository;
import com.poly.mhv.repository.InventoryAuditMissingRepository;
import com.poly.mhv.repository.InventoryAuditRepository;
import com.poly.mhv.repository.UsageHistoryRepository;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReportService {

    private final AssetRepository assetRepository;
    private final UsageHistoryRepository usageHistoryRepository;
    private final InventoryAuditRepository inventoryAuditRepository;
    private final InventoryAuditItemRepository inventoryAuditItemRepository;
    private final InventoryAuditMissingRepository inventoryAuditMissingRepository;

    public ReportService(
            AssetRepository assetRepository,
            UsageHistoryRepository usageHistoryRepository,
            InventoryAuditRepository inventoryAuditRepository,
            InventoryAuditItemRepository inventoryAuditItemRepository,
            InventoryAuditMissingRepository inventoryAuditMissingRepository
    ) {
        this.assetRepository = assetRepository;
        this.usageHistoryRepository = usageHistoryRepository;
        this.inventoryAuditRepository = inventoryAuditRepository;
        this.inventoryAuditItemRepository = inventoryAuditItemRepository;
        this.inventoryAuditMissingRepository = inventoryAuditMissingRepository;
    }

    @Transactional(readOnly = true)
    public byte[] exportAssetsExcel() throws IOException {
        List<Asset> assets = assetRepository.findAllForExportOrderByLocation();

        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            XSSFSheet sheet = workbook.createSheet("Danh sách thiết bị");

            Row headerRow = sheet.createRow(0);
            createCell(headerRow, 0, "Mã QA");
            createCell(headerRow, 1, "Tên thiết bị");
            createCell(headerRow, 2, "Loại");
            createCell(headerRow, 3, "Phòng học");
            createCell(headerRow, 4, "Trạng thái");

            int rowNum = 1;
            for (Asset asset : assets) {
                Row row = sheet.createRow(rowNum++);
                createCell(row, 0, asset.getQaCode());
                createCell(row, 1, asset.getName());
                createCell(row, 2, getCategoryDisplayName(asset.getCategory()));
                createCell(row, 3, asset.getLocation().getRoomName());
                createCell(row, 4, asset.getStatus());
            }

            sheet.autoSizeColumn(0);
            sheet.autoSizeColumn(1);
            sheet.autoSizeColumn(2);
            sheet.autoSizeColumn(3);
            sheet.autoSizeColumn(4);

            workbook.write(outputStream);
            return outputStream.toByteArray();
        }
    }

    @Transactional(readOnly = true)
    public byte[] exportUsageHistoryExcel(
            String assetName,
            Integer borrowedLocationId,
            Integer userId,
            LocalDate startDate,
            LocalDate endDate
    ) throws IOException {
        LocalDateTime startDateTime = startDate == null ? null : startDate.atStartOfDay();
        LocalDateTime endDateTime = endDate == null ? null : endDate.plusDays(1).atStartOfDay().minusNanos(1);
        List<UsageHistory> histories = usageHistoryRepository.searchForAdmin(
                assetName == null || assetName.isBlank() ? null : assetName.trim(),
                borrowedLocationId,
                userId,
                startDateTime,
                endDateTime
        );

        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            XSSFSheet sheet = workbook.createSheet("Lịch sử mượn thiết bị");

            Row headerRow = sheet.createRow(0);
            createCell(headerRow, 0, "STT");
            createCell(headerRow, 1, "Mã Thiết bị");
            createCell(headerRow, 2, "Tên thiết bị");
            createCell(headerRow, 3, "Phòng gốc");
            createCell(headerRow, 4, "Ngày mượn");
            createCell(headerRow, 5, "Phòng mượn");
            createCell(headerRow, 6, "Ngày trả");
            createCell(headerRow, 7, "Người mượn");

            int rowNum = 1;
            for (UsageHistory history : histories) {
                Row row = sheet.createRow(rowNum);
                createCell(row, 0, String.valueOf(rowNum));
                createCell(row, 1, history.getAsset().getQaCode());
                createCell(row, 2, history.getAsset().getName());
                createCell(row, 3, history.getAsset().getHomeLocation().getRoomName());
                createCell(row, 4, history.getStartTime() == null ? "" : history.getStartTime().toString());
                createCell(row, 5, history.getToLocation().getRoomName());
                createCell(row, 6, history.getEndTime() == null ? "" : history.getEndTime().toString());
                createCell(row, 7, history.getUser().getUsername());
                rowNum++;
            }

            for (int i = 0; i <= 7; i++) {
                sheet.autoSizeColumn(i);
            }

            workbook.write(outputStream);
            return outputStream.toByteArray();
        }
    }

    @Transactional(readOnly = true)
    public byte[] exportInventoryAuditExcel(Integer auditId) throws IOException {
        InventoryAudit audit = inventoryAuditRepository.findDetailById(auditId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy phiên kiểm kê."));
        List<InventoryAuditItem> scannedItems = inventoryAuditItemRepository.findByAuditIdOrderByScannedAtDesc(auditId);
        List<InventoryAuditMissing> missingItems = inventoryAuditMissingRepository.findByAuditIdOrderByAssetQaCodeAsc(auditId);

        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            XSSFSheet summarySheet = workbook.createSheet("Bien ban kiem ke");
            createCell(summarySheet.createRow(0), 0, "Phòng");
            createCell(summarySheet.getRow(0), 1, audit.getLocation().getRoomName());
            createCell(summarySheet.createRow(1), 0, "Người tạo");
            createCell(summarySheet.getRow(1), 1, audit.getCreatedBy().getUsername());
            createCell(summarySheet.createRow(2), 0, "Bắt đầu");
            createCell(summarySheet.getRow(2), 1, String.valueOf(audit.getStartedAt()));
            createCell(summarySheet.createRow(3), 0, "Kết thúc");
            createCell(summarySheet.getRow(3), 1, String.valueOf(audit.getCompletedAt()));
            createCell(summarySheet.createRow(4), 0, "Số lượng dự kiến");
            createCell(summarySheet.getRow(4), 1, String.valueOf(audit.getExpectedCount()));
            createCell(summarySheet.createRow(5), 0, "Số lượng đã quét");
            createCell(summarySheet.getRow(5), 1, String.valueOf(audit.getScannedCount()));
            createCell(summarySheet.createRow(6), 0, "Số lượng thất lạc");
            createCell(summarySheet.getRow(6), 1, String.valueOf(audit.getMissingCount()));

            XSSFSheet scannedSheet = workbook.createSheet("Da quet");
            createCell(scannedSheet.createRow(0), 0, "STT");
            createCell(scannedSheet.getRow(0), 1, "Mã thiết bị");
            createCell(scannedSheet.getRow(0), 2, "Tên thiết bị");
            createCell(scannedSheet.getRow(0), 3, "Người quét");
            createCell(scannedSheet.getRow(0), 4, "Thời gian quét");
            int rowNum = 1;
            for (InventoryAuditItem item : scannedItems) {
                Row row = scannedSheet.createRow(rowNum);
                createCell(row, 0, String.valueOf(rowNum));
                createCell(row, 1, item.getAssetQaCode());
                createCell(row, 2, item.getAssetName());
                createCell(row, 3, item.getScannedByUsername());
                createCell(row, 4, String.valueOf(item.getScannedAt()));
                rowNum++;
            }
            if (scannedItems.isEmpty()) {
                Row row = scannedSheet.createRow(1);
                createCell(row, 0, "1");
                createCell(row, 1, "");
                createCell(row, 2, "Không có thiết bị được quét");
                createCell(row, 3, "");
                createCell(row, 4, "");
            }

            XSSFSheet missingSheet = workbook.createSheet("That lac");
            createCell(missingSheet.createRow(0), 0, "STT");
            createCell(missingSheet.getRow(0), 1, "Mã thiết bị");
            createCell(missingSheet.getRow(0), 2, "Tên thiết bị");
            createCell(missingSheet.getRow(0), 3, "Phòng");
            createCell(missingSheet.getRow(0), 4, "Trạng thái thất lạc");
            createCell(missingSheet.getRow(0), 5, "Người xác nhận");
            createCell(missingSheet.getRow(0), 6, "Thời gian xác nhận");
            int missingRowNum = 1;
            for (InventoryAuditMissing item : missingItems) {
                Row row = missingSheet.createRow(missingRowNum);
                createCell(row, 0, String.valueOf(missingRowNum));
                createCell(row, 1, item.getAssetQaCode());
                createCell(row, 2, item.getAssetName());
                createCell(row, 3, item.getLocationName());
                createCell(row, 4, mapMissingStatus(item.getResolutionStatus()));
                createCell(row, 5, item.getResolvedByUsername());
                createCell(row, 6, item.getResolvedAt() == null ? "" : item.getResolvedAt().toString());
                missingRowNum++;
            }
            if (missingItems.isEmpty()) {
                Row row = missingSheet.createRow(1);
                createCell(row, 0, "1");
                createCell(row, 1, "");
                createCell(row, 2, "Không có thiết bị thất lạc");
                createCell(row, 3, "");
                createCell(row, 4, "");
                createCell(row, 5, "");
                createCell(row, 6, "");
            }

            for (int i = 0; i <= 1; i++) {
                summarySheet.autoSizeColumn(i);
            }
            for (int i = 0; i <= 4; i++) {
                scannedSheet.autoSizeColumn(i);
            }
            for (int i = 0; i <= 6; i++) {
                missingSheet.autoSizeColumn(i);
            }

            workbook.write(outputStream);
            return outputStream.toByteArray();
        }
    }

    private void createCell(Row row, int column, String value) {
        Cell cell = row.createCell(column);
        cell.setCellValue(value == null ? "" : value);
    }

    private String mapMissingStatus(String status) {
        if ("FOUND".equalsIgnoreCase(status)) {
            return "Đã tìm thấy";
        }
        if ("LOST".equalsIgnoreCase(status)) {
            return "Mất hẳn";
        }
        return "Chưa tìm thấy";
    }

    private String getCategoryDisplayName(Category category) {
        return category == null ? "" : category.getName();
    }
}
