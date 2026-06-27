n# Học tập Module Quản lý Tài sản

## Thứ tự học
1. Entity (Dữ liệu) → 2. Repository (Truy cập DB) → 3. DTO (Request/Response) → 4. Service (Business Logic) → 5. Controller (API) → 6. Utility (Helper) → 7. Frontend (UI)

---

## BƯỚC 1: ENTITY - DỮ LIỆU

### 1. Asset.java - Entity tài sản chính
**File:** `src/main/java/com/poly/mhv/entity/Asset.java`

**Field quan trọng:**
- `qaCode`: Primary key, mã QA tự sinh
- `trackingMode`: "ITEMIZED" (tài sản cố định) hoặc "CONSUMABLE" (vật tư tiêu hao)
- `status`: Trạng thái tổng hợp (legacy)
- `technicalStatus`: "Hoạt động tốt"/"Hỏng"/"Thất lạc"
- `usageStatus`: "Tại vị trí gốc"/"Đang cho mượn"
- `location`: Phòng hiện tại
- `homeLocation`: Phòng gốc
- `quantityOnHand`: Tồn kho (chỉ CONSUMABLE)
- `minimumStock`: Ngưỡng cảnh báo (chỉ CONSUMABLE)
- `expirationDate`: Hạn dùng (chỉ CONSUMABLE)

**Relationships:**
- `category`: Nhiều asset thuộc 1 category
- `location`, `homeLocation`: Nhiều asset ở 1 location
- `supplier`: Nhiều asset từ 1 supplier
- `usageHistories`: 1 asset có nhiều lịch sử mượn/trả
- `consumableIssues`: 1 asset có nhiều lần cấp phát (chỉ CONSUMABLE)

---

### 2. UsageHistory.java - Entity lịch sử mượn/trả
**File:** `src/main/java/com/poly/mhv/entity/UsageHistory.java`

**Field quan trọng:**
- `id`: Auto-increment primary key
- `startTime`: Thời điểm bắt đầu mượn
- `endTime`: Thời điểm trả (null = đang mượn)
- `asset`: Thiết bị được mượn
- `user`: Người mượn
- `fromLocation`: Phòng xuất phát
- `toLocation`: Phòng đích

**Logic quan trọng:**
- Khi `endTime = null`: Thiết bị đang được mượn
- Khi `endTime != null`: Thiết bị đã được trả
- Mỗi asset chỉ có 1 record với `endTime = null` tại 1 thời điểm

---

### 3. ConsumableIssue.java - Entity cấp phát vật tư
**File:** `src/main/java/com/poly/mhv/entity/ConsumableIssue.java`

**Field quan trọng:**
- `id`: Auto-increment primary key
- `asset`: Vật tư được cấp phát
- `issuedToLocation`: Phòng nhận vật tư
- `issuedBy`: Người thực hiện cấp phát
- `quantity`: Số lượng cấp phát
- `unitPrice`: Đơn giá tại thời điểm cấp phát
- `issuedAt`: Thời điểm cấp phát

**Logic quan trọng:**
- Khi cấp phát: Trừ `quantityOnHand` từ Asset, cộng vào `ConsumableLocationStock` của phòng
- `unitPrice` được tính trung bình từ các lô nhập (FIFO)

---

### 4. ConsumableLocationStock.java - Entity tồn theo phòng
**File:** `src/main/java/com/poly/mhv/entity/ConsumableLocationStock.java`

**Field quan trọng:**
- `id`: Auto-increment primary key
- `asset`: Vật tư
- `location`: Phòng
- `quantityIssued`: Tổng số đã cấp cho phòng
- `quantityRemaining`: Số lượng còn lại tại phòng
- `unitPrice`: Đơn giá trung bình
- `lastIssuedAt`: Lần cấp phát gần nhất
- `lastUpdatedBy`: Người cập nhật gần nhất

**Logic quan trọng:**
- Khi cấp phát: Tăng `quantityIssued` và `quantityRemaining`
- Khi sử dụng: Giảm `quantityRemaining` (user cập nhật thủ công)
- `quantityConsumed` = `quantityIssued` - `quantityRemaining`

---

