package com.smartspace.inbox.inbound;

import com.smartspace.inbox.conversation.ConversationService;
import com.smartspace.inbox.conversation.MessageDto;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal/inbound")
public class InboundController {

    private final ConversationService service;

    public InboundController(ConversationService service) {
        this.service = service;
    }

    @PostMapping
    public MessageDto ingest(@Valid @RequestBody InboundRequest request) {
        return service.ingest(request);
    }
}
