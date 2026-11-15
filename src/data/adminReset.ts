export interface AdminResetConfig {
  requiredClicks: number;
  clickWindowMs: number;
  worldId: string;
  defaultPasscodeHash: string;
}

export const ADMIN_RESET_CONFIG: AdminResetConfig = {
  requiredClicks: 7,
  clickWindowMs: 3000,
  worldId: 'main_world',
  // SHA-256 digest of default admin reset code (override via VITE_ADMIN_RESET_CODE)
  defaultPasscodeHash: '7f66e9ccdd6fba04ec04c65b4a0bee1d9cf2dd9832bad17cbe5b5271939e6051',
} as const;
