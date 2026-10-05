package com.smartspace.inbox.conversation;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface MessageRepository extends JpaRepository<Message, Long> {
    Optional<Message> findByExternalId(String externalId);

    // A mais recente e a de maior id, nao a de maior createdAt: duas mensagens
    // podem nascer no mesmo instante e a subconsulta devolveria duas linhas para
    // a mesma conversa. O id e unico e cresce na ordem de insercao.
    @Query("""
            select m from Message m
            where m.id in (select max(outra.id) from Message outra
                           where outra.conversation.id in :conversationIds
                           group by outra.conversation.id)
            """)
    List<Message> findUltimaDeCadaConversa(Collection<Long> conversationIds);
}
