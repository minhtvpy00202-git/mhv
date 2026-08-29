package com.poly.mhv.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(
        name = "inquiry_messages",
        indexes = {
                @Index(name = "idx_inquiry_message_thread", columnList = "inquiry_id,created_at"),
                @Index(name = "idx_inquiry_message_unread", columnList = "inquiry_id,read_at")
        })
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InquiryMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "inquiry_id", nullable = false)
    private ServiceInquiry inquiry;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sender_id", nullable = false)
    private AppUser sender;

    @Column(name = "content", columnDefinition = "TEXT")
    private String content;

    @Column(name = "media_url", length = 1000)
    private String mediaUrl;

    @Column(name = "media_type", length = 20)
    private String mediaType;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "read_at")
    private LocalDateTime readAt;
}
