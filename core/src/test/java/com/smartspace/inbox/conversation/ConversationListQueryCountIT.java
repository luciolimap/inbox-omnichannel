package com.smartspace.inbox.conversation;

import com.smartspace.inbox.agent.Agent;
import com.smartspace.inbox.agent.AgentRepository;
import com.smartspace.inbox.agent.Role;
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
    AgentRepository agents;

    @Autowired
    ConversationService service;

    @Autowired
    EntityManagerFactory emf;

    private final List<Long> conversasSemeadas = new ArrayList<>();
    private final List<Long> contatosSemeados = new ArrayList<>();
    private final List<Long> agentesSemeados = new ArrayList<>();

    @AfterEach
    void limpar() {
        conversasSemeadas.forEach(conversations::deleteById);
        contatosSemeados.forEach(contacts::deleteById);
        agentesSemeados.forEach(agents::deleteById);
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

    // A ultima mensagem e resposta de agente, e de um agente por conversa: e o
    // estado normal do inbox, e e o unico que expoe o sentByAgent EAGER de
    // Message. Com inbound so, ou com o mesmo agente em todas, o cache de
    // primeiro nivel esconde o select extra e o teste passa com o N+1 vivo.
    // A conversa fica sem assignedAgent de proposito: atribuida, o @EntityGraph
    // da lista ja traria o agente e o select nao apareceria.
    private void semear(String externalId) {
        Contact contact = contacts.save(new Contact(Channel.TELEGRAM, externalId, "Cliente"));
        contatosSemeados.add(contact.getId());
        Agent remetente = agents.save(new Agent(
                "Agente " + externalId, externalId + "@teste.local", "hash", Role.AGENT));
        agentesSemeados.add(remetente.getId());
        Conversation conversation = new Conversation(contact);
        conversation.addMessage(Message.inbound("primeira de " + externalId, externalId + "-m1"));
        conversation.addMessage(Message.outbound("resposta de " + externalId, remetente));
        conversasSemeadas.add(conversations.save(conversation).getId());
    }
}
