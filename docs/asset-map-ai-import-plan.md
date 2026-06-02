# Ke hoach ky thuat: AI doc ban ve cho So do dinh vi tai san

## 1. Muc tieu

Xay dung tinh nang import ban ve toa nha de ho tro tao so do trong tab `So do dinh vi tai san`.

Giai doan dau uu tien:

- Ho tro file `PDF` va `DWG`
- He thong chi sinh `goi y de duyet`, khong ghi thang vao du lieu that
- Admin xem preview, chinh tay, sau do moi ap dung vao `MapFloor`, `Location`, `RoomShape`

## 2. Nguyen tac thiet ke

- Giu nguyen domain hien tai:
  - `MapFloor` = tang
  - `Location` = phong/khu vuc
  - `RoomShape` = vung tren grid
- Khong de AI ghi truc tiep vao bang nghiep vu dang chay
- Tach du lieu import thanh lop `job -> parsed source -> suggestion`
- Ket hop `parser + rule + AI`, khong phu thuoc AI thuần
- `DWG` di qua buoc chuyen doi trung gian truoc khi phan tich

## 3. Pham vi giai doan 1

### Trong pham vi

- Upload file ban ve
- Tao `import job`
- Luu metadata file va ket qua parse trung gian
- Sinh danh sach goi y phong/khu vuc
- Hien preview tren canvas hien tai
- Cho phep admin:
  - sua ten khu vuc
  - sua tang
  - sua `hasAsset`
  - bo qua goi y
  - chap nhan va ap dung vao so do

### Ngoai pham vi

- OCR chuan xac 100% cho moi loai PDF scan
- Tu dong dung so do hoan hao khong can duyet
- Chinh sua file CAD goc
- Dong bo nguoc tu so do ve file PDF/DWG

## 4. Mo hinh du lieu de xuat

Them 3 nhom bang moi:

### 4.1 `map_import_jobs`

Muc dich: quan ly mot lan import.

Truong de xuat:

- `id`
- `sourceFileName`
- `sourceFileType` (`PDF`, `DWG`, `DXF`, `UNKNOWN`)
- `storagePath`
- `status` (`UPLOADED`, `PROCESSING`, `REVIEW_READY`, `APPLIED`, `FAILED`)
- `requestedBy`
- `requestedAt`
- `errorMessage`
- `previewImagePath`
- `pageCount`
- `detectedFloorCount`
- `rawMetadataJson`

### 4.2 `map_import_floors`

Muc dich: tang tam trong mot import job, chua phai `MapFloor` that.

Truong de xuat:

- `id`
- `jobId`
- `sourceFloorKey`
- `suggestedName`
- `pageNumber`
- `sortOrder`
- `widthPx`
- `heightPx`
- `scaleHint`
- `backgroundImagePath`

### 4.3 `map_import_suggestions`

Muc dich: moi vung phong/khu vuc ma parser/AI tim thay.

Truong de xuat:

- `id`
- `importFloorId`
- `suggestionType` (`ROOM`, `CORRIDOR`, `STAIR`, `ELEVATOR`, `YARD`, `ROAD`, `GATE`, `UNKNOWN`)
- `labelText`
- `normalizedName`
- `cellsJson`
- `polygonJson`
- `colorHex`
- `hasAssetSuggested`
- `confidenceScore`
- `sourceMethod` (`VECTOR`, `OCR`, `CAD_LAYER`, `AI_INFERENCE`, `MANUAL`)
- `reviewStatus` (`PENDING`, `APPROVED`, `REJECTED`, `EDITED`)
- `linkedLocationId`
- `notes`

## 5. Vi sao can lop suggestion rieng

He thong hien tai dang ghi truc tiep vao:

- `MapFloor`
- `Location`
- `RoomShape`

Neu import ghi thang vao day thi se gay cac rui ro:

- du lieu sai kho sua lui
- AI/parse nhan sai ten phong
- kho phan biet du lieu that va du lieu goi y
- kho ho tro UI review

