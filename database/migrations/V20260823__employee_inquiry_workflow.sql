-- Employee inquiry/chat workflow for PostgreSQL.
-- Idempotent: creates only missing structures and never updates/deletes business data.

BEGIN;

CREATE TABLE IF NOT EXISTS service_inquiries (
    id BIGSERIAL PRIMARY KEY,
    inquiry_type VARCHAR(30) NOT NULL,
    requester_id INTEGER NOT NULL REFERENCES users(id),
    target_role VARCHAR(30) NOT NULL,
    assignee_id INTEGER REFERENCES users(id),
    asset_qa_code VARCHAR(255) NOT NULL REFERENCES assets(qa_code),
    quantity_requested INTEGER NOT NULL,
    destination_location_id INTEGER NOT NULL REFERENCES locations(id),
    needed_from DATE NOT NULL,
    expected_return_date DATE,
    purpose TEXT NOT NULL,
    status VARCHAR(30) NOT NULL,
    alternative_asset_qa_code VARCHAR(255) REFERENCES assets(qa_code),
    proposed_quantity INTEGER,
    alternative_accepted BOOLEAN,
    decision_note TEXT,
    linked_entity_type VARCHAR(40),
    linked_entity_id BIGINT,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    claimed_at TIMESTAMP WITHOUT TIME ZONE,
    completed_at TIMESTAMP WITHOUT TIME ZONE,
    received_at TIMESTAMP WITHOUT TIME ZONE,
    sla_response_due_at TIMESTAMP WITHOUT TIME ZONE,
    first_response_at TIMESTAMP WITHOUT TIME ZONE,
    sla_breached_at TIMESTAMP WITHOUT TIME ZONE,
    last_overdue_reminder_at TIMESTAMP WITHOUT TIME ZONE,
    overdue_reminder_count INTEGER NOT NULL DEFAULT 0,
    version BIGINT
);

ALTER TABLE service_inquiries ADD COLUMN IF NOT EXISTS received_at TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE service_inquiries ADD COLUMN IF NOT EXISTS sla_response_due_at TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE service_inquiries ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE service_inquiries ADD COLUMN IF NOT EXISTS sla_breached_at TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE service_inquiries ADD COLUMN IF NOT EXISTS last_overdue_reminder_at TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE service_inquiries ADD COLUMN IF NOT EXISTS overdue_reminder_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE service_inquiries ADD COLUMN IF NOT EXISTS version BIGINT;

