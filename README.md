# MHV

Hệ thống quản lý tài sản, vật tư tiêu hao, mượn/trả thiết bị, ticket sửa chữa, kiểm kê định kỳ và sơ đồ định vị tài sản trong tòa nhà.

README này mô tả trạng thái hiện tại của monorepo `Spring Boot + React/Vite`, bám theo code và cấu hình đang có trong repo.

## 1. Tổng quan

MHV phục vụ các bài toán chính:

- Quản lý tài sản đơn chiếc và vật tư tiêu hao.
- Quản lý nhà cung cấp, loại tài sản, phòng/khu vực, nhóm kỹ thuật viên.
- Mượn/trả tài sản qua QR code.
- Báo hỏng, điều phối ticket, chat realtime và theo dõi tiến độ xử lý.
- Kiểm kê định kỳ cho TechSupport.
- Theo dõi tồn kho, cấp phát vật tư tiêu hao theo phòng.
- Cấu hình branding theo database.
- Vẽ sơ đồ tầng/phòng và định vị tài sản trên bản đồ.

## 2. Kiến trúc repo

```text
mhv/
├─ src/main/java/com/poly/mhv      # Backend Spring Boot
├─ src/main/resources              # Cấu hình backend
├─ frontend/                       # Frontend React + Vite
├─ cad-parser-service/             # Service Python riêng cho CAD parser
├─ deploy/single-vps/              # Bộ file triển khai 1 VPS
├─ docs/                           # Tài liệu và script bổ sung
├─ uploads/                        # File upload local khi dùng storage local
├─ Dockerfile                      # Docker image cho backend
├─ pom.xml                         # Cấu hình Maven backend
└─ infrastructure_management_script.sql
```

## 3. Công nghệ sử dụng

### Backend

- Java 17
- Spring Boot 4
- Spring Security + JWT
- Spring Data JPA / Hibernate
- PostgreSQL
- WebSocket + SSE
- springdoc OpenAPI / Swagger UI
- Apache POI
- ZXing
- AWS SDK S3-compatible storage

### Frontend

- React 19
- Vite 8
- React Router 7
- Tailwind CSS
- Axios
- React Toastify
- Recharts
- html5-qrcode
- SockJS + STOMP
- vite-plugin-pwa

## 4. Vai trò trong hệ thống

Hệ thống hiện có 4 vai trò chính:

- `Admin`: quản lý cấu hình, tài sản, vật tư, phòng/khu vực, sơ đồ, ticket, kiểm kê, người dùng.
- `NhanVien`: mượn/trả, báo hỏng, theo dõi ticket và chat.
- `TechSupport`: nhận và xử lý ticket, thực hiện kiểm kê.
- `ConsumableManager`: quản lý nghiệp vụ vật tư tiêu hao và các yêu cầu liên quan.

## 5. Tính năng nổi bật

### Quản lý tài sản

- CRUD tài sản, mã QA, QR code.
- Hỗ trợ 2 nhóm:
  - `ITEMIZED`: tài sản đơn chiếc.
  - `CONSUMABLE`: vật tư tiêu hao.
- Lưu thông tin specs, nhà cung cấp, bảo hành, giá mua, ngày mua.

### Vật tư tiêu hao

- Nhập kho theo lô, theo dõi hạn dùng, nhà cung cấp, đơn giá.
- Cấp phát vật tư theo phòng.
- Theo dõi tồn kho tại phòng sau cấp phát.
- Hỗ trợ yêu cầu cấp phát và yêu cầu tiêu hủy lô hết hạn.

### Mượn/trả và sử dụng tài sản

- Mượn/trả bằng QR scanner.
- Lưu lịch sử sử dụng và phòng hiện tại/phòng gốc.
- Tài sản được định vị theo `Asset.location`.

### Ticket, báo hỏng và chat

- Tạo ticket báo hỏng.
- Điều phối và nhận việc theo nhóm TechSupport.
- Chat realtime trên ticket.
- Theo dõi timeline xử lý.
- Đánh giá mức độ hài lòng sau khi ticket được giải quyết.
- Có luồng gia hạn SLA để Admin duyệt.

### Kiểm kê định kỳ

- Admin tạo phiên kiểm kê.
- TechSupport quét và thực hiện kiểm kê trên desktop/mobile.
- Admin theo dõi kết quả, xử lý thiếu tài sản và xuất biên bản.

### Sơ đồ định vị tài sản

- Quản lý tầng với `MapFloor`.
- Quản lý vùng phòng/khu vực trên grid với `RoomShape`.
- Gắn `Location` vào sơ đồ.
- Hỗ trợ tạo, sửa, di chuyển phòng trên mặt bằng.
- Tìm tài sản theo mã QA, tên, loại, phòng, tầng và hiển thị marker trên sơ đồ.
- Hỗ trợ khu vực `hasAsset = false` để biểu diễn hành lang, sảnh, cổng, lối đi... nhưng không dùng cho nghiệp vụ lưu trữ tài sản.

