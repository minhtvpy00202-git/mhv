package com.poly.mhv.service;

import com.poly.mhv.dto.statistics.AssetStatisticsAuditResponse;
import com.poly.mhv.dto.statistics.AssetStatisticsCountResponse;
import com.poly.mhv.dto.statistics.AssetStatisticsRankResponse;
import com.poly.mhv.dto.statistics.AssetStatisticsResponse;
import com.poly.mhv.dto.statistics.AssetStatisticsSummaryResponse;
import com.poly.mhv.dto.statistics.AssetStatisticsTrendResponse;
import com.poly.mhv.repository.AssetRepository;
import com.poly.mhv.repository.ConsumableDisposalRequestRepository;
import com.poly.mhv.repository.ConsumableIssueRepository;
import com.poly.mhv.repository.ConsumableReceiptLotRepository;
import com.poly.mhv.repository.ConsumableRequestRepository;
import com.poly.mhv.repository.InventoryAuditRepository;
import com.poly.mhv.repository.TicketRepository;
import com.poly.mhv.repository.UsageHistoryRepository;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.BigInteger;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AssetStatisticsService {

    private static final int DEFAULT_RANGE_DAYS = 30;
    private static final int MAX_FILLED_TREND_DAYS = 120;

    private final AssetRepository assetRepository;
    private final ConsumableReceiptLotRepository consumableReceiptLotRepository;
    private final ConsumableRequestRepository consumableRequestRepository;
    private final ConsumableDisposalRequestRepository consumableDisposalRequestRepository;
    private final ConsumableIssueRepository consumableIssueRepository;
    private final UsageHistoryRepository usageHistoryRepository;
    private final TicketRepository ticketRepository;
    private final InventoryAuditRepository inventoryAuditRepository;

    public AssetStatisticsService(
            AssetRepository assetRepository,
            ConsumableReceiptLotRepository consumableReceiptLotRepository,
            ConsumableRequestRepository consumableRequestRepository,
            ConsumableDisposalRequestRepository consumableDisposalRequestRepository,
            ConsumableIssueRepository consumableIssueRepository,
            UsageHistoryRepository usageHistoryRepository,
            TicketRepository ticketRepository,
            InventoryAuditRepository inventoryAuditRepository
    ) {
        this.assetRepository = assetRepository;
        this.consumableReceiptLotRepository = consumableReceiptLotRepository;
        this.consumableRequestRepository = consumableRequestRepository;
        this.consumableDisposalRequestRepository = consumableDisposalRequestRepository;
        this.consumableIssueRepository = consumableIssueRepository;
        this.usageHistoryRepository = usageHistoryRepository;
        this.ticketRepository = ticketRepository;
        this.inventoryAuditRepository = inventoryAuditRepository;
    }

    @Transactional(readOnly = true)
    public AssetStatisticsResponse getStatistics(
            LocalDate fromDate,
            LocalDate toDate,
            Integer categoryId,
            Integer locationId
    ) {
        DateRange range = normalizeDateRange(fromDate, toDate);
        LocalDate today = LocalDate.now();
        LocalDateTime startTime = range.fromDate().atStartOfDay();
        LocalDateTime endTime = range.toDate().plusDays(1).atStartOfDay().minusNanos(1);

        AssetStatisticsSummaryResponse summary = AssetStatisticsSummaryResponse.builder()
                .fixedAssetCount(assetRepository.countFixedAssetsForStatistics(categoryId, locationId))
                .consumableCount(assetRepository.countConsumablesForStatistics(categoryId, locationId))
                .availableAssetCount(assetRepository.countAvailableAssetsForStatistics(categoryId, locationId))
                .borrowedAssetCount(assetRepository.countBorrowedAssetsForStatistics(categoryId, locationId))
                .brokenAssetCount(assetRepository.countBrokenAssetsForStatistics(categoryId, locationId))
                .repairingAssetCount(assetRepository.countRepairingAssetsForStatistics(categoryId, locationId))
                .lostAssetCount(assetRepository.countLostAssetsForStatistics(categoryId, locationId))
                .lowStockConsumableCount(assetRepository.countLowStockConsumablesForStatistics(categoryId, locationId))
                .expiredLotCount(consumableReceiptLotRepository.countExpiredOpenLotsForStatistics(today, categoryId, locationId))
                .expiringSoonLotCount(consumableReceiptLotRepository.countExpiringOpenLotsForStatistics(
                        today,
                        today.plusDays(30),
                        categoryId,
                        locationId
                ))
                .pendingConsumableRequestCount(consumableRequestRepository.countByStatusForStatistics("PENDING", categoryId, locationId))
                .pendingDisposalRequestCount(consumableDisposalRequestRepository.countByStatusForStatistics("PENDING", categoryId, locationId))
                .borrowEventCount(usageHistoryRepository.countBorrowEventsForStatistics(startTime, endTime, categoryId, locationId))
                .ticketCount(ticketRepository.countTicketsForStatistics(startTime, endTime, categoryId, locationId))
                .auditCount(inventoryAuditRepository.countAuditsForStatistics(startTime, endTime, locationId))
                .auditMissingCount(inventoryAuditRepository.sumMissingCountForStatistics(startTime, endTime, locationId))
                .fixedAssetValue(assetRepository.sumFixedAssetPurchaseValueForStatistics(categoryId, locationId))
                .consumableInventoryValue(consumableReceiptLotRepository.sumOpenLotInventoryValueForStatistics(categoryId, locationId))
                .build();

        return AssetStatisticsResponse.builder()
                .fromDate(range.fromDate())
                .toDate(range.toDate())
                .categoryId(categoryId)
                .locationId(locationId)
                .summary(summary)
                .fixedAssetStatus(mapCountRows(assetRepository.countFixedAssetsByDisplayStatusForStatistics(categoryId, locationId)))
                .fixedAssetUsage(mapCountRows(assetRepository.countFixedAssetsByUsageStatusForStatistics(categoryId, locationId)))
                .fixedAssetsByCategory(mapCountRows(assetRepository.countAssetsByCategoryForStatistics("ITEMIZED", categoryId, locationId)))
                .fixedAssetsByLocation(mapCountRows(assetRepository.countAssetsByLocationForStatistics("ITEMIZED", categoryId, locationId)))
                .consumablesByCategory(mapCountRows(assetRepository.countAssetsByCategoryForStatistics("CONSUMABLE", categoryId, locationId)))
                .consumableStockStatus(mapCountRows(assetRepository.countConsumablesByStockStatusForStatistics(categoryId, locationId)))
                .expiryBuckets(mapCountRows(consumableReceiptLotRepository.countOpenLotsByExpiryBucketForStatistics(
                        today,
                        today.plusDays(7),
                        today.plusDays(30),
                        categoryId,
                        locationId
                )))
                .borrowTrend(fillTrend(
                        usageHistoryRepository.countBorrowTrendForStatistics(startTime, endTime, categoryId, locationId),
                        range.fromDate(),
                        range.toDate()
                ))
                .ticketTrend(fillTrend(
                        ticketRepository.countTicketTrendForStatistics(startTime, endTime, categoryId, locationId),
                        range.fromDate(),
                        range.toDate()
                ))
                .issuanceTrend(fillTrend(
                        consumableIssueRepository.countIssuanceTrendForStatistics(startTime, endTime, categoryId, locationId),
                        range.fromDate(),
                        range.toDate()
                ))
                .ticketStatus(mapStatusRows(ticketRepository.countTicketsByStatusForStatistics(startTime, endTime, categoryId, locationId), "ticket"))
                .auditStatus(mapStatusRows(inventoryAuditRepository.countAuditsByStatusForStatistics(startTime, endTime, locationId), "audit"))
                .topBorrowedAssets(mapRankRows(usageHistoryRepository.findTopBorrowedAssetsForStatistics(startTime, endTime, categoryId, locationId)))
                .topProblemAssets(mapRankRows(ticketRepository.findTopProblemAssetsForStatistics(startTime, endTime, categoryId, locationId)))
                .topLowStockConsumables(mapLowStockRows(assetRepository.findTopLowStockConsumablesForStatistics(categoryId, locationId)))
                .topBorrowedUsers(mapRankRows(usageHistoryRepository.findTopBorrowedUsersForStatistics(startTime, endTime, categoryId, locationId)))
                .topBorrowedLocations(mapRankRows(usageHistoryRepository.findTopBorrowedLocationsForStatistics(startTime, endTime, categoryId, locationId)))
                .topDispensedConsumables(mapRankRows(consumableIssueRepository.findTopDispensedConsumablesForStatistics(startTime, endTime, categoryId, locationId)))
                .recentAudits(mapAuditRows(inventoryAuditRepository.findRecentAuditsForStatistics(startTime, endTime, locationId)))
                .build();
    }

    @Transactional(readOnly = true)
    public byte[] exportStatisticsExcel(
            LocalDate fromDate,
            LocalDate toDate,
            Integer categoryId,
            Integer locationId
    ) throws IOException {
        AssetStatisticsResponse statistics = getStatistics(fromDate, toDate, categoryId, locationId);

        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            writeSummarySheet(workbook, statistics);
            writeCountSheet(workbook, "TSCĐ theo trạng thái", statistics.getFixedAssetStatus());
            writeCountSheet(workbook, "Vật tư theo tồn kho", statistics.getConsumableStockStatus());
            writeCountSheet(workbook, "Lô theo hạn dùng", statistics.getExpiryBuckets());
            writeTrendSheet(workbook, "Xu hướng mượn trả", statistics.getBorrowTrend());
            writeTrendSheet(workbook, "Xu hướng ticket", statistics.getTicketTrend());
            writeTrendSheet(workbook, "Xu hướng cấp phát", statistics.getIssuanceTrend());
            writeRankSheet(workbook, "Top thiết bị mượn", statistics.getTopBorrowedAssets());
            writeRankSheet(workbook, "Top thiết bị lỗi", statistics.getTopProblemAssets());
            writeRankSheet(workbook, "Vật tư cần nhập", statistics.getTopLowStockConsumables());
            writePersonRankSheet(workbook, "Top NV mượn nhiều", statistics.getTopBorrowedUsers());
            writeLocationRankSheet(workbook, "Top phòng mượn nhiều", statistics.getTopBorrowedLocations());
            writeRankSheet(workbook, "Top vật tư cấp phát", statistics.getTopDispensedConsumables());
            workbook.write(outputStream);
            return outputStream.toByteArray();
        }
    }

    private DateRange normalizeDateRange(LocalDate fromDate, LocalDate toDate) {
        LocalDate today = LocalDate.now();
        LocalDate safeToDate = toDate == null ? today : toDate;
        LocalDate safeFromDate = fromDate == null ? safeToDate.minusDays(DEFAULT_RANGE_DAYS - 1L) : fromDate;
        if (safeFromDate.isAfter(safeToDate)) {
            return new DateRange(safeToDate, safeFromDate);
        }
        return new DateRange(safeFromDate, safeToDate);
    }

    private List<AssetStatisticsCountResponse> mapCountRows(List<Object[]> rows) {
        return rows.stream()
                .map(row -> AssetStatisticsCountResponse.builder()
                        .label(asString(row[0]))
                        .count(asLong(row[1]))
                        .build())
                .toList();
    }

    private List<AssetStatisticsCountResponse> mapStatusRows(List<Object[]> rows, String domain) {
        return rows.stream()
                .map(row -> AssetStatisticsCountResponse.builder()
                        .label(toStatusLabel(asString(row[0]), domain))
                        .count(asLong(row[1]))
                        .build())
                .toList();
    }

    private List<AssetStatisticsTrendResponse> fillTrend(List<Object[]> rows, LocalDate fromDate, LocalDate toDate) {
        Map<LocalDate, Long> countByDate = rows.stream()
                .collect(Collectors.toMap(row -> asLocalDate(row[0]), row -> asLong(row[1]), Long::sum, LinkedHashMap::new));
        long days = java.time.temporal.ChronoUnit.DAYS.between(fromDate, toDate) + 1;
        if (days <= 0 || days > MAX_FILLED_TREND_DAYS) {
            return countByDate.entrySet().stream()
                    .map(entry -> AssetStatisticsTrendResponse.builder()
                            .date(entry.getKey())
                            .count(entry.getValue())
                            .build())
                    .toList();
        }
        java.util.ArrayList<AssetStatisticsTrendResponse> filled = new java.util.ArrayList<>();
        for (LocalDate cursor = fromDate; !cursor.isAfter(toDate); cursor = cursor.plusDays(1)) {
            filled.add(AssetStatisticsTrendResponse.builder()
                    .date(cursor)
                    .count(countByDate.getOrDefault(cursor, 0L))
                    .build());
        }
        return filled;
    }

    private List<AssetStatisticsRankResponse> mapRankRows(List<Object[]> rows) {
        return rows.stream()
                .map(row -> AssetStatisticsRankResponse.builder()
                        .qaCode(asString(row[0]))
                        .name(asString(row[1]))
                        .categoryName(asString(row[2]))
                        .locationName(asString(row[3]))
                        .count(asLong(row[4]))
                        .build())
                .toList();
    }

    private List<AssetStatisticsRankResponse> mapLowStockRows(List<Object[]> rows) {
        return rows.stream()
                .map(row -> AssetStatisticsRankResponse.builder()
                        .qaCode(asString(row[0]))
                        .name(asString(row[1]))
                        .categoryName(asString(row[2]))
                        .locationName(asString(row[3]))
                        .quantityOnHand(asInteger(row[4]))
                        .minimumStock(asInteger(row[5]))
                        .unit(asString(row[6]))
                        .unitValue(asBigDecimal(row[7]))
                        .build())
                .toList();
    }

    private List<AssetStatisticsAuditResponse> mapAuditRows(List<Object[]> rows) {
        return rows.stream()
                .map(row -> AssetStatisticsAuditResponse.builder()
                        .id(asInteger(row[0]))
                        .locationName(asString(row[1]))
                        .status(toStatusLabel(asString(row[2]), "audit"))
                        .expectedCount(asInteger(row[3]))
                        .scannedCount(asInteger(row[4]))
                        .missingCount(asInteger(row[5]))
                        .startedAt(asLocalDateTime(row[6]))
                        .completedAt(asLocalDateTime(row[7]))
                        .build())
                .toList();
    }

    private String toStatusLabel(String value, String domain) {
        if ("ticket".equals(domain)) {
            return switch (value) {
                case "PENDING" -> "Ticket mới";
                case "IN_PROGRESS" -> "Đang xử lý";
                case "RESOLVED" -> "Đã xử lý";
                default -> value;
            };
        }
        if ("audit".equals(domain)) {
            return switch (value) {
                case "OPEN" -> "Đang mở";
                case "COMPLETED" -> "Hoàn tất";
                default -> value;
            };
        }
        return value;
    }

    private long asLong(Object value) {
        if (value == null) {
            return 0L;
        }
        if (value instanceof Number number) {
            return number.longValue();
        }
        return Long.parseLong(String.valueOf(value));
    }

    private Integer asInteger(Object value) {
        if (value == null) {
            return 0;
        }
        if (value instanceof Number number) {
            return number.intValue();
        }
        return Integer.parseInt(String.valueOf(value));
    }

    private BigDecimal asBigDecimal(Object value) {
        if (value == null) {
            return BigDecimal.ZERO;
        }
        if (value instanceof BigDecimal decimal) {
            return decimal;
        }
        if (value instanceof BigInteger integer) {
            return new BigDecimal(integer);
        }
        if (value instanceof Number number) {
            return BigDecimal.valueOf(number.doubleValue());
        }
        return new BigDecimal(String.valueOf(value));
    }

    private String asString(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private LocalDate asLocalDate(Object value) {
        if (value instanceof LocalDate localDate) {
            return localDate;
        }
        if (value instanceof Date date) {
            return date.toLocalDate();
        }
        if (value instanceof Timestamp timestamp) {
            return timestamp.toLocalDateTime().toLocalDate();
        }
        return LocalDate.parse(String.valueOf(value));
    }

    private LocalDateTime asLocalDateTime(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof LocalDateTime localDateTime) {
            return localDateTime;
        }
        if (value instanceof Timestamp timestamp) {
            return timestamp.toLocalDateTime();
        }
        if (value instanceof java.util.Date date) {
            return new Timestamp(date.getTime()).toLocalDateTime();
        }
        return LocalDateTime.parse(String.valueOf(value).replace(" ", "T"));
    }

    private void writeSummarySheet(XSSFWorkbook workbook, AssetStatisticsResponse statistics) {
        XSSFSheet sheet = workbook.createSheet("Tong quan");
        AssetStatisticsSummaryResponse summary = statistics.getSummary();
        createCell(sheet.createRow(0), 0, "Tu ngay");
        createCell(sheet.getRow(0), 1, String.valueOf(statistics.getFromDate()));
        createCell(sheet.createRow(1), 0, "Den ngay");
        createCell(sheet.getRow(1), 1, String.valueOf(statistics.getToDate()));

        Object[][] rows = {
                {"Tai san co dinh", summary.getFixedAssetCount()},
                {"Vat tu tieu hao", summary.getConsumableCount()},
                {"Dang muon", summary.getBorrowedAssetCount()},
                {"Hong", summary.getBrokenAssetCount()},
                {"Dang sua chua", summary.getRepairingAssetCount()},
                {"That lac", summary.getLostAssetCount()},
                {"Vat tu can nhap", summary.getLowStockConsumableCount()},
                {"Lo het han", summary.getExpiredLotCount()},
                {"Luot muon trong ky", summary.getBorrowEventCount()},
                {"Ticket trong ky", summary.getTicketCount()},
                {"Kiem ke trong ky", summary.getAuditCount()},
                {"Thiet bi thieu khi kiem ke", summary.getAuditMissingCount()},
                {"Gia tri tai san co dinh", summary.getFixedAssetValue()},
                {"Gia tri ton vat tu", summary.getConsumableInventoryValue()}
        };

        int rowIndex = 3;
        for (Object[] item : rows) {
            Row row = sheet.createRow(rowIndex++);
            createCell(row, 0, String.valueOf(item[0]));
            createCell(row, 1, String.valueOf(item[1]));
        }
        autoSize(sheet, 2);
    }

    private void writeCountSheet(XSSFWorkbook workbook, String sheetName, List<AssetStatisticsCountResponse> rows) {
        XSSFSheet sheet = workbook.createSheet(sheetName);
        Row header = sheet.createRow(0);
        createCell(header, 0, "Nhom");
        createCell(header, 1, "So luong");
        int rowIndex = 1;
        for (AssetStatisticsCountResponse item : rows) {
            Row row = sheet.createRow(rowIndex++);
            createCell(row, 0, item.getLabel());
            createCell(row, 1, String.valueOf(item.getCount()));
        }
        autoSize(sheet, 2);
    }

    private void writeTrendSheet(XSSFWorkbook workbook, String sheetName, List<AssetStatisticsTrendResponse> rows) {
        XSSFSheet sheet = workbook.createSheet(sheetName);
        Row header = sheet.createRow(0);
        createCell(header, 0, "Ngay");
        createCell(header, 1, "So luong");
        int rowIndex = 1;
        for (AssetStatisticsTrendResponse item : rows) {
            Row row = sheet.createRow(rowIndex++);
            createCell(row, 0, String.valueOf(item.getDate()));
            createCell(row, 1, String.valueOf(item.getCount()));
        }
        autoSize(sheet, 2);
    }

    private void writeRankSheet(XSSFWorkbook workbook, String sheetName, List<AssetStatisticsRankResponse> rows) {
        XSSFSheet sheet = workbook.createSheet(sheetName);
        Row header = sheet.createRow(0);
        createCell(header, 0, "Ma QA");
        createCell(header, 1, "Ten");
        createCell(header, 2, "Loai");
        createCell(header, 3, "Vi tri");
        createCell(header, 4, "So luong/Luot");
        createCell(header, 5, "Ton hien tai");
        createCell(header, 6, "Nguong");
        createCell(header, 7, "Don vi");
        int rowIndex = 1;
        for (AssetStatisticsRankResponse item : rows) {
            Row row = sheet.createRow(rowIndex++);
            createCell(row, 0, item.getQaCode());
            createCell(row, 1, item.getName());
            createCell(row, 2, item.getCategoryName());
            createCell(row, 3, item.getLocationName());
            createCell(row, 4, String.valueOf(item.getCount()));
            createCell(row, 5, item.getQuantityOnHand() == null ? "" : String.valueOf(item.getQuantityOnHand()));
            createCell(row, 6, item.getMinimumStock() == null ? "" : String.valueOf(item.getMinimumStock()));
            createCell(row, 7, item.getUnit());
        }
        autoSize(sheet, 8);
    }

    private void writePersonRankSheet(XSSFWorkbook workbook, String sheetName, List<AssetStatisticsRankResponse> rows) {
        XSSFSheet sheet = workbook.createSheet(sheetName);
        Row header = sheet.createRow(0);
        createCell(header, 0, "Ho ten");
        createCell(header, 1, "Username");
        createCell(header, 2, "Luot muon");
        int rowIndex = 1;
        for (AssetStatisticsRankResponse item : rows) {
            Row row = sheet.createRow(rowIndex++);
            createCell(row, 0, item.getName());
            createCell(row, 1, item.getCategoryName());
            createCell(row, 2, String.valueOf(item.getCount()));
        }
        autoSize(sheet, 3);
    }

    private void writeLocationRankSheet(XSSFWorkbook workbook, String sheetName, List<AssetStatisticsRankResponse> rows) {
        XSSFSheet sheet = workbook.createSheet(sheetName);
        Row header = sheet.createRow(0);
        createCell(header, 0, "Phong / Vi tri");
        createCell(header, 1, "Luot muon");
        int rowIndex = 1;
        for (AssetStatisticsRankResponse item : rows) {
            Row row = sheet.createRow(rowIndex++);
            createCell(row, 0, item.getName());
            createCell(row, 1, String.valueOf(item.getCount()));
        }
        autoSize(sheet, 2);
    }

    private void createCell(Row row, int column, String value) {
        Cell cell = row.createCell(column);
        cell.setCellValue(value == null ? "" : value);
    }

    private void autoSize(XSSFSheet sheet, int columns) {
        for (int index = 0; index < columns; index += 1) {
            sheet.autoSizeColumn(index);
        }
    }

    private record DateRange(LocalDate fromDate, LocalDate toDate) {
    }
}
