# MHV

He thong quan ly tai san, vat tu tieu hao, muon/tra thiet bi, ticket sua chua, kiem ke dinh ky va so do dinh vi tai san trong toa nha.

README nay mo ta trang thai he thong hien tai trong monorepo `Spring Boot + React/Vite`.

## 1. Tong quan

MHV phuc vu cac bai toan chinh:

- Quan ly tai san don chiec va vat tu tieu hao.
- Quan ly nha cung cap, loai tai san, phong/khu vuc, nhom ky thuat vien.
- Muon/tra tai san qua QR code.
- Bao hong, dieu phoi ticket, chat realtime va theo doi tien do xu ly.
- Kiem ke dinh ky cho TechSupport.
- Theo doi ton kho, cap phat vat tu tieu hao theo phong.
- Cau hinh branding theo database.
- Ve so do tang/phong va dinh vi tai san tren ban do.

## 2. Kien truc hien tai

```text
mhv/
|- src/main/java/com/poly/mhv      # Backend Spring Boot
|- src/main/resources              # application.properties va tai nguyen backend
|- frontend/                       # Frontend React + Vite
|- docs/                           # Mot so tai lieu va script bo sung
|- uploads/                        # Thu muc upload local khi dung storage provider = local
|- Dockerfile                      # Docker image cho backend
|- pom.xml                         # Cau hinh Maven backend
```

## 3. Cong nghe su dung

### Backend

- Java 17
- Spring Boot
- Spring Security + JWT
- Spring Data JPA / Hibernate
- PostgreSQL
- WebSocket + SSE
- springdoc OpenAPI / Swagger UI
- Apache POI
- ZXing
- AWS SDK S3-compatible storage (DigitalOcean Spaces)

### Frontend

- React 19
- Vite
- React Router
- Tailwind CSS
- Axios
- React Toastify
- Recharts
- html5-qrcode
- SockJS + STOMP client

## 4. Vai tro trong he thong

He thong hien co 4 vai tro chinh:

- `Admin`: quan ly cau hinh, tai san, vat tu, phong/khu vuc, so do, ticket, kiem ke, nguoi dung.
- `NhanVien`: muon/tra, bao hong, theo doi ticket va chat.
- `TechSupport`: nhan va xu ly ticket, thuc hien kiem ke.
- `ConsumableManager`: tao phieu cap phat vat tu tieu hao va quan ly nghiep vu vat tu duoc giao.

## 5. Tinh nang noi bat

### Quan ly tai san

- CRUD tai san, ma QA, QR code.
- Ho tro 2 nhom:
  - `ITEMIZED`: tai san don chiec.
  - `CONSUMABLE`: vat tu tieu hao.
- Luu thong tin specs, nha cung cap, bao hanh, gia mua, ngay mua.

### Vat tu tieu hao

- Nhap kho theo lo, theo doi han dung, nha cung cap, don gia.
- Cap phat vat tu theo phong.
- Theo doi ton kho tai phong sau cap phat.
- Ho tro yeu cau cap phat va yeu cau tieu huy lo het han.

### Muon/tra va su dung tai san

- Muon/tra bang QR scanner.
- Luu lich su su dung va phong hien tai/phong goc.
- Tai san duoc dinh vi theo `Asset.location`.

### Ticket, bao hong va chat

- Tao ticket bao hong.
- Dieu phoi va nhan viec theo nhom TechSupport.
- Chat realtime tren ticket.
- Theo doi timeline xu ly.
- Danh gia muc do hai long sau khi ticket duoc giai quyet.

### Kiem ke dinh ky

- Admin tao phien kiem ke.
- TechSupport quet va thuc hien kiem ke tren desktop/mobile.
- Admin theo doi ket qua, xu ly thieu tai san va xuat bien ban.

### So do dinh vi tai san

