import { rateLimiter, circuitBreaker } from './rateLimiter';

// Enhanced API wrapper with performance optimizations
export class OptimizedAPIClient {
  constructor() {
    this.cache = new Map();
    this.pendingRequests = new Map();
    this.retryAttempts = new Map();
    this.maxRetries = 3;
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  // Optimized request method with caching, deduplication, and error handling
  async request(operation, options = {}, cacheKey = null) {
    const fullCacheKey = cacheKey || `${operation.name || 'operation'}_${JSON.stringify(options)}`;
    
    // Check cache first
    if (this.cache.has(fullCacheKey) && !options.ignoreCache) {
      const cached = this.cache.get(fullCacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      } else {
        this.cache.delete(fullCacheKey);
      }
    }

    // Check if same request is already pending (deduplication)
    if (this.pendingRequests.has(fullCacheKey)) {
      return this.pendingRequests.get(fullCacheKey);
    }

    // Rate limiting check
    if (!rateLimiter.canMakeRequest(fullCacheKey)) {
      throw new Error(`Rate limit exceeded for ${fullCacheKey}`);
    }

    if (!rateLimiter.canMakeGlobalRequest()) {
      throw new Error('Global rate limit exceeded');
    }

    // Create the request promise
    const requestPromise = this.executeRequestWithRetry(operation, options, fullCacheKey);
    this.pendingRequests.set(fullCacheKey, requestPromise);

    try {
      const result = await requestPromise;
      
      // Cache successful results
      if (!options.skipCache) {
        this.cache.set(fullCacheKey, {
          data: result,
          timestamp: Date.now()
        });
      }

      return result;
    } finally {
      this.pendingRequests.delete(fullCacheKey);
      this.retryAttempts.delete(fullCacheKey);
    }
  }

  async executeRequestWithRetry(operation, options, cacheKey) {
    const attempts = this.retryAttempts.get(cacheKey) || 0;

    try {
      return await circuitBreaker.execute(async () => {
        return await operation();
      });
    } catch (error) {
      if (attempts < this.maxRetries && this.shouldRetry(error)) {
        this.retryAttempts.set(cacheKey, attempts + 1);
        
        const delay = rateLimiter.getRetryDelay(attempts);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return this.executeRequestWithRetry(operation, options, cacheKey);
      }
      
      throw error;
    }
  }

  shouldRetry(error) {
    const retryableErrors = ['RATE_LIMITED', 'SERVER_ERROR', 'TIMEOUT', 'Network Error', 'fetch'];
    return retryableErrors.some(retryable => 
      error.message.includes(retryable) || error.name === 'AbortError'
    );
  }

  // Clear cache when needed
  clearCache(pattern = null) {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  // Get cache statistics
  getCacheStats() {
    return {
      size: this.cache.size,
      pendingRequests: this.pendingRequests.size,
      retryAttempts: this.retryAttempts.size
    };
  }
}

// Memory management utilities
export class MemoryManager {
  constructor() {
    this.observers = new Set();
    this.cleanupTasks = new Set();
    this.memoryThreshold = 50; // MB
  }

  // Monitor memory usage
  startMonitoring() {
    if (!window.performance || !window.performance.memory) {
      console.log('Memory monitoring not available in this browser');
      return;
    }

    const checkMemory = () => {
      const memory = window.performance.memory;
      const usedMB = memory.usedJSHeapSize / 1024 / 1024;
      
      if (usedMB > this.memoryThreshold) {
        this.performCleanup();
      }
    };

    setInterval(checkMemory, 30000); // Check every 30 seconds
  }

  // Register cleanup task
  addCleanupTask(task) {
    this.cleanupTasks.add(task);
  }

  // Perform memory cleanup
  performCleanup() {
    console.log('Performing memory cleanup...');
    
    // Execute cleanup tasks
    for (const task of this.cleanupTasks) {
      try {
        task();
      } catch (error) {
        console.error('Cleanup task error:', error);
      }
    }

    // Clear old cache entries
    const apiClient = window.apiClient;
    if (apiClient) {
      apiClient.clearCache();
    }

    // Clear old localStorage entries
    this.cleanupLocalStorage();

    // Force garbage collection if available
    if (window.gc) {
      window.gc();
    }
  }

  cleanupLocalStorage() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes('_timestamp')) {
        const timestamp = parseInt(localStorage.getItem(key));
        if (now - timestamp > maxAge) {
          const dataKey = key.replace('_timestamp', '');
          localStorage.removeItem(dataKey);
          localStorage.removeItem(key);
          i--; // Adjust index after removal
        }
      }
    }
  }
}

// Performance monitoring
export class PerformanceMonitor {
  constructor() {
    this.metrics = {
      pageLoads: [],
      apiCalls: [],
      renderTimes: [],
      errors: []
    };
  }

  // Track page load performance
  trackPageLoad(pageName) {
    const startTime = performance.now();
    
    return {
      end: () => {
        const duration = performance.now() - startTime;
        this.metrics.pageLoads.push({
          page: pageName,
          duration,
          timestamp: Date.now()
        });
        
        // Keep only last 100 entries
        if (this.metrics.pageLoads.length > 100) {
          this.metrics.pageLoads.shift();
        }
      }
    };
  }

  // Track API call performance
  trackAPICall(endpoint) {
    const startTime = performance.now();
    
    return {
      end: (success = true) => {
        const duration = performance.now() - startTime;
        this.metrics.apiCalls.push({
          endpoint,
          duration,
          success,
          timestamp: Date.now()
        });
        
        if (this.metrics.apiCalls.length > 200) {
          this.metrics.apiCalls.shift();
        }
      }
    };
  }

  // Get performance summary
  getMetrics() {
    return {
      avgPageLoadTime: this.getAverage(this.metrics.pageLoads, 'duration'),
      avgAPICallTime: this.getAverage(this.metrics.apiCalls, 'duration'),
      apiSuccessRate: this.getSuccessRate(this.metrics.apiCalls),
      totalErrors: this.metrics.errors.length
    };
  }

  getAverage(array, key) {
    if (array.length === 0) return 0;
    return array.reduce((sum, item) => sum + item[key], 0) / array.length;
  }

  getSuccessRate(apiCalls) {
    if (apiCalls.length === 0) return 100;
    const successful = apiCalls.filter(call => call.success).length;
    return (successful / apiCalls.length) * 100;
  }
}

// Export singleton instances
export const apiClient = new OptimizedAPIClient();
export const memoryManager = new MemoryManager();
export const performanceMonitor = new PerformanceMonitor();

// Initialize monitoring
memoryManager.startMonitoring();