export interface TestMenuEasterEggConfig {
  requiredClicks: number;
  clickWindowMs: number;
}

export const TEST_MENU_EASTER_EGG_CONFIG: TestMenuEasterEggConfig = {
  requiredClicks: 5,
  clickWindowMs: 2500,
} as const;
