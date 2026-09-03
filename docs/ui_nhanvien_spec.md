# Đặc tả UI nhân viên

## Mục tiêu

- Làm rõ 2 nghiệp vụ khác nhau: `Mượn thiết bị` và `Cấp phát vật tư`.
- Giảm cảm giác "đoán chức năng" khi người dùng nhìn vào menu hoặc form.
- Giữ giao diện mobile gọn, dễ hiểu, ít chữ mơ hồ.
- Giới hạn số kết quả mặc định để tránh danh sách quá dài.

## Nguyên tắc ngôn ngữ

- Không dùng riêng chữ `Yêu cầu` cho các điểm vào chính.
- Luôn ghi rõ nghiệp vụ:
  - `Mượn thiết bị`
  - `Cấp phát vật tư`
  - `Theo dõi yêu cầu`
- Các nút submit phải nói rõ hành động:
  - `Gửi yêu cầu mượn`
  - `Gửi yêu cầu cấp phát`

## Điều hướng mobile

### Menu dưới

- `Home`
- `Quét QR`
- `Mượn/Cấp`
- `Chat`
- `Báo hỏng`

Ghi chú:
- `Mượn/Cấp` là nhãn ngắn gọn nhưng vẫn đủ nghĩa để không bung layout.

## Cấu trúc màn hình mới

### 1. Trang trung tâm

Route: `/mobile/inquiries`

Vai trò:
- Là trang định hướng, không phải màn nhập liệu.
- Giúp người dùng chọn đúng mục đích trước khi thao tác.

Bố cục:
1. Hero ngắn:
   - Tiêu đề: `Mượn thiết bị hoặc cấp phát vật tư`
   - Mô tả: `Chọn đúng nghiệp vụ để tạo yêu cầu nhanh và dễ hiểu hơn.`
2. Hai card hành động lớn:
   - `Mượn thiết bị`
     - mô tả ngắn: `Laptop, máy chiếu, thiết bị dùng tạm`
     - CTA: `Mở danh sách thiết bị`
   - `Cấp phát vật tư`
     - mô tả ngắn: `Giấy, bút, trà, vật tư tiêu hao`
     - CTA: `Mở danh sách vật tư`
3. Khu phụ:
   - `Quét QR để chọn nhanh`
4. Khu `Theo dõi yêu cầu của tôi`
   - Có chip lọc:
     - `Tất cả`
     - `Mượn thiết bị`
     - `Cấp phát vật tư`
   - Hiển thị danh sách gọn các yêu cầu gần đây.

### 2. Trang mượn thiết bị

Route: `/mobile/inquiries/borrow`

Vai trò:
- Chỉ phục vụ nghiệp vụ mượn thiết bị.

Bố cục:
1. Header:
   - Tiêu đề: `Mượn thiết bị`
   - mô tả: `Tìm thiết bị có thể mượn và gửi yêu cầu đến Admin.`
2. Thanh công cụ:
   - tìm kiếm
   - nút `Quét QR`
3. Danh sách thiết bị:
   - hiển thị tối đa `20` kết quả đầu mặc định
   - có dòng chú thích: `Đang hiển thị 20 kết quả đầu. Hãy tìm kiếm để lọc nhanh hơn.`
4. Mỗi dòng thiết bị hiển thị:
   - tên thiết bị
   - mã QA
   - vị trí
   - trạng thái khả dụng
   - nút `Mượn`
5. Form tạo yêu cầu:
   - tiêu đề: `Yêu cầu mượn thiết bị`
   - tên thiết bị
   - phòng sử dụng/nhận
   - ngày cần
   - ngày trả
   - mục đích sử dụng
   - ghi chú thêm
   - nút: `Gửi yêu cầu mượn`

### 3. Trang cấp phát vật tư

Route: `/mobile/inquiries/consumables`

Vai trò:
- Chỉ phục vụ nghiệp vụ cấp phát vật tư tiêu hao.

Bố cục:
1. Header:
   - Tiêu đề: `Cấp phát vật tư`
   - mô tả: `Tìm vật tư còn hàng và gửi yêu cầu đến quản lý vật tư.`
2. Thanh công cụ:
   - tìm kiếm
3. Danh sách vật tư:
   - hiển thị tối đa `20` kết quả đầu mặc định
   - có chú thích giống màn mượn
4. Mỗi dòng vật tư hiển thị:
   - tên vật tư
   - mã QA
   - vị trí
   - số lượng khả dụng
   - nút `Chọn`
5. Form tạo yêu cầu:
   - tiêu đề: `Yêu cầu cấp phát vật tư`
   - tên vật tư
   - phòng nhận
   - số lượng
   - đơn vị
   - ngày cần
   - mục đích sử dụng
   - ghi chú thêm
   - nút: `Gửi yêu cầu cấp phát`

## Quy tắc hiển thị dữ liệu

- Không tải và hiển thị danh sách quá dài.
- Mỗi màn danh sách hiển thị tối đa `20` kết quả đầu.
- Nếu tổng dữ liệu lớn hơn, người dùng phải tìm kiếm để thu hẹp kết quả.
- Nếu có `qaCode` từ QR, màn tương ứng sẽ tự mở đúng kết quả đó.

## Quy tắc wording

- `Tạo yêu cầu cho [Tên tài sản]` -> bỏ.
- Dùng:
  - `Yêu cầu mượn thiết bị`
  - `Yêu cầu cấp phát vật tư`
- `Câu hỏi mở đầu` -> đổi thành `Ghi chú thêm`
- `Gửi yêu cầu` -> đổi theo từng nghiệp vụ.

## Luồng sử dụng chính

### Luồng 1: Mượn thiết bị

1. Người dùng bấm `Mượn/Cấp` ở menu dưới.
2. Chọn card `Mượn thiết bị`.
3. Tìm thiết bị hoặc quét QR.
4. Bấm `Mượn`.
5. Điền form `Yêu cầu mượn thiết bị`.
6. Gửi yêu cầu.

### Luồng 2: Cấp phát vật tư

1. Người dùng bấm `Mượn/Cấp` ở menu dưới.
2. Chọn card `Cấp phát vật tư`.
3. Tìm vật tư.
4. Bấm `Chọn`.
5. Điền form `Yêu cầu cấp phát vật tư`.
6. Gửi yêu cầu.

## Phạm vi triển khai đợt này

- Cập nhật menu dưới.
- Tạo lại trang `/mobile/inquiries` thành trang trung tâm.
- Tạo hai màn riêng:
  - `/mobile/inquiries/borrow`
  - `/mobile/inquiries/consumables`
- Cập nhật wording các form liên quan.
- Giữ nguyên route chi tiết yêu cầu `/mobile/inquiries/:id`.
