import { ErrorState } from '@atria/ui';
import { useParams } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { ConnectionsSummary } from '../features/connections/connections-summary';
import { ConnectionsTab } from '../features/connections/connections-tab';
import { HighlightsTab } from '../features/reader/highlights-tab';
import { registerMessages, translate, useT } from '../shared/i18n/i18n';
import { entityRouteOf, type EntityRoute, type EntityRoutePath } from './entity-types';
import messages from './i18n/entity-layout.pt-br.json';

registerMessages('entity_layout', messages);

export type EntityTabKind = 'connections' | 'highlights';

/** Aba extra no formato que as telas das features recebem; `render` lê o id da URL. */
export interface EntityExtraTab {
  id: EntityTabKind;
  label: string;
  render: () => ReactNode;
}

function useEntityId(param: string): string | undefined {
  return useParams({
    strict: false,
    select: (params: Record<string, unknown>) => {
      const value = params[param];
      return typeof value === 'string' && value !== '' ? value : undefined;
    },
  });
}

export interface EntityLayoutProps {
  entry: EntityRoute;
  tab: EntityTabKind;
}

/**
 * Conteúdo de uma aba que o app acrescenta à tela da entidade (RF-21): sem cabeçalho nem
 * controle de visibilidade, que são da tela da feature (PD-14, DEC-006).
 */
export function EntityLayout({ entry, tab }: EntityLayoutProps) {
  const t = useT();
  const entity_id = useEntityId(entry.param);
  if (!entity_id) return <ErrorState title={t('entity_layout.missing_entity')} />;
  if (tab === 'highlights' && (entry.entity_type === 'book' || entry.entity_type === 'article')) {
    return <HighlightsTab item_type={entry.entity_type} item_id={entity_id} />;
  }
  return <ConnectionsTab entity_type={entry.entity_type} entity_id={entity_id} />;
}

function extraTab(entry: EntityRoute, tab: EntityTabKind): EntityExtraTab {
  return {
    id: tab,
    label: translate(`entity_layout.${tab}`),
    render: () => <EntityLayout entry={entry} tab={tab} />,
  };
}

/** Abas extras da rota: Conexões em toda entidade e, antes dela, Destaques em livro e artigo. */
export function entityExtraTabs(path: EntityRoutePath): EntityExtraTab[] {
  const entry = entityRouteOf(path);
  if (entry.layout === 'none') return [];
  const reads = entry.entity_type === 'book' || entry.entity_type === 'article';
  return [...(reads ? [extraTab(entry, 'highlights')] : []), extraTab(entry, 'connections')];
}

/** Cartão "Ligações" da visão geral do projeto (PD-42). */
export function projectLinksSlot(project: { id: string }): ReactNode {
  return <ConnectionsSummary entity_type="project" entity_id={project.id} limit={5} />;
}
