-- ==============================================================================
-- KHỞI TẠO DATABASE
-- ==============================================================================
USE master;
GO

IF DB_ID('FpolyDnInfrastructure') IS NOT NULL
BEGIN
    ALTER DATABASE FpolyDnInfrastructure SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE FpolyDnInfrastructure;
END;
GO

CREATE DATABASE FpolyDnInfrastructure;
GO

USE FpolyDnInfrastructure;
GO

-- ==============================================================================
-- PHẦN 1: TẠO BẢNG (TABLES) THEO THỨ TỰ PHỤ THUỘC (TỪ ĐỘC LẬP TỚI PHỤ THUỘC)
-- ==============================================================================

-- 1. Bảng tech_support_types (Chứa nhóm quyền và thiết bị)
CREATE TABLE tech_support_types (
    id INT PRIMARY KEY,
    name NVARCHAR(100) NOT NULL UNIQUE
);
GO

-- 2. Bảng locations
CREATE TABLE locations (
    id INT IDENTITY(1,1) PRIMARY KEY,
    room_name NVARCHAR(100) NOT NULL
);
GO

-- 3. Bảng users
CREATE TABLE users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    full_name NVARCHAR(100) NOT NULL,
    birthday DATE NULL,
    phone VARCHAR(20) NULL,
    status NVARCHAR(20) NOT NULL CONSTRAINT DF_users_status DEFAULT N'Hoạt động',
    tech_type_id INT NOT NULL,
    CONSTRAINT CK_users_role CHECK (role IN ('Admin', 'NhanVien', 'TechSupport')),
    CONSTRAINT CK_users_status CHECK (status IN (N'Hoạt động', N'Khóa')),
    CONSTRAINT FK_users_tech_type FOREIGN KEY (tech_type_id) REFERENCES tech_support_types(id)
);
GO

-- 4. Bảng categories (Chuẩn hóa 4 loại chính)
CREATE TABLE categories (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(150) NOT NULL,
    tech_type_id INT NOT NULL,
    CONSTRAINT FK_categories_tech_type FOREIGN KEY (tech_type_id) REFERENCES tech_support_types(id)
);
GO

-- 5. Bảng assets
CREATE TABLE assets (
    qa_code VARCHAR(20) PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    category_id INT NOT NULL,
    location_id INT NOT NULL,
    home_location_id INT NOT NULL,
    status NVARCHAR(20) NOT NULL,
    CONSTRAINT CK_assets_status CHECK (status IN (N'Sẵn sàng', N'Đang sử dụng', N'Hỏng', N'Bảo trì', N'Thất lạc')),
    CONSTRAINT FK_assets_category FOREIGN KEY (category_id) REFERENCES categories(id),
    CONSTRAINT FK_assets_location FOREIGN KEY (location_id) REFERENCES locations(id),
    CONSTRAINT FK_assets_home_location FOREIGN KEY (home_location_id) REFERENCES locations(id)
);
GO

-- 6. Bảng usage_histories
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

-- 7. Bảng tickets (Thay thế maintenance_requests)
CREATE TABLE tickets (
    id INT IDENTITY(1,1) PRIMARY KEY,
    asset_qa_code VARCHAR(20) NOT NULL,
    reporter_id INT NOT NULL,
    assignee_id INT NULL,
    description NVARCHAR(500) NOT NULL,
    image_url NVARCHAR(MAX) NULL,
    priority VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL CONSTRAINT DF_tickets_status DEFAULT 'PENDING',
    created_at DATETIME2 NOT NULL CONSTRAINT DF_tickets_created_at DEFAULT SYSDATETIME(),
    due_date DATETIME2 NULL,
    resolved_at DATETIME2 NULL,
    CONSTRAINT FK_tickets_asset FOREIGN KEY (asset_qa_code) REFERENCES assets(qa_code),
    CONSTRAINT FK_tickets_reporter FOREIGN KEY (reporter_id) REFERENCES users(id),
    CONSTRAINT FK_tickets_assignee FOREIGN KEY (assignee_id) REFERENCES users(id),
    CONSTRAINT CK_tickets_priority CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),
    CONSTRAINT CK_tickets_status CHECK (status IN ('PENDING', 'IN_PROGRESS', 'RESOLVED'))
);
GO

