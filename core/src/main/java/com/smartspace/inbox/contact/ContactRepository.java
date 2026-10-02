package com.smartspace.inbox.contact;

import com.smartspace.inbox.conversation.Channel;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ContactRepository extends JpaRepository<Contact, Long> {
    Optional<Contact> findByChannelAndExternalId(Channel channel, String externalId);
}
