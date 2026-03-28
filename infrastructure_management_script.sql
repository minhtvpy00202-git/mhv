
CREATE database FpolyDnInfrastructure;
GO

USE FpolyDnInfrastructure;
GO

CREATE TABLE locations (
    id INT IDENTITY(1,1) PRIMARY KEY,
    room_name NVARCHAR(100) NOT NULL
);
GO

CREATE TABLE users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    full_name NVARCHAR(100) NULL,
    birthday DATE NULL,
    phone VARCHAR(20) NULL,
    status NVARCHAR(20) NOT NULL CONSTRAINT DF_users_status DEFAULT N'Hoạt động',
    CONSTRAINT CK_users_role CHECK (role IN ('Admin', 'NhanVien')),
    CONSTRAINT CK_users_status CHECK (status IN (N'Hoạt động', N'Khóa'))
);
GO

CREATE TABLE assets (
    qa_code VARCHAR(20) PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    category NVARCHAR(50) NOT NULL,
    location_id INT NOT NULL,
    status NVARCHAR(20) NOT NULL,
    CONSTRAINT CK_assets_status CHECK (status IN (N'Đang sử dụng', N'Hỏng', N'Bảo trì', N'Sẵn sàng')),
    CONSTRAINT FK_assets_location FOREIGN KEY (location_id) REFERENCES locations(id)
);
GO

CREATE TABLE usage_histories (
    id INT IDENTITY(1,1) PRIMARY KEY,
    asset_qa_code VARCHAR(20) NOT NULL,
    user_id INT NOT NULL,
    start_time DATETIME2 NOT NULL,
    end_time DATETIME2 NULL,
    from_location_id INT NOT NULL,
    to_location_id INT NOT NULL,
    CONSTRAINT FK_usage_histories_asset FOREIGN KEY (asset_qa_code) REFERENCES assets(qa_code),
    CONSTRAINT FK_usage_histories_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT FK_usage_histories_from_location FOREIGN KEY (from_location_id) REFERENCES locations(id),
    CONSTRAINT FK_usage_histories_to_location FOREIGN KEY (to_location_id) REFERENCES locations(id),
    CONSTRAINT CK_usage_histories_time CHECK (end_time IS NULL OR end_time > start_time)
);
GO

CREATE TABLE maintenance_requests (
    id INT IDENTITY(1,1) PRIMARY KEY,
    asset_qa_code VARCHAR(20) NOT NULL,
    reported_by INT NOT NULL,
    assigned_to INT NULL,
    description NVARCHAR(500) NOT NULL,
    status NVARCHAR(20) NOT NULL CONSTRAINT DF_maintenance_requests_status DEFAULT N'Mới tạo',
    report_time DATETIME2 NOT NULL CONSTRAINT DF_maintenance_requests_report_time DEFAULT SYSDATETIME(),
    resolved_time DATETIME2 NULL,
    resolution_note NVARCHAR(500) NULL,
    CONSTRAINT FK_maintenance_requests_asset FOREIGN KEY (asset_qa_code) REFERENCES assets(qa_code),
    CONSTRAINT FK_maintenance_requests_reported_by FOREIGN KEY (reported_by) REFERENCES users(id),
    CONSTRAINT FK_maintenance_requests_assigned_to FOREIGN KEY (assigned_to) REFERENCES users(id),
    CONSTRAINT CK_maintenance_requests_status CHECK (status IN (N'Mới tạo', N'Đang xử lý', N'Hoàn tất')),
    CONSTRAINT CK_maintenance_requests_resolved_time CHECK (resolved_time IS NULL OR resolved_time >= report_time)
);
GO

CREATE INDEX IX_assets_name ON assets(name);
CREATE INDEX IX_assets_status ON assets(status);
CREATE INDEX IX_assets_location_id ON assets(location_id);
CREATE INDEX IX_usage_histories_asset_qa_code ON usage_histories(asset_qa_code);
CREATE INDEX IX_usage_histories_user_id ON usage_histories(user_id);
CREATE INDEX IX_usage_histories_start_time ON usage_histories(start_time);
CREATE UNIQUE INDEX UX_usage_histories_asset_open ON usage_histories(asset_qa_code) WHERE end_time IS NULL;
CREATE INDEX IX_maintenance_requests_status ON maintenance_requests(status);
CREATE INDEX IX_maintenance_requests_asset_qa_code ON maintenance_requests(asset_qa_code);
GO

