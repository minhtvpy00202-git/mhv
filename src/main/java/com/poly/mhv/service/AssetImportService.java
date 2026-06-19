package com.poly.mhv.service;

import com.poly.mhv.dto.asset.AssetCreateRequest;
import com.poly.mhv.dto.asset.AssetImportPreviewResponse;
import com.poly.mhv.dto.asset.AssetImportPreviewRow;
import com.poly.mhv.entity.Category;
import com.poly.mhv.entity.Location;
import com.poly.mhv.entity.Supplier;
import com.poly.mhv.repository.CategoryRepository;
import com.poly.mhv.repository.LocationRepository;
import com.poly.mhv.repository.SupplierRepository;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.xssf.usermodel.XSSFRow;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class AssetImportService {

    static final String[] HEADERS = {
        "Kiểu theo dõi (*)",
        "Tên thiết bị (*)",
        "Loại thiết bị (*)",
        "Phòng gốc (*ITEMIZED)",
        "Tình trạng kỹ thuật",
        "Trạng thái sử dụng",
        "Giá mua",
        "Ngày mua (yyyy-MM-dd)",
        "Hết bảo hành (yyyy-MM-dd)",
        "Nhà cung cấp",
        "Số lượng tồn (*CONSUMABLE)",
        "Ngưỡng cảnh báo",
        "Đơn vị",
        "Bật HSD (true/false)",
        "Hạn dùng (yyyy-MM-dd)"
    };

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private final CategoryRepository categoryRepository;
    private final LocationRepository locationRepository;
    private final SupplierRepository supplierRepository;
    private final AssetService assetService;

    public AssetImportService(
            CategoryRepository categoryRepository,
            LocationRepository locationRepository,
            SupplierRepository supplierRepository,
            AssetService assetService
    ) {
        this.categoryRepository = categoryRepository;
        this.locationRepository = locationRepository;
        this.supplierRepository = supplierRepository;
        this.assetService = assetService;
    }

    public byte[] generateTemplate() throws IOException {
        List<Category> categories = categoryRepository.findAll();
        List<Location> locations = locationRepository.findAll();
        List<Supplier> suppliers = supplierRepository.findAll();

        try (XSSFWorkbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            XSSFSheet sheet = workbook.createSheet("Nhập tài sản");

            XSSFRow headerRow = sheet.createRow(0);
            for (int i = 0; i < HEADERS.length; i++) {
                headerRow.createCell(i).setCellValue(HEADERS[i]);
            }

            String firstCategory = categories.isEmpty() ? "Loại thiết bị (xem sheet Danh mục)" : categories.get(0).getName();
            String firstLocation = locations.isEmpty() ? "Phòng (xem sheet Danh mục)" : locations.get(0).getRoomName();
            String firstSupplier = suppliers.isEmpty() ? "" : suppliers.get(0).getName();

            XSSFRow exampleItemized = sheet.createRow(1);
            String[] exampleI = {
                "ITEMIZED", "Tên thiết bị mẫu", firstCategory, firstLocation,
                "Hoạt động tốt", "Tại vị trí gốc", "5000000", "2024-01-15",
                "2027-01-15", firstSupplier, "", "", "", "", ""
            };
            for (int i = 0; i < exampleI.length; i++) {
                exampleItemized.createCell(i).setCellValue(exampleI[i]);
            }

            String firstConsumableCategory = categories.stream()
                    .filter(c -> "CONSUMABLE".equalsIgnoreCase(c.getCategoryKind()))
                    .findFirst()
                    .map(Category::getName)
                    .orElse(firstCategory);

            XSSFRow exampleConsumable = sheet.createRow(2);
            String[] exampleC = {
                "CONSUMABLE", "Vật tư mẫu", firstConsumableCategory, "",
                "", "", "50000", "2024-03-01", "", firstSupplier, "20",
                "5", "Cái", "false", ""
            };
            for (int i = 0; i < exampleC.length; i++) {
                exampleConsumable.createCell(i).setCellValue(exampleC[i]);
            }

            for (int i = 0; i < HEADERS.length; i++) {
                sheet.autoSizeColumn(i);
            }

            writeGuideSheet(workbook.createSheet("Hướng dẫn"));
            writeReferenceSheet(workbook.createSheet("Danh mục hợp lệ"), categories, locations, suppliers);
            workbook.write(out);
            return out.toByteArray();
        }
    }

    private void writeReferenceSheet(XSSFSheet sheet, List<Category> categories, List<Location> locations, List<Supplier> suppliers) {
        int col = 0;

        XSSFRow catHeader = sheet.createRow(0);
        catHeader.createCell(col).setCellValue("Loại thiết bị (ITEMIZED)");
        int row = 1;
        for (Category c : categories) {
            if (!"CONSUMABLE".equalsIgnoreCase(c.getCategoryKind())) {
                sheet.createRow(row++).createCell(col).setCellValue(c.getName());
            }
        }

        col = 1;
        XSSFRow conHeader = sheet.createRow(0);
        conHeader.createCell(col).setCellValue("Loại vật tư (CONSUMABLE)");
        row = 1;
        for (Category c : categories) {
            if ("CONSUMABLE".equalsIgnoreCase(c.getCategoryKind())) {
                Row r = sheet.getRow(row);
                if (r == null) r = sheet.createRow(row);
                r.createCell(col).setCellValue(c.getName());
                row++;
            }
        }

        col = 2;
        sheet.getRow(0).createCell(col).setCellValue("Phòng / Vị trí");
        row = 1;
        for (Location l : locations) {
            Row r = sheet.getRow(row);
            if (r == null) r = sheet.createRow(row);
            r.createCell(col).setCellValue(l.getRoomName());
            row++;
        }

        col = 3;
        sheet.getRow(0).createCell(col).setCellValue("Nhà cung cấp");
        row = 1;
        for (Supplier s : suppliers) {
            Row r = sheet.getRow(row);
            if (r == null) r = sheet.createRow(row);
            r.createCell(col).setCellValue(s.getName());
            row++;
        }

        for (int i = 0; i < 4; i++) {
            sheet.autoSizeColumn(i);
        }
    }

    private void writeGuideSheet(XSSFSheet sheet) {
        String[][] guide = {
            {"Cột", "Mô tả", "Bắt buộc"},
            {"Kiểu theo dõi", "ITEMIZED (tài sản cố định) hoặc CONSUMABLE (vật tư tiêu hao)", "Có"},
            {"Tên thiết bị", "Tên đầy đủ, 2-150 ký tự", "Có"},
            {"Loại thiết bị", "Tên loại thiết bị đúng trong hệ thống", "Có"},
            {"Phòng gốc", "Tên phòng / vị trí gốc (chỉ dùng cho ITEMIZED)", "Với ITEMIZED"},
            {"Tình trạng kỹ thuật", "Hoạt động tốt / Hỏng / Thất lạc", "Không"},
            {"Trạng thái sử dụng", "Tại vị trí gốc / Đang cho mượn", "Không"},
            {"Giá mua", "Số nguyên dương (VND)", "Không"},
            {"Ngày mua", "Định dạng yyyy-MM-dd, ví dụ: 2024-01-15", "Không"},
            {"Hết bảo hành", "Định dạng yyyy-MM-dd", "Không"},
            {"Nhà cung cấp", "Tên nhà cung cấp đúng trong hệ thống", "Không"},
            {"Số lượng tồn", "Số nguyên >= 0, bắt buộc cho vật tư", "Với CONSUMABLE"},
            {"Ngưỡng cảnh báo", "Số nguyên >= 0", "Không"},
            {"Đơn vị", "Ví dụ: Cái, Hộp, Kg...", "Không"},
            {"Bật HSD", "true nếu muốn theo dõi hạn sử dụng", "Không"},
            {"Hạn dùng", "Định dạng yyyy-MM-dd, dùng khi Bật HSD = true", "Không"},
        };
        for (int r = 0; r < guide.length; r++) {
            XSSFRow row = sheet.createRow(r);
            for (int c = 0; c < guide[r].length; c++) {
                row.createCell(c).setCellValue(guide[r][c]);
            }
        }
        for (int i = 0; i < 3; i++) {
            sheet.autoSizeColumn(i);
        }
    }

    public AssetImportPreviewResponse previewImport(MultipartFile file) throws IOException {
        Map<String, Integer> categoryMap = buildCategoryMap();
        Map<String, Integer> locationMap = buildLocationMap();
        Map<String, Integer> supplierMap = buildSupplierMap();
        List<AssetImportPreviewRow> rows = new ArrayList<>();

        try (InputStream in = file.getInputStream();
             XSSFWorkbook workbook = new XSSFWorkbook(in)) {
            XSSFSheet sheet = workbook.getSheetAt(0);
            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null || isRowEmpty(row)) continue;
                rows.add(parseRow(i + 1, row, categoryMap, locationMap, supplierMap));
            }
        }

        long valid = rows.stream().filter(AssetImportPreviewRow::isValid).count();
        return AssetImportPreviewResponse.builder()
                .totalRows(rows.size())
                .validRows((int) valid)
                .errorRows(rows.size() - (int) valid)
                .rows(rows)
                .build();
    }

    @Transactional
    public Map<String, Object> commitImport(MultipartFile file) throws IOException {
        Map<String, Integer> categoryMap = buildCategoryMap();
        Map<String, Integer> locationMap = buildLocationMap();
        Map<String, Integer> supplierMap = buildSupplierMap();

        int imported = 0;
        int skipped = 0;
        List<String> errors = new ArrayList<>();

        try (InputStream in = file.getInputStream();
             XSSFWorkbook workbook = new XSSFWorkbook(in)) {
            XSSFSheet sheet = workbook.getSheetAt(0);
            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null || isRowEmpty(row)) continue;
                AssetImportPreviewRow preview = parseRow(i + 1, row, categoryMap, locationMap, supplierMap);
                if (!preview.isValid()) {
                    skipped++;
                    continue;
                }
                try {
                    AssetCreateRequest request = buildCreateRequest(row, categoryMap, locationMap, supplierMap);
                    assetService.createAsset(request);
                    imported++;
                } catch (Exception ex) {
                    skipped++;
                    errors.add("Dòng " + (i + 1) + ": " + ex.getMessage());
                }
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("imported", imported);
        result.put("skipped", skipped);
        result.put("errors", errors);
        return result;
    }

    private AssetImportPreviewRow parseRow(
            int displayRowNum,
            Row row,
            Map<String, Integer> categoryMap,
            Map<String, Integer> locationMap,
            Map<String, Integer> supplierMap
    ) {
        List<String> errors = new ArrayList<>();
        String trackingMode = normalize(cellStr(row, 0));
        String name = normalize(cellStr(row, 1));
        String categoryName = normalize(cellStr(row, 2));
        String locationName = normalize(cellStr(row, 3));

        if (!"ITEMIZED".equalsIgnoreCase(trackingMode) && !"CONSUMABLE".equalsIgnoreCase(trackingMode)) {
            errors.add("Kiểu theo dõi phải là ITEMIZED hoặc CONSUMABLE.");
        }
        if (name.isBlank()) {
            errors.add("Tên thiết bị là bắt buộc.");
        } else if (name.length() < 2 || name.length() > 150) {
            errors.add("Tên thiết bị phải từ 2 đến 150 ký tự.");
        }
        if (categoryName.isBlank()) {
            errors.add("Loại thiết bị là bắt buộc.");
        } else if (!categoryMap.containsKey(categoryName.toLowerCase())) {
            errors.add("Loại thiết bị '" + categoryName + "' không tìm thấy trong hệ thống.");
        }

        boolean isConsumable = "CONSUMABLE".equalsIgnoreCase(trackingMode);
        if (!isConsumable) {
            if (locationName.isBlank()) {
                errors.add("Phòng gốc là bắt buộc với ITEMIZED.");
            } else if (!locationMap.containsKey(locationName.toLowerCase())) {
                errors.add("Phòng gốc '" + locationName + "' không tìm thấy trong hệ thống.");
            }
        }

        if (isConsumable) {
            String qtyStr = normalize(cellStr(row, 10));
            if (qtyStr.isBlank()) {
                errors.add("Số lượng tồn là bắt buộc với CONSUMABLE.");
            } else {
                try {
                    int qty = Integer.parseInt(qtyStr);
                    if (qty < 0) errors.add("Số lượng tồn không được âm.");
                } catch (NumberFormatException ex) {
                    errors.add("Số lượng tồn phải là số nguyên.");
                }
            }
        }

        validateOptionalDate(cellStr(row, 7), "Ngày mua", errors);
        validateOptionalDate(cellStr(row, 8), "Hết bảo hành", errors);
        validateOptionalDate(cellStr(row, 14), "Hạn dùng", errors);
        validateOptionalPrice(cellStr(row, 6), errors);

        String supplierName = normalize(cellStr(row, 9));
        if (!supplierName.isBlank() && !supplierMap.containsKey(supplierName.toLowerCase())) {
            errors.add("Nhà cung cấp '" + supplierName + "' không tìm thấy trong hệ thống.");
        }

        return AssetImportPreviewRow.builder()
                .rowNumber(displayRowNum)
                .trackingMode(trackingMode)
                .name(name)
                .categoryName(categoryName)
                .locationName(locationName)
                .valid(errors.isEmpty())
                .errors(errors)
                .build();
    }

    private AssetCreateRequest buildCreateRequest(
            Row row,
            Map<String, Integer> categoryMap,
            Map<String, Integer> locationMap,
            Map<String, Integer> supplierMap
    ) {
        String trackingMode = normalize(cellStr(row, 0)).toUpperCase();
        boolean isConsumable = "CONSUMABLE".equals(trackingMode);

        String categoryName = normalize(cellStr(row, 2));
        String locationName = normalize(cellStr(row, 3));
        String supplierName = normalize(cellStr(row, 9));

        Integer categoryId = categoryMap.get(categoryName.toLowerCase());
        Integer locationId = isConsumable ? 1 : locationMap.get(locationName.toLowerCase());
        Integer supplierId = supplierName.isBlank() ? null : supplierMap.get(supplierName.toLowerCase());

        String qtyStr = normalize(cellStr(row, 10));
        String minStockStr = normalize(cellStr(row, 11));

        return AssetCreateRequest.builder()
                .trackingMode(trackingMode)
                .name(normalize(cellStr(row, 1)))
                .categoryId(categoryId)
                .locationId(locationId)
                .technicalStatus(isConsumable ? null : blankToNull(cellStr(row, 4)))
                .usageStatus(isConsumable ? null : blankToNull(cellStr(row, 5)))
                .purchasePrice(parseBigDecimal(cellStr(row, 6)))
                .purchaseDate(parseDate(cellStr(row, 7)))
                .warrantyExpirationDate(isConsumable ? null : parseDate(cellStr(row, 8)))
                .supplierId(supplierId)
                .quantityOnHand(qtyStr.isBlank() ? null : Integer.parseInt(qtyStr))
                .minimumStock(minStockStr.isBlank() ? null : Integer.parseInt(minStockStr))
                .unit(blankToNull(cellStr(row, 12)))
                .expiryTrackingEnabled(parseBoolean(cellStr(row, 13)))
                .expirationDate(parseDate(cellStr(row, 14)))
                .build();
    }

    private Map<String, Integer> buildCategoryMap() {
        Map<String, Integer> map = new HashMap<>();
        for (Category c : categoryRepository.findAll()) {
            map.put(c.getName().toLowerCase(), c.getId());
        }
        return map;
    }

    private Map<String, Integer> buildLocationMap() {
        Map<String, Integer> map = new HashMap<>();
        for (Location l : locationRepository.findAll()) {
            map.put(l.getRoomName().toLowerCase(), l.getId());
        }
        return map;
    }

    private Map<String, Integer> buildSupplierMap() {
        Map<String, Integer> map = new HashMap<>();
        for (Supplier s : supplierRepository.findAll()) {
            map.put(s.getName().toLowerCase(), s.getId());
        }
        return map;
    }

    private boolean isRowEmpty(Row row) {
        for (int i = 0; i < HEADERS.length; i++) {
            if (!cellStr(row, i).isBlank()) return false;
        }
        return true;
    }

    private String cellStr(Row row, int col) {
        Cell cell = row.getCell(col, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
        if (cell == null) return "";
        if (cell.getCellType() == CellType.NUMERIC) {
            double v = cell.getNumericCellValue();
            if (v == Math.floor(v)) return String.valueOf((long) v);
            return String.valueOf(v);
        }
        return cell.toString().trim();
    }

    private String normalize(String value) {
        return value == null ? "" : value.strip();
    }

    private String blankToNull(String value) {
        String v = normalize(value);
        return v.isBlank() ? null : v;
    }

    private LocalDate parseDate(String value) {
        String v = normalize(value);
        if (v.isBlank()) return null;
        try {
            return LocalDate.parse(v, DATE_FMT);
        } catch (DateTimeParseException ex) {
            return null;
        }
    }

    private BigDecimal parseBigDecimal(String value) {
        String v = normalize(value);
        if (v.isBlank()) return null;
        try {
            return new BigDecimal(v.replace(",", ""));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private Boolean parseBoolean(String value) {
        String v = normalize(value).toLowerCase();
        if (v.equals("true") || v.equals("yes") || v.equals("1")) return Boolean.TRUE;
        return Boolean.FALSE;
    }

    private void validateOptionalDate(String value, String fieldName, List<String> errors) {
        String v = normalize(value);
        if (v.isBlank()) return;
        try {
            LocalDate.parse(v, DATE_FMT);
        } catch (DateTimeParseException ex) {
            errors.add(fieldName + " phải đúng định dạng yyyy-MM-dd (ví dụ: 2024-01-15).");
        }
    }

    private void validateOptionalPrice(String value, List<String> errors) {
        String v = normalize(value).replace(",", "");
        if (v.isBlank()) return;
        try {
            BigDecimal price = new BigDecimal(v);
            if (price.compareTo(BigDecimal.ZERO) <= 0) {
                errors.add("Giá mua phải lớn hơn 0.");
            }
        } catch (NumberFormatException ex) {
            errors.add("Giá mua phải là số.");
        }
    }
}
