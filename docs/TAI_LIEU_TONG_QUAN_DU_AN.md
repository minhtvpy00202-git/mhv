# Tai lieu tong quan du an MHV

Tai lieu nay giup thanh vien moi (dev, test, reviewer, hoi dong bao ve) hieu nhanh toan bo du an: bai toan, kien truc, module, data flow, quy trinh nghiep vu va cach van hanh.

## 1. Bai toan nghiep vu

Du an giai quyet bai toan quan ly thiet bi trong phong hoc:

- Quan ly danh muc tai san theo phong goc/phong hien tai.
- Muon/tra thiet bi bang QR.
- Bao hong va theo doi tinh trang xu ly.
- Kiem ke dinh ky va phat hien thiet bi thieu.
- Quan ly ticket ky thuat va giao tiep realtime.
- Theo doi lich su thao tac va thong bao su kien.

## 2. Muc tieu he thong

- Chinh xac du lieu tai san theo thoi gian thuc.
- Truy vet duoc ai lam gi, luc nao.
- Ho tro nhieu vai tro nguoi dung.
- Van hanh on dinh o local va production.

## 3. Vai tro nguoi dung

- `Admin`: quan tri he thong, duyet/xu ly nhieu nghiep vu, xem dashboard va bao cao.
- `NhanVien`: muon/tra thiet bi, bao hong, xem lich su ca nhan.
- `TechSupport`: tiep nhan ticket ky thuat, xu ly va cap nhat trang thai.

4 nhom chuyen mon cua `TechSupport`:

- Ky thuat vien cong nghe.
- Ky thuat vien thiet bi giang day.
- Ky thuat vien thiet bi thi nghiem.
- Ky thuat vien thiet bi the duc the thao.

## 4. Kien truc tong the

### 4.1 Kieu kien truc

- Monolith chia layer:
  - `Controller` (REST/WebSocket endpoint)
  - `Service` (nghiep vu)
  - `Repository` (truy cap du lieu)
  - `Entity/DTO` (mo hinh du lieu)

### 4.2 Thanh phan chinh

- Frontend React:
  - Layout theo role (`AdminLayout`, `MobileLayout`, `TechSupportLayout`)
  - Pages theo module nghiep vu.
- Backend Spring:
  - JWT authentication + security filter.
  - REST API cho CRUD va nghiep vu.
  - SSE/WebSocket cho thong bao/chat realtime.
- SQL Server:
  - Luu nguoi dung, tai san, lich su, thong bao, ticket, chat.

## 5. Cau truc thu muc backend

`src/main/java/com/poly/mhv`:

- `config`: cau hinh ung dung (WebSocket, static resource, async, seeder).
- `controller`: API endpoint va endpoint realtime.
- `service`: xu ly nghiep vu chinh.
- `repository`: interface JPA truy cap CSDL.
- `entity`: mapping bang du lieu.
- `dto`: request/response model cho API.
- `security`: JWT, UserDetails, SecurityConfig.
- `exception`: xu ly loi tap trung.
- `util`: tien ich (vi du QRCode generator).

`src/main/resources`:

- `application.properties`: cau hinh datasource, JWT, CORS, upload dir.

## 6. Cau truc thu muc frontend

`frontend/src`:

- `api`: axios client va cau hinh goi API.
- `context`: quan ly auth context.
- `layouts`: layout theo role.
- `pages`: man hinh theo module.
- `components`: component dung chung (modal, notification, chat box...).
- `hooks`: custom hook (vi du websocket).
- `utils`: helper xu ly du lieu/media.

## 7. Data model tong quan

Cac bang cot loi:

- Nguoi dung: `AppUser`, `TechSupportType`.
- Tai san: `Asset`, `Category`, `Location`.
- Van hanh:
  - `UsageHistory` (muon/tra)
  - `InventoryAudit`, `InventoryAuditItem`, `InventoryAuditMissing` (kiem ke)
  - `Notification` (thong bao)
  - `Ticket`, `TicketEvent` (ticket ho tro)
  - `ChatMessage` (chat)

Quan he tieu bieu:

- `AppUser` 1-n `UsageHistory`.
- `Asset` lien ket `Category`, `Location`.
- `Ticket` lien ket nguoi tao/nguoi xu ly, va co nhieu `TicketEvent`.

## 8. Luong nghiep vu chinh

### 8.1 Muon/tra thiet bi

