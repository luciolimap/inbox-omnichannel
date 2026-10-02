package com.smartspace.inbox.conversation;

import com.smartspace.inbox.agent.Agent;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "message")
@Getter
@Setter
@NoArgsConstructor
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "conversation_id")
    private Conversation conversation;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Direction direction;

    @Column(nullable = false, columnDefinition = "text")
    private String body;

    @Column(name = "external_id")
    private String externalId;

    @Enumerated(EnumType.STRING)
    @Column(name = "delivery_status", nullable = false)
    private DeliveryStatus deliveryStatus = DeliveryStatus.SENT;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "sent_by_agent_id")
    private Agent sentByAgent;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public static Message inbound(String body, String externalId) {
        Message message = new Message();
        message.direction = Direction.INBOUND;
        message.body = body;
        message.externalId = externalId;
        message.deliveryStatus = DeliveryStatus.SENT;
        return message;
    }

    public static Message outbound(String body, Agent sentBy) {
        Message message = new Message();
        message.direction = Direction.OUTBOUND;
        message.body = body;
        message.sentByAgent = sentBy;
        message.deliveryStatus = DeliveryStatus.PENDING;
        return message;
    }
}
