package com.smartspace.inbox.contact;

import com.smartspace.inbox.conversation.Channel;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "contact")
@Getter
@Setter
@NoArgsConstructor
public class Contact {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Channel channel;

    @Column(name = "external_id", nullable = false)
    private String externalId;

    @Column(name = "display_name")
    private String displayName;

    public Contact(Channel channel, String externalId, String displayName) {
        this.channel = channel;
        this.externalId = externalId;
        this.displayName = displayName;
    }
}
