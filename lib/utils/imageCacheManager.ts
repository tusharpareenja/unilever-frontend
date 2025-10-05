// === Image Cache Manager ===
// Centralized image preloading and cache management for the participate flow

interface CacheEntry {
  url: string
  loaded: boolean
  timestamp: number
  taskId?: string
  error?: string
  note?: string
}

interface PreloadProgress {
  total: number
  loaded: number
  failed: number
}

class ImageCacheManager {
  private cache = new Map<string, CacheEntry>()
  private loadingPromises = new Map<string, Promise<void>>()
  private preloadProgress: PreloadProgress = { total: 0, loaded: 0, failed: 0 }
  private isPreloading = false
  private preloadStartTime = 0

  // Check if images are already cached/preloaded
  isPreloaded(url: string): boolean {
    const entry = this.cache.get(url)
    return entry?.loaded === true
  }

  // Check if preloading is in progress
  isPreloadingInProgress(): boolean {
    return this.isPreloading
  }

  // Get preload progress
  getPreloadProgress(): PreloadProgress {
    return { ...this.preloadProgress }
  }

  // Get preload duration
  getPreloadDuration(): number {
    return this.preloadStartTime > 0 ? Date.now() - this.preloadStartTime : 0
  }

  // Preload a single image with CORS handling and fallback strategies
  private async preloadImage(url: string, priority: 'critical' | 'high' | 'low' = 'high'): Promise<void> {
    if (this.cache.has(url)) {
      const entry = this.cache.get(url)!
      if (entry.loaded) return
    }

    if (this.loadingPromises.has(url)) {
      return this.loadingPromises.get(url)!
    }

    const promise = new Promise<void>((resolve) => {
      this.attemptImagePreload(url, priority)
        .then(() => {
          this.preloadProgress.loaded++
          console.log(`✅ Preloaded image: ${url.substring(url.lastIndexOf('/') + 1)}`)
          resolve()
        })
        .catch(error => {
          this.cache.set(url, {
            url,
            loaded: false,
            timestamp: Date.now(),
            error: error.message
          })
          this.preloadProgress.failed++
          console.warn(`❌ Failed to preload image: ${url}`, error.message)
          resolve() // Don't block on errors
        })
    })

    this.loadingPromises.set(url, promise)
    await promise
    this.loadingPromises.delete(url)
  }

  // Attempt image preload with multiple strategies for CORS handling
  private async attemptImagePreload(url: string, priority: string): Promise<void> {
    const isAzure = url.includes('blob.core.windows.net')
    const isDev = typeof window !== 'undefined' && location.hostname === 'localhost'
    // Order strategies to minimize noisy CORS failures in dev for Azure
    const strategies = isAzure && isDev
      ? [
          // Prefer no-cors first locally where CORS isn't configured on storage
          () => this.fetchWithoutCors(url),
          // Fallback to image element load (still caches at browser level)
          () => this.preloadWithImageElement(url),
          // Last resort: try full CORS fetch
          () => this.fetchWithCors(url),
        ]
      : [
          // Default: try CORS first
          () => this.fetchWithCors(url),
          () => this.fetchWithoutCors(url),
          () => this.preloadWithImageElement(url),
        ]

    let lastError: Error | null = null

    for (const [index, strategy] of strategies.entries()) {
      try {
        console.log(`🔄 Trying preload strategy ${index + 1} for: ${url.substring(url.lastIndexOf('/') + 1)}`)
        await strategy()
        
        // Success - strategies already set cache appropriately
        return
      } catch (error) {
        lastError = error as Error
        console.warn(`⚠️ Strategy ${index + 1} failed:`, error)
        
        // If this is a CORS error and we're in development, try the next strategy
        if (error instanceof TypeError && error.message.includes('CORS')) {
          console.log(`🔄 CORS error detected, trying next strategy...`)
          continue
        }
        
        // For other errors, break and try next strategy
        continue
      }
    }

    // All strategies failed
    throw lastError || new Error('All preload strategies failed')
  }

