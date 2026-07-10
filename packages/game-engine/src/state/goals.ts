import type { GameConfig, SetupInput, Targets } from '../types';

export function getBucketTargetSales(productPrice: number, config: GameConfig): number {
  const bucket = config.goals.priceBuckets.find((item) => item.maxPrice === null || productPrice <= item.maxPrice);
  if (!bucket) {
    throw new Error(`No goal bucket for product price ${productPrice}`);
  }
  return bucket.targetSales;
}

export function calculateTargets(setup: SetupInput, config: GameConfig): Targets {
  const bucketTargetSales = getBucketTargetSales(setup.productPrice, config);
  const minimumRevenueSales =
    setup.productPrice <= 5_000 ? Math.ceil(config.goals.lowTicketMinimumRevenue / setup.productPrice) : 0;
  const targetSales = Math.max(bucketTargetSales, minimumRevenueSales);
  const personalGoal = setup.dreams.reduce((sum, dreamId) => {
    const dream = config.dreams.find((item) => item.id === dreamId && item.enabled);
    return sum + (dream?.price ?? 0);
  }, 0);

  return {
    targetSales,
    targetRevenue: targetSales * setup.productPrice,
    personalGoal
  };
}
