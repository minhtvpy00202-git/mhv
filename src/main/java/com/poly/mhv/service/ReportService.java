package com.poly.mhv.service;

import com.poly.mhv.entity.AppUser;
import com.poly.mhv.entity.Asset;
import com.poly.mhv.entity.Category;
import com.poly.mhv.entity.ConsumableDisposalRequest;
import com.poly.mhv.entity.ConsumableDisposalRequestItem;
import com.poly.mhv.entity.ConsumableReceiptLot;
import com.poly.mhv.entity.InventoryAudit;
import com.poly.mhv.entity.InventoryAuditItem;
import com.poly.mhv.entity.InventoryAuditMissing;
import com.poly.mhv.entity.UsageHistory;
import com.poly.mhv.repository.AssetRepository;
import com.poly.mhv.repository.ConsumableDisposalRequestRepository;
import com.poly.mhv.repository.InventoryAuditItemRepository;
import com.poly.mhv.repository.InventoryAuditMissingRepository;
import com.poly.mhv.repository.InventoryAuditRepository;
import com.poly.mhv.repository.UsageHistoryRepository;
import com.poly.mhv.util.AssetStatusSupport;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigInteger;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import org.apache.poi.xwpf.usermodel.BreakType;
import org.apache.poi.xwpf.usermodel.ParagraphAlignment;
import org.apache.poi.xwpf.usermodel.TableRowAlign;
import org.apache.poi.xwpf.usermodel.TextAlignment;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTBody;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTPageMar;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTSectPr;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTTblBorders;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTTblPr;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.STBorder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class ReportService {

    private final AssetRepository assetRepository;
    private final UsageHistoryRepository usageHistoryRepository;
    private final InventoryAuditRepository inventoryAuditRepository;
    private final InventoryAuditItemRepository inventoryAuditItemRepository;
    private final InventoryAuditMissingRepository inventoryAuditMissingRepository;
    private final ConsumableDisposalRequestRepository consumableDisposalRequestRepository;
    private final BrandingSettingsService brandingSettingsService;

    public ReportService(
            AssetRepository assetRepository,
            UsageHistoryRepository usageHistoryRepository,
            InventoryAuditRepository inventoryAuditRepository,
            InventoryAuditItemRepository inventoryAuditItemRepository,
            InventoryAuditMissingRepository inventoryAuditMissingRepository,
            ConsumableDisposalRequestRepository consumableDisposalRequestRepository,
            BrandingSettingsService brandingSettingsService
    ) {
        this.assetRepository = assetRepository;
        this.usageHistoryRepository = usageHistoryRepository;
        this.inventoryAuditRepository = inventoryAuditRepository;
        this.inventoryAuditItemRepository = inventoryAuditItemRepository;
        this.inventoryAuditMissingRepository = inventoryAuditMissingRepository;
        this.consumableDisposalRequestRepository = consumableDisposalRequestRepository;
        this.brandingSettingsService = brandingSettingsService;
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
            createCell(headerRow, 4, "Kiểu theo dõi");
            createCell(headerRow, 5, "Tình trạng kỹ thuật");
            createCell(headerRow, 6, "Trạng thái sử dụng");
            createCell(headerRow, 7, "Trạng thái hiển thị");
            createCell(headerRow, 8, "Số lượng tồn");
            createCell(headerRow, 9, "Đơn vị tính");

            int rowNum = 1;
            for (Asset asset : assets) {
                Row row = sheet.createRow(rowNum++);
                createCell(row, 0, asset.getQaCode());
                createCell(row, 1, asset.getName());
                createCell(row, 2, getCategoryDisplayName(asset.getCategory()));
                createCell(row, 3, asset.getLocation().getRoomName());
                createCell(row, 4, "CONSUMABLE".equalsIgnoreCase(asset.getTrackingMode()) ? "Tiêu hao" : "Đơn chiếc");
                if ("CONSUMABLE".equalsIgnoreCase(asset.getTrackingMode())) {
                    createCell(row, 5, "");
                    createCell(row, 6, "");
                    createCell(row, 7, asset.getStatus());
                } else {
                    String technicalStatus = resolveTechnicalStatus(asset);
                    String usageStatus = resolveUsageStatus(asset);
                    createCell(row, 5, technicalStatus);
                    createCell(row, 6, usageStatus);
                    createCell(row, 7, AssetStatusSupport.deriveDisplayStatus(
                            technicalStatus,
                            usageStatus,
                            AssetStatusSupport.isRepairInProgress(asset.getStatus())
                    ));
                }
                createCell(row, 8, asset.getQuantityOnHand() == null ? "" : String.valueOf(asset.getQuantityOnHand()));
                createCell(row, 9, asset.getUnit());
            }

            for (int i = 0; i <= 9; i++) {
                sheet.autoSizeColumn(i);
            }

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
        String normalizedAssetName = StringUtils.hasText(assetName) ? assetName.trim().toLowerCase(Locale.ROOT) : null;
        List<UsageHistory> histories = usageHistoryRepository.findAllForAdminOrderByStartTimeDesc().stream()
                .filter(history -> {
                    if (!StringUtils.hasText(normalizedAssetName)) {
                        return true;
                    }
                    String assetValue = history.getAsset() == null || history.getAsset().getName() == null
                            ? ""
                            : history.getAsset().getName().toLowerCase(Locale.ROOT);
                    return assetValue.contains(normalizedAssetName);
                })
                .filter(history -> borrowedLocationId == null
                        || (history.getToLocation() != null && borrowedLocationId.equals(history.getToLocation().getId())))
                .filter(history -> userId == null
                        || (history.getUser() != null && userId.equals(history.getUser().getId())))
                .filter(history -> startDateTime == null
                        || (history.getStartTime() != null && !history.getStartTime().isBefore(startDateTime)))
                .filter(history -> endDateTime == null
                        || (history.getStartTime() != null && !history.getStartTime().isAfter(endDateTime)))
                .toList();

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

    @Transactional(readOnly = true)
    public byte[] exportExpiredDisposalDocument(Long requestId) throws IOException {
        ConsumableDisposalRequest request = consumableDisposalRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy yêu cầu tiêu huỷ."));
        if (!"APPROVED".equalsIgnoreCase(request.getStatus())) {
            throw new RuntimeException("Chỉ xuất được biên bản cho yêu cầu tiêu huỷ đã được duyệt.");
        }
        Asset asset = request.getAsset();
        AppUser requester = request.getRequestedBy();
        AppUser approver = request.getResolvedBy();
        LocalDate documentDate = resolveDocumentDate(request);
        List<ConsumableDisposalRequestItem> requestItems = request.getItems() == null ? List.of() : request.getItems();
        String companyName = brandingSettingsService.getCompanyName();
        String appName = brandingSettingsService.getAppName();

        try (XWPFDocument document = new XWPFDocument(); ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            configureDocumentPage(document);

            XWPFTable headerTable = document.createTable(1, 2);
            applyInvisibleBorders(headerTable);
            headerTable.setTableAlignment(TableRowAlign.CENTER);
            populateHeaderCell(headerTable.getRow(0).getCell(0), List.of(companyName), ParagraphAlignment.CENTER, true);
            populateHeaderCell(
                    headerTable.getRow(0).getCell(1),
                    List.of("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", "Độc lập - Tự do - Hạnh phúc"),
                    ParagraphAlignment.CENTER,
                    true
            );

            createParagraph(document, "", ParagraphAlignment.LEFT, false);
            createParagraph(
                    document,
                    "Ngày " + documentDate.getDayOfMonth()
                            + " tháng " + documentDate.getMonthValue()
                            + " năm " + documentDate.getYear(),
                    ParagraphAlignment.RIGHT,
                    false
            );
            createParagraph(document, "BIÊN BẢN HỦY HÀNG HÓA HẾT HẠN SỬ DỤNG", ParagraphAlignment.CENTER, true);
            createParagraph(document, "Căn cứ đề nghị tiêu huỷ vật tư hết hạn sử dụng đã được phê duyệt.", ParagraphAlignment.LEFT, false);
            createParagraph(
                    document,
                    "Hôm nay, tại kho vật tư của " + companyName + ", chúng tôi gồm:",
                    ParagraphAlignment.LEFT,
                    false
            );
            createParagraph(
                    document,
                    "1. " + getFullNameOrFallback(requester) + " - Chức vụ: " + toDocumentRoleLabel(requester),
                    ParagraphAlignment.LEFT,
                    false
            );
            createParagraph(
                    document,
                    "2. " + getFullNameOrFallback(approver) + " - Chức vụ: " + toDocumentRoleLabel(approver),
                    ParagraphAlignment.LEFT,
                    false
            );
            createParagraph(
                    document,
                    "Cùng thống nhất tiêu huỷ lô hàng hóa hết hạn sử dụng theo danh sách dưới đây:",
                    ParagraphAlignment.LEFT,
                    false
            );

            int rowCount = Math.max(2, requestItems.size() + 1);
            XWPFTable itemsTable = document.createTable(rowCount, 7);
            applyInvisibleBorders(itemsTable);
            XWPFTableRow headerRow = itemsTable.getRow(0);
            setTableCellText(headerRow.getCell(0), "STT", ParagraphAlignment.CENTER, true);
            setTableCellText(headerRow.getCell(1), "Tên hàng hóa", ParagraphAlignment.CENTER, true);
            setTableCellText(headerRow.getCell(2), "ĐVT", ParagraphAlignment.CENTER, true);
            setTableCellText(headerRow.getCell(3), "Số lượng", ParagraphAlignment.CENTER, true);
            setTableCellText(headerRow.getCell(4), "Ngày nhập", ParagraphAlignment.CENTER, true);
            setTableCellText(headerRow.getCell(5), "Ngày hết hạn sử dụng", ParagraphAlignment.CENTER, true);
            setTableCellText(headerRow.getCell(6), "Lô hàng", ParagraphAlignment.CENTER, true);
            if (requestItems.isEmpty()) {
                ConsumableReceiptLot lot = request.getReceiptLot();
                XWPFTableRow valueRow = itemsTable.getRow(1);
                setTableCellText(valueRow.getCell(0), "1", ParagraphAlignment.CENTER, false);
                setTableCellText(valueRow.getCell(1), asset.getName(), ParagraphAlignment.LEFT, false);
                setTableCellText(valueRow.getCell(2), StringUtils.hasText(asset.getUnit()) ? asset.getUnit() : "", ParagraphAlignment.CENTER, false);
                setTableCellText(valueRow.getCell(3), String.valueOf(request.getQuantityRequested()), ParagraphAlignment.CENTER, false);
                setTableCellText(valueRow.getCell(4), formatLocalDate(lot != null ? lot.getReceivedDate() : null), ParagraphAlignment.CENTER, false);
                setTableCellText(valueRow.getCell(5), formatLocalDate(lot != null ? lot.getExpirationDate() : null), ParagraphAlignment.CENTER, false);
                setTableCellText(valueRow.getCell(6), getLotDisplayName(lot), ParagraphAlignment.CENTER, false);
            } else {
                for (int index = 0; index < requestItems.size(); index += 1) {
                    ConsumableDisposalRequestItem requestItem = requestItems.get(index);
                    ConsumableReceiptLot lot = requestItem.getReceiptLot();
                    XWPFTableRow valueRow = itemsTable.getRow(index + 1);
                    setTableCellText(valueRow.getCell(0), String.valueOf(index + 1), ParagraphAlignment.CENTER, false);
                    setTableCellText(valueRow.getCell(1), asset.getName(), ParagraphAlignment.LEFT, false);
                    setTableCellText(valueRow.getCell(2), StringUtils.hasText(asset.getUnit()) ? asset.getUnit() : "", ParagraphAlignment.CENTER, false);
                    setTableCellText(valueRow.getCell(3), String.valueOf(requestItem.getQuantityRequested()), ParagraphAlignment.CENTER, false);
                    setTableCellText(valueRow.getCell(4), formatLocalDate(lot != null ? lot.getReceivedDate() : null), ParagraphAlignment.CENTER, false);
                    setTableCellText(valueRow.getCell(5), formatLocalDate(lot != null ? lot.getExpirationDate() : null), ParagraphAlignment.CENTER, false);
                    setTableCellText(valueRow.getCell(6), getLotDisplayName(lot), ParagraphAlignment.CENTER, false);
                }
            }

            createParagraph(document, "Lý do tiêu huỷ: " + request.getReason(), ParagraphAlignment.LEFT, false);
            createParagraph(
                    document,
                    "Biên bản được lập thành 01 bản để lưu hồ sơ " + companyName + " " + appName + ".",
                    ParagraphAlignment.LEFT,
                    false
            );

            XWPFTable signatureTable = document.createTable(2, 3);
            applyInvisibleBorders(signatureTable);
            signatureTable.setTableAlignment(TableRowAlign.CENTER);
            XWPFTableRow roleRow = signatureTable.getRow(0);
            setTableCellText(roleRow.getCell(0), "Quản trị hệ thống", ParagraphAlignment.CENTER, true);
            setTableCellText(roleRow.getCell(1), "Nhân viên quản lý vật tư", ParagraphAlignment.CENTER, true);
            setTableCellText(roleRow.getCell(2), "Giám đốc", ParagraphAlignment.CENTER, true);
            XWPFTableRow noteRow = signatureTable.getRow(1);
            setTableCellText(noteRow.getCell(0), "(Ký và ghi rõ họ tên)", ParagraphAlignment.CENTER, false);
            setTableCellText(noteRow.getCell(1), "(Ký và ghi rõ họ tên)", ParagraphAlignment.CENTER, false);
            setTableCellText(noteRow.getCell(2), "(Ký và ghi rõ họ tên)", ParagraphAlignment.CENTER, false);

            document.write(outputStream);
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

    private void createParagraph(XWPFDocument document, String text, ParagraphAlignment alignment, boolean bold) {
        XWPFParagraph paragraph = document.createParagraph();
        writeParagraph(paragraph, text, alignment, bold);
    }

    private LocalDate resolveDocumentDate(ConsumableDisposalRequest request) {
        LocalDateTime resolvedAt = request.getResolvedAt();
        if (resolvedAt != null) {
            return resolvedAt.toLocalDate();
        }
        if (request.getCreatedAt() != null) {
            return request.getCreatedAt().toLocalDate();
        }
        return LocalDate.now();
    }

    private String formatLocalDate(LocalDate value) {
        if (value == null) {
            return "";
        }
        return value.format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));
    }

    private String getFullNameOrFallback(AppUser user) {
        if (user == null) {
            return "";
        }
        return StringUtils.hasText(user.getFullName()) ? user.getFullName().trim() : user.getUsername();
    }

    private String toDocumentRoleLabel(AppUser user) {
        if (user == null) {
            return "";
        }
        return switch (user.getRole()) {
            case "Admin" -> "Quản trị hệ thống";
            case "ConsumableManager" -> "Nhân viên quản lý vật tư";
            case "TechSupport" -> "Kỹ thuật viên";
            case "NhanVien" -> "Nhân viên";
            default -> "Người dùng";
        };
    }

    private String getLotDisplayName(ConsumableReceiptLot lot) {
        if (lot == null) {
            return "";
        }
        return StringUtils.hasText(lot.getLotCode()) ? lot.getLotCode().trim() : "Lô #" + lot.getId();
    }

    private void configureDocumentPage(XWPFDocument document) {
        CTBody body = document.getDocument().getBody();
        CTSectPr section = body.isSetSectPr() ? body.getSectPr() : body.addNewSectPr();
        CTPageMar pageMar = section.isSetPgMar() ? section.getPgMar() : section.addNewPgMar();
        pageMar.setTop(BigInteger.valueOf(1134));
        pageMar.setBottom(BigInteger.valueOf(1134));
        pageMar.setLeft(BigInteger.valueOf(1701));
        pageMar.setRight(BigInteger.valueOf(1134));
    }

    private void applyInvisibleBorders(XWPFTable table) {
        CTTblPr tableProperties = table.getCTTbl().getTblPr();
        if (tableProperties == null) {
            tableProperties = table.getCTTbl().addNewTblPr();
        }
        CTTblBorders borders = tableProperties.isSetTblBorders()
                ? tableProperties.getTblBorders()
                : tableProperties.addNewTblBorders();
        borders.addNewTop().setVal(STBorder.NONE);
        borders.addNewBottom().setVal(STBorder.NONE);
        borders.addNewLeft().setVal(STBorder.NONE);
        borders.addNewRight().setVal(STBorder.NONE);
        borders.addNewInsideH().setVal(STBorder.NONE);
        borders.addNewInsideV().setVal(STBorder.NONE);
    }

    private void populateHeaderCell(XWPFTableCell cell, List<String> lines, ParagraphAlignment alignment, boolean bold) {
        cell.removeParagraph(0);
        for (String line : lines) {
            XWPFParagraph paragraph = cell.addParagraph();
            writeParagraph(paragraph, line, alignment, bold);
        }
    }

    private void setTableCellText(XWPFTableCell cell, String text, ParagraphAlignment alignment, boolean bold) {
        cell.removeParagraph(0);
        XWPFParagraph paragraph = cell.addParagraph();
        writeParagraph(paragraph, text, alignment, bold);
    }

    private void writeParagraph(XWPFParagraph paragraph, String text, ParagraphAlignment alignment, boolean bold) {
        paragraph.setAlignment(alignment);
        paragraph.setVerticalAlignment(TextAlignment.CENTER);
        paragraph.setSpacingBetween(1.5);
        XWPFRun run = paragraph.createRun();
        run.setFontFamily("Times New Roman");
        run.setFontSize(13);
        run.setBold(bold);
        String normalizedText = text == null ? "" : text;
        String[] lines = normalizedText.split("\\n", -1);
        for (int index = 0; index < lines.length; index += 1) {
            if (index > 0) {
                run.addBreak(BreakType.TEXT_WRAPPING);
            }
            run.setText(lines[index]);
        }
    }
}
