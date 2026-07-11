import type { GameConfig, Targets } from '../types';

export function getBucketTargetSales(productPrice: number, config: GameConfig): number {
  const bucket = config.goals.priceBuckets.find((item) => item.maxPrice === null || productPrice <= item.maxPrice);
  if (!bucket) {
    throw new Error(`No goal bucket for product price ${productPrice}`);
  }
  return bucket.targetSales;
}

export function calculateTargets(productPrice: number, dreamsList: string[], config: GameConfig): Targets {
  if (productPrice <= 0) return { targetSales: 0, targetRevenue: 0, personalGoal: 0 };

  const bucketTargetSales = getBucketTargetSales(productPrice, config);
  const minimumRevenueSales =
    productPrice <= 5_000 ? Math.ceil(config.goals.lowTicketMinimumRevenue / productPrice) : 0;
  const targetSales = Math.max(bucketTargetSales, minimumRevenueSales);
  const personalGoal = dreamsList.reduce((sum, dreamId) => {
    const dream = config.dreams.find((item) => item.id === dreamId && item.enabled);
    return sum + (dream?.price ?? 0);
  }, 0);

  return {
    targetSales,
    targetRevenue: targetSales * productPrice,
    personalGoal
  };
}
