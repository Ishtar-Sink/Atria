import { describe, expect, it } from 'vitest';
import {
  canChangeInstance,
  canChangeRole,
  canOpenAdmin,
  canResetPassword,
  canToggleActive,
} from './permissions';

const admin = { id: 'a1', role: 'admin' };
const elevated = { id: 'e1', role: 'elevated' };
const user = { id: 'u1', role: 'user' };

describe('admin permissions', () => {
  it('only admin changes roles', () => {
    expect(canChangeRole(admin)).toBe(true);
    expect(canChangeRole(elevated)).toBe(false);
    expect(canChangeRole(user)).toBe(false);
    expect(canChangeRole(undefined)).toBe(false);
    expect(canResetPassword(elevated)).toBe(false);
  });

  it('elevated toggles only user accounts', () => {
    expect(canToggleActive(elevated, user)).toBe(true);
    expect(canToggleActive(elevated, { id: 'e2', role: 'elevated' })).toBe(false);
    expect(canToggleActive(elevated, admin)).toBe(false);
    expect(canToggleActive(admin, user)).toBe(true);
    expect(canToggleActive(admin, elevated)).toBe(true);
    expect(canToggleActive(admin, admin)).toBe(false);
    expect(canToggleActive(user, user)).toBe(false);
    expect(canToggleActive(undefined, user)).toBe(false);
  });

  it('elevated never changes the instance', () => {
    expect(canChangeInstance(admin)).toBe(true);
    expect(canChangeInstance(elevated)).toBe(false);
    expect(canChangeInstance(user)).toBe(false);
  });

  it('opens the admin area only for admin and elevated', () => {
    expect(canOpenAdmin(admin)).toBe(true);
    expect(canOpenAdmin(elevated)).toBe(true);
    expect(canOpenAdmin(user)).toBe(false);
    expect(canOpenAdmin(undefined)).toBe(false);
  });
});
