package com.smartspace.inbox.conversation;

import com.smartspace.inbox.contact.Contact;
import com.smartspace.inbox.contact.ContactRepository;
import com.smartspace.inbox.support.PostgresIT;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

// O container e unico para a suite. Sem rollback por teste, a conversa de um
// teste entra na ordenacao do outro e a assercao de ordem passa a depender da
// ordem de execucao.
@Transactional
class ConversationRepositoryIT extends PostgresIT {

    @Autowired
    ContactRepository contacts;

    @Autowired
    ConversationRepository conversations;

    @Test
    void ordena_conversas_pela_mensagem_mais_recente() {
        Conversation antiga = novaConversa("telegram-1", Instant.parse("2026-10-01T10:00:00Z"));
        Conversation recente = novaConversa("telegram-2", Instant.parse("2026-10-01T12:00:00Z"));

        List<Conversation> resultado = conversations.findAllByOrderByLastMessageAtDesc();

        assertThat(resultado).extracting(Conversation::getId)
                .containsExactly(recente.getId(), antiga.getId());
    }

    @Test
    void acha_contato_por_canal_e_id_externo() {
        novaConversa("telegram-3", Instant.now());

        assertThat(contacts.findByChannelAndExternalId(Channel.TELEGRAM, "telegram-3")).isPresent();
        assertThat(contacts.findByChannelAndExternalId(Channel.WHATSAPP, "telegram-3")).isEmpty();
    }

    private Conversation novaConversa(String externalId, Instant lastMessageAt) {
        Contact contact = contacts.save(new Contact(Channel.TELEGRAM, externalId, "Cliente"));
        Conversation conversation = new Conversation(contact);
        conversation.setLastMessageAt(lastMessageAt);
        return conversations.save(conversation);
    }
}