CREATE INDEX IF NOT EXISTS idx_inquiry_requester ON service_inquiries(requester_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_inquiry_target_role ON service_inquiries(target_role, status, updated_at);
CREATE INDEX IF NOT EXISTS idx_inquiry_assignee ON service_inquiries(assignee_id, status);
CREATE INDEX IF NOT EXISTS idx_inquiry_response_sla ON service_inquiries(sla_response_due_at, first_response_at, status);

CREATE TABLE IF NOT EXISTS inquiry_messages (
    id BIGSERIAL PRIMARY KEY,
    inquiry_id BIGINT NOT NULL REFERENCES service_inquiries(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id),
    content TEXT,
    media_url VARCHAR(1000),
    media_type VARCHAR(20),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    read_at TIMESTAMP WITHOUT TIME ZONE,
    CONSTRAINT chk_inquiry_message_payload CHECK (content IS NOT NULL OR media_url IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_inquiry_message_thread ON inquiry_messages(inquiry_id, created_at);
CREATE INDEX IF NOT EXISTS idx_inquiry_message_unread ON inquiry_messages(inquiry_id, read_at);

CREATE TABLE IF NOT EXISTS asset_borrow_requests (
    id BIGSERIAL PRIMARY KEY,
    inquiry_id BIGINT UNIQUE REFERENCES service_inquiries(id),
    asset_qa_code VARCHAR(255) NOT NULL REFERENCES assets(qa_code),
    requester_id INTEGER NOT NULL REFERENCES users(id),
    approved_by_user_id INTEGER REFERENCES users(id),
    destination_location_id INTEGER NOT NULL REFERENCES locations(id),
    needed_from DATE NOT NULL,
    expected_return_date DATE NOT NULL,
    purpose TEXT NOT NULL,
    status VARCHAR(30) NOT NULL,
    decision_note TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    approved_at TIMESTAMP WITHOUT TIME ZONE,
    reserved_at TIMESTAMP WITHOUT TIME ZONE,
    reservation_expires_at TIMESTAMP WITHOUT TIME ZONE,
    checked_out_at TIMESTAMP WITHOUT TIME ZONE,
    returned_at TIMESTAMP WITHOUT TIME ZONE,
    version BIGINT
);

CREATE INDEX IF NOT EXISTS idx_borrow_request_requester ON asset_borrow_requests(requester_id, created_at);
CREATE INDEX IF NOT EXISTS idx_borrow_request_status ON asset_borrow_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_borrow_request_asset ON asset_borrow_requests(asset_qa_code, status);

CREATE TABLE IF NOT EXISTS inquiry_reply_templates (
    id BIGSERIAL PRIMARY KEY,
    owner_role VARCHAR(30) NOT NULL,
    created_by_user_id INTEGER NOT NULL REFERENCES users(id),
    title VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    active BOOLEAN NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inquiry_reply_template_role
    ON inquiry_reply_templates(owner_role, active, title);

CREATE TABLE IF NOT EXISTS inquiry_workflow_settings (
    id INTEGER PRIMARY KEY,
    asset_response_sla_minutes INTEGER NOT NULL,
    consumable_response_sla_minutes INTEGER NOT NULL,
    overdue_reminder_interval_hours INTEGER NOT NULL,
    large_quantity_threshold INTEGER NOT NULL,
    high_value_threshold NUMERIC(19, 2) NOT NULL,
    updated_by_user_id INTEGER REFERENCES users(id),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL
);

INSERT INTO inquiry_workflow_settings (
    id,
    asset_response_sla_minutes,
    consumable_response_sla_minutes,
    overdue_reminder_interval_hours,
    large_quantity_threshold,
    high_value_threshold,
    updated_at
) VALUES (1, 30, 45, 24, 20, 5000000.00, CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS consumable_inquiry_fulfillments (
    id BIGSERIAL PRIMARY KEY,
    inquiry_id BIGINT NOT NULL UNIQUE REFERENCES service_inquiries(id),
    original_consumable_request_id BIGINT NOT NULL,
    active_consumable_request_id BIGINT NOT NULL,
    source_warehouse_location_id INTEGER NOT NULL REFERENCES locations(id),
    requested_quantity INTEGER NOT NULL,
    fulfilled_quantity INTEGER NOT NULL DEFAULT 0,
    prepared_quantity INTEGER,
    status VARCHAR(30) NOT NULL,
    requires_admin_approval BOOLEAN NOT NULL,
    admin_approved BOOLEAN NOT NULL,
    admin_approved_by_user_id INTEGER REFERENCES users(id),
    prepared_by_user_id INTEGER REFERENCES users(id),
    admin_approved_at TIMESTAMP WITHOUT TIME ZONE,
    prepared_at TIMESTAMP WITHOUT TIME ZONE,
    ready_at TIMESTAMP WITHOUT TIME ZONE,
    fulfilled_at TIMESTAMP WITHOUT TIME ZONE,
    closed_partial BOOLEAN NOT NULL DEFAULT FALSE,
    decision_note TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    version BIGINT,
    CONSTRAINT chk_consumable_fulfillment_quantities CHECK (
        requested_quantity > 0
        AND fulfilled_quantity >= 0
        AND fulfilled_quantity <= requested_quantity
        AND (prepared_quantity IS NULL OR prepared_quantity > 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_consumable_fulfillment_status
    ON consumable_inquiry_fulfillments(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_consumable_fulfillment_active_request
    ON consumable_inquiry_fulfillments(active_consumable_request_id);

COMMIT;
