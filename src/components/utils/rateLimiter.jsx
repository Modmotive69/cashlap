// Client-side rate limiter utility
class RateLimiter {
  constructor() {
    this.requests = new Map();
    this.globalLimits = new Map();
    this.RATE_LIMIT_COOLDOWN = 60000; // 60 seconds
  }

  // Per-endpoint rate limiting
  canMakeRequest(endpoint, maxRequests = 10, windowMs = 60000) {
    const now = Date.now();
    const key = endpoint;
    
    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }
    
    const requests = this.requests.get(key);
    
    // Remove old requests outside the window
    while (requests.length > 0 && requests[0] < now - windowMs) {
      requests.shift();
    }
    
    // Check if we can make the request
    if (requests.length >= maxRequests) {
      return false;
    }
    
    // Add current request
    requests.push(now);
    return true;
  }

  // Global rate limiting across all endpoints
  canMakeGlobalRequest(maxRequests = 100, windowMs = 60000) {
    const now = Date.now();
    const key = 'global';
    
    if (!this.globalLimits.has(key)) {
      this.globalLimits.set(key, []);
    }
    
    const requests = this.globalLimits.get(key);
    
    // Remove old requests outside the window
    while (requests.length > 0 && requests[0] < now - windowMs) {
      requests.shift();
    }
    
    // Check if we can make the request
    if (requests.length >= maxRequests) {
      return false;
    }
    
    // Add current request
    requests.push(now);
    return true;
  }

  // NEW: Check if currently rate limited
  isRateLimited() {
    const lastRateLimit = localStorage.getItem('last_rate_limit_time');
    if (!lastRateLimit) return false;
    
    const timeSinceLastLimit = Date.now() - parseInt(lastRateLimit);
    return timeSinceLastLimit < this.RATE_LIMIT_COOLDOWN;
  }

  // NEW: Mark as rate limited
  markRateLimited() {
    localStorage.setItem('last_rate_limit_time', Date.now().toString());
  }

  // NEW: Get cached data
  getCachedData() {
    try {
      const cached = localStorage.getItem('campaign_manager_cache');
      if (!cached) return null;
      
      const data = JSON.parse(cached);
      const now = Date.now();
      
      // Check if cache is still valid (5 minutes)
      if (data.timestamp && (now - data.timestamp) < 300000) {
        return data.data;
      }
      
      // Clear expired cache
      localStorage.removeItem('campaign_manager_cache');
      return null;
    } catch (error) {
      console.error('Error reading cache:', error);
      return null;
    }
  }

  // NEW: Set cached data
  setCachedData(data) {
    try {
      const cacheData = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem('campaign_manager_cache', JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error setting cache:', error);
    }
  }

  // NEW: Clear cached data
  clearCache() {
    localStorage.removeItem('campaign_manager_cache');
  }

  // Get retry delay with exponential backoff
  getRetryDelay(attempt) {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const jitter = Math.random() * 1000;
    
    return Math.min(baseDelay * Math.pow(2, attempt) + jitter, maxDelay);
  }

  // Clean up old entries to prevent memory leaks
  cleanup() {
    const now = Date.now();
    const oldThreshold = 5 * 60 * 1000; // 5 minutes
    
    for (const [key, requests] of this.requests.entries()) {
      const filteredRequests = requests.filter(timestamp => now - timestamp < oldThreshold);
      if (filteredRequests.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, filteredRequests);
      }
    }
    
    for (const [key, requests] of this.globalLimits.entries()) {
      const filteredRequests = requests.filter(timestamp => now - timestamp < oldThreshold);
      if (filteredRequests.length === 0) {
        this.globalLimits.delete(key);
      } else {
        this.globalLimits.set(key, filteredRequests);
      }
    }
  }
}

// Circuit breaker pattern for handling failing services
class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000, monitor = 30000) {
    this.threshold = threshold;
    this.timeout = timeout;
    this.monitor = monitor;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.lastAttemptTime = null;
  }

  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime < this.timeout) {
        throw new Error('Circuit breaker is OPEN - service unavailable');
      } else {
        this.state = 'HALF_OPEN';
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
    }
  }

  getState() {
    return this.state;
  }
}

// Request queue for batching and prioritization
class RequestQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.maxBatchSize = 10;
    this.batchInterval = 100; // ms
  }

  add(request, priority = 0) {
    this.queue.push({ ...request, priority, timestamp: Date.now() });
    this.queue.sort((a, b) => b.priority - a.priority);
    
    if (!this.processing) {
      this.processQueue();
    }
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.maxBatchSize);
      
      try {
        await Promise.all(batch.map(request => this.executeRequest(request)));
      } catch (error) {
        console.error('Batch processing error:', error);
      }
      
      // Small delay between batches to prevent overwhelming
      if (this.queue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, this.batchInterval));
      }
    }
    
    this.processing = false;
  }

  async executeRequest(request) {
    try {
      const result = await request.operation();
      if (request.onSuccess) request.onSuccess(result);
      return result;
    } catch (error) {
      if (request.onError) request.onError(error);
      throw error;
    }
  }
}

// Export singleton instances
export const rateLimiter = new RateLimiter();
export const circuitBreaker = new CircuitBreaker();
export const requestQueue = new RequestQueue();