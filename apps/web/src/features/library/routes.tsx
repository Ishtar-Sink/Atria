import { createRoute, type AnyRoute } from '@tanstack/react-router';
import { ArticleFormPage } from './article-form-page';
import { ArticlePage, type ArticleExtraTab } from './article-page';
import { BookFormPage } from './book-form-page';
import { BookPage, type BookExtraTab } from './book-page';
import { ReadingSessionFormPage } from './reading-session-form-page';
import { ShelfPage } from './shelf-page';
import { VideoFormPage } from './video-form-page';
import { VideoPage, type VideoExtraTab } from './video-page';

export interface LibraryRoutesOptions {
  /** Abas do livro que outra feature acrescenta (Conexões e Destaques, montadas na TASK-35). */
  book_extra_tabs?: readonly BookExtraTab[];
  /** Abas do artigo que outra feature acrescenta (Conexões e Destaques, montadas na TASK-35). */
  article_extra_tabs?: readonly ArticleExtraTab[];
  /** Abas do vídeo que outra feature acrescenta (Conexões, montada na TASK-35). */
  video_extra_tabs?: readonly VideoExtraTab[];
}

function meta(key: string) {
  return { title_key: key, breadcrumb_key: key };
}

/**
 * Rotas do Acervo, para a TASK-35 registrar. A estante lê aba, status, busca, etiqueta e
 * visualização da URL pelo `useListSearch`; as rotas de leitura (`/read`) são da feature `reader`.
 */
export function createLibraryRoutes(
  parent_route: AnyRoute,
  options: LibraryRoutesOptions = {},
): AnyRoute[] {
  const route = (path: string, component: () => React.JSX.Element, key: string) =>
    createRoute({
      getParentRoute: () => parent_route,
      path,
      component,
      staticData: meta(key),
    });
  const book_tabs = options.book_extra_tabs;
  const article_tabs = options.article_extra_tabs;
  const video_tabs = options.video_extra_tabs;
  return [
    route('/library', ShelfPage, 'library.nav.title'),
    route('/library/books/new', BookFormPage, 'library.book.title_new'),
    route(
      '/library/books/$bookId',
      () => <BookPage {...(book_tabs ? { extra_tabs: book_tabs } : {})} />,
      'library.book.nav_crumb',
    ),
    route('/library/books/$bookId/edit', BookFormPage, 'library.book.title_edit'),
    route(
      '/library/books/$bookId/sessions/new',
      ReadingSessionFormPage,
      'library.session.title_new',
    ),
    route(
      '/library/books/$bookId/sessions/$sessionId/edit',
      ReadingSessionFormPage,
      'library.session.title_edit',
    ),
    route('/library/articles/new', ArticleFormPage, 'library.article.title_new'),
    route(
      '/library/articles/$articleId',
      () => <ArticlePage {...(article_tabs ? { extra_tabs: article_tabs } : {})} />,
      'library.article.nav_crumb',
    ),
    route('/library/articles/$articleId/edit', ArticleFormPage, 'library.article.title_edit'),
    route('/library/videos/new', VideoFormPage, 'library.video.title_new'),
    route(
      '/library/videos/$videoId',
      () => <VideoPage {...(video_tabs ? { extra_tabs: video_tabs } : {})} />,
      'library.video.nav_crumb',
    ),
    route('/library/videos/$videoId/edit', VideoFormPage, 'library.video.title_edit'),
  ];
}
