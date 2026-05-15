/*
  Mục tiêu:
  - Chuẩn hóa dữ liệu cũ trong tickets.image_url về dạng public path `/uploads/...`
  - Xử lý được các case chuỗi phổ biến:
      + '/api/uploads/...'
      + 'uploads/...'
      + '\uploads\...'
      + path tuyệt đối có chứa thư mục uploads
      + chuỗi rỗng / chỉ có khoảng trắng

  Lưu ý:
  - Script SQL KHÔNG giải mã được data URL base64.
  - Với các dòng `image_url` bắt đầu bằng `data:image/...`, hãy dùng Java cleanup runner
    `TicketImageUrlCleanupRunner` để chuyển ảnh base64 thành file thật trong `/uploads/...`.
  - Nên chạy bản preview trước, rồi mới COMMIT.
*/

BEGIN TRANSACTION;
GO

-- 1) Thống kê nhanh hiện trạng image_url
SELECT
    COUNT(*) AS total_non_null_image_url
FROM tickets
WHERE image_url IS NOT NULL;
GO

SELECT
    COUNT(*) AS total_blank_image_url
FROM tickets
WHERE image_url IS NOT NULL
  AND LTRIM(RTRIM(image_url)) = '';
GO

SELECT
    COUNT(*) AS total_base64_image_url
FROM tickets
WHERE image_url LIKE 'data:image/%';
GO

-- 2) Preview các dòng bất thường trước khi sửa
SELECT TOP (200)
    id,
    image_url
FROM tickets
WHERE image_url IS NOT NULL
  AND (
        LTRIM(RTRIM(image_url)) = ''
        OR image_url LIKE '%\%'
        OR image_url LIKE '/api/uploads/%'
        OR image_url LIKE 'uploads/%'
        OR image_url LIKE '%/uploads/%'
        OR image_url LIKE '%:\%uploads\%'
      )
ORDER BY id;
GO

-- 3) Chuẩn hóa basic string cases

-- 3.1) Chuỗi trắng -> NULL
UPDATE tickets
SET image_url = NULL
WHERE image_url IS NOT NULL
  AND LTRIM(RTRIM(image_url)) = '';
GO

-- 3.2) Đổi backslash sang slash
UPDATE tickets
SET image_url = REPLACE(image_url, '\', '/')
WHERE image_url LIKE '%\%';
GO

-- 3.3) Bỏ prefix /api nếu ảnh đã là /api/uploads/...
UPDATE tickets
SET image_url = STUFF(LTRIM(RTRIM(image_url)), 1, 4, '')
WHERE LTRIM(RTRIM(image_url)) LIKE '/api/uploads/%';
GO

-- 3.4) uploads/... -> /uploads/...
UPDATE tickets
SET image_url = '/' + LTRIM(RTRIM(image_url))
WHERE LTRIM(RTRIM(image_url)) LIKE 'uploads/%';
GO

-- 3.5) Path tuyệt đối có chứa /uploads/... -> chỉ giữ phần /uploads/...
;WITH normalized AS (
    SELECT
        id,
        LTRIM(RTRIM(image_url)) AS trimmed_image_url
    FROM tickets
    WHERE image_url IS NOT NULL
)
UPDATE t
SET image_url = SUBSTRING(n.trimmed_image_url, CHARINDEX('/uploads/', n.trimmed_image_url), LEN(n.trimmed_image_url))
FROM tickets t
INNER JOIN normalized n ON n.id = t.id
WHERE CHARINDEX('/uploads/', n.trimmed_image_url) > 1;
GO

-- 4) Preview các dòng còn lại cần Java runner xử lý tiếp
SELECT TOP (200)
    id,
    image_url
FROM tickets
WHERE image_url IS NOT NULL
  AND image_url NOT LIKE '/uploads/%'
  AND image_url NOT LIKE 'http://%'
  AND image_url NOT LIKE 'https://%'
  AND image_url NOT LIKE 'data:image/%'
ORDER BY id;
GO

-- 5) Kiểm tra kết quả sau cleanup SQL
SELECT
    SUM(CASE WHEN image_url IS NULL THEN 1 ELSE 0 END) AS total_null,
    SUM(CASE WHEN image_url LIKE '/uploads/%' THEN 1 ELSE 0 END) AS total_public_upload_path,
    SUM(CASE WHEN image_url LIKE 'http://%' OR image_url LIKE 'https://%' THEN 1 ELSE 0 END) AS total_absolute_url,
    SUM(CASE WHEN image_url LIKE 'data:image/%' THEN 1 ELSE 0 END) AS total_data_url_need_java_cleanup,
    SUM(CASE
            WHEN image_url IS NOT NULL
             AND image_url NOT LIKE '/uploads/%'
             AND image_url NOT LIKE 'http://%'
             AND image_url NOT LIKE 'https://%'
             AND image_url NOT LIKE 'data:image/%'
            THEN 1
            ELSE 0
        END) AS total_unresolved
FROM tickets;
GO

-- Khi kiểm tra xong:
-- COMMIT TRANSACTION;
-- GO

-- Nếu chỉ muốn xem thử mà chưa áp dụng:
ROLLBACK TRANSACTION;
GO
