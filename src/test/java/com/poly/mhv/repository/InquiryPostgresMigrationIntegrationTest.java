package com.poly.mhv.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
class InquiryPostgresMigrationIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @Test
    void migrationIsIdempotentAndPersistsInquiryWorkflow() throws Exception {
        String migration = Files.readString(Path.of(
                "database", "migrations", "V20260823__employee_inquiry_workflow.sql"));

        try (Connection connection = DriverManager.getConnection(
                POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
             Statement statement = connection.createStatement()) {
            statement.execute("""
                    CREATE TABLE users (id INTEGER PRIMARY KEY, username VARCHAR(100));
                    CREATE TABLE assets (qa_code VARCHAR(255) PRIMARY KEY, name VARCHAR(255));
                    CREATE TABLE locations (id INTEGER PRIMARY KEY, room_name VARCHAR(100));
                    INSERT INTO users(id, username) VALUES (1, 'employee'), (2, 'manager');
                    INSERT INTO assets(qa_code, name) VALUES ('VT001', 'Giấy A4');
                    INSERT INTO locations(id, room_name) VALUES (1, 'Kho vật tư'), (2, 'Phòng 202');
                    """);

            statement.execute(migration);
            statement.execute("""
                    INSERT INTO service_inquiries (
                        inquiry_type, requester_id, target_role, assignee_id, asset_qa_code,
                        quantity_requested, destination_location_id, needed_from, purpose, status,
                        created_at, updated_at, sla_response_due_at
                    ) VALUES (
                        'CONSUMABLE_REQUEST', 1, 'ConsumableManager', 2, 'VT001',
                        25, 2, CURRENT_DATE, 'Phục vụ công việc', 'WAITING_APPROVAL',
                        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '45 minutes'
                    );
                    INSERT INTO consumable_inquiry_fulfillments (
                        inquiry_id, original_consumable_request_id, active_consumable_request_id,
                        source_warehouse_location_id, requested_quantity, fulfilled_quantity,
                        status, requires_admin_approval, admin_approved, closed_partial,
                        created_at, updated_at
                    ) VALUES (
                        1, 10, 10, 1, 25, 0, 'PENDING', TRUE, FALSE, FALSE,
                        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                    );
                    UPDATE inquiry_workflow_settings SET large_quantity_threshold = 77 WHERE id = 1;
                    """);

            statement.execute(migration);

            try (ResultSet result = statement.executeQuery("""
                    SELECT i.status, f.requested_quantity, f.requires_admin_approval,
                           s.large_quantity_threshold
                    FROM service_inquiries i
                    JOIN consumable_inquiry_fulfillments f ON f.inquiry_id = i.id
                    CROSS JOIN inquiry_workflow_settings s
                    WHERE i.id = 1 AND s.id = 1
                    """)) {
                assertThat(result.next()).isTrue();
                assertThat(result.getString("status")).isEqualTo("WAITING_APPROVAL");
                assertThat(result.getInt("requested_quantity")).isEqualTo(25);
                assertThat(result.getBoolean("requires_admin_approval")).isTrue();
                assertThat(result.getInt("large_quantity_threshold")).isEqualTo(77);
                assertThat(result.next()).isFalse();
            }
        }
    }
}
