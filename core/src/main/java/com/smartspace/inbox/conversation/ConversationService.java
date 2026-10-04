package com.smartspace.inbox.conversation;

import com.smartspace.inbox.agent.Agent;
import com.smartspace.inbox.agent.AgentRepository;
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
    private final AgentRepository agents;

    public ConversationService(ConversationRepository conversations,
                               ContactRepository contacts,
                               MessageRepository messages,
                               AgentRepository agents) {
        this.conversations = conversations;
        this.contacts = contacts;
        this.messages = messages;
        this.agents = agents;
    }

    @Transactional
    public ReplyPrepared persistReply(Long conversationId, ReplyRequest request, Agent agent) {
        Conversation conversation = buscar(conversationId);
        Message message = Message.outbound(request.body(), agent);
        conversation.addMessage(message);
        // A mensagem e persistida direto, nao pelo cascade de conversations.save:
        // save numa conversa que ja tem id chama em.merge, que copia a mensagem
        // nova e deixa o id na copia, enquanto quem chama precisa do id aqui para
        // o markDelivery depois do despacho.
        Message salva = messages.saveAndFlush(message);
        return new ReplyPrepared(
                MessageDto.from(salva),
                conversation.getChannel(),
                conversation.getContact().getExternalId());
    }

    @Transactional
    public MessageDto markDelivery(Long messageId, DeliveryStatus status) {
        Message message = messages.findById(messageId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "mensagem " + messageId + " nao existe"));
        message.setDeliveryStatus(status);
        messages.save(message);
        return MessageDto.from(message);
    }

    @Transactional
    public ConversationDetail assign(Long conversationId, Long agentId) {
        Conversation conversation = buscar(conversationId);
        Agent agent = agents.findById(agentId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "agente " + agentId + " nao existe"));
        conversation.setAssignedAgent(agent);
        return ConversationDetail.from(conversations.save(conversation));
    }

    @Transactional
    public ConversationDetail changeStatus(Long conversationId, ConversationStatus status) {
        Conversation conversation = buscar(conversationId);
        conversation.setStatus(status);
        return ConversationDetail.from(conversations.save(conversation));
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
        if (conversation.getId() == null) {
            // Conversa nova: o persist em cascata grava a mensagem na propria
            // instancia, entao o id chega aqui.
            conversations.save(conversation);
            return MessageDto.from(message);
        }
        // Conversa que ja existe: a mesma armadilha do persistReply. save chamaria
        // em.merge, que copia a mensagem e deixa o id na copia, e o DTO sairia com
        // id nulo contra CoreMessage.id do gateway.
        return MessageDto.from(messages.saveAndFlush(message));
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
