package com.smartspace.inbox.conversation;

import com.smartspace.inbox.agent.AgentDto;

import java.time.Instant;

public record MessageDto(Long id, String direction, String body, String deliveryStatus,
                         AgentDto sentByAgent, Instant createdAt) {

    public static MessageDto from(Message message) {
        return new MessageDto(
                message.getId(),
                message.getDirection().name(),
                message.getBody(),
                message.getDeliveryStatus().name(),
                message.getSentByAgent() == null ? null : AgentDto.from(message.getSentByAgent()),
                message.getCreatedAt());
    }
}
