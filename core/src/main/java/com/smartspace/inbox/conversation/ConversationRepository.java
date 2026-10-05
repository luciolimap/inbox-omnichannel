package com.smartspace.inbox.conversation;

import com.smartspace.inbox.contact.Contact;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ConversationRepository extends JpaRepository<Conversation, Long> {

    // O grafo existe porque derived query nao vira join so por a associacao ser
    // EAGER: sem ele, cada conversa da lista custa um select de contato e um de
    // agente atribuido.
    @EntityGraph(attributePaths = {"contact", "assignedAgent"})
    List<Conversation> findAllByOrderByLastMessageAtDesc();

    @EntityGraph(attributePaths = {"contact", "assignedAgent"})
    List<Conversation> findByStatusOrderByLastMessageAtDesc(ConversationStatus status);

    Optional<Conversation> findFirstByContactAndStatusNotOrderByLastMessageAtDesc(
            Contact contact, ConversationStatus status);
}
