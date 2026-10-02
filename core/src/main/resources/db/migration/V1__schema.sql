create table agent (
    id            bigserial primary key,
    name          varchar(120) not null,
    email         varchar(180) not null unique,
    password_hash varchar(100) not null,
    role          varchar(20)  not null
);

create table contact (
    id           bigserial primary key,
    channel      varchar(20)  not null,
    external_id  varchar(180) not null,
    display_name varchar(180),
    unique (channel, external_id)
);

create table conversation (
    id                bigserial primary key,
    contact_id        bigint      not null references contact (id),
    channel           varchar(20) not null,
    status            varchar(20) not null,
    assigned_agent_id bigint references agent (id),
    created_at        timestamptz not null default now(),
    last_message_at   timestamptz not null default now()
);

create index conversation_status_last_message_idx
    on conversation (status, last_message_at desc);

create table message (
    id               bigserial primary key,
    conversation_id  bigint      not null references conversation (id) on delete cascade,
    direction        varchar(10) not null,
    body             text        not null,
    external_id      varchar(220),
    delivery_status  varchar(20) not null,
    sent_by_agent_id bigint references agent (id),
    created_at       timestamptz not null default now()
);

-- Telegram reentrega o webhook quando nao recebe 200 rapido. O external_id vem
-- prefixado pelo canal (telegram:4812), entao o unico global nao colide entre
-- canais e a reentrega para no banco, nao na aplicacao.
create unique index message_external_id_idx
    on message (external_id) where external_id is not null;

create index message_conversation_created_idx
    on message (conversation_id, created_at);
