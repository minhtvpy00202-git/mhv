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

    public String getUserNameFromJwtToken(String token) {
        return getClaims(token).getSubject();
    }

    public Integer getUserIdFromJwtToken(String token) {
        return getClaims(token).get("id", Integer.class);
    }

    public String getRoleFromJwtToken(String token) {
        return getClaims(token).get("role", String.class);
    }

    public String getFullNameFromJwtToken(String token) {
        return getClaims(token).get("fullName", String.class);
    }

    public String getStatusFromJwtToken(String token) {
        return getClaims(token).get("status", String.class);
    }

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

    public boolean validateJwtToken(String authToken) {
        getClaims(authToken);
        return !isTokenExpired(authToken);
    }

    private Claims getClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

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

    private boolean isTokenExpired(String token) {
        return getClaims(token).getExpiration().before(new Date());
    }
}
