package com.smartspace.inbox.conversation;

import jakarta.validation.constraints.NotNull;

public record StatusRequest(@NotNull ConversationStatus status) {
}
