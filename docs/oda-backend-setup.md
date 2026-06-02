# Cai ODA File Converter trong backend container

## Muc tieu

Backend web service se nhan `DWG`, goi local `ODA File Converter` de doi sang `DXF`, sau do parse `DXF` ngay trong Java.

## 1. Trang thai hien tai cua repo

- `Dockerfile` da duoc cap nhat de tu tai va cai `ODA File Converter` ban Linux `.deb` trong luc build image.
- Link mac dinh hien dang duoc dung:

```text
https://www.opendesign.com/guestfiles/get?filename=ODAFileConverter_QT6_lnxX64_8.3dll_27.1.deb
```

- Neu ODA doi version hay doi ten file, can cap nhat lai `ARG ODA_DEB_URL` trong `Dockerfile`.

## 2. Ban can lam gi tren DigitalOcean

Chi can 2 viec:

- Push code moi len GitHub de DigitalOcean build lai image bang `Dockerfile`
- Cau hinh env:

```env
APP_ASSET_MAP_IMPORT_ODA_ENABLED=true
```

Khong bat buoc phai set them `APP_ASSET_MAP_IMPORT_ODA_EXECUTABLE_PATH` nua vi image da dat san:

```env
APP_ASSET_MAP_IMPORT_ODA_EXECUTABLE_PATH=/usr/bin/ODAFileConverter
APP_ASSET_MAP_IMPORT_ODA_USE_XVFB=true
```

Ban van co the override neu can.

## 3. Cau hinh env tren DigitalOcean

```env
APP_ASSET_MAP_IMPORT_ODA_ENABLED=true
APP_ASSET_MAP_IMPORT_ODA_EXECUTABLE_PATH=/usr/bin/ODAFileConverter
APP_ASSET_MAP_IMPORT_ODA_OUTPUT_VERSION=ACAD2018
APP_ASSET_MAP_IMPORT_ODA_TIMEOUT_SECONDS=120
APP_ASSET_MAP_IMPORT_ODA_AUDIT=true
APP_ASSET_MAP_IMPORT_ODA_RECURSIVE=false
APP_ASSET_MAP_IMPORT_ODA_USE_XVFB=true
```

Neu binary da nam tren `PATH`, co the de:

```env
APP_ASSET_MAP_IMPORT_ODA_EXECUTABLE_PATH=ODAFileConverter
```

## 4. Test local

### Cach 1: test bang Docker

- Cach nay chay dung nhu production tren DO.
- Docker build se tu tai va cai ODA trong image.

Vi du:

```bash
docker build -t mhv-backend .
docker run --rm -p 8080:8080 \
  -e JWT_SECRET=dev-secret \
  -e SPRING_DATASOURCE_URL=jdbc:postgresql://host.docker.internal:5432/mhv \
  -e SPRING_DATASOURCE_USERNAME=postgres \
  -e SPRING_DATASOURCE_PASSWORD=postgres \
  -e APP_ASSET_MAP_IMPORT_ODA_ENABLED=true \
  mhv-backend
```

### Cach 2: run backend truc tiep bang IDE hoac `./mvnw spring-boot:run`

- Cach nay **khong dung Dockerfile**.
- Neu muon ODA hoat dong o local theo cach nay, ban phai tu cai ODA tren may va tu set:

```env
APP_ASSET_MAP_IMPORT_ODA_ENABLED=true
APP_ASSET_MAP_IMPORT_ODA_EXECUTABLE_PATH=/duong-dan-toi-ODAFileConverter
APP_ASSET_MAP_IMPORT_ODA_USE_XVFB=false
```

- Neu chi dev logic thong thuong, co the de `APP_ASSET_MAP_IMPORT_ODA_ENABLED=false`.

## 5. Luong chay

- User upload `DWG`
- Backend tai file tu storage vao thu muc tam
- Backend goi ODA de doi sang `DXF`
- Backend parse text DXF, tach ban ve con, gan nhan de hieu
- Admin chon ban can dung
- Backend parse suggestion phong/khu vuc nhu luong import hien tai

## 6. Ghi chu

- DigitalOcean hien da duoc xac nhan build bang `Dockerfile` cua repo.
- Vi ODA la phan mem ben thu ba, build image se phu thuoc vao viec link tai tren guestfiles con hoat dong.
- Neu build bi loi tai buoc ODA, can kiem tra lai link `ODA_DEB_URL` trong `Dockerfile`.
