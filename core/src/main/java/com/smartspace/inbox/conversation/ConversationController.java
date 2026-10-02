package com.smartspace.inbox.conversation;

import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/conversations")
public class ConversationController {

    private final ConversationService service;

    public ConversationController(ConversationService service) {
        this.service = service;
    }

    @GetMapping
    public List<ConversationSummary> list(@RequestParam(required = false) ConversationStatus status) {
        return service.list(status);
    }

    @GetMapping("/{id}")
    public ConversationDetail detail(@PathVariable Long id) {
        return service.detail(id);
    }
}
