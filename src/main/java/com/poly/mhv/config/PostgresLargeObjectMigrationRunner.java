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
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
public class PostgresLargeObjectMigrationRunner implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        migrateOidColumnToText("categories", "spec_templates");
        migrateOidColumnToText("assets", "specs");
        migrateOidColumnToText("tickets", "image_url");
        migrateOidColumnToText("chat_messages", "content");
    }

    private void migrateOidColumnToText(String tableName, String columnName) {
        String columnTypeSql = """
                SELECT c.udt_name
                FROM information_schema.columns c
                WHERE c.table_schema = 'public'
                  AND c.table_name = ?
                  AND c.column_name = ?
                """;

        String columnType = jdbcTemplate.query(
                        columnTypeSql,
                        rs -> rs.next() ? rs.getString(1) : null,
                        tableName,
                        columnName
                );

        if (!"oid".equals(columnType)) {
            return;
        }

        String tempColumn = columnName + "_text";

        log.warn("Migrating PostgreSQL OID column {}.{} to TEXT", tableName, columnName);

        jdbcTemplate.execute("ALTER TABLE public." + tableName + " ADD COLUMN " + tempColumn + " text");
        jdbcTemplate.execute("""
                UPDATE public.%s
                SET %s = CASE
                    WHEN %s IS NULL THEN NULL
                    ELSE convert_from(lo_get(%s), 'UTF8')
                END
                """.formatted(tableName, tempColumn, columnName, columnName));
        jdbcTemplate.execute("""
                SELECT lo_unlink(%s)
                FROM public.%s
                WHERE %s IS NOT NULL
                """.formatted(columnName, tableName, columnName));
        jdbcTemplate.execute("ALTER TABLE public." + tableName + " DROP COLUMN " + columnName);
        jdbcTemplate.execute("ALTER TABLE public." + tableName + " RENAME COLUMN " + tempColumn + " TO " + columnName);
    }
}
