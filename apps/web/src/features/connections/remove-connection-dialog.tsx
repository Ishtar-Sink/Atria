import { ConfirmDialog } from '@atria/ui';
import { useT } from '../../shared/i18n/i18n';
import type { ConnectionItem } from './use-connections';

export interface RemoveConnectionDialogProps {
  /** A ligação a remover; `null` mantém o diálogo fechado. */
  item: ConnectionItem | null;
  onConfirm: (item: ConnectionItem) => void;
  onCancel: () => void;
}

/** Confirmação da remoção: a ligação some dos dois lados (RN-10). */
export function RemoveConnectionDialog({ item, onConfirm, onCancel }: RemoveConnectionDialogProps) {
  const t = useT();
  return (
    <ConfirmDialog
      open={item !== null}
      title={t('connections.remove_title')}
      description={t('connections.remove_confirm', { title: item?.title ?? '' })}
      confirmLabel={t('connections.remove_action')}
      cancelLabel={t('common.cancel')}
      onConfirm={() => {
        if (item) onConfirm(item);
      }}
      onCancel={onCancel}
    />
  );
}