CREATE TRIGGER TR_usage_histories_validate_insert
ON usage_histories
INSTEAD OF INSERT
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN assets a ON a.qa_code = i.asset_qa_code
        WHERE a.status IN (N'Đang sử dụng', N'Bảo trì')
    )
    BEGIN
        THROW 50001, N'Thiết bị đang bận hoặc đang bảo trì, không thể check-out.', 1;
    END;

    INSERT INTO usage_histories (asset_qa_code, user_id, start_time, end_time, from_location_id, to_location_id)
    SELECT i.asset_qa_code, i.user_id, i.start_time, i.end_time, i.from_location_id, i.to_location_id
    FROM inserted i;
END;
GO

INSERT INTO locations (room_name) VALUES
(N'Phòng Server'),
(N'Phòng Văn phòng'),
(N'Phòng Kho'),
(N'Phòng Hội trường'),
(N'Phòng Nghiên cứu');
GO

INSERT INTO users (username, password, role, full_name, birthday, phone, status) VALUES
('admin', 'hashed_password_1', 'Admin', N'Quản trị hệ thống', '1990-01-01', '0900000001', N'Hoạt động'),
('john_doe', 'hashed_password_2', 'NhanVien', N'John Doe', '1998-05-20', '0900000002', N'Hoạt động'),
('jane_smith', 'hashed_password_3', 'NhanVien', N'Jane Smith', '1999-08-12', '0900000003', N'Hoạt động'),
('bob_wilson', 'hashed_password_4', 'NhanVien', N'Bob Wilson', '1997-03-14', '0900000004', N'Hoạt động'),
('alice_brown', 'hashed_password_5', 'NhanVien', N'Alice Brown', '1996-11-30', '0900000005', N'Hoạt động');
GO


INSERT INTO assets (qa_code, name, category, location_id, status) VALUES
('QA001', N'Máy tính xách tay Dell', N'Máy tính', 1, N'Sẵn sàng'),
('QA002', N'Máy in HP LaserJet', N'Máy in', 2, N'Sẵn sàng'),
('QA003', N'Màn hình LG 24 inch', N'Màn hình', 3, N'Hỏng'),
('QA004', N'Router Cisco', N'Mạng', 1, N'Bảo trì'),
('QA005', N'Bàn phím Logitech', N'Phụ kiện', 4, N'Sẵn sàng');
GO

INSERT INTO usage_histories (asset_qa_code, user_id, start_time, end_time, from_location_id, to_location_id) VALUES
('QA001', 2, '2026-01-01 09:00:00', '2026-01-01 17:00:00', 1, 2),
('QA002', 3, '2026-01-02 10:00:00', '2026-01-02 12:00:00', 2, 3),
('QA005', 2, '2026-01-05 12:00:00', '2026-01-05 18:00:00', 4, 5);
GO

INSERT INTO maintenance_requests (asset_qa_code, reported_by, assigned_to, description, status) VALUES
('QA003', 2, 4, N'Màn hình không hiển thị hình ảnh', N'Đang xử lý'),
('QA004', 4, 2, N'Router mất kết nối mạng', N'Đang xử lý'),
('QA001', 3, NULL, N'Máy tính chạy chậm', N'Mới tạo'),
('QA002', 5, NULL, N'Máy in kẹt giấy', N'Mới tạo'),
('QA005', 2, 4, N'Bàn phím không phản hồi', N'Hoàn tất');
GO

IF COL_LENGTH('assets', 'home_location_id') IS NULL
BEGIN
    ALTER TABLE assets ADD home_location_id INT NULL;
END;
GO

IF COL_LENGTH('users', 'full_name') IS NULL
BEGIN
    ALTER TABLE users ADD full_name NVARCHAR(100) NULL;
END;
GO

IF COL_LENGTH('users', 'birthday') IS NULL
BEGIN
    ALTER TABLE users ADD birthday DATE NULL;
