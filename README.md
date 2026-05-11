# MHV - He thong quan ly ha tang phong hoc

Du an MHV giup quan ly tai san, muon/tra thiet bi, bao hong, kiem ke dinh ky, thong bao realtime va ho tro xu ly ticket ky thuat.

## 1. Cong nghe su dung

- Backend: Java 17, Spring Boot, Spring Security, Spring Data JPA, WebSocket, SSE.
- Frontend: React + Vite, TailwindCSS, React Router, React Toastify.
- Database: Microsoft SQL Server.
- Bao cao va QR: Apache POI (Excel), ZXing (QR Code).

## 2. Cau truc du an

```text
mhv/
|- src/main/java/com/poly/mhv      # Backend Spring Boot
|- src/main/resources              # Cau hinh backend
|- frontend/                       # Frontend React
|- docs/                           # Tai lieu nghiep vu/ky thuat
|- infrastructure_management_script.sql
|- pom.xml
```

## 3. Tinh nang chinh

- Dang nhap, dang ky, xac thuc JWT, phan quyen theo vai tro.
- Quan ly tai san: them/sua/xoa, loc tim, tao QR.
- Muon/tra thiet bi qua QR scanner.
- Bao hong thiet bi va cap nhat trang thai xu ly.
- Kiem ke dinh ky va doi soat tai san.
- Quan ly thong bao va xem chi tiet nghiep vu.
- Goi y thong minh cho Admin dua tren tan suat bao hong va luot muon theo thang.
- Ticket ky thuat va chat realtime (WebSocket/SSE).
- Dieu phoi ticket theo nhom TechSupport, ho tro "nhan viec truoc duoc gan truoc".

## 4. Yeu cau moi truong

- Java 17.
- Maven (hoac dung `./mvnw`).
- Node.js 18+ va npm.
- SQL Server dang chay.

## 5. Cai dat va chay nhanh

### 5.1 Tao database

1. Tao database va du lieu mau bang script:

```bash
sqlcmd -S localhost,1433 -U sa -P "<mat_khau>" -i infrastructure_management_script.sql
```

2. Hoac mo script `infrastructure_management_script.sql` bang SSMS va chay thu cong.

### 5.2 Cau hinh backend

Sua file `src/main/resources/application.properties`:

- `spring.datasource.url`
- `spring.datasource.username`
- `spring.datasource.password`
- `app.cors.allowed-origins` (them domain frontend production neu deploy)
- `jwt.secret`

### 5.3 Chay backend

```bash
./mvnw spring-boot:run
```

Backend mac dinh: `http://localhost:8080`.

### 5.4 Chay frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend mac dinh: `http://localhost:5173`.

## 6. Bien moi truong frontend

Frontend su dung `VITE_API_BASE_URL` de goi backend.

Vi du file `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8080
```

Khi deploy Vercel, dat `VITE_API_BASE_URL` thanh domain backend production.

## 7. Lenh build/kiem tra

### Backend

```bash
./mvnw -DskipTests compile
./mvnw test
```

### Frontend

```bash
cd frontend
npm run build
```

## 8. Tai lieu chi tiet

- Tai lieu tong quan chi tiet: `docs/TAI_LIEU_TONG_QUAN_DU_AN.md`
- So do da co san:
  - `docs/repair-ticket-flowchart.md`
  - `docs/repair-ticket-sequence.md`

## 9. Mo ta logic nang cao

### 9.1 Goi y thong minh (Admin Dashboard)

- He thong tong hop du lieu trong thang hien tai:
  - So lan bao hong theo thiet bi.
  - So luot muon theo thiet bi.
- Tu do sinh danh sach de xuat uu tien:
  - `breakdownCount >= 3`: de xuat thanh ly/mua moi.
  - `breakdownCount >= 2` hoac `usageCount >= 30`: de xuat bao tri chuyen sau.
  - Nguoc lai: de xuat theo doi dinh ky.
- Neu khong co thiet bi vuot nguong canh bao, he thong tra ve thong diep mac dinh.

### 9.2 Dieu phoi ticket theo nhom ky thuat

- Role cha `TechSupport` gom 4 role con/chuyen mon:
  - Ky thuat vien cong nghe.
  - Ky thuat vien thiet bi giang day.
  - Ky thuat vien thiet bi thi nghiem.
  - Ky thuat vien thiet bi the duc the thao.
- Khi phat sinh bao hong:
  - He thong xac dinh loai thiet bi.
  - Chi gui thong bao den nhom TechSupport phu hop voi loai do.
- Co che nhan viec:
  - Nhieu ky thuat vien cung nhom deu thay ticket va co quyen nhan viec.
  - Ai nhan truoc se duoc gan ticket (co che tranh gan trung).
  - Nguoi khac se khong the nhan tiep ticket da co nguoi xu ly.
- Neu ticket chua co ai nhan:
  - Admin co the dung tinh nang "Dieu phoi ticket" de chi dinh truc tiep ky thuat vien.

## 10. Luu y bao mat

- Khong commit thong tin nhay cam (mat khau DB, JWT secret that) len git cong khai.
- Nen dung bien moi truong theo tung moi truong (`dev`, `staging`, `prod`).
