export const SWITCHABLE_USER_ROLES = ['promoter', 'marketer', 'marketing_rep'];

export const isSwitchableUserRole = (role) => SWITCHABLE_USER_ROLES.includes(role);
