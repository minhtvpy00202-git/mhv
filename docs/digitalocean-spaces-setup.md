# Luu Media Len DigitalOcean Spaces

## Tong Quan

Backend da duoc ho tro 2 che do luu media:

- `local`: luu vao thu muc `uploads` tren may/server
- `spaces`: upload len DigitalOcean Spaces va luu URL public vao DB

Anh ticket va media chat moi deu di qua cung mot tang storage nay.

## Bien Moi Truong Can Dat Tren Backend

Dat cac env vars sau cho component backend tren DigitalOcean App Platform:

```env
APP_STORAGE_PROVIDER=spaces
APP_SPACES_BUCKET=ten-space-cua-ban
APP_SPACES_REGION=sgp1
APP_SPACES_ENDPOINT=https://sgp1.digitaloceanspaces.com
APP_SPACES_ACCESS_KEY=xxxxxxxx
APP_SPACES_SECRET_KEY=xxxxxxxx
APP_SPACES_PUBLIC_BASE_URL=https://ten-space-cua-ban.sgp1.digitaloceanspaces.com
```

Neu chay local va muon test Spaces, co the dat cac bien moi truong tuong tu roi chay backend binh thuong.

## Can Lam Gi Tren Trang Web DigitalOcean

### 1. Tao Space

- Vao `DigitalOcean -> Spaces Object Storage`
- Tao mot Space moi, vi du `mhv-media`
- Chon region gan voi app backend, vi du `Singapore (sgp1)`

### 2. Tao Access Key

- Trong trang Spaces, tao `Access Key`
- Lay:
  - `Access Key`
  - `Secret Key`
- Gan vao:
  - `APP_SPACES_ACCESS_KEY`
  - `APP_SPACES_SECRET_KEY`

### 3. Chot Public URL

- Neu bucket cua ban la `mhv-media`
- Va region la `sgp1`
- Thi `APP_SPACES_PUBLIC_BASE_URL` thuong la:

```env
APP_SPACES_PUBLIC_BASE_URL=https://mhv-media.sgp1.digitaloceanspaces.com
```

### 4. Dam Bao Object Co The Doc Cong Khai

Code hien tai upload object voi ACL `public-read`, nen URL anh/chat tra ve se la URL public truc tiep.

Neu ban dang dung chinh sach han che hon o phia Spaces, hay dam bao object co the GET duoc cong khai. Neu khong, frontend se co URL nhung van khong xem duoc anh.

### 5. App Platform Backend

- Vao app backend tren `DigitalOcean App Platform`
- Mo `Settings` hoac `App Spec`
- Them cac env vars o muc tren
- Redeploy backend

## Cach Kiem Tra Sau Khi Deploy

1. Dang nhap bang nhan vien hoac techsupport
2. Tao ticket moi co anh
3. Gui anh trong chat
4. Mo DevTools/network hoac copy URL anh ra tab moi
5. URL ky vong se co dang:

```text
https://ten-space.region.digitaloceanspaces.com/tickets/...
https://ten-space.region.digitaloceanspaces.com/chat/image/...
https://ten-space.region.digitaloceanspaces.com/chat/audio/...
```

## Luu Y

- Du lieu media cu trong local `uploads` se khong tu dong migrate sang Spaces
- Media moi tao sau khi bat `APP_STORAGE_PROVIDER=spaces` se luu len Spaces
- Frontend khong can them env moi de xem anh, vi backend tra URL day du
