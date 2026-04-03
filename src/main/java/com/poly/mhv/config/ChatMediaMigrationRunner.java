package com.poly.mhv.config;

import com.poly.mhv.service.ChatMediaStorageService;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class ChatMediaMigrationRunner implements CommandLineRunner {

    private final JdbcTemplate jdbcTemplate;
    private final ChatMediaStorageService chatMediaStorageService;

    @Override
    public void run(String... args) {
        ensureSchema();
        migrateLegacyMessages();
    }

    private void ensureSchema() {
        jdbcTemplate.execute("""
                IF COL_LENGTH('chat_messages', 'media_url') IS NULL
                    ALTER TABLE chat_messages ADD media_url NVARCHAR(1000) NULL;
                IF COL_LENGTH('chat_messages', 'media_type') IS NULL
                    ALTER TABLE chat_messages ADD media_type VARCHAR(20) NULL;
                IF EXISTS (
                    SELECT 1
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_NAME = 'chat_messages'
                      AND COLUMN_NAME = 'content'
                      AND IS_NULLABLE = 'NO'
                )
                    ALTER TABLE chat_messages ALTER COLUMN content NVARCHAR(MAX) NULL;
                """);
    }

    private void migrateLegacyMessages() {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT id, content
                FROM chat_messages
                WHERE media_url IS NULL
                  AND (
                    content LIKE '[[IMG]]data:%;base64,%'
                    OR content LIKE '[[AUDIO]]data:%;base64,%'
                    OR content LIKE 'data:%;base64,%'
                    OR content LIKE '[[IMG]]/uploads/%'
                    OR content LIKE '[[AUDIO]]/uploads/%'
                  )
                """);
        for (Map<String, Object> row : rows) {
            Integer id = ((Number) row.get("id")).intValue();
            String content = (String) row.get("content");
            ChatMediaStorageService.ProcessedChatPayload payload = chatMediaStorageService.migrateLegacyContent(content);
            if (payload == null) {
                continue;
            }
            jdbcTemplate.update(
                    "UPDATE chat_messages SET content = ?, media_url = ?, media_type = ? WHERE id = ?",
                    payload.content(),
                    payload.mediaUrl(),
                    payload.mediaType(),
                    id
            );
        }
    }
}