  // Strategy 1: Standard CORS fetch
  private async fetchWithCors(url: string): Promise<void> {
    // Special-case Azure Storage: avoid blob conversion; rely on browser cache
    if (url.includes('blob.core.windows.net')) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)
      try {
        const response = await fetch(url, {
          method: 'GET',
          mode: 'cors',
          cache: 'force-cache',
          signal: controller.signal,
          headers: {
            'Accept': 'image/*',
          }
        })
        clearTimeout(timeout)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        // Ensure body is read so browser caches it
        try {
          await response.blob()
        } catch {}
        this.cache.set(url, {
          url: url,
          loaded: true,
          timestamp: Date.now(),
          note: 'azure-direct',
        })
        try {
          await this.predecodeImage(url)
        } catch {}
        return
      } finally {
        clearTimeout(timeout)
      }
    }

    // Default: CORS GET and blob caching
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000) // 15s timeout
    try {
      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        cache: 'force-cache',
        signal: controller.signal,
        headers: {
          'Accept': 'image/*',
        }
      })
      clearTimeout(timeout)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      this.cache.set(url, {
        url: objectUrl,
        loaded: true,
        timestamp: Date.now()
      })
      try {
        await this.predecodeImage(objectUrl)
      } catch {}
    } finally {
      clearTimeout(timeout)
    }
  }

  // Strategy 2: No-cors mode (for development with CORS issues)
  private async fetchWithoutCors(url: string): Promise<void> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000) // 15s timeout
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        mode: 'no-cors',
        cache: 'force-cache',
        signal: controller.signal
      })
      
      clearTimeout(timeout)
      
      // In no-cors mode, we can't read the response, but we can check if it succeeded
      if (response.type === 'opaque') {
        // Opaque response means the request succeeded but we can't read the content
        // This is acceptable for preloading purposes
        this.cache.set(url, {
          url: url, // Use original URL since we can't create object URL
          loaded: true,
          timestamp: Date.now(),
          note: 'no-cors mode'
        })
        // Warm-decode using the original URL to eliminate decode time later
        try {
          await this.predecodeImage(url)
        } catch {}
        return
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      
      this.cache.set(url, {
        url: objectUrl,
        loaded: true,
        timestamp: Date.now()
      })
      // Warm-decode the image so it renders instantly when used
      try {
        await this.predecodeImage(objectUrl)
      } catch {}

      // Warm-decode the image so it renders instantly when used
      try {
        await this.predecodeImage(objectUrl)
      } catch {}
    } finally {
      clearTimeout(timeout)
    }
  }

  // Strategy 3: Image element preload (fallback for CORS issues)
  private async preloadWithImageElement(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const timeout = setTimeout(() => {
        reject(new Error('Image preload timeout'))
      }, 15000) // 15s timeout
      
      img.onload = () => {
        clearTimeout(timeout)
        this.cache.set(url, {
          url: url, // Use original URL
          loaded: true,
          timestamp: Date.now(),
          note: 'image element preload'
        })
        resolve()
      }
      
      img.onerror = (error) => {
        clearTimeout(timeout)
        reject(new Error('Image failed to load'))
      }
      
      // Set crossOrigin to handle CORS
      img.crossOrigin = 'anonymous'
      img.src = url
    })
  }

  // Public: Preload and warm-decode a set of URLs (idempotent)
  async prewarmUrls(urls: string[], priority: 'critical' | 'high' | 'low' = 'high'): Promise<void> {
    if (!Array.isArray(urls) || urls.length === 0) return
    const unique = [...new Set(urls.filter(Boolean))]
    // Ensure they are preloaded
    await this.preloadImages(unique, priority)
    // Warm-decode whatever is in cache (blob: or original URL)
    await Promise.all(
      unique.map(async (original) => {
        const entry = this.cache.get(original)
        if (!entry || !entry.url) return
        try {
          await this.predecodeImage(entry.url)
        } catch {}
      })
    )
  }

  // Decode cached object URLs off-DOM to remove decode time at display
  private async predecodeImage(objectUrl: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('predecode failed'))
      // decode() is supported in modern browsers; fall back to onload
      try {
        img.src = objectUrl
        if (typeof (img as any).decode === 'function') {
          ;(img as any).decode().then(() => resolve()).catch(() => resolve())
        }
      } catch {
        // Best-effort only
        resolve()
      }
    })
  }

  // Preload multiple images with batching for performance
  async preloadImages(urls: string[], priority: 'critical' | 'high' | 'low' = 'high'): Promise<void> {
    const uniqueUrls = [...new Set(urls)].filter(url => !this.isPreloaded(url))
    if (uniqueUrls.length === 0) return

    this.preloadProgress.total += uniqueUrls.length

    // Batch loading for better performance
    const batchSize = 6 // Limit concurrent loads
    const batches: string[][] = []
    
    for (let i = 0; i < uniqueUrls.length; i += batchSize) {
      batches.push(uniqueUrls.slice(i, i + batchSize))
    }

    for (const batch of batches) {
      await Promise.all(batch.map(url => this.preloadImage(url, priority)))
    }
  }

  // Extract image URLs from tasks (handles both raw and processed task structures)
  extractImageUrls(tasks: any[]): string[] {
    const urls: string[] = []
    
    tasks.forEach(task => {
      // Handle processed task structure (already has layeredImages, gridUrls, etc.)
      if (task.layeredImages?.length) {
        task.layeredImages.forEach((img: any) => {
          if (img.url) urls.push(img.url)
        })
      }
      
      if (task.gridUrls?.length) {
        urls.push(...task.gridUrls.filter(Boolean))
      }
      
      if (task.leftImageUrl) urls.push(task.leftImageUrl)
      if (task.rightImageUrl) urls.push(task.rightImageUrl)

      // Handle raw task structure (elements_shown, elements_shown_content)
      if (task.elements_shown) {
        const shown = task.elements_shown
        const content = task.elements_shown_content
        
        // For layer/grid studies with elements_shown present
        // Consider only base keys (exclude *_content) for activation flags
        const activeBaseKeys = Object.keys(shown).filter((k) => !k.endsWith('_content') && Number(shown[k]) === 1)
        activeBaseKeys.forEach((k) => {
            // Prefer content object when available
            const fromContent = content?.[k]
            if (fromContent && typeof fromContent === 'object' && typeof fromContent.url === 'string') {
              urls.push(fromContent.url)
            }
            const fromContent2 = content?.[`${k}_content`]
            if (fromContent2 && typeof fromContent2 === 'object' && typeof fromContent2.url === 'string') {
              urls.push(fromContent2.url)
            }

            // If elements_shown_content is missing, some backends place direct URLs under *_content inside elements_shown itself
            const directFromShown = (shown as any)[`${k}_content`]
            if (typeof directFromShown === 'string' && directFromShown.startsWith('http')) {
              urls.push(directFromShown)
            }
        })

        // For grid studies (support 1 / '1' / true)
        const isActive = (v: unknown) => v === 1 || v === '1' || v === true
        const activeKeys = Object.keys(shown).filter((k) => isActive((shown as any)[k]))
        const safeContent: Record<string, any> = (content && typeof content === 'object') ? (content as any) : {}
        activeKeys.forEach((k) => {
          const directUrl = (shown as any)[`${k}_content`]
          if (typeof directUrl === 'string' && directUrl.startsWith('http')) {
            urls.push(directUrl)
          }
          
          const contentItem = safeContent[k]
          if (contentItem && typeof contentItem === 'object' && contentItem.url) {
            urls.push(contentItem.url)
          }
          
          const contentItem2 = safeContent[`${k}_content`]
          if (contentItem2 && typeof contentItem2 === 'object' && contentItem2.url) {
            urls.push(contentItem2.url)
          }
          if (typeof contentItem2 === 'string' && contentItem2.startsWith('http')) {
            urls.push(contentItem2)
          }
        })

        // Fallbacks
        // 1) Scan content object for any url fields
        if (urls.length === 0 && content && typeof content === 'object') {
          Object.values(content).forEach((v: any) => {
            if (v && typeof v === 'object' && typeof v.url === 'string') urls.push(v.url)
            if (typeof v === 'string' && v.startsWith('http')) urls.push(v)
          })
        }
        // 2) If content missing, scan elements_shown itself for any *_content: "http..." entries
        if (urls.length === 0 && shown && typeof shown === 'object') {
          Object.entries(shown as Record<string, any>).forEach(([key, val]) => {
            if (typeof val === 'string' && key.endsWith('_content') && val.startsWith('http')) {
              urls.push(val)
            }
          })
        }
      }
    })

    const uniqueUrls = [...new Set(urls)].filter(url => url && url.startsWith('http'))
    console.log(`🔍 Extracted ${uniqueUrls.length} image URLs from ${tasks.length} tasks`)
    if (uniqueUrls.length > 0) {
      console.log('📸 Sample URLs:', uniqueUrls.slice(0, 3))
    }
    
    return uniqueUrls
  }

  // Smart preload: preload all task images with progress tracking
  async preloadAllTaskImages(tasks: any[]): Promise<void> {
    if (this.isPreloading) {
      console.log('Preloading already in progress, skipping...')
      return
    }

    this.isPreloading = true
    this.preloadStartTime = Date.now()
    this.preloadProgress = { total: 0, loaded: 0, failed: 0 }

    try {
      // Debug: log task structure
      console.log('🔍 Task structure debug:')
      if (tasks.length > 0) {
        const firstTask = tasks[0]
        console.log('📋 First task keys:', Object.keys(firstTask))
        console.log('📋 Has elements_shown:', !!firstTask.elements_shown)
        console.log('📋 Has elements_shown_content:', !!firstTask.elements_shown_content)
        if (firstTask.elements_shown) {
          console.log('📋 elements_shown keys:', Object.keys(firstTask.elements_shown))
        }
        if (firstTask.elements_shown_content) {
          console.log('📋 elements_shown_content keys:', Object.keys(firstTask.elements_shown_content))
        }
      }

      const urls = this.extractImageUrls(tasks)
      console.log(`Starting preload of ${urls.length} images for ${tasks.length} tasks`)
      
      if (urls.length === 0) {
        console.warn('⚠️ No image URLs found in tasks!')
        return
      }
      
      await this.preloadImages(urls, 'high')
      
      const duration = this.getPreloadDuration()
      console.log(`Preload completed in ${duration}ms: ${this.preloadProgress.loaded}/${this.preloadProgress.total} loaded`)
    } catch (error) {
      console.error('Preload failed:', error)
    } finally {
      this.isPreloading = false
    }
  }

  // Get cache statistics
  getCacheStats(): { total: number; loaded: number; failed: number; size: number } {
    const entries = Array.from(this.cache.values())
    return {
      total: entries.length,
      loaded: entries.filter(e => e.loaded).length,
      failed: entries.filter(e => !e.loaded).length,
      size: this.cache.size
    }
  }

  // Clear cache (call on thank-you page)
  clearCache(): void {
    console.log('Clearing image cache...')
    
    // Clean up object URLs to prevent memory leaks
    this.cache.forEach(entry => {
      if (entry.url.startsWith('blob:')) {
        URL.revokeObjectURL(entry.url)
      }
    })
    
    this.cache.clear()
    this.loadingPromises.clear()
    this.preloadProgress = { total: 0, loaded: 0, failed: 0 }
    this.isPreloading = false
    this.preloadStartTime = 0
    console.log('✅ Image cache cleared')
  }

  // Get cached URLs for debugging
  getCachedUrls(): string[] {
    return Array.from(this.cache.keys())
  }

  // Debug method to log cache status
  logCacheStatus(): void {
    const stats = this.getCacheStats()
    console.log(`📊 Cache Status: ${stats.loaded}/${stats.total} loaded, ${stats.failed} failed, ${stats.size} total`)
    console.log('🔗 Cached URLs:', this.getCachedUrls().slice(0, 5), this.getCachedUrls().length > 5 ? '...' : '')
    
    // Log failed URLs with error details
    const failedEntries = Array.from(this.cache.entries()).filter(([_, entry]) => !entry.loaded)
    if (failedEntries.length > 0) {
      console.log('❌ Failed URLs:')
      failedEntries.forEach(([url, entry]) => {
        console.log(`  - ${url.substring(url.lastIndexOf('/') + 1)}: ${entry.error || 'Unknown error'}`)
      })
    }
  }

  // Get detailed error information for debugging
  getErrorDetails(): { url: string; error: string; note?: string }[] {
    return Array.from(this.cache.entries())
      .filter(([_, entry]) => !entry.loaded)
      .map(([url, entry]) => ({
        url,
        error: entry.error || 'Unknown error',
        note: entry.note
      }))
  }

  // Test method to manually trigger preloading
  async testPreload(urls: string[]): Promise<void> {
    console.log('🧪 Testing preload with URLs:', urls)
    await this.preloadImages(urls, 'high')
    this.logCacheStatus()
  }

  // Test method to debug URL extraction
  testExtractUrls(tasks: any[]): string[] {
    console.log('🧪 Testing URL extraction with tasks:', tasks.length)
    const urls = this.extractImageUrls(tasks)
    console.log('🧪 Extracted URLs:', urls)
    return urls
  }

  // Check if we should skip preloading due to CORS issues in development
  shouldSkipPreloading(): boolean {
    // In development, if we have many CORS errors, we might want to skip preloading
    const errorDetails = this.getErrorDetails()
    const corsErrors = errorDetails.filter(error => 
      error.error.includes('CORS') || 
      error.error.includes('Failed to fetch') ||
      error.error.includes('blocked by CORS policy')
    )
    
    // If more than 50% of attempts result in CORS errors, suggest skipping
    const totalAttempts = this.preloadProgress.total
    const corsErrorRate = totalAttempts > 0 ? corsErrors.length / totalAttempts : 0
    
    if (corsErrorRate > 0.5) {
      console.warn(`⚠️ High CORS error rate (${(corsErrorRate * 100).toFixed(1)}%), consider skipping preloading in development`)
      return true
    }
    
    return false
  }

  // Get a fallback URL for failed images (placeholder or alternative)
  getFallbackUrl(originalUrl: string): string {
    // For now, return the original URL - the browser will handle the fallback
    // In the future, you could implement placeholder images or alternative sources
    return originalUrl
  }

  // Check if an image is available (either cached or fallback)
  isImageAvailable(url: string): boolean {
    const entry = this.cache.get(url)
    if (!entry) return false
    
    // If it's loaded, it's available
    if (entry.loaded) return true
    
    // If it failed but we have a fallback, it's still available
    return true // We'll use the original URL as fallback
  }

  // Get the cached URL for display (returns cached object URL if available, otherwise original URL)
  getCachedUrl(originalUrl: string): string {
    if (!originalUrl || typeof originalUrl !== 'string') {
      console.warn('getCachedUrl called with invalid input:', originalUrl)
      return '/placeholder.svg'
    }
    
    const entry = this.cache.get(originalUrl)
    if (entry && entry.loaded && entry.url) {
      // Return the cached object URL if available
      return entry.url
    }
    // Fallback to original URL
    return originalUrl
  }

  // Get cached URLs for multiple images
  getCachedUrlsForImages(originalUrls: string[]): string[] {
    if (!originalUrls || !Array.isArray(originalUrls)) {
      console.warn('getCachedUrlsForImages called with invalid input:', originalUrls)
      return []
    }
    return originalUrls.map(url => this.getCachedUrl(url))
  }
}

// Global instance
export const imageCacheManager = new ImageCacheManager()

// Make it available globally for testing
if (typeof window !== 'undefined') {
  (window as any).imageCacheManager = imageCacheManager
  console.log('🔧 imageCacheManager available globally for testing')
}

// React hook for using the cache manager
export function useImageCache() {
  return {
    isPreloaded: (url: string) => imageCacheManager.isPreloaded(url),
    isPreloading: () => imageCacheManager.isPreloadingInProgress(),
    getProgress: () => imageCacheManager.getPreloadProgress(),
    getDuration: () => imageCacheManager.getPreloadDuration(),
    preloadImages: (urls: string[]) => imageCacheManager.preloadImages(urls),
    preloadAllTasks: (tasks: any[]) => imageCacheManager.preloadAllTaskImages(tasks),
    clearCache: () => imageCacheManager.clearCache(),
    getStats: () => imageCacheManager.getCacheStats()
  }
}
