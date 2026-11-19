import type {
  InventoryItemRecord,
  StockMovementRecord,
} from '../types';

export function computeStockQuantity(
  stockId: string,
  movements: StockMovementRecord[]
): number {
  return movements
    .filter(
      (m) =>
        m.stockId === stockId &&
        (m.approvalStatus === 'Not required' || m.approvalStatus === 'Approved')
    )
    .reduce((sum, m) => sum + m.quantityChange, 0);
}

export interface BatchWithQuantity extends InventoryItemRecord {
  quantityOnHand: number;
}

/**
 * First-Expiry, First-Out (FEFO) batch selection.
 * Excludes batches expired on or before the doseDate (YYYY-MM-DD),
 * and excludes batches without enough available stock.
 */
export function selectFefoBatchForDose(
  medicineId: string,
  doseAmount: number,
  doseDateIso: string,
  items: InventoryItemRecord[],
  movements: StockMovementRecord[]
): { batch: BatchWithQuantity | null; totalAvailableNonExpired: number } {
  const doseDay = doseDateIso.slice(0, 10);

  const candidates: BatchWithQuantity[] = items
    .filter((item) => item.medicineId === medicineId && item.expiryDate >= doseDay)
    .map((item) => ({
      ...item,
      quantityOnHand: computeStockQuantity(item.stockId, movements),
    }))
    .filter((b) => b.quantityOnHand > 0)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

  const totalAvailableNonExpired = candidates.reduce((s, b) => s + b.quantityOnHand, 0);
  const matching = candidates.find((b) => b.quantityOnHand >= doseAmount) || null;

  return { batch: matching, totalAvailableNonExpired };
}

export function canApproveStockMovement(
  movement: StockMovementRecord,
  approverUserId: string
): { allowed: boolean; error?: string } {
  if (movement.approvalStatus !== 'Pending') {
    return { allowed: false, error: 'Only Pending stock movements can be approved or rejected.' };
  }
  if (movement.performedBy === approverUserId) {
    return { allowed: false, error: 'You cannot approve your own stock adjustment, disposal, or damage write-off.' };
  }
  return { allowed: true };
}
