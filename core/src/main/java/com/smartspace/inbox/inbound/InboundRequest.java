package com.smartspace.inbox.inbound;

import com.smartspace.inbox.conversation.Channel;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record InboundRequest(
        @NotNull Channel channel,
        @NotBlank String externalContactId,
        String contactName,
        @NotBlank String externalMessageId,
        @NotBlank @Size(max = 4096) String body) {
}