-- 8. Bảng chat_messages
CREATE TABLE chat_messages (
    id INT IDENTITY(1,1) PRIMARY KEY,
    ticket_id INT NOT NULL,
    sender_id INT NOT NULL,
    content NVARCHAR(MAX) NULL,
    media_url NVARCHAR(1000) NULL,
    media_type VARCHAR(20) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_chat_messages_created_at DEFAULT SYSDATETIME(),
    CONSTRAINT FK_chat_messages_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id),
    CONSTRAINT FK_chat_messages_sender FOREIGN KEY (sender_id) REFERENCES users(id)
);
GO

-- 9. Bảng notifications
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
GO

-- 10. Bảng ticket_events
CREATE TABLE ticket_events (
    id INT IDENTITY(1,1) PRIMARY KEY,
    ticket_id INT NOT NULL,
    event_type VARCHAR(40) NOT NULL,
    actor_id INT NULL,
    actor_name NVARCHAR(120) NULL,
    message NVARCHAR(500) NOT NULL,
    detail_json NVARCHAR(4000) NULL,
    occurred_at DATETIME2 NOT NULL CONSTRAINT DF_ticket_events_occurred_at DEFAULT SYSDATETIME(),
    CONSTRAINT FK_ticket_events_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id),
    CONSTRAINT FK_ticket_events_actor FOREIGN KEY (actor_id) REFERENCES users(id)
);
GO

-- 11. Bảng inventory_audits
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
GO

-- 12. Bảng inventory_audit_items
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
GO

-- 13. Bảng inventory_audit_missing
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
GO

-- ==============================================================================
-- PHẦN 2: TẠO INDEXES & TRIGGERS
-- ==============================================================================

CREATE INDEX IX_assets_name ON assets(name);
CREATE INDEX IX_assets_status ON assets(status);
CREATE INDEX IX_assets_location_id ON assets(location_id);
CREATE INDEX IX_assets_home_location_id ON assets(home_location_id);
CREATE INDEX IX_assets_category_id ON assets(category_id);
CREATE INDEX IX_assets_search_name_status_category ON assets(name, status, category_id);

CREATE INDEX IX_usage_histories_asset_qa_code ON usage_histories(asset_qa_code);
CREATE INDEX IX_usage_histories_user_id ON usage_histories(user_id);
CREATE INDEX IX_usage_histories_start_time ON usage_histories(start_time);
CREATE UNIQUE INDEX UX_usage_histories_asset_open ON usage_histories(asset_qa_code) WHERE end_time IS NULL;

CREATE INDEX IX_notifications_occurred_at ON notifications(occurred_at DESC);
CREATE INDEX IX_notifications_is_read ON notifications(is_read);

CREATE INDEX IX_tickets_assignee_status_created_at ON tickets(assignee_id, status, created_at DESC);
CREATE INDEX IX_tickets_reporter_created_at ON tickets(reporter_id, created_at DESC);
CREATE INDEX IX_tickets_asset_created_at ON tickets(asset_qa_code, created_at DESC);
CREATE INDEX IX_chat_messages_ticket_created_at ON chat_messages(ticket_id, created_at DESC);
CREATE INDEX IX_ticket_events_ticket_occurred_at ON ticket_events(ticket_id, occurred_at DESC);

CREATE INDEX IX_inventory_audits_location_status ON inventory_audits(location_id, status);
CREATE INDEX IX_inventory_audit_missing_audit ON inventory_audit_missing(audit_id);
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

