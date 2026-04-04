package com.poly.mhv.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class AsyncRealtimePushService {

    private final SimpMessagingTemplate simpMessagingTemplate;

    @Async("notificationExecutor")
    public void pushToDestination(String destination, Object payload) {
        try {
            simpMessagingTemplate.convertAndSend(destination, payload);
        } catch (Exception ex) {
            log.warn("Realtime push failed to destination={}", destination, ex);
        }
    }
}
