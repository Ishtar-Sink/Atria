import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { JOURNAL_KEY, type JournalEntry } from './use-journal-entries';

export function useJournalEntry(entry_id: string) {
  return useQuery({
    queryKey: [...JOURNAL_KEY, 'detail', entry_id],
    queryFn: ({ signal }) => api.get<JournalEntry>(`/journal-entries/${entry_id}`, { signal }),
  });
}
