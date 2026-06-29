# Single VPS Deployment

Muc tieu cua bo file nay la gom 3 phan hien tai:

- app `frontend + backend`
- database `PostgreSQL`
- media local `uploads/`

ve cung 1 VPS DigitalOcean duy nhat.

## 1. Local uploads nam o dau?

Neu dung:

```env
APP_STORAGE_PROVIDER=local
APP_UPLOAD_DIR=/app/uploads
```

thi file upload se nam tren o dia cua may dang chay container `app`.

Trong `docker-compose.yml`, thu muc nay duoc gan vao volume:

```yaml
volumes:
  - uploads_data:/app/uploads
```

Nghia la:

- file **khong** nam tren GitHub
- file **khong** nam tren "cloud cua GitHub"
- file nam tren VPS DigitalOcean cua ban, trong volume/local disk Docker

GitHub chi luu source code ban push len repo. Runtime upload khong tu dong len GitHub.

## 2. Khi nao dung duoc bo file nay?

Dung khi ban muon bo:

- App Platform
- Managed PostgreSQL
- Spaces

va chuyen sang 1 Droplet duy nhat.

## 3. Chuan bi tren VPS

Can:

- Ubuntu 24.04 hoac tuong duong
- Docker Engine
- Docker Compose plugin
- domain da tro vao IP cua VPS

Mo firewall:

- `22` cho SSH
- `80` cho HTTP
- `443` cho HTTPS neu ban dung reverse proxy TLS ben ngoai

## 4. Tao file env

```bash
cd /opt/mhv
cp deploy/single-vps/.env.example deploy/single-vps/.env
```

Sua cac bien quan trong:

- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `PUBLIC_DOMAIN`
- `APP_CORS_ALLOWED_ORIGINS`

## 5. Chay stack

```bash
cd /opt/mhv/deploy/single-vps
docker compose up -d --build
```

Sau khi chay:

- frontend duoc phuc vu boi `web`
- backend chay trong `app`
- postgres chay trong `postgres`
- HTTPS reverse proxy chay trong `proxy (Caddy)`
- media luu local trong volume `uploads_data`

## 6. DNS va truy cap

Neu domain tro dung vao VPS, ban co the truy cap bang:

- `https://your-domain.com`

`Caddy` se tu dong:

- xin chung chi Let's Encrypt
- renew tu dong
- redirect `http` sang `https`

Dieu kien de HTTPS cap duoc:

- `PUBLIC_DOMAIN` phai dung
- DNS cua domain phai tro vao IP VPS
- firewall/Droplet phai mo cong `80` va `443`

Vi du voi DuckDNS:

```env
PUBLIC_DOMAIN=qltsmhv.duckdns.org
APP_CORS_ALLOWED_ORIGINS=https://qltsmhv.duckdns.org
VITE_API_BASE_URL=
```

## 7. Backup can lam

Vi media va database deu nam cung 1 VPS, ban nen backup:

- PostgreSQL dump
- volume `uploads_data`

Khuyen nghi:

- bat Droplet Backups cua DO
- hoac tao cron job `pg_dump`
- hoac dong bo backup sang noi khac

## 8. Chi phi co giam khong?

Thuong la co.

Vi ban bo duoc:

- App Platform
- Managed Database
- Spaces

va thay bang 1 Droplet.

Nhung doi lai:

- ban tu quan ly backup
- ban tu quan ly server
- 1 may loi la anh huong ca app + db + media

## 9. Goi y cau hinh

- dev / test nho: `2 GB RAM`
- production nho: `4 GB RAM`

Neu co nhieu anh/media hoac import nhieu, nen uu tien:

- `4 GB RAM`
- hoac gan them DO Volume cho data

## 10. Tach DB giua App Platform va VPS

Bo file nay chi anh huong toi stack tren Droplet:

- `web` + `app` + `postgres` tren VPS se dung PostgreSQL noi bo cua VPS
- App Platform van co the tiep tuc dung Managed PostgreSQL cua DigitalOcean qua environment variables rieng cua App Platform

Nghia la:

- `https://your-duckdns-domain` se doc/ghi vao DB tren VPS
- App Platform van doc/ghi vao Database Cluster neu ban giu nguyen `SPRING_DATASOURCE_*` trong App Platform

## 11. Chay local nhung dung DB tren VPS

Neu ban muon backend chay tren may ca nhan nhung dung cung DB voi VPS:

1. Tren VPS, `docker-compose.yml` da publish Postgres vao `127.0.0.1:5432` cua chinh VPS.
2. Tren may ca nhan, mo SSH tunnel:

```bash
ssh -N -L 5433:127.0.0.1:5432 root@YOUR_VPS_IP
```

3. Chay backend local voi profile `vpsdb`.

Spring Boot da co file [application-vpsdb.properties](file:///Users/tranminh/FPOLY/AI/mhv/src/main/resources/application-vpsdb.properties) voi default:

```properties
spring.datasource.url=jdbc:postgresql://localhost:5433/mhv
spring.datasource.username=mhv
```

Chi can set trong IntelliJ:

```env
SPRING_PROFILES_ACTIVE=vpsdb
SPRING_DATASOURCE_PASSWORD=your_vps_postgres_password
JWT_SECRET=your_jwt_secret
```

Neu muon override host/port/db/user, ban co the set lai `SPRING_DATASOURCE_URL` va `SPRING_DATASOURCE_USERNAME` nhu binh thuong.
