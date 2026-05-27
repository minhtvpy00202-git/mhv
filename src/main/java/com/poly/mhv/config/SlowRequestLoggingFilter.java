package com.poly.mhv.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Slf4j
@Component
public class SlowRequestLoggingFilter extends OncePerRequestFilter {

    private final long slowRequestThresholdMs;

    public SlowRequestLoggingFilter(
            @Value("${app.performance.slow-request-threshold-ms:1500}") long slowRequestThresholdMs
    ) {
        this.slowRequestThresholdMs = slowRequestThresholdMs;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        long startNanos = System.nanoTime();
        try {
            filterChain.doFilter(request, response);
        } finally {
            long elapsedMs = (System.nanoTime() - startNanos) / 1_000_000L;
            if (elapsedMs >= slowRequestThresholdMs) {
                log.warn(
                        "Slow request: method={}, uri={}, query={}, status={}, durationMs={}",
                        request.getMethod(),
                        request.getRequestURI(),
                        request.getQueryString(),
                        response.getStatus(),
                        elapsedMs
                );
            }
        }
    }
}
