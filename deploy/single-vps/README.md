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
- media luu local trong volume `uploads_data`

## 6. DNS va truy cap

Neu domain tro dung vao VPS, ban co the truy cap bang:

- `http://your-domain.com`

Hien tai `nginx.conf` nghe port `80`.

Neu muon HTTPS, co 2 cach:

- dat Nginx/Caddy tren host de cap TLS
- hoac them reverse proxy TLS rieng trong docker

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
