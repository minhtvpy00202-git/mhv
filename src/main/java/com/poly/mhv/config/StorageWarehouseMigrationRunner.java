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
@Order(Ordered.HIGHEST_PRECEDENCE + 8)
@RequiredArgsConstructor
public class StorageWarehouseMigrationRunner implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        ensureStorageWarehouseColumn();
        backfillStorageWarehouseFlag();
        ensureReceiptLotWarehouseLocationColumn();
        backfillReceiptLotWarehouseLocation();
        ensureConsumableIssueSourceWarehouseColumn();
        backfillConsumableIssueSourceWarehouse();
        ensureConsumableRequestSourceWarehouseColumn();
        backfillConsumableRequestSourceWarehouse();
    }

    private void ensureStorageWarehouseColumn() {
        if (columnExists("asset_map_area_types", "is_storage_warehouse")) {
            return;
        }
        jdbcTemplate.execute("ALTER TABLE public.asset_map_area_types ADD COLUMN is_storage_warehouse boolean");
        log.warn("Added asset_map_area_types.is_storage_warehouse column");
    }

    private void backfillStorageWarehouseFlag() {
        if (!columnExists("asset_map_area_types", "is_storage_warehouse")) {
            return;
        }
        int markedWarehouseRows = jdbcTemplate.update("""
                UPDATE public.asset_map_area_types
                SET is_storage_warehouse = true
                WHERE upper(coalesce(type_key, '')) = 'STORAGE_WAREHOUSE'
                  AND coalesce(is_storage_warehouse, false) = false
                """);
        if (markedWarehouseRows > 0) {
            log.warn("Marked {} area type rows as storage warehouses", markedWarehouseRows);
        }
        int normalizedRows = jdbcTemplate.update("""
                UPDATE public.asset_map_area_types
                SET is_storage_warehouse = false
                WHERE is_storage_warehouse IS NULL
                """);
        if (normalizedRows > 0) {
            log.warn("Backfilled false for {} null asset_map_area_types.is_storage_warehouse rows", normalizedRows);
        }
    }

    private void ensureReceiptLotWarehouseLocationColumn() {
        if (columnExists("consumable_receipt_lots", "warehouse_location_id")) {
            return;
        }
        jdbcTemplate.execute("ALTER TABLE public.consumable_receipt_lots ADD COLUMN warehouse_location_id integer");
        log.warn("Added consumable_receipt_lots.warehouse_location_id column");
    }

    private void backfillReceiptLotWarehouseLocation() {
        if (!columnExists("consumable_receipt_lots", "warehouse_location_id")) {
            return;
        }
        int updatedRows = jdbcTemplate.update("""
                UPDATE public.consumable_receipt_lots lot
                SET warehouse_location_id = coalesce(asset.home_location_id, asset.location_id)
                FROM public.assets asset
                WHERE asset.qa_code = lot.asset_qa_code
                  AND lot.warehouse_location_id IS NULL
                """);
        if (updatedRows > 0) {
            log.warn("Backfilled warehouse location for {} consumable receipt lots", updatedRows);
        }
    }

    private void ensureConsumableIssueSourceWarehouseColumn() {
        if (columnExists("consumable_issues", "source_warehouse_location_id")) {
            return;
        }
        jdbcTemplate.execute("ALTER TABLE public.consumable_issues ADD COLUMN source_warehouse_location_id integer");
        log.warn("Added consumable_issues.source_warehouse_location_id column");
    }

    private void backfillConsumableIssueSourceWarehouse() {
        if (!columnExists("consumable_issues", "source_warehouse_location_id")) {
            return;
        }
        int updatedRows = jdbcTemplate.update("""
                UPDATE public.consumable_issues issue
                SET source_warehouse_location_id = coalesce(asset.home_location_id, asset.location_id)
                FROM public.assets asset
                WHERE asset.qa_code = issue.asset_qa_code
                  AND issue.source_warehouse_location_id IS NULL
                """);
        if (updatedRows > 0) {
            log.warn("Backfilled source warehouse for {} consumable issues", updatedRows);
        }
    }

    private void ensureConsumableRequestSourceWarehouseColumn() {
        if (columnExists("consumable_requests", "source_warehouse_location_id")) {
            return;
        }
        jdbcTemplate.execute("ALTER TABLE public.consumable_requests ADD COLUMN source_warehouse_location_id integer");
        log.warn("Added consumable_requests.source_warehouse_location_id column");
    }

    private void backfillConsumableRequestSourceWarehouse() {
        if (!columnExists("consumable_requests", "source_warehouse_location_id")) {
            return;
        }
        int updatedRows = jdbcTemplate.update("""
                UPDATE public.consumable_requests request
                SET source_warehouse_location_id = coalesce(asset.home_location_id, asset.location_id)
                FROM public.assets asset
                WHERE asset.qa_code = request.asset_qa_code
                  AND request.source_warehouse_location_id IS NULL
                """);
        if (updatedRows > 0) {
            log.warn("Backfilled source warehouse for {} consumable requests", updatedRows);
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