-- ==============================================================================
-- PHẦN 3: SEED DỮ LIỆU
-- ==============================================================================

-- Seed Tech Support Types
INSERT INTO tech_support_types (id, name) VALUES
(0, N'Không phải TechSupport'),
(1, N'Kỹ thuật viên công nghệ'),
(2, N'Kỹ thuật viên thiết bị giảng dạy'),
(3, N'Kỹ thuật viên thiết bị thí nghiệm'),
(4, N'Kỹ thuật viên thiết bị thể dục thể thao');
GO

-- Seed Categories (Force Identity Insert)
SET IDENTITY_INSERT categories ON;
INSERT INTO categories (id, name, tech_type_id) VALUES
(1, N'Thiết bị công nghệ', 1),
(2, N'Thiết bị giảng dạy truyền thống', 2),
(3, N'Thiết bị phòng thí nghiệm/chức năng', 3),
(4, N'Thiết bị thể dục thể thao', 4);
SET IDENTITY_INSERT categories OFF;
GO

-- Seed Locations (Phòng chính & Sinh tự động từ 200 -> 219)
INSERT INTO locations (room_name) VALUES
(N'Phòng Server'),
(N'Phòng Văn phòng'),
(N'Phòng Kho'),
(N'Phòng Hội trường'),
(N'Phòng Nghiên cứu');

;WITH room_numbers AS (
    SELECT 200 AS room_no
    UNION ALL
    SELECT room_no + 1 FROM room_numbers WHERE room_no < 219
)
INSERT INTO locations (room_name)
SELECT CAST(room_no AS NVARCHAR(100)) FROM room_numbers
OPTION (MAXRECURSION 20);
GO

-- Seed Users
INSERT INTO users (username, password, role, full_name, birthday, phone, status, tech_type_id) VALUES
('admin', '$2a$10$KRN/6lT3hD.seFsGzrk2v./EDmp5.1lQqJMAH7Wltaj0yxKtXz3Oi', 'Admin', N'Quản trị hệ thống', '1990-01-01', '0900000001', N'Hoạt động', 0),
('nhanvien', '$2a$10$KRN/6lT3hD.seFsGzrk2v./EDmp5.1lQqJMAH7Wltaj0yxKtXz3Oi', 'NhanVien', N'Lê Trần', '1998-05-20', '0900000002', N'Hoạt động', 0),
('techsup', '$2a$10$KRN/6lT3hD.seFsGzrk2v./EDmp5.1lQqJMAH7Wltaj0yxKtXz3Oi', 'TechSupport', N'An', '1999-08-12', '0900000003', N'Hoạt động', 1),
('techsup1', '$2a$10$KRN/6lT3hD.seFsGzrk2v./EDmp5.1lQqJMAH7Wltaj0yxKtXz3Oi', 'TechSupport', N'Vương', '1997-03-14', '0900000004', N'Hoạt động', 2),
('techsup2', '$2a$10$KRN/6lT3hD.seFsGzrk2v./EDmp5.1lQqJMAH7Wltaj0yxKtXz3Oi', 'TechSupport', N'Nghĩa', '1996-11-30', '0900000005', N'Hoạt động', 3);
GO

-- Seed Assets
-- 1. Insert Static Assets (Máy tính, in, màn hình, router, phím map về Category 1)
INSERT INTO assets (qa_code, name, category_id, location_id, home_location_id, status) VALUES
('QA001', N'Máy tính xách tay Dell', 1, 1, 1, N'Sẵn sàng'),
('QA002', N'Máy in HP LaserJet', 1, 2, 2, N'Sẵn sàng'),
('QA003', N'Màn hình LG 24 inch', 1, 3, 3, N'Hỏng'),
('QA004', N'Router Cisco', 1, 1, 1, N'Bảo trì'),
('QA005', N'Bàn phím Logitech', 1, 4, 4, N'Sẵn sàng');

