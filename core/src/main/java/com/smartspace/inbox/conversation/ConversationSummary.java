package com.smartspace.inbox.conversation;

import com.smartspace.inbox.agent.AgentDto;

import java.time.Instant;

public record ConversationSummary(Long id, String channel, String status, String contactName,
                                  String contactExternalId, AgentDto assignedAgent,
                                  String lastMessagePreview, Instant lastMessageAt) {

    // A previa chega de fora porque quem monta a lista a busca em lote. Ler
    // conversation.getMessages() aqui carregaria todas as mensagens da conversa
    // para usar uma linha, uma vez por conversa da lista.
    public static ConversationSummary from(Conversation conversation, String lastMessagePreview) {
        return new ConversationSummary(
                conversation.getId(),
                conversation.getChannel().name(),
                conversation.getStatus().name(),
                conversation.getContact().getDisplayName(),
                conversation.getContact().getExternalId(),
                conversation.getAssignedAgent() == null
                        ? null : AgentDto.from(conversation.getAssignedAgent()),
                lastMessagePreview,
                conversation.getLastMessageAt());
    }
}