- Quan ly tang voi `MapFloor`.
- Quan ly vung phong/khu vuc tren grid voi `RoomShape`.
- Gan `Location` vao so do.
- Ho tro ve phong moi, ve lai phong, sua thong tin, di chuyen phong.
- Ho tro chon nhieu phong va di chuyen ca cum.
- Tim tai san theo QA code, ten, loai, phong, tang va hien marker tren so do.
- Ho tro khu vuc `hasAsset = false` de bieu dien hanh lang, san, cong, duong di... tren so do nhung khong dung cho nghiep vu luu tru tai san.

### Branding va giao dien

- Branding lay tu database thong qua API branding.
- Ho tro ten cong ty, ten ung dung, mau chu dao, thong tin lien he.
- Ho tro dark mode qua `ThemeContext`.

## 6. Mo hinh du lieu quan trong

- `Asset`: tai san, vat tu, vi tri hien tai, vi tri goc, specs, trang thai.
- `Category`: nhom tai san, phan biet `ITEMIZED` va `CONSUMABLE`.
- `Location`: phong/khu vuc nghiep vu, co the thuoc tang va co co `hasAsset`.
- `MapFloor`: tang hien thi tren so do.
- `RoomShape`: vung da ve tren grid gan voi `Location`.
- `UsageHistory`: lich su muon/tra va di chuyen.
- `Ticket`, `TicketEvent`, `ChatMessage`: nghiep vu helpdesk.
- `InventoryAudit`, `InventoryAuditItem`, `InventoryAuditMissing`: nghiep vu kiem ke.
- `ConsumableReceiptLot`, `ConsumableIssue`, `ConsumableLocationStock`, `ConsumableRequest`, `ConsumableDisposalRequest`: nghiep vu vat tu tieu hao.
- `AppSetting`: branding va cau hinh giao dien.

## 7. Yeu cau moi truong

- Java 17
- Node.js 18+ va npm
- PostgreSQL 14+ (khuyen nghi)
- Maven 3.9+ hoac dung Maven Wrapper `./mvnw`

## 8. Cau hinh moi truong

Backend doc cau hinh tu `src/main/resources/application.properties` va environment variables.

### Bien moi truong backend quan trong

```env
JWT_SECRET=your_jwt_secret
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/mhv
SPRING_DATASOURCE_USERNAME=postgres
SPRING_DATASOURCE_PASSWORD=postgres

# tuy chon
SPRING_JPA_SHOW_SQL=false
SPRING_JPA_FORMAT_SQL=false
APP_SEED_DEMO_USERS_ENABLED=false
APP_STORAGE_PROVIDER=local
APP_UPLOAD_DIR=uploads
```

### Storage provider

- `APP_STORAGE_PROVIDER=local`: luu file vao thu muc `uploads/`.
- `APP_STORAGE_PROVIDER=spaces`: luu file len DigitalOcean Spaces hoac S3-compatible storage.

Neu dung `spaces`, can bo sung:

```env
APP_SPACES_BUCKET=your-bucket
APP_SPACES_REGION=your-region
APP_SPACES_ENDPOINT=https://your-endpoint
APP_SPACES_ACCESS_KEY=your-access-key
APP_SPACES_SECRET_KEY=your-secret-key
APP_SPACES_PUBLIC_BASE_URL=https://your-public-base-url
```

### Bien moi truong frontend

Frontend goi API thong qua `VITE_API_BASE_URL`.

Vi du `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8080
```

Neu frontend va backend cung domain/reverse proxy, co the de rong bien nay de goi cung origin.

## 9. Khoi tao database

He thong hien tai duoc thiet ke de chay voi PostgreSQL va `spring.jpa.hibernate.ddl-auto=update`.

### Cach khoi tao de phat trien local

1. Tao database rong trong PostgreSQL, vi du `mhv`.
2. Cau hinh cac bien `SPRING_DATASOURCE_*`.
3. Chay backend, Hibernate se tao/cap nhat schema tu dong.

Luu y:

- File `infrastructure_management_script.sql` trong repo la tai lieu/du lieu cu, khong phai duong khoi tao chinh cho runtime hien tai.
- README cu co nhac SQL Server, nhung he thong hien tai dang dung PostgreSQL.

