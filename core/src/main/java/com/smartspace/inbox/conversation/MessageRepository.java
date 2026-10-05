package com.smartspace.inbox.conversation;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface MessageRepository extends JpaRepository<Message, Long> {
    Optional<Message> findByExternalId(String externalId);

    // Projecao, nao a entidade: Message tem sentByAgent EAGER, e carregar a
    // entidade custava um select por agente remetente distinto da lista. A previa
    // so precisa do corpo.
    //
    // A mais recente e a de maior id, nao a de maior createdAt: duas mensagens
    // podem nascer no mesmo instante e a subconsulta devolveria duas linhas para
    // a mesma conversa. O preco e que id e lastMessageAt podem discordar quando
    // duas respostas da mesma conversa sao inseridas fora da ordem em que
    // nasceram: a lista ordena por lastMessageAt e a previa sai pela ordem de
    // insercao. Divergencia cosmetica, e so sob concorrencia na mesma conversa.
    @Query("""
            select m.conversation.id as conversationId, m.body as body from Message m
            where m.id in (select max(outra.id) from Message outra
                           where outra.conversation.id in :conversationIds
                           group by outra.conversation.id)
            """)
    List<PreviaDeConversa> findUltimaDeCadaConversa(Collection<Long> conversationIds);

    interface PreviaDeConversa {
        Long getConversationId();

        String getBody();
    }
}
