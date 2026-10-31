-- Acervo (RF-47 a RF-53, RF-64, RF-66 a RF-70): arquivos, livros, artigos, vídeos,
-- sessões de leitura, notas de item e destaques. O progresso do livro é calculado
-- das sessões, não gravado. Sem chave estrangeira para tabelas de outro contexto.

CREATE EXTENSION IF NOT EXISTS unaccent;

-- Funções `IMMUTABLE` prefixadas `library_` para a coluna gerada do `tsvector`
-- ([project/database-06]) e para a consulta de busca usarem a mesma normalização.
CREATE FUNCTION library_unaccent(input text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, input) $$;

CREATE FUNCTION library_search_text(input text[]) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$ SELECT coalesce(array_to_string(input, ' '), '') $$;

CREATE TABLE library_files (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'personal' CHECK (visibility IN ('personal', 'shared')),
    kind TEXT NOT NULL CHECK (kind IN ('pdf', 'image')),
    content_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
    sha256 TEXT NOT NULL,
    storage_key TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX library_files_owner_idx ON library_files (owner_id);

CREATE TABLE books (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'personal' CHECK (visibility IN ('personal', 'shared')),
    title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
    author TEXT NULL CHECK (author IS NULL OR char_length(author) <= 300),
    publisher TEXT NULL CHECK (publisher IS NULL OR char_length(publisher) <= 300),
    page_count INT NULL CHECK (page_count > 0),
    tags TEXT[] NOT NULL DEFAULT '{}',
    reading_status TEXT NOT NULL DEFAULT 'want_to_read'
        CHECK (reading_status IN ('want_to_read', 'reading', 'read')),
    cover_file_id UUID NULL REFERENCES library_files (id),
    pdf_file_id UUID NULL REFERENCES library_files (id),
    last_read_page INT NULL CHECK (last_read_page > 0),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ NULL,
    search_vector tsvector GENERATED ALWAYS AS (
        to_tsvector(
            'portuguese',
            library_unaccent(
                title || ' ' || coalesce(author, '') || ' ' || coalesce(publisher, '')
                || ' ' || library_search_text(tags)
            )
        )
    ) STORED
);

CREATE INDEX books_owner_created_idx ON books (owner_id, created_at DESC, id DESC)
    WHERE deleted_at IS NULL;
CREATE INDEX books_owner_status_idx ON books (owner_id, reading_status)
    WHERE deleted_at IS NULL;
CREATE INDEX books_cover_file_idx ON books (cover_file_id);
CREATE INDEX books_pdf_file_idx ON books (pdf_file_id);
CREATE INDEX books_search_idx ON books USING GIN (search_vector);
CREATE INDEX books_tags_idx ON books USING GIN (tags);

CREATE TABLE articles (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'personal' CHECK (visibility IN ('personal', 'shared')),
    title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
    url TEXT NULL CHECK (url IS NULL OR char_length(url) <= 2048),
    author TEXT NULL CHECK (author IS NULL OR char_length(author) <= 300),
    source TEXT NULL CHECK (source IS NULL OR char_length(source) <= 300),
    tags TEXT[] NOT NULL DEFAULT '{}',
    reading_status TEXT NOT NULL DEFAULT 'to_read'
        CHECK (reading_status IN ('to_read', 'reading', 'read')),
    cover_file_id UUID NULL REFERENCES library_files (id),
    pdf_file_id UUID NULL REFERENCES library_files (id),
    last_read_page INT NULL CHECK (last_read_page > 0),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ NULL,
    search_vector tsvector GENERATED ALWAYS AS (
        to_tsvector(
            'portuguese',
            library_unaccent(
                title || ' ' || coalesce(author, '') || ' ' || coalesce(source, '')
                || ' ' || library_search_text(tags)
            )
        )
    ) STORED
);

CREATE INDEX articles_owner_created_idx ON articles (owner_id, created_at DESC, id DESC)
    WHERE deleted_at IS NULL;
CREATE INDEX articles_cover_file_idx ON articles (cover_file_id);
CREATE INDEX articles_pdf_file_idx ON articles (pdf_file_id);
CREATE INDEX articles_search_idx ON articles USING GIN (search_vector);
CREATE INDEX articles_tags_idx ON articles USING GIN (tags);

CREATE TABLE videos (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'personal' CHECK (visibility IN ('personal', 'shared')),
    url TEXT NOT NULL CHECK (char_length(url) <= 2048),
    title TEXT NULL CHECK (title IS NULL OR char_length(title) BETWEEN 1 AND 300),
    channel TEXT NULL CHECK (channel IS NULL OR char_length(channel) BETWEEN 1 AND 300),
    watch_status TEXT NOT NULL DEFAULT 'to_watch'
        CHECK (watch_status IN ('to_watch', 'watching', 'watched')),
    tags TEXT[] NOT NULL DEFAULT '{}',
    thumbnail_file_id UUID NULL REFERENCES library_files (id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ NULL,
    search_vector tsvector GENERATED ALWAYS AS (
        to_tsvector(
            'portuguese',
            library_unaccent(
                coalesce(title, '') || ' ' || coalesce(channel, '')
                || ' ' || library_search_text(tags)
            )
        )
    ) STORED
);

CREATE INDEX videos_owner_created_idx ON videos (owner_id, created_at DESC, id DESC)
    WHERE deleted_at IS NULL;
CREATE INDEX videos_owner_status_idx ON videos (owner_id, watch_status)
    WHERE deleted_at IS NULL;
CREATE INDEX videos_thumbnail_file_idx ON videos (thumbnail_file_id);
CREATE INDEX videos_search_idx ON videos USING GIN (search_vector);
CREATE INDEX videos_tags_idx ON videos USING GIN (tags);

CREATE TABLE reading_sessions (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'personal' CHECK (visibility IN ('personal', 'shared')),
    book_id UUID NOT NULL REFERENCES books (id) ON DELETE CASCADE,
    read_on DATE NOT NULL,
    pages_read INT NOT NULL CHECK (pages_read > 0),
    from_page INT NULL,
    to_page INT NULL,
    observation TEXT NULL CHECK (observation IS NULL OR char_length(observation) <= 2000),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CHECK (from_page IS NULL OR to_page IS NULL OR to_page > from_page)
);

CREATE INDEX reading_sessions_book_idx ON reading_sessions (book_id, read_on DESC);

CREATE TABLE item_notes (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'personal' CHECK (visibility IN ('personal', 'shared')),
    book_id UUID NULL REFERENCES books (id) ON DELETE CASCADE,
    article_id UUID NULL REFERENCES articles (id) ON DELETE CASCADE,
    video_id UUID NULL REFERENCES videos (id) ON DELETE CASCADE,
    quote TEXT NULL CHECK (quote IS NULL OR char_length(quote) <= 5000),
    page INT NULL CHECK (page > 0),
    comment TEXT NULL CHECK (comment IS NULL OR char_length(comment) <= 5000),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CHECK (num_nonnulls(book_id, article_id, video_id) = 1),
    CHECK (quote IS NOT NULL OR comment IS NOT NULL)
);

CREATE INDEX item_notes_book_idx ON item_notes (book_id);
CREATE INDEX item_notes_article_idx ON item_notes (article_id);
CREATE INDEX item_notes_video_idx ON item_notes (video_id);

CREATE TABLE highlights (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'personal' CHECK (visibility IN ('personal', 'shared')),
    book_id UUID NULL REFERENCES books (id) ON DELETE CASCADE,
    article_id UUID NULL REFERENCES articles (id) ON DELETE CASCADE,
    file_id UUID NOT NULL REFERENCES library_files (id),
    page INT NOT NULL CHECK (page > 0),
    color TEXT NOT NULL CHECK (color IN ('accent', 'primary', 'success', 'warning', 'info')),
    text TEXT NOT NULL CHECK (char_length(text) <= 5000),
    rects JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CHECK (num_nonnulls(book_id, article_id) = 1)
);

CREATE INDEX highlights_book_idx ON highlights (book_id);
CREATE INDEX highlights_article_idx ON highlights (article_id);
CREATE INDEX highlights_file_idx ON highlights (file_id);

-- Row Level Security em todas as tabelas. O `NULLIF` evita erro numa conexão
-- reaproveitada do pool, em que o valor fica ''.
ALTER TABLE library_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_files FORCE ROW LEVEL SECURITY;
CREATE POLICY library_files_owner_isolation ON library_files
    USING (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    WITH CHECK (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE books FORCE ROW LEVEL SECURITY;
CREATE POLICY books_owner_isolation ON books
    USING (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    WITH CHECK (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles FORCE ROW LEVEL SECURITY;
CREATE POLICY articles_owner_isolation ON articles
    USING (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    WITH CHECK (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos FORCE ROW LEVEL SECURITY;
CREATE POLICY videos_owner_isolation ON videos
    USING (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    WITH CHECK (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

ALTER TABLE reading_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY reading_sessions_owner_isolation ON reading_sessions
    USING (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    WITH CHECK (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

ALTER TABLE item_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_notes FORCE ROW LEVEL SECURITY;
CREATE POLICY item_notes_owner_isolation ON item_notes
    USING (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    WITH CHECK (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

ALTER TABLE highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE highlights FORCE ROW LEVEL SECURITY;
CREATE POLICY highlights_owner_isolation ON highlights
    USING (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    WITH CHECK (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);