### Branding và giao diện

- Branding lấy từ database thông qua API branding.
- Hỗ trợ tên công ty, tên ứng dụng, màu chủ đạo, thông tin liên hệ.
- Frontend có dark mode và hỗ trợ màn hình mobile.
- Frontend được cấu hình như một PWA.

## 6. Mô hình dữ liệu chính

- `Asset`: tài sản, vật tư, vị trí hiện tại, vị trí gốc, specs, trạng thái.
- `Category`: nhóm tài sản, phân biệt `ITEMIZED` và `CONSUMABLE`.
- `Location`: phòng/khu vực nghiệp vụ, có thể thuộc tầng và có cờ `hasAsset`.
- `MapFloor`: tầng hiển thị trên sơ đồ.
- `RoomShape`: vùng đã vẽ trên grid gắn với `Location`.
- `UsageHistory`: lịch sử mượn/trả và di chuyển.
- `Ticket`, `TicketEvent`, `ChatMessage`: nghiệp vụ helpdesk.
- `InventoryAudit`, `InventoryAuditItem`, `InventoryAuditMissing`: nghiệp vụ kiểm kê.
- `ConsumableReceiptLot`, `ConsumableIssue`, `ConsumableLocationStock`, `ConsumableRequest`, `ConsumableDisposalRequest`: nghiệp vụ vật tư tiêu hao.
- `AppSetting`: branding và cấu hình giao diện.
- `AppUser`, `TechSupportType`: người dùng và nhóm kỹ thuật viên.

## 7. Yêu cầu môi trường

- Java 17
- Maven 3.9+ hoặc Maven Wrapper `./mvnw`
- Node.js 18+ và npm
- PostgreSQL 14+ hoặc tương đương

## 8. Cấu hình môi trường

Backend đọc cấu hình từ `src/main/resources/application.properties` và environment variables.

### Biến môi trường backend tối thiểu

```env
JWT_SECRET=your_jwt_secret
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/mhv
SPRING_DATASOURCE_USERNAME=postgres
SPRING_DATASOURCE_PASSWORD=postgres
```

### Biến môi trường backend thường dùng

```env
SPRING_JPA_SHOW_SQL=false
SPRING_JPA_FORMAT_SQL=false
APP_SEED_DEMO_USERS_ENABLED=false
APP_LOCAL_DB_AUTO_CREATE_ENABLED=true
APP_STORAGE_PROVIDER=local
APP_UPLOAD_DIR=uploads
APP_CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
SPRING_SERVLET_MULTIPART_MAX_FILE_SIZE=50MB
SPRING_SERVLET_MULTIPART_MAX_REQUEST_SIZE=55MB
```

### Storage provider

- Hệ thống hiện tại đang triển khai production với `APP_STORAGE_PROVIDER=local`.
- Media upload như ảnh sự cố, ảnh chat, file đính kèm, ảnh nền sơ đồ... được lưu cục bộ trên chính máy chủ đang chạy backend.
- Trong môi trường local đơn giản, `APP_UPLOAD_DIR` thường là `uploads/`.
- Trong môi trường deploy bằng Docker trên VPS, backend lưu file vào `/app/uploads` trong container và mount ra volume/ổ đĩa của VPS để dữ liệu không mất khi rebuild container.

Cấu hình đang phù hợp với mô hình triển khai thực tế:

- 1 VPS DigitalOcean duy nhất
- build và chạy cả frontend lẫn backend trên VPS
- PostgreSQL cũng chạy trên cùng VPS
- toàn bộ media runtime cũng nằm trên cùng VPS

Code vẫn hỗ trợ storage kiểu object storage nếu cần mở rộng sau này:

- `APP_STORAGE_PROVIDER=spaces`: lưu file lên DigitalOcean Spaces hoặc storage tương thích S3.

Nếu dùng `spaces`, cần bổ sung:

```env
APP_SPACES_BUCKET=your-bucket
APP_SPACES_REGION=your-region
APP_SPACES_ENDPOINT=https://your-endpoint
APP_SPACES_ACCESS_KEY=your-access-key
APP_SPACES_SECRET_KEY=your-secret-key
APP_SPACES_PUBLIC_BASE_URL=https://your-public-base-url
```

### Biến môi trường frontend

Frontend gọi API thông qua `VITE_API_BASE_URL`.

Ví dụ `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8080
```

Nếu frontend và backend đi cùng domain/reverse proxy, có thể để rỗng biến này để frontend gọi cùng origin.

## 9. Khởi tạo database

