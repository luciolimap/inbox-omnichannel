package com.smartspace.inbox.conversation;

import com.smartspace.inbox.agent.Agent;
import com.smartspace.inbox.agent.AgentRepository;
import com.smartspace.inbox.agent.Role;
import com.smartspace.inbox.contact.Contact;
import com.smartspace.inbox.contact.ContactRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ConversationServiceTest {

    ConversationRepository conversations = mock(ConversationRepository.class);
    ContactRepository contacts = mock(ContactRepository.class);
    MessageRepository messages = mock(MessageRepository.class);
    AgentRepository agents = mock(AgentRepository.class);

    ConversationService service;
    Conversation conversa;
    Agent agente;

    @BeforeEach
    void preparar() {
        service = new ConversationService(conversations, contacts, messages, agents);
        conversa = new Conversation(new Contact(Channel.TELEGRAM, "chat-1", "Cliente"));
        agente = new Agent("Agente Demo", "agente@smartspace.test", "hash", Role.AGENT);
        when(conversations.findById(1L)).thenReturn(Optional.of(conversa));
        when(conversations.save(any(Conversation.class))).thenAnswer(i -> i.getArgument(0));
        when(messages.saveAndFlush(any(Message.class))).thenAnswer(i -> i.getArgument(0));
    }

    @Test
    void atribuir_grava_o_agente_na_conversa() {
        when(agents.findById(7L)).thenReturn(Optional.of(agente));

        ConversationDetail resultado = service.assign(1L, 7L);

        assertThat(resultado.assignedAgent().email()).isEqualTo("agente@smartspace.test");
        assertThat(conversa.getAssignedAgent()).isSameAs(agente);
    }

    @Test
    void atribuir_a_agente_inexistente_recusa() {
        when(agents.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.assign(1L, 99L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("agente 99 nao existe");

        assertThat(conversa.getAssignedAgent()).isNull();
    }

    @Test
    void resolver_muda_o_status() {
        ConversationDetail resultado = service.changeStatus(1L, ConversationStatus.RESOLVED);

        assertThat(resultado.status()).isEqualTo("RESOLVED");
        assertThat(conversa.getStatus()).isEqualTo(ConversationStatus.RESOLVED);
    }

    @Test
    void responder_nasce_pendente_de_entrega_e_atualiza_a_conversa() {
        ReplyPrepared preparada = service.persistReply(1L, new ReplyRequest("ja estou vendo"), agente);

        assertThat(preparada.message().direction()).isEqualTo("OUTBOUND");
        assertThat(preparada.message().deliveryStatus()).isEqualTo("PENDING");
        assertThat(preparada.channel()).isEqualTo(Channel.TELEGRAM);
        assertThat(preparada.externalContactId()).isEqualTo("chat-1");
        assertThat(conversa.getMessages()).hasSize(1);
    }
}
