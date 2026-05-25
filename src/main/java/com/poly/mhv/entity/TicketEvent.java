package com.poly.mhv.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "ticket_events")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TicketEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ticket_id", nullable = false)
    private Ticket ticket;

    @Column(name = "event_type", nullable = false, length = 40)
    private String eventType;

    @Column(name = "actor_id")
    private Integer actorId;

    @Column(name = "actor_name", length = 120)
    private String actorName;

    @Column(name = "message", nullable = false, length = 500)
    private String message;

    @Column(name = "detail_json", length = 4000)
    private String detailJson;

    @Column(name = "occurred_at", nullable = false)
    private LocalDateTime occurredAt;
}