## 10. Chay ung dung local

### Chay backend

```bash
./mvnw spring-boot:run
```

Mac dinh backend chay tai:

- `http://localhost:8080`

Swagger UI:

- `http://localhost:8080/swagger-ui.html`

### Chay frontend

```bash
cd frontend
npm install
npm run dev
```

Mac dinh frontend chay tai:

- `http://localhost:5173`

## 11. Seed du lieu

Khi backend khoi dong:

- He thong luon seed nhom `TechSupportType` mac dinh.
- Tai khoan demo chi duoc seed khi bat:

```env
APP_SEED_DEMO_USERS_ENABLED=true
```

Khi bat co nay, backend se upsert cac tai khoan demo:

- `admin`
- `nhanvien`
- `techsup1`
- `techsup2`
- `techsup3`
- `techsup4`

Khuyen nghi:

- Khong bat seed demo trong moi truong production.
- Tai khoan demo co the bi ghi de lai full name/password theo logic seeder.

## 12. Build va kiem tra

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
```

## 13. Docker

Repo hien co `Dockerfile` cho backend.

Build image:

```bash
docker build -t mhv-backend .
```

Run container:

```bash
docker run --rm -p 8080:8080 \
  -e JWT_SECRET=your_jwt_secret \
  -e SPRING_DATASOURCE_URL=jdbc:postgresql://host.docker.internal:5432/mhv \
  -e SPRING_DATASOURCE_USERNAME=postgres \
  -e SPRING_DATASOURCE_PASSWORD=postgres \
  mhv-backend
```

Luu y:

- `Dockerfile` hien tai dong goi backend.
- Frontend can deploy rieng, vi du Vercel, Netlify hoac reverse proxy cung backend.

## 14. Route giao dien chinh

### Admin

- `/admin/dashboard`
- `/admin/assets`
- `/admin/asset-map`
- `/admin/locations`
- `/admin/tickets`
- `/admin/inventory-audits`
- `/admin/branding`

### NhanVien

- `/mobile/home`
- `/mobile/scan`
- `/mobile/maintenance`
- `/mobile/chats`

### TechSupport

- `/tech/tickets`
- `/tech/chats`
- `/tech/inventory-audits`
- `/tech-mobile/tickets`
- `/tech-mobile/chats`

### ConsumableManager

- `/supply/consumables`

## 15. Luu y nghiep vu quan trong

- `Location.hasAsset = true`: khu vuc hop le de gan/chua tai san.
- `Location.hasAsset = false`: khu vuc chi de hien thi tren so do, khong hien trong cac nghiep vu can chon phong luu tru tai san.
- Tai san xuat hien tren so do theo `Asset.location`.
- `homeLocation` duoc dung lam vi tri goc/fallback cho du lieu legacy va nghiep vu muon/tra.
- Vat tu tieu hao duoc quan ly theo lo nhap va ton tai kho/phong, khong chi theo mot so luong tong don gian.
- Branding uu tien lay tu database (`app_settings`) qua API, env chi dong vai tro fallback.

## 16. Thu muc va tai lieu lien quan

- `frontend/.agents/skills/`: cac rule/noi quy thiet ke frontend noi bo.
- `docs/sql/`: mot so script bo sung.
- `HELP.md`: file mac dinh do Spring Boot sinh ra.

## 17. Bao mat va van hanh

- Khong commit secret that len git.
- Tach bien moi truong theo `dev`, `staging`, `prod`.
- Tat `APP_SEED_DEMO_USERS_ENABLED` trong production.
- Neu dung object storage, uu tien cap public base URL dung de frontend render media on dinh.
- Kiem tra `app.cors.allowed-origins` khi doi domain frontend.

## 18. Ghi chu phat trien

- Backend va frontend deu dang duoc phat trien lien tuc; README nay uu tien phan anh codebase hien tai.
- Neu co chenh lech giua README va code, hay uu tien:
  - `src/main/resources/application.properties`
  - `pom.xml`
  - `frontend/package.json`
  - route trong `frontend/src/App.jsx`
