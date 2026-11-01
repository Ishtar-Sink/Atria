import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { ToastRegion, Toast } from '@atria/ui';
import { useMemo, useState, type ReactNode } from 'react';
import { useServerTheme } from '../features/settings/use-user-preferences';
import { createQueryClient } from '../shared/api/query-client';
import { I18nProvider, registerMessages, useT } from '../shared/i18n/i18n';
import commonMessages from '../shared/i18n/pt-br.json';
import { ScreenInfoProvider } from '../shared/layout/screen-info';
import {
  PreferencesProvider,
  type PreferenceValues,
} from '../shared/preferences/preferences-context';
import { useCurrentUser } from '../shared/session/current-user';
import { useToast } from '../shared/toast/toast-store';
import { ThemeProvider } from './theme/theme-provider';

registerMessages('common', commonMessages);

function Toasts() {
  const t = useT();
  const { toasts } = useToast();
  return (
    <ToastRegion>
      {toasts.map((entry) => (
        <Toast key={entry.id} tone={entry.tone}>
          {t(entry.message_key, entry.params)}
        </Toast>
      ))}
    </ToastRegion>
  );
}

/** Aplica a preferência de tema do servidor ao abrir o app (RN-06). */
function ServerTheme() {
  useServerTheme();
  return null;
}

export interface AppProvidersProps {
  children: ReactNode;
  query_client?: QueryClient;
  preferences?: Partial<PreferenceValues>;
}

/** Lê o usuário atual para guardar as preferências do navegador por pessoa. */
function UserPreferences({
  value,
  children,
}: {
  value?: Partial<PreferenceValues>;
  children: ReactNode;
}) {
  const { data: user } = useCurrentUser();
  return (
    <PreferencesProvider {...(value ? { value } : {})} {...(user ? { user_id: user.id } : {})}>
      {children}
    </PreferencesProvider>
  );
}

export function AppProviders({ children, query_client, preferences }: AppProvidersProps) {
  const [own_client] = useState(createQueryClient);
  const client = useMemo(() => query_client ?? own_client, [query_client, own_client]);
  return (
    <QueryClientProvider client={client}>
      <UserPreferences {...(preferences ? { value: preferences } : {})}>
        <I18nProvider>
          <ThemeProvider>
            <ServerTheme />
            <ScreenInfoProvider>
              {children}
              <Toasts />
            </ScreenInfoProvider>
          </ThemeProvider>
        </I18nProvider>
      </UserPreferences>
    </QueryClientProvider>
  );
}