END;
GO

IF COL_LENGTH('users', 'phone') IS NULL
BEGIN
    ALTER TABLE users ADD phone VARCHAR(20) NULL;
END;
GO

IF COL_LENGTH('users', 'status') IS NULL
BEGIN
    ALTER TABLE users ADD status NVARCHAR(20) NULL;
END;
GO

IF COL_LENGTH('users', 'status') IS NOT NULL
BEGIN
    UPDATE users
    SET status = N'Hoạt động'
    WHERE status IS NULL;
END;
GO

IF COL_LENGTH('users', 'status') IS NOT NULL
AND EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('users')
      AND name = 'status'
      AND is_nullable = 1
)
BEGIN
    ALTER TABLE users ALTER COLUMN status NVARCHAR(20) NOT NULL;
END;
GO

IF OBJECT_ID('DF_users_status', 'D') IS NULL
BEGIN
    ALTER TABLE users ADD CONSTRAINT DF_users_status DEFAULT N'Hoạt động' FOR status;
END;
GO

IF OBJECT_ID('CK_users_status', 'C') IS NULL
BEGIN
    ALTER TABLE users ADD CONSTRAINT CK_users_status CHECK (status IN (N'Hoạt động', N'Khóa'));
END;
GO

IF COL_LENGTH('assets', 'home_location_id') IS NOT NULL
BEGIN
    UPDATE assets
    SET home_location_id = location_id
    WHERE home_location_id IS NULL;
END;
GO

IF COL_LENGTH('assets', 'home_location_id') IS NOT NULL
AND EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('assets')
      AND name = 'home_location_id'
      AND is_nullable = 1
)
BEGIN
    ALTER TABLE assets ALTER COLUMN home_location_id INT NOT NULL;
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_assets_home_location'
)
BEGIN
    ALTER TABLE assets
    ADD CONSTRAINT FK_assets_home_location
    FOREIGN KEY (home_location_id) REFERENCES locations(id);
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_assets_home_location_id'
      AND object_id = OBJECT_ID('assets')
)
BEGIN
    CREATE INDEX IX_assets_home_location_id ON assets(home_location_id);
END;
GO

;WITH room_numbers AS (
    SELECT 200 AS room_no
    UNION ALL
    SELECT room_no + 1
    FROM room_numbers
    WHERE room_no < 219
)
INSERT INTO locations (room_name)
SELECT CAST(rn.room_no AS NVARCHAR(100))
FROM room_numbers rn
WHERE NOT EXISTS (
    SELECT 1
    FROM locations l
    WHERE l.room_name = CAST(rn.room_no AS NVARCHAR(100))
)
OPTION (MAXRECURSION 20);
GO

-- Update

INSERT INTO assets (qa_code, name, category, location_id, home_location_id, status)
SELECT qa_code, name, category, location_id, location_id, status
FROM (
    SELECT
        CONCAT('R', l.room_name, '-TV') AS qa_code,
        CONCAT(N'TV phòng ', l.room_name) AS name,
        N'Màn hình TV' AS category,
        l.id AS location_id,
        N'Sẵn sàng' AS status
    FROM locations l
    WHERE l.room_name LIKE N'2%'
      AND LEN(l.room_name) = 3

    UNION ALL

    SELECT
        CONCAT('R', l.room_name, '-PC') AS qa_code,
        CONCAT(N'Máy tính để bàn phòng ', l.room_name) AS name,
        N'Máy tính để bàn' AS category,
        l.id AS location_id,
        N'Sẵn sàng' AS status
    FROM locations l
    WHERE l.room_name LIKE N'2%'
      AND LEN(l.room_name) = 3

    UNION ALL

    SELECT
        CONCAT('R', l.room_name, '-PJ') AS qa_code,
        CONCAT(N'Máy chiếu phòng ', l.room_name) AS name,
        N'Máy chiếu' AS category,
        l.id AS location_id,
        N'Sẵn sàng' AS status
    FROM locations l
    WHERE l.room_name LIKE N'2%'
      AND LEN(l.room_name) = 3
) seed_assets
WHERE NOT EXISTS (
    SELECT 1
    FROM assets a
    WHERE a.qa_code = seed_assets.qa_code
);
GO