Vi vay, `suggestion` la lop trung gian bat buoc nen co.

## 6. Pipeline xu ly file

### 6.1 PDF

Chia 2 nhanh:

- `PDF vector`
  - doc line/path/text bang parser
  - tim closed shape, text label, kich thuoc trang
- `PDF scan/image`
  - render page thanh image
  - OCR lay text
  - CV tim contour/vung khép kín

Thu vien/huong de xuat:

- `Apache PDFBox` de doc PDF va render page
- `Tesseract` hoac dich vu OCR de lay text neu la scan
- `OpenCV` hoac xu ly image de tim vung

### 6.2 DWG

Khong nen doc truc tiep trong service chinh.

Huong de xuat:

- `DWG` -> convert sang `DXF` hoac `SVG/PDF`
- parse file trung gian
- dua ve cung mot mo hinh `ParsedDrawingModel`

Lua chon thuc te:

- Neu co tool chuyen doi CAD san co trong ha tang:
  - chay qua worker/CLI rieng
- Neu khong:
  - uu tien yeu cau upload `PDF` xuat tu CAD trong pha 1
  - thiet ke interface san de cam `DWG` o pha 2

## 7. Mo hinh noi bo de xuat trong backend

Them cac model noi bo, chua can expose thang ra API:

### 7.1 `ParsedDrawingModel`

- `floors`
- `drawingBounds`
- `labels`
- `regions`
- `sourceType`

### 7.2 `ParsedDrawingFloor`

- `sourceFloorKey`
- `suggestedName`
- `backgroundWidth`
- `backgroundHeight`
- `regions`

### 7.3 `ParsedRegion`

- `labelText`
- `polygon`
- `boundingBox`
- `suggestionType`
- `hasAssetSuggested`
- `confidenceScore`
- `sourceMethod`

## 8. Quy tac map sang domain hien tai

Sau khi admin duyet:

- Neu chua co tang:
  - tao `MapFloor`
- Neu da co tang:
  - cho admin chon map vao tang hien co hoac tao tang moi
- Moi suggestion duoc chap nhan se:
  - tao moi hoac gan vao `Location`
  - set `Location.hasAsset` theo review
  - tao `RoomShape`

Quy tac:

- `ROOM` thuong mac dinh `hasAsset = true`
- `CORRIDOR`, `STAIR`, `ELEVATOR`, `YARD`, `ROAD`, `GATE` thuong mac dinh `hasAsset = false`
- Admin duoc sua lai truoc khi ap dung

## 9. API de xuat

Them namespace moi:

- `/api/asset-map-import`

### 9.1 Upload file

`POST /api/asset-map-import/jobs`

Request:

- multipart file
- optional `sourceType`

Response:

- thong tin `job`

### 9.2 Bat dau phan tich

`POST /api/asset-map-import/jobs/{jobId}/analyze`

Response:

- trang thai job moi

### 9.3 Lay ket qua review

`GET /api/asset-map-import/jobs/{jobId}`

Response:

- job
- import floors
- suggestions

### 9.4 Cap nhat suggestion trong buoc duyet

`PUT /api/asset-map-import/jobs/{jobId}/suggestions/{suggestionId}`

Cho phep sua:

- ten
- loai khu vuc
- tang
- `hasAsset`
- mau
- trang thai review

### 9.5 Ap dung vao so do that

`POST /api/asset-map-import/jobs/{jobId}/apply`

Response:

- danh sach `MapFloorResponse` vua tao/cap nhat

## 10. Service de xuat

### 10.1 `AssetMapImportService`

Trach nhiem:

- tao job
- quan ly trang thai job
- dieu phoi pipeline parse
- apply ket qua vao domain that

### 10.2 `DrawingParseService`

Interface tong:

- `supports(sourceType)`
- `parse(file)`

### 10.3 `PdfDrawingParseService`

Trach nhiem:

- detect PDF vector hay scan
- tach trang
- extract label/shape

### 10.4 `CadDrawingParseService`

Trach nhiem:

- goi buoc convert trung gian
- parse ket qua convert