### 5. ConsumableReceiptLot.java - Entity lô nhập
**File:** `src/main/java/com/poly/mhv/entity/ConsumableReceiptLot.java`

**Field quan trọng:**
- `id`: Auto-increment primary key
- `asset`: Vật tư
- `lotCode`: Mã lô (tự sinh hoặc manual)
- `quantityReceived`: Số lượng nhập
- `quantityRemaining`: Số lượng còn lại trong lô
- `unitPrice`: Đơn giá của lô này
- `receivedDate`: Ngày nhập
- `expirationDate`: Hạn dùng (nếu có)
- `supplier`: Nhà cung cấp
- `receivedBy`: Người nhập

**Logic quan trọng:**
- Khi nhập hàng: Tạo lô mới, tăng `quantityOnHand` của Asset
- Khi cấp phát: Trừ `quantityRemaining` theo FIFO (lô cũ trước)
- Khi tiêu hủy: Trừ `quantityRemaining` từ lô hết hạn

---

## BƯỚC 2: REPOSITORY - TRUY CẬP DATABASE

### 6. AssetRepository.java - Repository Asset
**File:** `src/main/java/com/poly/mhv/repository/AssetRepository.java`

**Method quan trọng:**
- `searchForAdmin()`: Query phức tạp tìm kiếm asset cho admin với filter theo status
- `findDetailByQaCode()`: Tìm asset chi tiết với EntityGraph để load relationships
- `findMaxQaCodeByCategoryIdAndPrefix()`: Tìm QA code lớn nhất để sinh mã mới
- `countAllAssets()`, `countAllConsumables()`: Đếm theo tracking mode
- `countLowStockConsumables()`: Đếm vật tư hết hàng
- `countAvailableAssets()`, `countBorrowedAssets()`: Đếm asset theo trạng thái
- `searchForAssetMap()`: Query cho sơ đồ định vị

**Điểm nổi bật:**
- Sử dụng `@EntityGraph` để tránh N+1 query problem
- Query phức tạp với `@Query` và JPQL
- Support cả ITEMIZED và CONSUMABLE trong cùng query

---

### 7. UsageHistoryRepository.java - Repository UsageHistory
**File:** `src/main/java/com/poly/mhv/repository/UsageHistoryRepository.java`

**Method quan trọng:**
- `findByAssetQaCodeAndEndTimeIsNull()`: Tìm record đang mượn (endTime = null) - **quan trọng nhất**
- `findByUserIdForHistory()`: Lấy lịch sử của user với fetch joins
- `findAllForAdminOrderByStartTimeDesc()`: Lấy tất cả lịch sử cho admin
- `insertOpenUsageHistory()`: Native query để insert record mượn mới
- `countUsageByAssetInPeriod()`: Thống kê sử dụng theo khoảng thời gian

**Điểm nổi bật:**
- Extends `UsageHistoryRepositoryCustom` cho query động
- Sử dụng `@Modifying` cho update/insert
- Native query cho insert để tránh JPA overhead

---

## BƯỚC 3: DTO - REQUEST/RESPONSE

### 8. AssetCreateRequest.java - DTO tạo Asset mới
**File:** `src/main/java/com/poly/mhv/dto/asset/AssetCreateRequest.java`

**Field quan trọng:**
- `trackingMode`: ITEMIZED hoặc CONSUMABLE
- `name`: Tên thiết bị (bắt buộc, 2-150 ký tự)
- `categoryId`: Category (bắt buộc)
- `locationId`: Phòng gốc (bắt buộc)
- `currentLocationId`: Phòng hiện tại (optional)
- `technicalStatus`, `usageStatus`, `status`: Các status (optional)
- `specs`: Thông số kỹ thuật JSON
- `quantityOnHand`, `minimumStock`, `unit`: Chỉ CONSUMABLE

**Validation:** Sử dụng Jakarta validation annotations (@NotBlank, @NotNull, @Size, @Pattern, etc.)

---

### 9. AssetUpdateRequest.java - DTO cập nhật Asset
**File:** `src/main/java/com/poly/mhv/dto/asset/AssetUpdateRequest.java`