-- 2. Sinh tự động thiết bị Công nghệ (Category = 1) cho các phòng học (TV, Máy tính, Máy chiếu)
INSERT INTO assets (qa_code, name, category_id, location_id, home_location_id, status)
SELECT qa_code, name, 1, location_id, location_id, status
FROM (
    SELECT CONCAT('R', l.room_name, '-TV') AS qa_code, CONCAT(N'TV phòng ', l.room_name) AS name, l.id AS location_id, N'Sẵn sàng' AS status
    FROM locations l WHERE l.room_name LIKE N'2%' AND LEN(l.room_name) = 3
    UNION ALL
    SELECT CONCAT('R', l.room_name, '-PC') AS qa_code, CONCAT(N'Máy tính để bàn phòng ', l.room_name) AS name, l.id AS location_id, N'Sẵn sàng' AS status
    FROM locations l WHERE l.room_name LIKE N'2%' AND LEN(l.room_name) = 3
    UNION ALL
    SELECT CONCAT('R', l.room_name, '-PJ') AS qa_code, CONCAT(N'Máy chiếu phòng ', l.room_name) AS name, l.id AS location_id, N'Sẵn sàng' AS status
    FROM locations l WHERE l.room_name LIKE N'2%' AND LEN(l.room_name) = 3
) seed_tech_assets;

-- 3. Sinh tự động Bàn ghế (Category = 2) cho các phòng học (19 bộ mỗi phòng)
;WITH chair_numbers AS (
    SELECT 1 AS n UNION ALL SELECT n + 1 FROM chair_numbers WHERE n < 19
)
INSERT INTO assets (qa_code, name, category_id, location_id, home_location_id, status)
SELECT 
    CONCAT('R', l.room_name, '-BG', RIGHT(CONCAT('0', c.n), 2)), 
    CONCAT(N'Bộ bàn ghế ', c.n, N' phòng ', l.room_name), 
    2, l.id, l.id, N'Sẵn sàng'
FROM locations l CROSS JOIN chair_numbers c
WHERE l.room_name LIKE N'2%' AND LEN(l.room_name) = 3
OPTION (MAXRECURSION 20);
GO

-- Seed Usage Histories
INSERT INTO usage_histories (asset_qa_code, user_id, start_time, end_time, from_location_id, to_location_id) VALUES
('QA001', 2, '2026-01-01 09:00:00', '2026-01-01 17:00:00', 1, 2),
('QA002', 3, '2026-01-02 10:00:00', '2026-01-02 12:00:00', 2, 3),
('QA005', 2, '2026-01-05 12:00:00', '2026-01-05 18:00:00', 4, 5);
GO

-- Seed Tickets (Dữ liệu đã được convert trực tiếp từ bảng maintenance_requests cũ sang form mới)
INSERT INTO tickets (asset_qa_code, reporter_id, assignee_id, description, priority, status, created_at, due_date) VALUES
('QA003', 2, 4, N'Màn hình không hiển thị hình ảnh', 'MEDIUM', 'IN_PROGRESS', SYSDATETIME(), DATEADD(HOUR, 48, SYSDATETIME())),
('QA004', 4, 2, N'Router mất kết nối mạng', 'MEDIUM', 'IN_PROGRESS', SYSDATETIME(), DATEADD(HOUR, 48, SYSDATETIME())),
('QA001', 3, NULL, N'Máy tính chạy chậm', 'MEDIUM', 'PENDING', SYSDATETIME(), DATEADD(HOUR, 48, SYSDATETIME())),
('QA002', 5, NULL, N'Máy in kẹt giấy', 'MEDIUM', 'PENDING', SYSDATETIME(), DATEADD(HOUR, 48, SYSDATETIME())),
('QA005', 2, 4, N'Bàn phím không phản hồi', 'MEDIUM', 'RESOLVED', SYSDATETIME(), DATEADD(HOUR, 48, SYSDATETIME()));
GO
