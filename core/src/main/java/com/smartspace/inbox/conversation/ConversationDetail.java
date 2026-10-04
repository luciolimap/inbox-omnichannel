package com.smartspace.inbox.conversation;

import com.smartspace.inbox.agent.AgentDto;

import java.util.List;

public record ConversationDetail(Long id, String channel, String status, String contactName,
                                 String contactExternalId, AgentDto assignedAgent,
                                 List<MessageDto> messages) {

    public static ConversationDetail from(Conversation conversation) {
        return new ConversationDetail(
                conversation.getId(),
                conversation.getChannel().name(),
                conversation.getStatus().name(),
                conversation.getContact().getDisplayName(),
                conversation.getContact().getExternalId(),
                conversation.getAssignedAgent() == null
                        ? null : AgentDto.from(conversation.getAssignedAgent()),
                conversation.getMessages().stream().map(MessageDto::from).toList());
    }
}