**Điểm khác biệt với CreateRequest:**
- `trackingMode`: Pattern validation chỉ cho phép ITEMIZED/CONSUMABLE
- `status`: Pattern validation với các giá trị hợp lệ
- `technicalStatus`: Pattern validation
- `usageStatus`: Pattern validation
- Tất cả field đều optional (không có @NotBlank/@NotNull)

---

### 10. CheckoutRequest.java - DTO mượn thiết bị
**File:** `src/main/java/com/poly/mhv/dto/usage/CheckoutRequest.java`

**Field:**
- `assetQaCode`: Mã QA thiết bị
- `userId`: ID người mượn
- `toLocationId`: ID phòng đích

---

### 11. CheckinRequest.java - DTO trả thiết bị
**File:** `src/main/java/com/poly/mhv/dto/usage/CheckinRequest.java`

**Field:**
- `assetQaCode`: Mã QA thiết bị

**Lưu ý:** Không cần userId vì hệ thống tự lấy từ user đang đăng nhập (người mượn phải là người trả)

---

## BƯỚC 4: SERVICE - BUSINESS LOGIC

### 12. UsageHistoryService.java - Service mượn/trả
**File:** `src/main/java/com/poly/mhv/service/UsageHistoryService.java`

**Method quan trọng:**

#### checkout() - Mượn thiết bị (line 59-123)
1. Validate request (line 60)
2. Tìm asset và validate (line 62-64)
3. Kiểm tra asset đang mượn chưa (line 66-69)
4. Tìm user và location đích (line 71-77)
5. Validate phòng đích khác phòng hiện tại (line 79-82)
6. Insert UsageHistory mới với native query (line 84-90)
7. Cập nhật status và location của asset (line 93-100)
8. Xóa cache (line 101)
9. Tạo notification (line 103-121)

#### checkin() - Trả thiết bị (line 126-174)
1. Validate request (line 127-129)
2. Tìm asset (line 131-132)
3. Tìm UsageHistory đang mở (line 134-135)
4. Validate người mượn = người trả (line 136-139)
5. Cập nhật endTime của UsageHistory (line 141)
6. Cập nhật status và location của asset về phòng gốc (line 142-148)
7. Save và xóa cache (line 150-151)
8. Tạo notification (line 154-172)

#### validateAssetForCheckout() - Validate asset trước khi mượn (line 238-262)
- Không mượn CONSUMABLE
- Chỉ mượn khi technicalStatus = "Hoạt động tốt" và usageStatus = "Tại vị trí gốc"
- Không mượn khi Hỏng, Đang sửa chữa, Thất lạc, Đang cho mượn

---

## BƯỚC 5: CONTROLLER - API

### 13. UsageHistoryController.java - Controller mượn/trả
**File:** `src/main/java/com/poly/mhv/controller/UsageHistoryController.java`

**Endpoint quan trọng:**
- `POST /api/usage/checkout`: Mượn thiết bị
- `POST /api/usage/checkin`: Trả thiết bị
- `GET /api/usage/history`: Lấy lịch sử của user hiện tại
- `GET /api/usage/history/admin`: Lấy tất cả lịch sử cho admin (với filter và pagination)

---

### 14. AssetController.java - Controller Asset
**File:** `src/main/java/com/poly/mhv/controller/AssetController.java`

**Endpoint quan trọng:**
- `POST /api/assets`: Tạo asset mới
- `PUT /api/assets/{qaCode}`: Cập nhật asset
- `DELETE /api/assets/{qaCode}`: Xóa asset
- `GET /api/assets/{qaCode}`: Lấy chi tiết asset
- `GET /api/assets`: Tìm kiếm asset (với filter, pagination)
- `POST /api/assets/{qaCode}/consumable/issue`: Cấp phát vật tư
- `POST /api/assets/{qaCode}/consumable/receipt`: Nhập vật tư
- `GET /api/assets/{qaCode}/qr-code`: Lấy QR code base64

---

## BƯỚC 6: UTILITY - HELPER

### 15. AssetStatusSupport.java - Helper xử lý status
**File:** `src/main/java/com/poly/mhv/util/AssetStatusSupport.java`

**Constants:**
- `TECHNICAL_STATUS_GOOD`: "Hoạt động tốt"
- `TECHNICAL_STATUS_BROKEN`: "Hỏng"
- `TECHNICAL_STATUS_LOST`: "Thất lạc"
- `USAGE_STATUS_HOME`: "Tại vị trí gốc"
- `USAGE_STATUS_BORROWED`: "Đang cho mượn"

