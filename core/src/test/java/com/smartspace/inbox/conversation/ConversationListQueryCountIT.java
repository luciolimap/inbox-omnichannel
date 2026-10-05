package com.smartspace.inbox.conversation;

import com.smartspace.inbox.contact.Contact;
import com.smartspace.inbox.contact.ContactRepository;
import com.smartspace.inbox.support.PostgresIT;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

// Sem @Transactional de proposito: a semeadura precisa estar commitada e o
// contexto de persistencia limpo, senao list() acha as conversas em cache de
// primeiro nivel e nao consulta nada. O preco e limpar o que foi semeado.
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
class ConversationListQueryCountIT extends PostgresIT {

    @Autowired
    ContactRepository contacts;

    @Autowired
    ConversationRepository conversations;

    @Autowired
    ConversationService service;

    @Autowired
    EntityManagerFactory emf;

    private final List<Long> conversasSemeadas = new ArrayList<>();
    private final List<Long> contatosSemeados = new ArrayList<>();

    @AfterEach
    void limpar() {
        conversasSemeadas.forEach(conversations::deleteById);
        contatosSemeados.forEach(contacts::deleteById);
    }

    @Test
    void consultas_da_lista_nao_crescem_com_a_quantidade_de_conversas() {
        semear("qc-1");
        semear("qc-2");
        long comDuas = medir();

        semear("qc-3");
        semear("qc-4");
        long comQuatro = medir();

        assertThat(comQuatro).isEqualTo(comDuas);
    }

    private long medir() {
        Statistics estatisticas = emf.unwrap(SessionFactory.class).getStatistics();
        estatisticas.clear();
        service.list(null);
        return estatisticas.getPrepareStatementCount();
    }

    private void semear(String externalId) {
        Contact contact = contacts.save(new Contact(Channel.TELEGRAM, externalId, "Cliente"));
        contatosSemeados.add(contact.getId());
        Conversation conversation = new Conversation(contact);
        conversation.addMessage(Message.inbound("primeira de " + externalId, externalId + "-m1"));
        conversation.addMessage(Message.inbound("segunda de " + externalId, externalId + "-m2"));
        conversasSemeadas.add(conversations.save(conversation).getId());
    }
}