Hệ thống hiện tại chạy với PostgreSQL và `spring.jpa.hibernate.ddl-auto=update`.

### Cách khởi tạo local

1. Cài PostgreSQL local.
2. Cấu hình `SPRING_DATASOURCE_*`.
3. Chạy backend.

Lưu ý:

- Nếu datasource trỏ về `localhost` hoặc `127.0.0.1` và `APP_LOCAL_DB_AUTO_CREATE_ENABLED=true`, backend có thể tự tạo database local nếu database đích chưa tồn tại.
- Sau khi kết nối được, Hibernate sẽ tự tạo/cập nhật schema.
- File `infrastructure_management_script.sql` trong repo không phải luồng khởi tạo runtime chính của hệ thống hiện tại.
- README cũ từng nhắc SQL Server, nhưng code hiện tại đang dùng PostgreSQL.

## 10. Chạy ứng dụng local

### Chạy backend

```bash
./mvnw spring-boot:run
```

Backend mặc định chạy tại:

- `http://localhost:8080`

Swagger UI:

- `http://localhost:8080/swagger-ui.html`

### Chạy frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend mặc định chạy tại:

- `http://localhost:5173`

## 11. Seed dữ liệu demo

Khi backend khởi động:

- Hệ thống luôn seed nhóm `TechSupportType` mặc định.
- Tài khoản demo chỉ được seed khi bật:

```env
APP_SEED_DEMO_USERS_ENABLED=true
```

Các tài khoản demo hiện có:

| Username | Vai trò | Mật khẩu mặc định |
| --- | --- | --- |
| `admin` | `Admin` | `123456` |
| `nhanvien` | `NhanVien` | `123456` |
| `consumable` | `ConsumableManager` | `123456` |
| `techsup1` | `TechSupport` | `123456` |
| `techsup2` | `TechSupport` | `123456` |
| `techsup3` | `TechSupport` | `123456` |
| `techsup4` | `TechSupport` | `123456` |

Lưu ý:

- Seeder hiện tại chỉ gán mật khẩu khi user chưa có mật khẩu trong database.
- Không nên bật seed demo ở môi trường production.

## 12. API, realtime và file tĩnh

### Các nhóm API chính

- `/api/auth`: đăng nhập, đăng ký, kiểm tra username.
- `/api/assets`: tài sản, vật tư tiêu hao, import Excel, QR code.
- `/api/categories`: nhóm tài sản.
- `/api/locations`: phòng/khu vực.
- `/api/tickets`: ticket, timeline, gia hạn, gợi ý kỹ thuật viên.
- `/api/maintenance`: báo hỏng và lịch sử bảo trì.
- `/api/inventory-audits`: kiểm kê.
- `/api/dashboard`: dashboard và KPI.
- `/api/notifications`: thông báo.
- `/api/asset-map`: sơ đồ tầng/phòng và import nền ảnh.
- `/api/branding`: branding công khai.
- `/api/reports`: xuất báo cáo.

### Realtime

- WebSocket native: `/api/ws`
- SockJS fallback: `/api/ws-sockjs`
- SSE cảnh báo admin: `/api/alerts/stream`

### Media và upload

- Backend public file qua `/uploads/**` và `/api/uploads/**`.
- Theo cách triển khai hiện tại, file thật nằm trên VPS DigitalOcean, trong thư mục/volume được map với `APP_UPLOAD_DIR`.
- Khi chạy container backend theo `Dockerfile`, giá trị mặc định là `/app/uploads`.
- Điều này có nghĩa là media không nằm trên GitHub, không nằm trên máy người dùng, mà nằm trên chính VPS đang host hệ thống.
- Vì database và media cùng nằm trên một VPS, backup production cần bao gồm cả PostgreSQL và thư mục/volume upload.

## 13. Route giao diện chính

### Admin

- `/admin/dashboard`
- `/admin/assets`
- `/admin/assets/fixed`
- `/admin/assets/consumables`
- `/admin/asset-map`
- `/admin/locations`
- `/admin/locations/area-types`
- `/admin/categories/fixed`
- `/admin/categories/consumables`
- `/admin/tickets`
- `/admin/tickets/extensions`
- `/admin/inventory-audits`
- `/admin/users`
- `/admin/branding`

### Nhân viên

- `/mobile/home`
- `/mobile/scan`
- `/mobile/maintenance`
- `/mobile/chats`

### TechSupport

- `/tech/tickets`
- `/tech/chats`
- `/tech/inventory-audits`
- `/tech/inventory-audits/history`
- `/tech-mobile/tickets`
- `/tech-mobile/chats`
- `/tech-mobile/inventory-audits`

### ConsumableManager

- `/supply/consumables`

## 14. Build và kiểm tra

### Backend

