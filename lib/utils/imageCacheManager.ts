/* eslint-disable @typescript-eslint/no-explicit-any */
// === Image Cache Manager ===
//
// Lean preloader for the participate flow.
//
// Design goal (mobile-first):
//   - DO NOT hold image bytes in the JS heap as Blob/ObjectURL. On a phone
//     a 50-image high-quality PNG study would otherwise pin 100-250 MB in JS
//     memory and crash the WebView with the iOS "A problem repeatedly
//     occurred" tab-killer.
//   - DO populate the browser's built-in HTTP cache (disk + memory) so that
//     when a real <img src={url}> is later mounted, the bytes are served
//     instantly with no network round-trip and the JS heap stays empty.
//   - DO NOT force-decode every image up front. Decoded bitmaps are huge
//     (width * height * 4 bytes). Decoding is left to whoever actually
//     mounts the <img>, or to the on-demand `decodeUrls` helper which the
//     tasks page uses for the current + next task only.
//
// All public method signatures from the previous implementation are kept so
// callers (personal-information page, classification-questions page, tasks
// page, etc.) do not need any changes.

interface CacheEntry {
  loaded: boolean
  timestamp: number
  error?: string
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

  isPreloaded(url: string): boolean {
    const entry = this.cache.get(url)
    return entry?.loaded === true
  }

  isPreloadingInProgress(): boolean {
    return this.isPreloading
  }

  getPreloadProgress(): PreloadProgress {
    return { ...this.preloadProgress }
  }

  getPreloadDuration(): number {
    return this.preloadStartTime > 0 ? Date.now() - this.preloadStartTime : 0
  }