;WITH chair_numbers AS (
    SELECT 1 AS n
    UNION ALL
    SELECT n + 1
    FROM chair_numbers
    WHERE n < 20
)
INSERT INTO assets (qa_code, name, category, location_id, home_location_id, status)
SELECT
    CONCAT('R', l.room_name, '-BG', RIGHT(CONCAT('0', c.n), 2)) AS qa_code,
    CONCAT(N'Bộ bàn ghế ', c.n, N' phòng ', l.room_name) AS name,
    N'Bàn ghế' AS category,
    l.id AS location_id,
    l.id AS home_location_id,
    N'Sẵn sàng' AS status
FROM locations l
CROSS JOIN chair_numbers c
WHERE l.room_name LIKE N'2%'
  AND LEN(l.room_name) = 3
  AND NOT EXISTS (
      SELECT 1
      FROM assets a
      WHERE a.qa_code = CONCAT('R', l.room_name, '-BG', RIGHT(CONCAT('0', c.n), 2))
  )
OPTION (MAXRECURSION 20);
GO

IF OBJECT_ID('categories', 'U') IS NULL
BEGIN
    CREATE TABLE categories (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(50) NOT NULL
    );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'UX_categories_name'
      AND object_id = OBJECT_ID('categories')
)
BEGIN
    CREATE UNIQUE INDEX UX_categories_name ON categories(name);
END;
GO

INSERT INTO categories (name)
SELECT DISTINCT a.category
FROM assets a
WHERE a.category IS NOT NULL
  AND LTRIM(RTRIM(a.category)) <> N''
  AND NOT EXISTS (
      SELECT 1
      FROM categories c
      WHERE c.name = a.category
  );
GO

INSERT INTO categories (name)
SELECT src.name
FROM (
    SELECT N'Máy tính' AS name
    UNION ALL SELECT N'Máy tính để bàn'
    UNION ALL SELECT N'Máy in'
    UNION ALL SELECT N'Màn hình'
    UNION ALL SELECT N'Màn hình TV'
    UNION ALL SELECT N'Máy chiếu'
    UNION ALL SELECT N'Bàn ghế'
    UNION ALL SELECT N'Mạng'
    UNION ALL SELECT N'Phụ kiện'
) src
WHERE NOT EXISTS (
    SELECT 1
    FROM categories c
    WHERE c.name = src.name
);
GO

IF COL_LENGTH('assets', 'category_id') IS NULL
BEGIN
    ALTER TABLE assets ADD category_id INT NULL;
END;
GO

IF COL_LENGTH('assets', 'category_id') IS NOT NULL
BEGIN
    UPDATE a
    SET a.category_id = c.id
    FROM assets a
    JOIN categories c ON c.name = a.category
    WHERE a.category_id IS NULL;
END;
GO

IF COL_LENGTH('assets', 'category_id') IS NOT NULL
AND EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('assets')
      AND name = 'category_id'
      AND is_nullable = 1
)
BEGIN
    ALTER TABLE assets ALTER COLUMN category_id INT NOT NULL;
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_assets_category'
)
BEGIN
    ALTER TABLE assets
    ADD CONSTRAINT FK_assets_category
    FOREIGN KEY (category_id) REFERENCES categories(id);
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_assets_category_id'
      AND object_id = OBJECT_ID('assets')
)
BEGIN
    CREATE INDEX IX_assets_category_id ON assets(category_id);
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_assets_search_name_status_category'
      AND object_id = OBJECT_ID('assets')
)
BEGIN
    CREATE INDEX IX_assets_search_name_status_category
    ON assets(name, status, category_id);
END;
GO

