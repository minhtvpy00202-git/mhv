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
@Order(Ordered.HIGHEST_PRECEDENCE + 9)
@RequiredArgsConstructor
public class ConsumableRequestQuantityUnitMigrationRunner implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        ensureConsumableRequestQuantityColumns();
        backfillConsumableRequestQuantityColumns();
        ensureServiceInquiryQuantityColumns();
        backfillServiceInquiryQuantityColumns();
    }

    private void ensureConsumableRequestQuantityColumns() {
        if (!columnExists("consumable_requests", "quantity_requested_input")) {
            jdbcTemplate.execute("ALTER TABLE public.consumable_requests ADD COLUMN quantity_requested_input integer");
            log.warn("Added consumable_requests.quantity_requested_input column");
        }
        if (!columnExists("consumable_requests", "quantity_requested_unit")) {
            jdbcTemplate.execute("ALTER TABLE public.consumable_requests ADD COLUMN quantity_requested_unit varchar(20)");
            log.warn("Added consumable_requests.quantity_requested_unit column");
        }
    }

    private void backfillConsumableRequestQuantityColumns() {
        if (!columnExists("consumable_requests", "quantity_requested_input")
                || !columnExists("consumable_requests", "quantity_requested_unit")) {
            return;
        }
        int inputRows = jdbcTemplate.update("""
                UPDATE public.consumable_requests
                SET quantity_requested_input = quantity_requested
                WHERE quantity_requested_input IS NULL
                """);
        if (inputRows > 0) {
            log.warn("Backfilled quantity_requested_input for {} consumable requests", inputRows);
        }
        int unitRows = jdbcTemplate.update("""
                UPDATE public.consumable_requests
                SET quantity_requested_unit = 'RETAIL'
                WHERE quantity_requested_unit IS NULL OR btrim(quantity_requested_unit) = ''
                """);
        if (unitRows > 0) {
            log.warn("Backfilled quantity_requested_unit for {} consumable requests", unitRows);
        }
    }

    private void ensureServiceInquiryQuantityColumns() {
        if (!columnExists("service_inquiries", "quantity_requested_input")) {
            jdbcTemplate.execute("ALTER TABLE public.service_inquiries ADD COLUMN quantity_requested_input integer");
            log.warn("Added service_inquiries.quantity_requested_input column");
        }
        if (!columnExists("service_inquiries", "quantity_requested_unit")) {
            jdbcTemplate.execute("ALTER TABLE public.service_inquiries ADD COLUMN quantity_requested_unit varchar(20)");
            log.warn("Added service_inquiries.quantity_requested_unit column");
        }
    }

    private void backfillServiceInquiryQuantityColumns() {
        if (!columnExists("service_inquiries", "quantity_requested_input")
                || !columnExists("service_inquiries", "quantity_requested_unit")) {
            return;
        }
        int inputRows = jdbcTemplate.update("""
                UPDATE public.service_inquiries
                SET quantity_requested_input = quantity_requested
                WHERE quantity_requested_input IS NULL
                """);
        if (inputRows > 0) {
            log.warn("Backfilled quantity_requested_input for {} service inquiries", inputRows);
        }
        int unitRows = jdbcTemplate.update("""
                UPDATE public.service_inquiries
                SET quantity_requested_unit = 'RETAIL'
                WHERE quantity_requested_unit IS NULL OR btrim(quantity_requested_unit) = ''
                """);
        if (unitRows > 0) {
            log.warn("Backfilled quantity_requested_unit for {} service inquiries", unitRows);
        }
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
