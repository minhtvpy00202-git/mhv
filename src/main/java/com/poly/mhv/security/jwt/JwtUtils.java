package com.poly.mhv.security.jwt;

import com.poly.mhv.security.services.UserDetailsImpl;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class JwtUtils {

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Value("${jwt.expiration-ms}")
    private long jwtExpirationMs;

    // Tạo JWT chứa thông tin người dùng cần cho các request đã đăng nhập.
    public String generateJwtToken(UserDetailsImpl userPrincipal) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + jwtExpirationMs);
        return Jwts.builder()
                .subject(userPrincipal.getUsername())
                .claim("id", userPrincipal.getId())
                .claim("fullName", userPrincipal.getFullName())
                .claim("role", userPrincipal.getRole())
                .claim("status", userPrincipal.getStatus())
                .claim("techTypeIds", userPrincipal.getTechTypeIds())
                .claim("techTypeNames", userPrincipal.getTechTypeNames())
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(getSigningKey())
                .compact();
    }

    // Đọc username từ JWT để nhận diện người dùng hiện tại.
    public String getUserNameFromJwtToken(String token) {
        return getClaims(token).getSubject();
    }

    // Đọc id người dùng đã được lưu trong JWT.
    public Integer getUserIdFromJwtToken(String token) {
        return getClaims(token).get("id", Integer.class);
    }

    // Đọc vai trò từ JWT để dựng lại quyền của người dùng.
    public String getRoleFromJwtToken(String token) {
        return getClaims(token).get("role", String.class);
    }

    // Đọc họ tên hiển thị từ JWT để tránh phải truy vấn lại database ở mọi request.
    public String getFullNameFromJwtToken(String token) {
        return getClaims(token).get("fullName", String.class);
    }

    // Đọc trạng thái tài khoản từ JWT để phục vụ khôi phục UserDetails.
    public String getStatusFromJwtToken(String token) {
        return getClaims(token).get("status", String.class);
    }

    // Đọc danh sách id chuyên môn kỹ thuật từ JWT và ép về kiểu số nguyên.
    public List<Integer> getTechTypeIdsFromJwtToken(String token) {
        Object value = getClaims(token).get("techTypeIds");
        if (!(value instanceof List<?> rawList)) {
            return List.of();
        }
        return rawList.stream()
                .filter(item -> item instanceof Number)
                .map(item -> ((Number) item).intValue())
                .toList();
    }

    // Đọc danh sách tên chuyên môn kỹ thuật từ JWT.
    public List<String> getTechTypeNamesFromJwtToken(String token) {
        Object value = getClaims(token).get("techTypeNames");
        if (!(value instanceof List<?> rawList)) {
            return List.of();
        }
        return rawList.stream()
                .filter(item -> item != null)
                .map(String::valueOf)
                .toList();
    }

    // Kiểm tra token có chữ ký hợp lệ và chưa hết hạn hay không.
    public boolean validateJwtToken(String authToken) {
        getClaims(authToken);
        return !isTokenExpired(authToken);
    }

    // Giải mã token và trả về toàn bộ claims đã được ký.
    private Claims getClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    // Chuẩn hóa cấu hình secret và dựng khóa ký dùng cho JWT.
    private SecretKey getSigningKey() {
        if (jwtSecret == null || jwtSecret.isBlank()) {
            throw new IllegalStateException("JWT secret is missing.");
        }
        String secret = jwtSecret.trim();
        if ((secret.startsWith("\"") && secret.endsWith("\"")) || (secret.startsWith("'") && secret.endsWith("'"))) {
            secret = secret.substring(1, secret.length() - 1).trim();
        }

        byte[] keyBytes;
        try {
            String base64Candidate = secret
                    .replace("\\n", "")
                    .replace("\\r", "")
                    .replace("\\", "")
                    .replaceAll("\\s+", "");
            keyBytes = Decoders.BASE64.decode(base64Candidate);
        } catch (RuntimeException ex) {
            keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        }
        return Keys.hmacShaKeyFor(keyBytes);
    }

    // Kiểm tra riêng thời điểm hết hạn của token.
    private boolean isTokenExpired(String token) {
        return getClaims(token).getExpiration().before(new Date());
    }
}