IF OBJECT_ID('notifications', 'U') IS NULL
BEGIN
    CREATE TABLE notifications (
        id INT IDENTITY(1,1) PRIMARY KEY,
        event_type VARCHAR(50) NOT NULL,
        title NVARCHAR(255) NOT NULL,
        message NVARCHAR(500) NOT NULL,
        link_path VARCHAR(255) NOT NULL,
        actor_username VARCHAR(50) NOT NULL,
        asset_qa_code VARCHAR(20) NULL,
        asset_name NVARCHAR(255) NULL,
        detail_json NVARCHAR(4000) NOT NULL,
        occurred_at DATETIME2 NOT NULL CONSTRAINT DF_notifications_occurred_at DEFAULT SYSDATETIME(),
        is_read BIT NOT NULL CONSTRAINT DF_notifications_is_read DEFAULT 0
    );
END;
GO

IF COL_LENGTH('notifications', 'asset_name') IS NULL
BEGIN
    ALTER TABLE notifications ADD asset_name NVARCHAR(255) NULL;
END;
GO

IF EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_notifications_asset'
)
BEGIN
    ALTER TABLE notifications DROP CONSTRAINT FK_notifications_asset;
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_notifications_occurred_at'
      AND object_id = OBJECT_ID('notifications')
)
BEGIN
    CREATE INDEX IX_notifications_occurred_at ON notifications(occurred_at DESC);
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_notifications_is_read'
      AND object_id = OBJECT_ID('notifications')
)
BEGIN
    CREATE INDEX IX_notifications_is_read ON notifications(is_read);
END;
GO

IF EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = 'CK_assets_status'
      AND parent_object_id = OBJECT_ID('assets')
)
BEGIN
    ALTER TABLE assets DROP CONSTRAINT CK_assets_status;
END;
GO

ALTER TABLE assets
ADD CONSTRAINT CK_assets_status CHECK (status IN (N'Sẵn sàng', N'Đang sử dụng', N'Hỏng', N'Bảo trì', N'Thất lạc'));
GO

IF OBJECT_ID('inventory_audits', 'U') IS NULL
BEGIN
    CREATE TABLE inventory_audits (
        id INT IDENTITY(1,1) PRIMARY KEY,
        location_id INT NOT NULL,
        created_by INT NOT NULL,
        started_at DATETIME2 NOT NULL CONSTRAINT DF_inventory_audits_started_at DEFAULT SYSDATETIME(),
        completed_at DATETIME2 NULL,
        status VARCHAR(20) NOT NULL,
        expected_count INT NULL,
        scanned_count INT NULL,
        missing_count INT NULL,
        notes NVARCHAR(500) NULL,
        CONSTRAINT FK_inventory_audits_location FOREIGN KEY (location_id) REFERENCES locations(id),
        CONSTRAINT FK_inventory_audits_created_by FOREIGN KEY (created_by) REFERENCES users(id)
    );
END;
GO

IF OBJECT_ID('inventory_audit_items', 'U') IS NULL
BEGIN
    CREATE TABLE inventory_audit_items (
        id INT IDENTITY(1,1) PRIMARY KEY,
        audit_id INT NOT NULL,
        asset_qa_code VARCHAR(20) NOT NULL,
        asset_name NVARCHAR(255) NOT NULL,
        scanned_at DATETIME2 NOT NULL CONSTRAINT DF_inventory_audit_items_scanned_at DEFAULT SYSDATETIME(),
        scanned_by_username VARCHAR(50) NOT NULL,
        CONSTRAINT FK_inventory_audit_items_audit FOREIGN KEY (audit_id) REFERENCES inventory_audits(id),
        CONSTRAINT UQ_inventory_audit_items UNIQUE (audit_id, asset_qa_code)
    );
END;
GO

IF OBJECT_ID('inventory_audit_missing', 'U') IS NULL
BEGIN
    CREATE TABLE inventory_audit_missing (
        id INT IDENTITY(1,1) PRIMARY KEY,
        audit_id INT NOT NULL,
        asset_qa_code VARCHAR(20) NOT NULL,
        asset_name NVARCHAR(255) NOT NULL,
        location_name NVARCHAR(100) NOT NULL,
        resolution_status VARCHAR(20) NOT NULL CONSTRAINT DF_inventory_audit_missing_resolution_status DEFAULT 'PENDING',
        resolved_at DATETIME2 NULL,
        resolved_by_username VARCHAR(50) NULL,
        CONSTRAINT FK_inventory_audit_missing_audit FOREIGN KEY (audit_id) REFERENCES inventory_audits(id)
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_inventory_audits_location_status'
      AND object_id = OBJECT_ID('inventory_audits')
)
BEGIN
    CREATE INDEX IX_inventory_audits_location_status ON inventory_audits(location_id, status);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_inventory_audit_missing_audit'
      AND object_id = OBJECT_ID('inventory_audit_missing')
)
BEGIN
    CREATE INDEX IX_inventory_audit_missing_audit ON inventory_audit_missing(audit_id);
