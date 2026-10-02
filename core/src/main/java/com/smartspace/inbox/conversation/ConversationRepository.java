package com.smartspace.inbox.conversation;

import com.smartspace.inbox.contact.Contact;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ConversationRepository extends JpaRepository<Conversation, Long> {

    List<Conversation> findAllByOrderByLastMessageAtDesc();

    List<Conversation> findByStatusOrderByLastMessageAtDesc(ConversationStatus status);

    Optional<Conversation> findFirstByContactAndStatusNotOrderByLastMessageAtDesc(
            Contact contact, ConversationStatus status);
}
