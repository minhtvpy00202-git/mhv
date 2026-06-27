# Danh sách Use Case – Module Quản lý tài sản (Phạm vi B)

File diagram: `quan-ly-tai-san.drawio` (3 trang: Tài sản cố định | Vật tư tiêu hao | Thống kê)

Mở bằng [draw.io](https://app.diagrams.net/) hoặc extension Draw.io Integration trong VS Code/Cursor.

## Actor

| Actor | Mô tả | Role trong hệ thống |
|-------|--------|---------------------|
| Quản trị viên | Người quản lý toàn bộ tài sản và vật tư | `Admin` |
| Nhân viên quản lý vật tư | Người thao tác nghiệp vụ vật tư tiêu hao | `ConsumableManager` |

## Trang 1 – Tài sản cố định

| ID | Use Case | Actor | Mô tả ngắn |
|----|----------|-------|------------|
| UC-F01 | Tra cứu danh sách tài sản | Quản trị viên | Lọc, sắp xếp, phân trang danh sách tài sản cố định |
| UC-F02 | Quản lý thông tin tài sản cố định | Quản trị viên | Thêm, sửa, xóa thông tin tài sản (mã QA, specs, NCC, bảo hành…) |
| UC-F03 | Gán vị trí phòng cho tài sản | Quản trị viên | Gán phòng hiện tại và phòng gốc |
| UC-F04 | Import danh sách tài sản | Quản trị viên | Import Excel: preview → commit |
| UC-F05 | Tạo mã QR tài sản | Quản trị viên | Sinh và in mã QR (extend UC-F02) |
| UC-F06 | Xem timeline sửa chữa | Quản trị viên | Xem lịch sử ticket sửa chữa của tài sản |
| UC-F07 | Đăng nhập hệ thống | Quản trị viên | Xác thực trước khi thao tác (include) |

## Trang 2 – Vật tư tiêu hao

| ID | Use Case | Actor | Mô tả ngắn |
|----|----------|-------|------------|
| UC-C01 | Quản lý thông tin vật tư | Quản trị viên, Nhân viên QL vật tư | Thêm, sửa, xóa vật tư tiêu hao |
| UC-C02 | Nhập kho vật tư theo lô | Quản trị viên, Nhân viên QL vật tư | Nhập kho theo lô, hạn dùng, đơn giá |
| UC-C03 | Cấp phát vật tư cho phòng | Quản trị viên, Nhân viên QL vật tư | Giảm tồn kho, ghi lịch sử cấp phát |
| UC-C04 | Theo dõi tồn vật tư tại phòng | Quản trị viên, Nhân viên QL vật tư | Xem và điều chỉnh số lượng còn lại tại phòng |
| UC-C05 | Tạo yêu cầu cấp phát vật tư | Nhân viên QL vật tư | Tạo phiếu yêu cầu cấp phát cho phòng |
| UC-C06 | Duyệt yêu cầu cấp phát | Quản trị viên | Admin duyệt và ghi nhận cấp phát |
| UC-C07 | Từ chối yêu cầu cấp phát | Quản trị viên | Admin từ chối phiếu yêu cầu |
| UC-C08 | Tạo yêu cầu tiêu huỷ lô hết hạn | Quản trị viên, Nhân viên QL vật tư | Tạo phiếu tiêu huỷ lô đã hết hạn |
| UC-C09 | Duyệt yêu cầu tiêu huỷ | Quản trị viên | Admin duyệt tiêu huỷ và cập nhật tồn |
| UC-C10 | Từ chối yêu cầu tiêu huỷ | Quản trị viên | Admin từ chối yêu cầu tiêu huỷ |
| UC-C11 | Đăng nhập hệ thống | Tất cả | Xác thực trước khi thao tác (include) |

## Trang 3 – Thống kê tài sản

| ID | Use Case | Actor | Mô tả ngắn |
|----|----------|-------|------------|
| UC-S01 | Xem thống kê tài sản | Quản trị viên | KPI, biểu đồ, lọc theo thời gian/loại/phòng |
| UC-S02 | Xuất báo cáo thống kê | Quản trị viên | Xuất Excel (extend UC-S01) |
| UC-S03 | Đăng nhập hệ thống | Quản trị viên | Xác thực trước khi thao tác (include) |

## Phạm vi loại trừ (phạm vi B)

- Sơ đồ định vị tài sản (`AssetMapManagement`)
- Lịch sử mượn/trả thiết bị (`UsageHistoryManagement`)
- Quản lý nhà cung cấp, loại thiết bị, phòng (module Quản lý chung)
