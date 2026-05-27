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
@Order(Ordered.HIGHEST_PRECEDENCE + 15)
@RequiredArgsConstructor
public class ConsumableIssueMigrationRunner implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        backfillIssueUnitPrice();
        backfillConsumableLocationStocks();
    }

    private void backfillIssueUnitPrice() {
        if (!columnExists("consumable_issues", "unit_price")) {
            return;
        }
        int updatedRows = jdbcTemplate.update("""
                UPDATE public.consumable_issues ci
                SET unit_price = a.purchase_price
                FROM public.assets a
                WHERE ci.asset_qa_code = a.qa_code
                  AND ci.unit_price IS NULL
                """);
        if (updatedRows > 0) {
            log.warn("Backfilled unit_price for {} consumable issue rows", updatedRows);
        }
    }

    private void backfillConsumableLocationStocks() {
        if (!tableExists("consumable_location_stocks")) {
            return;
        }
        Integer rowCount = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM public.consumable_location_stocks",
                Integer.class
        );
        if (rowCount != null && rowCount > 0) {
            return;
        }
        int insertedRows = jdbcTemplate.update("""
                INSERT INTO public.consumable_location_stocks (
                    asset_qa_code,
                    location_id,
                    quantity_issued,
                    quantity_remaining,
                    unit_price,
                    last_issued_at,
                    last_updated_by_user_id,
                    last_updated_at,
                    last_note
                )
                SELECT
                    ci.asset_qa_code,
                    ci.issued_to_location_id,
                    SUM(ci.quantity) AS quantity_issued,
                    SUM(ci.quantity) AS quantity_remaining,
                    MAX(ci.unit_price) AS unit_price,
                    MAX(ci.issued_at) AS last_issued_at,
                    (
                        ARRAY_AGG(ci.issued_by_user_id ORDER BY ci.issued_at DESC, ci.id DESC)
                    )[1] AS last_updated_by_user_id,
                    MAX(ci.issued_at) AS last_updated_at,
                    (
                        ARRAY_AGG(ci.note ORDER BY ci.issued_at DESC, ci.id DESC)
                    )[1] AS last_note
                FROM public.consumable_issues ci
                GROUP BY ci.asset_qa_code, ci.issued_to_location_id
                """);
        if (insertedRows > 0) {
            log.warn("Backfilled {} consumable location stock rows from legacy issue history", insertedRows);
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

    private boolean tableExists(String tableName) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT count(*)
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name = ?
                """, Integer.class, tableName);
        return count != null && count > 0;
    }
}
