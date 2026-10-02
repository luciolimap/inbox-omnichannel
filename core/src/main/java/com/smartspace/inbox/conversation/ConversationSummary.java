package com.smartspace.inbox.conversation;

import com.smartspace.inbox.agent.AgentDto;

import java.time.Instant;

public record ConversationSummary(Long id, String channel, String status, String contactName,
                                  String contactExternalId, AgentDto assignedAgent,
                                  String lastMessagePreview, Instant lastMessageAt) {

    public static ConversationSummary from(Conversation conversation) {
        String previa = conversation.getMessages().isEmpty()
                ? ""
                : conversation.getMessages().get(conversation.getMessages().size() - 1).getBody();
        return new ConversationSummary(
                conversation.getId(),
                conversation.getChannel().name(),
                conversation.getStatus().name(),
                conversation.getContact().getDisplayName(),
                conversation.getContact().getExternalId(),
                conversation.getAssignedAgent() == null
                        ? null : AgentDto.from(conversation.getAssignedAgent()),
                previa,
                conversation.getLastMessageAt());
    }
}
