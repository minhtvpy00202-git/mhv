package com.poly.mhv.service;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Service
public class AdminAlertSseService {

    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    public SseEmitter subscribe() {
        SseEmitter emitter = new SseEmitter(0L);
        emitters.add(emitter);
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError((ex) -> emitters.remove(emitter));
        return emitter;
    }

    public void notifyMaintenanceAlert(String message) {
        Map<String, Object> payload = Map.of(
                "type", "maintenance_alert",
                "message", message,
                "timestamp", LocalDateTime.now().toString()
        );
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name("maintenance_alert").data(payload));
            } catch (IOException ex) {
                emitter.completeWithError(ex);
                emitters.remove(emitter);
            }
        }
    }
}