  // Preload one URL by injecting <link rel="preload" as="image"> into <head>.
  //
  // This is the only preload mechanism that provably does NOT decode the
  // image. `new Image(); img.src = url` causes mobile Safari to decode the
  // PNG into a full-size bitmap and pin it in the browser image cache, which
  // is what was crashing 80-task layer studies with large PNGs. A link
  // preload only triggers the HTTP fetch; the bytes land in the disk cache
  // and the decode happens later, on demand, when a real <img src={url}> is
  // mounted by the tasks page.
  //
  // The <link> element is removed from <head> as soon as the fetch completes
  // because we no longer need a reference to it; the HTTP cache holds the
  // bytes.
  private preloadImage(url: string, priority: 'critical' | 'high' | 'low' = 'high'): Promise<void> {
    if (!url || typeof url !== 'string') return Promise.resolve()
    if (typeof document === 'undefined') return Promise.resolve()

    const existing = this.cache.get(url)
    if (existing?.loaded) return Promise.resolve()

    const inFlight = this.loadingPromises.get(url)
    if (inFlight) return inFlight

    const promise = new Promise<void>((resolve) => {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.as = 'image'
      link.href = url
      try {
        ;(link as any).fetchPriority =
          priority === 'critical' ? 'high' : priority === 'low' ? 'low' : 'high'
      } catch { /* not supported on older browsers */ }
      // Intentionally NOT setting crossOrigin. Some Azure Storage buckets do
      // not advertise CORS headers, and CORS-mode failure prevents the
      // response from entering the cache. We only need to display the bytes
      // later via <img>, not read pixels via canvas.

      let settled = false
      const cleanup = () => {
        if (link.parentNode) link.parentNode.removeChild(link)
      }

      const timeout = setTimeout(() => {
        if (settled) return
        settled = true
        this.cache.set(url, { loaded: false, timestamp: Date.now(), error: 'timeout' })
        this.preloadProgress.failed++
        cleanup()
        resolve()
      }, 20000)

      link.onload = () => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        this.cache.set(url, { loaded: true, timestamp: Date.now() })
        this.preloadProgress.loaded++
        cleanup()
        resolve()
      }

      link.onerror = () => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        this.cache.set(url, { loaded: false, timestamp: Date.now(), error: 'load failed' })
        this.preloadProgress.failed++
        cleanup()
        resolve()
      }

      try {
        document.head.appendChild(link)
      } catch {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        this.cache.set(url, { loaded: false, timestamp: Date.now(), error: 'append failed' })
        this.preloadProgress.failed++
        resolve()
      }
    })

    this.loadingPromises.set(url, promise)
    promise.finally(() => this.loadingPromises.delete(url))
    return promise
  }

  // Public: download a set of URLs into the browser HTTP cache.
  // Compatible with the previous implementation's signature.
  async prewarmUrls(urls: string[], priority: 'critical' | 'high' | 'low' = 'high'): Promise<void> {
    if (!Array.isArray(urls) || urls.length === 0) return
    const unique = [...new Set(urls.filter(Boolean))]
    await this.preloadImages(unique, priority)
  }

  // Public: download many images, throttled to avoid saturating a mobile
  // connection or hitting per-host socket limits.
  async preloadImages(urls: string[], priority: 'critical' | 'high' | 'low' = 'high'): Promise<void> {
    const uniqueUrls = [...new Set(urls)].filter((url) => url && !this.isPreloaded(url))
    if (uniqueUrls.length === 0) return

    this.preloadProgress.total += uniqueUrls.length

    // 4-at-a-time is friendly to mobile (browsers cap ~6 connections per
    // origin, and we want some headroom for other resources).
    const batchSize = 4

    for (let i = 0; i < uniqueUrls.length; i += batchSize) {
      const batch = uniqueUrls.slice(i, i + batchSize)
      await Promise.all(batch.map((url) => this.preloadImage(url, priority)))
    }
  }

  // Public: ensure a small set of URLs is in the browser HTTP cache.
  //
  // Despite the name kept for backward compatibility, this no longer forces
  // a decode. Forcing decode for high-resolution PNGs on mobile is what was
  // pinning hundreds of MB of bitmaps and crashing the tab. Instead we just
  // make sure the bytes are downloaded; the actual decode happens when the
  // <img> mounts, at which point the browser decodes from the disk cache
  // very quickly without holding the bitmap permanently.
  async decodeUrls(urls: string[]): Promise<void> {
    return this.prewarmUrls(urls, 'high')
  }

  // Extract image URLs from tasks (handles both raw and processed task structures).
  // Logic unchanged from the previous implementation.
  extractImageUrls(tasks: any[]): string[] {
    const urls: string[] = []

    tasks.forEach((task) => {
      // Processed task shape
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

      // Raw task shape
      if (task.elements_shown) {
        const shown = task.elements_shown
        const content = task.elements_shown_content

        const activeBaseKeys = Object.keys(shown).filter(
          (k) => !k.endsWith('_content') && Number(shown[k]) === 1,
        )
        activeBaseKeys.forEach((k) => {
          const fromContent = content?.[k]
          if (fromContent && typeof fromContent === 'object') {
            if (typeof (fromContent as any).url === 'string') {
              urls.push((fromContent as any).url)
            } else if (typeof (fromContent as any).content === 'string') {
              urls.push((fromContent as any).content)
            }
          }
          const fromContent2 = content?.[`${k}_content`]
          if (fromContent2 && typeof fromContent2 === 'object') {
            if (typeof (fromContent2 as any).url === 'string') {
              urls.push((fromContent2 as any).url)
            } else if (typeof (fromContent2 as any).content === 'string') {
              urls.push((fromContent2 as any).content)
            }
          }

          const directFromShown = (shown as any)[`${k}_content`]
          if (typeof directFromShown === 'string' && directFromShown.startsWith('http')) {
            urls.push(directFromShown)
          }
        })

        const isActive = (v: unknown) => v === 1 || v === '1' || v === true
        const activeKeys = Object.keys(shown).filter((k) => isActive((shown as any)[k]))
        const safeContent: Record<string, any> =
          content && typeof content === 'object' ? (content as any) : {}
        activeKeys.forEach((k) => {
          const directUrl = (shown as any)[`${k}_content`]
          if (typeof directUrl === 'string' && directUrl.startsWith('http')) {
            urls.push(directUrl)
          }

          const contentItem = safeContent[k]
          if (contentItem && typeof contentItem === 'object') {
            if ((contentItem as any).url) {
              urls.push((contentItem as any).url)
            } else if (
              (contentItem as any).content &&
              typeof (contentItem as any).content === 'string'
            ) {
              urls.push((contentItem as any).content)
            }
          }

          const contentItem2 = safeContent[`${k}_content`]
          if (contentItem2 && typeof contentItem2 === 'object') {
            if ((contentItem2 as any).url) {
              urls.push((contentItem2 as any).url)
            } else if (
              (contentItem2 as any).content &&
              typeof (contentItem2 as any).content === 'string'
            ) {
              urls.push((contentItem2 as any).content)
            }
          }
          if (typeof contentItem2 === 'string' && contentItem2.startsWith('http')) {
            urls.push(contentItem2)
          }
        })

        if (urls.length === 0 && content && typeof content === 'object') {
          Object.values(content).forEach((v: any) => {
            if (v && typeof v === 'object') {
              if (typeof v.url === 'string') urls.push(v.url)
              if (typeof v.content === 'string') urls.push(v.content)
            }
            if (typeof v === 'string' && v.startsWith('http')) urls.push(v)
          })
        }
        if (urls.length === 0 && shown && typeof shown === 'object') {
          Object.entries(shown as Record<string, any>).forEach(([key, val]) => {
            if (typeof val === 'string' && key.endsWith('_content') && val.startsWith('http')) {
              urls.push(val)
            }
          })
        }
      }
    })

    const uniqueUrls = [...new Set(urls)].filter((url) => url && url.startsWith('http'))
    console.log(`Extracted ${uniqueUrls.length} image URLs from ${tasks.length} tasks`)
    return uniqueUrls
  }

  // Smart preload: download every task image into the browser HTTP cache so
  // each task's <img> mounts hit cache. Memory cost is essentially zero
  // because nothing is held in JS - the browser handles eviction.
  async preloadAllTaskImages(tasks: any[]): Promise<void> {
    if (this.isPreloading) {
      console.log('Preloading already in progress, skipping...')
      return
    }

    this.isPreloading = true
    this.preloadStartTime = Date.now()
    this.preloadProgress = { total: 0, loaded: 0, failed: 0 }

    try {
      const urls = this.extractImageUrls(tasks)
      console.log(`Starting preload of ${urls.length} images for ${tasks.length} tasks`)

      if (urls.length === 0) {
        console.warn('No image URLs found in tasks')
        return
      }

      await this.preloadImages(urls, 'high')

      const duration = this.getPreloadDuration()
      console.log(
        `Preload completed in ${duration}ms: ${this.preloadProgress.loaded}/${this.preloadProgress.total} loaded`,
      )
    } catch (error) {
      console.error('Preload failed:', error)
    } finally {
      this.isPreloading = false
    }
  }

  getCacheStats(): { total: number; loaded: number; failed: number; size: number } {
    const entries = Array.from(this.cache.values())
    return {
      total: entries.length,
      loaded: entries.filter((e) => e.loaded).length,
      failed: entries.filter((e) => !e.loaded).length,
      size: this.cache.size,
    }
  }

  clearCache(): void {
    // No ObjectURLs to revoke any more; just drop the tracking map. The
    // browser's HTTP cache manages its own eviction.
    console.log('Clearing image cache tracking map...')
    this.cache.clear()
    this.loadingPromises.clear()
    this.preloadProgress = { total: 0, loaded: 0, failed: 0 }
    this.isPreloading = false
    this.preloadStartTime = 0
    console.log('Image cache tracking map cleared')
  }

  getCachedUrls(): string[] {
    return Array.from(this.cache.keys())
  }

  logCacheStatus(): void {
    const stats = this.getCacheStats()
    console.log(
      `Cache Status: ${stats.loaded}/${stats.total} loaded, ${stats.failed} failed, ${stats.size} tracked`,
    )

    const failedEntries = Array.from(this.cache.entries()).filter(([_, entry]) => !entry.loaded)
    if (failedEntries.length > 0) {
      console.log('Failed URLs:')
      failedEntries.forEach(([url, entry]) => {
        console.log(`  - ${url.substring(url.lastIndexOf('/') + 1)}: ${entry.error || 'Unknown error'}`)
      })
    }
  }

  getErrorDetails(): { url: string; error: string; note?: string }[] {
    return Array.from(this.cache.entries())
      .filter(([_, entry]) => !entry.loaded)
      .map(([url, entry]) => ({
        url,
        error: entry.error || 'Unknown error',
      }))
  }

  async testPreload(urls: string[]): Promise<void> {
    console.log('Testing preload with URLs:', urls)
    await this.preloadImages(urls, 'high')
    this.logCacheStatus()
  }

  testExtractUrls(tasks: any[]): string[] {
    console.log('Testing URL extraction with tasks:', tasks.length)
    const urls = this.extractImageUrls(tasks)
    console.log('Extracted URLs:', urls)
    return urls
  }

  // Always false now: the browser HTTP cache approach works everywhere
  // without CORS configuration on the storage account.
  shouldSkipPreloading(): boolean {
    return false
  }

  getFallbackUrl(originalUrl: string): string {
    return originalUrl
  }

  isImageAvailable(_url: string): boolean {
    // We render the original URL, and the browser falls back gracefully if
    // it's missing, so this is effectively always true.
    return true
  }

  // Public: returns the URL to use in <img src=...>.
  // We always return the original URL - the browser HTTP cache will serve
  // it instantly without us holding any Blob in the JS heap.
  getCachedUrl(originalUrl: string): string {
    if (!originalUrl || typeof originalUrl !== 'string') {
      console.warn('getCachedUrl called with invalid input:', originalUrl)
      return '/placeholder.svg'
    }
    return originalUrl
  }

  getCachedUrlsForImages(originalUrls: string[]): string[] {
    if (!originalUrls || !Array.isArray(originalUrls)) {
      console.warn('getCachedUrlsForImages called with invalid input:', originalUrls)
      return []
    }
    return originalUrls.map((url) => this.getCachedUrl(url))
  }
}

// Global instance
export const imageCacheManager = new ImageCacheManager()

// Make it available globally for testing
if (typeof window !== 'undefined') {
  ;(window as any).imageCacheManager = imageCacheManager
  console.log('imageCacheManager available globally for testing')
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
    getStats: () => imageCacheManager.getCacheStats(),
  }
}