END;
GO

IF COL_LENGTH('assets', 'quantity') IS NOT NULL
BEGIN
    DECLARE @df_name NVARCHAR(200);
    SELECT @df_name = dc.name
    FROM sys.default_constraints dc
    JOIN sys.columns c ON c.default_object_id = dc.object_id
    JOIN sys.tables t ON t.object_id = c.object_id
    WHERE t.name = 'assets' AND c.name = 'quantity';

    IF @df_name IS NOT NULL
        EXEC('ALTER TABLE assets DROP CONSTRAINT ' + @df_name);

    ALTER TABLE assets DROP COLUMN quantity;
END;
GO


--- update
IF COL_LENGTH('usage_histories', 'quantity') IS NOT NULL
BEGIN
    DECLARE @df_usage_quantity NVARCHAR(200);
    SELECT @df_usage_quantity = dc.name
    FROM sys.default_constraints dc
    JOIN sys.columns c ON c.default_object_id = dc.object_id
    JOIN sys.tables t ON t.object_id = c.object_id
    WHERE t.name = 'usage_histories' AND c.name = 'quantity';

    IF @df_usage_quantity IS NOT NULL
        EXEC('ALTER TABLE usage_histories DROP CONSTRAINT ' + @df_usage_quantity);

    ALTER TABLE usage_histories DROP COLUMN quantity;
END;
GO

IF EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_usage_histories_asset_open'
      AND object_id = OBJECT_ID('usage_histories')
)
BEGIN
    DROP INDEX IX_usage_histories_asset_open ON usage_histories;
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UX_usage_histories_asset_open'
      AND object_id = OBJECT_ID('usage_histories')
)
BEGIN
    CREATE UNIQUE INDEX UX_usage_histories_asset_open ON usage_histories(asset_qa_code) WHERE end_time IS NULL;
END;
GO

IF OBJECT_ID('asset_location_stocks', 'U') IS NOT NULL
BEGIN
    DROP TABLE asset_location_stocks;
END;
GO

---update
IF COL_LENGTH('users', 'full_name') IS NULL
BEGIN
    ALTER TABLE users ADD full_name NVARCHAR(100) NULL;
END;
GO

IF COL_LENGTH('users', 'birthday') IS NULL
BEGIN
    ALTER TABLE users ADD birthday DATE NULL;
END;
GO

IF COL_LENGTH('users', 'phone') IS NULL
BEGIN
    ALTER TABLE users ADD phone VARCHAR(20) NULL;
END;
GO

IF COL_LENGTH('users', 'status') IS NULL
BEGIN
    ALTER TABLE users ADD status NVARCHAR(20) NULL;
END;
GO

UPDATE users
SET full_name = username
WHERE full_name IS NULL OR LTRIM(RTRIM(full_name)) = '';
GO

UPDATE users
SET status = N'Hoạt động'
WHERE status IS NULL OR LTRIM(RTRIM(status)) = '';
GO

IF COL_LENGTH('users', 'status') IS NOT NULL
AND EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('users')
      AND name = 'status'
      AND is_nullable = 1
)
BEGIN
    ALTER TABLE users ALTER COLUMN status NVARCHAR(20) NOT NULL;
END;
GO

IF OBJECT_ID('DF_users_status', 'D') IS NULL
BEGIN
    ALTER TABLE users ADD CONSTRAINT DF_users_status DEFAULT N'Hoạt động' FOR status;
END;
GO

IF OBJECT_ID('CK_users_status', 'C') IS NULL
BEGIN
    ALTER TABLE users ADD CONSTRAINT CK_users_status CHECK (status IN (N'Hoạt động', N'Khóa'));
END;
GO
