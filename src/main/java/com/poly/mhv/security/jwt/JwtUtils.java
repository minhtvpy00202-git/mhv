package com.poly.mhv.security.jwt;

import com.poly.mhv.security.services.UserDetailsImpl;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
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
                .setSubject(userPrincipal.getUsername())
                .claim("role", userPrincipal.getRole())
                .setIssuedAt(now)
                .setExpiration(expiryDate)
                .signWith(getSigningKey())
                .compact();
    }

    public String getUserNameFromJwtToken(String token) {
        return getClaims(token).getSubject();
    }

    public boolean validateJwtToken(String authToken, UserDetails userDetails) {
        String username = getUserNameFromJwtToken(authToken);
        return username.equals(userDetails.getUsername()) && !isTokenExpired(authToken);
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
            String base64Candidate = secret.replaceAll("\\s+", "");
            keyBytes = Decoders.BASE64.decode(base64Candidate);
        } catch (IllegalArgumentException ex) {
            // Fallback for plain-text secrets in some environments.
            keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        }
        return Keys.hmacShaKeyFor(keyBytes);
    }

    private boolean isTokenExpired(String token) {
        return getClaims(token).getExpiration().before(new Date());
    }
}
