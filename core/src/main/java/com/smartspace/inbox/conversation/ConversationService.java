package com.smartspace.inbox.conversation;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class ConversationService {

    private final ConversationRepository conversations;

    public ConversationService(ConversationRepository conversations) {
        this.conversations = conversations;
    }

    @Transactional(readOnly = true)
    public List<ConversationSummary> list(ConversationStatus status) {
        List<Conversation> encontradas = status == null
                ? conversations.findAllByOrderByLastMessageAtDesc()
                : conversations.findByStatusOrderByLastMessageAtDesc(status);
        return encontradas.stream().map(ConversationSummary::from).toList();
    }

    @Transactional(readOnly = true)
    public ConversationDetail detail(Long id) {
        return ConversationDetail.from(buscar(id));
    }

    Conversation buscar(Long id) {
        return conversations.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "conversa " + id + " nao existe"));
    }
}
