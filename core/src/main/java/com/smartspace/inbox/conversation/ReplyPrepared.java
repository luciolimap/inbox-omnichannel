package com.smartspace.inbox.conversation;

public record ReplyPrepared(MessageDto message, Channel channel, String externalContactId) {
}
