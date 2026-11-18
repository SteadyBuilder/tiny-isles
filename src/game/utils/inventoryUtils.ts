import { Inventory } from '../../types/game';

/**
 * 인벤토리 수치(목재, 석재, 금화, 고기)가 동일한지 값 비교하는 순수 함수
 */
export function isSameInventory(a: Inventory, b: Inventory): boolean {
  return (
    a.wood === b.wood &&
    a.stone === b.stone &&
    a.gold === b.gold &&
    a.meat === b.meat
  );
}
