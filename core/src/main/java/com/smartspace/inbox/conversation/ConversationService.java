package com.smartspace.inbox.conversation;

import com.smartspace.inbox.contact.Contact;
import com.smartspace.inbox.contact.ContactRepository;
import com.smartspace.inbox.inbound.InboundRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class ConversationService {

    private final ConversationRepository conversations;
    private final ContactRepository contacts;
    private final MessageRepository messages;

    public ConversationService(ConversationRepository conversations,
                               ContactRepository contacts,
                               MessageRepository messages) {
        this.conversations = conversations;
        this.contacts = contacts;
        this.messages = messages;
    }

    @Transactional
    public MessageDto ingest(InboundRequest request) {
        // Telegram reentrega o webhook quando nao recebe 200 rapido. Devolver a
        // mensagem que ja existe e mais barato que tratar violacao de unique, e
        // o gateway recebe a mesma resposta nas duas entregas.
        var repetida = messages.findByExternalId(request.externalMessageId());
        if (repetida.isPresent()) {
            return MessageDto.from(repetida.get());
        }

        Contact contact = contacts
                .findByChannelAndExternalId(request.channel(), request.externalContactId())
                .orElseGet(() -> contacts.save(new Contact(
                        request.channel(), request.externalContactId(), request.contactName())));

        Conversation conversation = conversations
                .findFirstByContactAndStatusNotOrderByLastMessageAtDesc(
                        contact, ConversationStatus.RESOLVED)
                .orElseGet(() -> new Conversation(contact));

        Message message = Message.inbound(request.body(), request.externalMessageId());
        conversation.addMessage(message);
        conversations.save(conversation);
        return MessageDto.from(message);
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
