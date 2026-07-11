export class RateLimiter {
  private ipMap = new Map<string, { count: number, resetTime: number }>();
  
  constructor(private readonly limit: number, private readonly windowMs: number) {}

  check(ip: string): { success: boolean; limit: number; remaining: number; reset: number } {
    const now = Date.now();
    const entry = this.ipMap.get(ip);
    
    if (!entry || entry.resetTime <= now) {
      this.ipMap.set(ip, { count: 1, resetTime: now + this.windowMs });
      return { success: true, limit: this.limit, remaining: this.limit - 1, reset: now + this.windowMs };
    }
    
    if (entry.count >= this.limit) {
      return { success: false, limit: this.limit, remaining: 0, reset: entry.resetTime };
    }
    
    entry.count += 1;
    return { success: true, limit: this.limit, remaining: this.limit - entry.count, reset: entry.resetTime };
  }
}

export const globalRateLimiter = new RateLimiter(50, 10000); // 50 requests per 10 seconds per IP
