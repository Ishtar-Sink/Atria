export type Role = 'admin' | 'elevated' | 'user';

/** Quem usa o app (`GET /me`) ou uma conta da listagem; o servidor devolve o papel como texto. */
export interface Account {
  id: string;
  role: string;
}

export function isAdmin(viewer: Account | undefined): boolean {
  return viewer?.role === 'admin';
}

/** Só o admin mexe nos papéis (RN-12). Estas funções só escondem ações: o servidor recusa. */
export function canChangeRole(viewer: Account | undefined): boolean {
  return isAdmin(viewer);
}

/** O admin age em qualquer conta que não seja a própria; o elevado, só em contas `user`. */
export function canToggleActive(viewer: Account | undefined, target: Account): boolean {
  if (viewer === undefined) return false;
  if (viewer.role === 'admin') return viewer.id !== target.id;
  if (viewer.role === 'elevated') return target.role === 'user';
  return false;
}

/** Só o admin muda as configurações da instância (RN-12). */
export function canChangeInstance(viewer: Account | undefined): boolean {
  return isAdmin(viewer);
}

/** Só o admin gera o link de redefinição de senha. */
export function canResetPassword(viewer: Account | undefined): boolean {
  return isAdmin(viewer);
}

/** `admin` e `elevated` entram na área de administração. */
export function canOpenAdmin(viewer: Account | undefined): boolean {
  return viewer?.role === 'admin' || viewer?.role === 'elevated';
}
