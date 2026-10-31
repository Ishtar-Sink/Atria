export type RouteMeta = {
  title_key: string;
  breadcrumb_key: string;
  /** `bare` é a tela sem sidebar nem topbar (modo leitura e telas de entrada). */
  layout?: 'app' | 'bare';
};

declare module '@tanstack/react-router' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- extensão do tipo da biblioteca
  interface StaticDataRouteOption extends RouteMeta {}
}
