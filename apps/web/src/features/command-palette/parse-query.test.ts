import { describe, expect, it } from 'vitest';
import { parseQuery } from './parse-query';

describe('parseQuery', () => {
  it('treats a leading greater than as actions only', () => {
    expect(parseQuery('> criar')).toEqual({ mode: 'actions', term: 'criar' });
    expect(parseQuery('>')).toEqual({ mode: 'actions', term: '' });
  });

  it('treats a leading hash as tags only', () => {
    expect(parseQuery('#saude')).toEqual({ mode: 'tags', term: 'saude' });
    expect(parseQuery('  #casa  ')).toEqual({ mode: 'tags', term: 'casa' });
  });

  it('treats free text as a search in everything', () => {
    expect(parseQuery('  viagem a Lisboa ')).toEqual({ mode: 'all', term: 'viagem a Lisboa' });
    expect(parseQuery('')).toEqual({ mode: 'all', term: '' });
  });
});
