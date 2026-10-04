package com.smartspace.inbox.conversation;

import jakarta.validation.constraints.NotNull;

public record AssignRequest(@NotNull Long agentId) {
}