### 10.5 `DrawingSuggestionService`

Trach nhiem:

- chay rule
- goi AI neu can
- sinh `ParsedRegion` + `suggestionType` + `hasAssetSuggested`

## 11. Luong UI de xuat trong frontend

Tren man `AssetMapManagement.jsx`, them mot action moi:

- `Import ban ve`

### 11.1 Modal upload

Cho phep:

- chon file PDF/DWG
- chon loai file neu can

### 11.2 Man review import

Can co:

- preview background image/pdf page
- overlay cac region goi y
- sidebar danh sach suggestion
- bo loc theo tang / loai / confidence / review status

### 11.3 Hanh dong review

Moi suggestion co cac thao tac:

- chap nhan
- bo qua
- sua ten
- sua `hasAsset`
- chuyen tang
- gan vao `Location` san co
- tao `Location` moi

### 11.4 Hanh dong cuoi

- `Ap dung vao so do`

Khi ap dung xong:

- reload bootstrap asset map
- dua user ve tang vua duoc cap nhat

## 12. Tich hop AI nhu the nao

AI chi nen lam cac viec sau:

- chuan hoa ten phong/khu vuc tu text OCR
- phan loai khu vuc:
  - phong
  - hanh lang
  - thang bo
  - thang may
  - san
  - cong
  - duong
- goi y `hasAsset`
- goi y tang neu tai lieu co ky hieu tang

Khong nen de AI:

- tu quyet dinh ghi vao DB that
- tu merge/split phong ma khong co review

## 13. Rui ro ky thuat

### 13.1 PDF scan chat luong kem

- text mo
- line dut
- mat contour

Giai phap:

- cho review thu cong
- cho resize/rotate/crop truoc khi parse

### 13.2 DWG kho chuyen doi

- phu thuoc tool ngoai
- mat layer/text khi convert

Giai phap:

- thiet ke adapter rieng cho `DWG`
- pha 1 co the an UI `DWG` neu ha tang chua san sang

### 13.3 Khong khop grid hien tai

Ban ve thuc te co toa do lien tuc, trong khi canvas hien tai la grid cell.

Giai phap:

- luu ca `polygonJson` va `cellsJson`
- giai doan apply moi rasterize polygon thanh grid cells

## 14. Chien luoc trien khai theo pha

### Pha 1A: Khung import

- Tao entity/repository cho `map_import_jobs`, `map_import_floors`, `map_import_suggestions`
- Tao upload API
- Tao review API
- Tao man upload/review rong tren frontend

### Pha 1B: PDF import co ban

- Ho tro upload PDF
- Render page thanh image preview
- Cho user dung image lam background de ve tay

Muc tieu:

- chua can AI
- da co gia tri su dung ngay

### Pha 1C: PDF parse + suggestion

- Tach text
- Tim region co ban
- Sinh suggestion
- Review va apply vao map

### Pha 2: DWG

- Them pipeline convert
- Parse du lieu CAD
- Dua ve cung model suggestion

### Pha 3: AI nang cao

- Phan loai khu vuc bang AI
- Goi y `hasAsset`
- Goi y ten chuan hoa song ngu neu can

## 15. Buoc code tiep theo de xuat

Neu bat dau implement ngay, thu tu nen la:

1. Tao bang/entity cho import job va suggestion
2. Tao API upload + lay review result
3. Them UI `Import ban ve` trong `AssetMapManagement.jsx`
4. Ho tro `PDF background import` truoc
5. Sau do moi them parser/suggestion

## 16. Quyet dinh de chot

Quyet dinh ky thuat de xuat cho du an nay:

- Dung `i18n + AI ho tro dich`, khong dung AI-thuan cho toan bo UI
- Uu tien nhanh `AI doc ban ve`
- Giai doan dau ho tro `PDF + DWG` theo kien truc mo
- Muc tu dong hoa: `goi y de duyet`
- Khong ghi truc tiep vao `MapFloor`, `Location`, `RoomShape` truoc khi admin xac nhan