1. Nguoi dung quet QR tai man hinh scanner.
2. Frontend goi API lay thong tin thiet bi.
3. Backend validate trang thai + vi tri.
4. Ghi `UsageHistory`, cap nhat vi tri/trang thai tai san.
5. Tao thong bao va day realtime neu can.

### 8.2 Bao hong thiet bi

1. Nguoi dung tao report bao hong.
2. Backend luu su kien bao hong + thong tin mo ta.
3. Admin/TechSupport cap nhat tinh trang xu ly.
4. Nhat ky thong bao va lich su duoc cap nhat.

### 8.3 Kiem ke

1. Admin mo phien kiem ke theo phong.
2. Nhan vien/nguoi duoc giao quet tai san.
3. He thong doi chieu tai san co/khong co.
4. Xuat ket qua va tong hop chenh lech.

### 8.4 Ticket va chat

1. Tao ticket ho tro ky thuat.
2. He thong loc danh sach ky thuat vien theo chuyen mon phu hop loai thiet bi.
3. Gui thong bao den nhom ky thuat vien phu hop.
4. Ky thuat vien nao nhan viec truoc se duoc gan ticket.
5. Neu ticket chua co nguoi nhan, Admin co the "Dieu phoi ticket" de chi dinh nguoi xu ly.
6. Trao doi qua chat/timeline su kien.
7. Dong ticket khi da xu ly xong.

### 8.5 Goi y thong minh cho Admin

Chuc nang goi y thong minh duoc tinh theo thang hien tai, dua tren 2 tap du lieu:

- So luot muon theo tung thiet bi.
- So lan bao hong/ticket theo tung thiet bi.

Logic de xuat:

- Neu `breakdownCount >= 3`:
  - Goi y: thanh ly va mua moi.
- Neu `breakdownCount >= 2` hoac `usageCount >= 30`:
  - Goi y: bao tri chuyen sau.
- Nguoc lai:
  - Goi y: theo doi dinh ky.

Neu khong co thiet bi dat nguong canh bao, he thong tra ve:

- "Chua co thiet bi nao vuot nguong canh bao trong thang nay."

## 9. Realtime va thong bao

- SSE:
  - Gui canh bao nhanh cho dashboard/admin.
- WebSocket:
  - Ho tro chat va su kien ticket.
- Polling fallback:
  - Frontend dinh ky dong bo feed thong bao khi kenh realtime khong on dinh.

## 10. Bao mat va phan quyen

- Dang nhap bang JWT.
- Security filter xac thuc token moi request.
- Rule phan quyen theo role va endpoint.
- Validation input tai DTO/service + global exception handler.

## 11. Cau hinh production

Can luu y khi deploy:

- Dat dung `VITE_API_BASE_URL` de frontend tro den backend production.
- Cap nhat `app.cors.allowed-origins` de bao gom domain frontend (Vercel).
- Tach cau hinh bi mat ra bien moi truong.
- Cau hinh upload storage phu hop (local folder hoac object storage).

## 12. Van de ky thuat thuong gap

- Frontend nhan thong bao cham:
  - Kiem tra SSE/WebSocket ket noi va CORS.
- Toast khong hien:
  - Kiem tra parse loi API va fallback thong diep.
- Loi CORS production:
  - Kiem tra domain frontend da duoc khai bao trong backend.
- Du lieu lech khi thao tac dong thoi:
  - Kiem tra transaction va rule nghiep vu chot o backend.

## 13. Huong phat trien tiep

- Workflow nghiep vu theo trang thai ro rang (`created -> approved -> processing -> done -> closed`).
- RBAC chi tiet theo permission thay vi chi role tong quat.
- Audit log day du cap ban ghi.
- Dashboard phan tich nang cao theo phong/loai/chu ky.
- Tu dong nhac lich bao tri.
- Nang cap mo hinh goi y thong minh thanh scoring/ML khi du lieu lich su lon hon.

## 14. Checklist cho thanh vien moi

1. Chay script SQL.
2. Cau hinh `application.properties`.
3. Chay backend (`./mvnw spring-boot:run`).
4. Chay frontend (`npm run dev` trong `frontend/`).
5. Dang nhap bang tai khoan mau.
6. Thu cac luong: them tai san -> muon/tra -> bao hong -> kiem ke -> ticket.

---

Neu can trinh bay de tai tot nghiep, nen su dung tai lieu nay kem so do trong `docs/repair-ticket-flowchart.md` va `docs/repair-ticket-sequence.md`.