**Method quan trọng:**
- `normalizeTechnicalStatus()`: Chuẩn hóa technical status
- `normalizeUsageStatus()`: Chuẩn hóa usage status
- `resolveTechnicalStatus()`: Giải quyết technical status từ legacy
- `resolveUsageStatus()`: Giải quyết usage status từ legacy và location
- `deriveLegacyStatus()`: Tính status legacy từ dual status
- `deriveDisplayStatus()`: Tính display status cho UI

---

### 16. QRCodeGenerator.java - Tạo QR code
**File:** `src/main/java/com/poly/mhv/util/QRCodeGenerator.java`

**Method:**
- `generateBase64QrCode()`: Tạo QR code base64 từ content

---

## BƯỚC 7: FRONTEND - UI

### 17. assetStatus.js - Frontend utility status
**File:** `frontend/src/utils/assetStatus.js`

**Constants:**
- `itemizedStatusOptions`: Options cho dropdown status ITEMIZED
- `technicalStatusOptions`: Options cho dropdown technical status
- `usageStatusOptions`: Options cho dropdown usage status

**Function:**
- `getAssetStatusMeta()`: Lấy metadata status (label, tone)
- `getTechnicalStatusMeta()`: Lấy metadata technical status
- `getUsageStatusMeta()`: Lấy metadata usage status

---

### 18. assetSpecs.js - Frontend utility specs
**File:** `frontend/src/utils/assetSpecs.js`

**Function:**
- `parseSpecsToEntries()`: Parse JSON specs thành array entries
- `mergeSpecEntries()`: Merge template với existing entries
- `normalizeSpecTemplates()`: Chuẩn hóa template specs
- `stringifySpecs()`: Convert entries thành JSON string

---

## TÓM TẮT LUỒNG HOẠT ĐỘNG

### Mượn thiết bị (Checkout)
1. User quét QR code → Gửi `CheckoutRequest` (assetQaCode, userId, toLocationId)
2. Controller nhận → Gọi `UsageHistoryService.checkout()`
3. Service validate:
   - Asset tồn tại và là ITEMIZED
   - Asset không đang mượn
   - Asset ở trạng thái "Hoạt động tốt" và "Tại vị trí gốc"
   - Phòng đích khác phòng hiện tại
4. Service tạo UsageHistory mới (endTime = null)
5. Service cập nhật Asset: usageStatus = "Đang cho mượn", location = toLocation
6. Service tạo notification
7. Trả về `UsageHistoryResponse`

### Trả thiết bị (Checkin)
1. User quét QR code → Gửi `CheckinRequest` (assetQaCode)
2. Controller nhận → Gọi `UsageHistoryService.checkin()`
3. Service validate:
   - Asset tồn tại
   - Có UsageHistory đang mở (endTime = null)
   - Người mượn = người trả
4. Service cập nhật UsageHistory: endTime = now
5. Service cập nhật Asset: usageStatus = "Tại vị trí gốc", location = homeLocation
6. Service tạo notification
7. Trả về `UsageHistoryResponse`

### Cấp phát vật tư (Consumable Issue)
1. Admin gửi `ConsumableIssueRequest` (issuedToLocationId, quantity, note)
2. Controller nhận → Gọi `AssetService.issueConsumable()`
3. Service validate:
   - Asset là CONSUMABLE
   - Có đủ quantityOnHand
4. Service trừ quantityOnHand theo FIFO từ các lô
5. Service tạo ConsumableIssue record
6. Service cập nhật/tạo ConsumableLocationStock
7. Service tạo notification
8. Trả về `ConsumableIssueResponse`

### Nhập vật tư (Consumable Receipt)
1. Admin gửi `ConsumableStockReceiptRequest` (quantity, unitPrice, supplierId, receivedDate, expirationDate)
2. Controller nhận → Gọi `AssetService.receiveConsumableStock()`
3. Service tạo ConsumableReceiptLot mới
4. Service tăng quantityOnHand của Asset
5. Service tạo notification
6. Trả về `ConsumableReceiptLotResponse`