```bash
./mvnw -DskipTests compile
./mvnw test
./mvnw package
```

### Frontend

```bash
cd frontend
npm run lint
npm run build
npm run preview
```

## 15. Docker

Repo hiện có `Dockerfile` cho backend.

### Build image

```bash
docker build -t mhv-backend .
```

### Chạy container backend

```bash
docker run --rm -p 8080:8080 \
  -e JWT_SECRET=your_jwt_secret \
  -e SPRING_DATASOURCE_URL=jdbc:postgresql://host.docker.internal:5432/mhv \
  -e SPRING_DATASOURCE_USERNAME=postgres \
  -e SPRING_DATASOURCE_PASSWORD=postgres \
  mhv-backend
```

Lưu ý:

- `Dockerfile` hiện chỉ đóng gói backend.
- Mô hình triển khai thực tế hiện tại là một VPS DigitalOcean dùng để build và chạy toàn bộ hệ thống.
- Frontend sau khi build được phục vụ cùng stack triển khai trên VPS, không dùng object storage cho media.
- Nếu dùng local storage trong container, mặc định backend lưu file ở `/app/uploads`, và thư mục này cần được mount ra volume/ổ đĩa của VPS.

## 16. Triển khai

Repo hiện có tài liệu triển khai riêng tại:

- `deploy/single-vps/README.md`: triển khai `frontend + backend + PostgreSQL + uploads` trên một VPS.
- `deploy/single-vps/.env.example`: mẫu biến môi trường cho Docker Compose.

Mô hình triển khai hiện tại của hệ thống là:

- thuê 1 VPS trên DigitalOcean
- dùng chính VPS đó để build frontend và backend
- chạy backend, frontend và PostgreSQL trên cùng một máy
- lưu toàn bộ media upload trên local disk/volume của VPS

Nói ngắn gọn: production hiện tại không dùng DigitalOcean Spaces hay dịch vụ lưu trữ media tách riêng; database và tập tin media đang cùng nằm trên một VPS.

Ngoài ra có profile `vpsdb` trong `src/main/resources/application-vpsdb.properties` để backend local kết nối tới PostgreSQL đang chạy trên VPS qua SSH tunnel.

Ví dụ:

```bash
ssh -N -L 5433:127.0.0.1:5432 root@YOUR_VPS_IP
SPRING_PROFILES_ACTIVE=vpsdb ./mvnw spring-boot:run
```

## 17. Tài liệu liên quan

- `cad-parser-service/README.md`: tài liệu cho microservice Python phân tích CAD.
- `frontend/README.md`: hiện vẫn là README mặc định của template Vite, không phản ánh đầy đủ nghiệp vụ dự án.
- `HELP.md`: file mặc định do Spring Boot sinh ra.

Lưu ý: backend hiện tại đã có luồng import nền ảnh cho sơ đồ qua `PNG/JPG/JPEG`. Service CAD parser được tách riêng và có README riêng, phù hợp khi cần mở rộng luồng import `DWG/DXF`.

## 18. Ghi chú nghiệp vụ quan trọng

- `Location.hasAsset = true`: khu vực hợp lệ để gán/chứa tài sản.
- `Location.hasAsset = false`: khu vực chỉ để hiển thị trên sơ đồ, không dùng trong các nghiệp vụ cần chọn nơi lưu tài sản.
- Tài sản hiển thị trên sơ đồ theo `Asset.location`.
- `homeLocation` được dùng làm vị trí gốc/fallback cho dữ liệu legacy và nghiệp vụ mượn/trả.
- Vật tư tiêu hao được quản lý theo lô nhập và tồn theo phòng/kho, không chỉ theo một số lượng tổng đơn giản.
- Branding ưu tiên lấy từ database (`app_settings`), biến môi trường chỉ đóng vai trò fallback.

## 19. Vận hành và bảo mật

- Không commit secret thật vào Git.
- Tách biến môi trường theo `dev`, `staging`, `prod`.
- Tắt `APP_SEED_DEMO_USERS_ENABLED` trong production.
- Kiểm tra `APP_CORS_ALLOWED_ORIGINS` khi đổi domain frontend.
- Code vẫn hỗ trợ object storage, nhưng production hiện tại đang dùng local storage trên VPS.
- Với mô hình một VPS hiện tại, cần backup cả PostgreSQL lẫn thư mục/volume upload vì hai phần này cùng quyết định dữ liệu sống của hệ thống.

## 20. Ưu tiên khi README và code lệch nhau

Nếu có chênh lệch giữa README và code, nên ưu tiên kiểm tra:

- `src/main/resources/application.properties`
- `src/main/resources/application-vpsdb.properties`
- `pom.xml`
- `frontend/package.json`
- `frontend/src/App.jsx`
