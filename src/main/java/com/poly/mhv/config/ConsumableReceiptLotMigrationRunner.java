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
@Order(Ordered.HIGHEST_PRECEDENCE + 16)
@RequiredArgsConstructor
public class ConsumableReceiptLotMigrationRunner implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        backfillConsumableReceiptLots();
    }

    private void backfillConsumableReceiptLots() {
        if (!tableExists("consumable_receipt_lots")) {
            return;
        }
        Integer rowCount = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM public.consumable_receipt_lots",
                Integer.class
        );
        if (rowCount != null && rowCount > 0) {
            return;
        }
        int insertedRows = jdbcTemplate.update("""
                INSERT INTO public.consumable_receipt_lots (
                    asset_qa_code,
                    lot_code,
                    quantity_received,
                    quantity_remaining,
                    unit_price,
                    received_date,
                    expiration_date,
                    supplier_id,
                    received_by_user_id,
                    received_at,
                    note
                )
                SELECT
                    a.qa_code,
                    CONCAT('LEGACY-', a.qa_code),
                    a.quantity_on_hand,
                    a.quantity_on_hand,
                    COALESCE(a.purchase_price, 1),
                    COALESCE(a.purchase_date, CURRENT_DATE),
                    CASE
                        WHEN COALESCE(a.expiry_tracking_enabled, FALSE) THEN a.expiration_date
                        ELSE NULL
                    END,
                    a.supplier_id,
                    NULL,
                    NOW(),
                    'Backfill từ dữ liệu vật tư cũ trước khi tách quản lý theo lô.'
                FROM public.assets a
                WHERE a.tracking_mode = 'CONSUMABLE'
                  AND COALESCE(a.quantity_on_hand, 0) > 0
                """);
        if (insertedRows > 0) {
            log.warn("Backfilled {} consumable receipt lot rows from legacy asset inventory", insertedRows);
        }
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
