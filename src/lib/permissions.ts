export type Role = 'admin' | 'manager' | 'waiter' | 'kitchen';

export type Area = 'dashboard' | 'orders' | 'kitchen' | 'menu' | 'tables' | 'finance' | 'printing' | 'settings' | 'users' | 'audit';

const MATRIX: Record<Role, Area[]> = {
  admin: ['dashboard', 'orders', 'kitchen', 'menu', 'tables', 'finance', 'printing', 'settings', 'users', 'audit'],
  manager: ['dashboard', 'orders', 'kitchen', 'menu', 'tables', 'finance', 'printing', 'audit'],
  waiter: ['orders', 'tables', 'kitchen'],
  kitchen: ['kitchen', 'orders'],
};

export const can = (role: Role, area: Area) => MATRIX[role]?.includes(area) ?? false;
export const areasOf = (role: Role) => MATRIX[role] ?? [];
export const ROLE_LABEL: Record<Role, string> = { admin: 'Administrador', manager: 'Gerente', waiter: 'Garçom', kitchen: 'Cozinha' };
