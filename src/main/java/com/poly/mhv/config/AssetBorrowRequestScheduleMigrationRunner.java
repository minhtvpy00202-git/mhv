package com.poly.mhv.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 14)
@RequiredArgsConstructor
public class AssetBorrowRequestScheduleMigrationRunner implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        if (!tableExists("asset_borrow_requests")) {
            return;
        }

        addColumnIfMissing("asset_borrow_requests", "start_at", "TIMESTAMP WITHOUT TIME ZONE");
        addColumnIfMissing("asset_borrow_requests", "end_at", "TIMESTAMP WITHOUT TIME ZONE");
        addColumnIfMissing("asset_borrow_requests", "last_overdue_reminder_at", "TIMESTAMP WITHOUT TIME ZONE");

        if (columnExists("asset_borrow_requests", "needed_from")) {
            jdbcTemplate.update("""
                    UPDATE public.asset_borrow_requests
                    SET start_at = COALESCE(start_at, needed_from::timestamp)
                    WHERE start_at IS NULL
                      AND needed_from IS NOT NULL
                    """);
            jdbcTemplate.update("""
                    UPDATE public.asset_borrow_requests
                    SET needed_from = COALESCE(needed_from, start_at::date)
                    WHERE needed_from IS NULL
                      AND start_at IS NOT NULL
                    """);
        }

        if (columnExists("asset_borrow_requests", "expected_return_date")) {
            jdbcTemplate.update("""
                    UPDATE public.asset_borrow_requests
                    SET end_at = COALESCE(end_at, (expected_return_date::timestamp + interval '1 day') - interval '1 second')
                    WHERE end_at IS NULL
                      AND expected_return_date IS NOT NULL
                    """);
            jdbcTemplate.update("""
                    UPDATE public.asset_borrow_requests
                    SET expected_return_date = COALESCE(expected_return_date, end_at::date)
                    WHERE expected_return_date IS NULL
                      AND end_at IS NOT NULL
                    """);
        }

        jdbcTemplate.update("""
                UPDATE public.asset_borrow_requests
                SET reserved_at = COALESCE(reserved_at, approved_at, created_at)
                WHERE status = 'RESERVED'
                """);

        if (columnExists("asset_borrow_requests", "start_at")) {
            jdbcTemplate.update("""
                    UPDATE public.asset_borrow_requests
                    SET checked_out_at = COALESCE(checked_out_at, start_at)
                    WHERE status IN ('CHECKED_OUT', 'RETURN_PENDING', 'RETURNED')
                      AND checked_out_at IS NULL
                    """);
        }

        createIndexIfMissing("idx_borrow_request_schedule", """
                CREATE INDEX idx_borrow_request_schedule
                ON public.asset_borrow_requests(asset_qa_code, start_at, end_at, status)
                """);

        enforceNotNullWhenPopulated("asset_borrow_requests", "start_at");
        enforceNotNullWhenPopulated("asset_borrow_requests", "end_at");
    }

    private void addColumnIfMissing(String tableName, String columnName, String definition) {
        if (columnExists(tableName, columnName)) {
            return;
        }
        jdbcTemplate.execute("ALTER TABLE public." + tableName + " ADD COLUMN " + columnName + " " + definition);
        log.warn("Added column {}.{} for borrow scheduling", tableName, columnName);
    }

    private void createIndexIfMissing(String indexName, String createSql) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT count(*)
                FROM pg_indexes
                WHERE schemaname = 'public'
                  AND indexname = ?
                """, Integer.class, indexName);
        if (count != null && count > 0) {
            return;
        }
        jdbcTemplate.execute(createSql);
    }

    private void enforceNotNullWhenPopulated(String tableName, String columnName) {
        Integer nullCount = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM public." + tableName + " WHERE " + columnName + " IS NULL",
                Integer.class
        );
        if (nullCount == null || nullCount > 0) {
            return;
        }
        jdbcTemplate.execute("ALTER TABLE public." + tableName + " ALTER COLUMN " + columnName + " SET NOT NULL");
    }

    private boolean tableExists(String tableName) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT count(*)
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name = ?
                """, Integer.class, tableName);
        return count != null && count > 0;
    }

    private boolean columnExists(String tableName, String columnName) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT count(*)
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = ?
                  AND column_name = ?
                """, Integer.class, tableName, columnName);
        return count != null && count > 0;
    }
}
