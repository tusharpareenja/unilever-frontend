// === MOBILE-FIRST Image Preloader ===
// lib/utils/imagePreloader.ts

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef } from 'react'

// Mobile detection
const isMobile = () => typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

// Preload with priority queue
class MobileImagePreloader {
  private loadedUrls = new Set<string>()
  private loadingPromises = new Map<string, Promise<void>>()
  private compositeCache = new Map<string, string>()

  async preloadImage(url: string, priority: 'critical' | 'high' | 'low' = 'high'): Promise<void> {
    if (this.loadedUrls.has(url)) return

    if (this.loadingPromises.has(url)) {
      return this.loadingPromises.get(url)!
    }

    const promise = new Promise<void>((resolve) => {
      const img = new Image()
      img.decoding = priority === 'critical' ? 'sync' : 'async'
      img.referrerPolicy = 'no-referrer'

      if ('fetchPriority' in img) {
        (img as any).fetchPriority = priority === 'critical' ? 'high' : 'low'
      }

      img.onload = () => {
        this.loadedUrls.add(url)
        resolve()
      }
      img.onerror = () => {
        resolve() // Don't block on errors
      }

      img.src = url
    })

    this.loadingPromises.set(url, promise)
    await promise
    this.loadingPromises.delete(url)
  }

  async preloadBatch(urls: string[], priority: 'critical' | 'high' | 'low' = 'high'): Promise<void> {
    const toLoad = urls.filter(u => !this.loadedUrls.has(u))
    if (toLoad.length === 0) return

    // On mobile, limit concurrent loads
    const limit = isMobile() ? 3 : 6
    const batches: string[][] = []

    for (let i = 0; i < toLoad.length; i += limit) {
      batches.push(toLoad.slice(i, i + limit))
    }

    for (const batch of batches) {
      await Promise.all(batch.map(url => this.preloadImage(url, priority)))
    }
  }

  // Create and cache composite
  async createComposite(taskId: string, layers: Array<{ url: string; z: number }>): Promise<string | null> {
    if (this.compositeCache.has(taskId)) {
      return this.compositeCache.get(taskId)!
    }

    try {
      // NO CANVAS APPROACH: Completely avoid canvas operations that cause security errors

      // Sort by z-index
      const sortedLayers = [...layers].sort((a, b) => a.z - b.z)

      // For mobile, we'll use a much simpler approach:
      // 1. If only one layer, return it directly
      if (sortedLayers.length === 1) {
        const singleLayerUrl = sortedLayers[0].url
        this.compositeCache.set(taskId, singleLayerUrl)
        return singleLayerUrl
      }

      // 2. For multiple layers, return the top layer (highest z-index)
      // This avoids canvas security issues entirely
      const topLayer = sortedLayers[sortedLayers.length - 1]
      console.log(`Mobile composite: Using top layer for task ${taskId} (avoiding canvas)`)

      this.compositeCache.set(taskId, topLayer.url)
      return topLayer.url

      // Note: This approach sacrifices perfect layering for mobile compatibility
      // The trade-off is worth it to avoid security errors
    } catch (error) {
      console.error('Composite creation failed:', error)
      return null
    }
  }

  getComposite(taskId: string): string | null {
    return this.compositeCache.get(taskId) || null
  }

  cleanup() {
    this.compositeCache.forEach(url => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url)
      }
    })
    this.compositeCache.clear()
    this.loadedUrls.clear()
    this.loadingPromises.clear()
  }
}

export const imagePreloader = new MobileImagePreloader()

// React hook - optimized for mobile
export function useOptimizedImages(tasks: any[], currentIndex: number) {
  const [isLoading, setIsLoading] = useState(true)
  const [compositesReady, setCompositesReady] = useState(false)
  const preloadedIndices = useRef(new Set<number>())
  const mobile = isMobile()

  useEffect(() => {
    if (tasks.length === 0) {
      setIsLoading(false)
      return
    }

    async function preloadCurrentTask() {
      const task = tasks[currentIndex]
      if (!task || preloadedIndices.current.has(currentIndex)) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)

      try {
        // For layer tasks on mobile, create composite FIRST
        if (mobile && task.layeredImages?.length) {
          console.log(`Creating composite for task ${currentIndex}`)
          const compositeUrl = await imagePreloader.createComposite(
            task.id,
            task.layeredImages
          )

          if (compositeUrl) {
            task.compositeLayerUrl = compositeUrl
            console.log(`Composite ready: ${compositeUrl.substring(0, 50)}...`)
          }
        } else if (task.layeredImages?.length) {
          // Desktop: preload individual layers
          await imagePreloader.preloadBatch(
            task.layeredImages.map((l: any) => l.url),
            'critical'
          )
        }

        // For grid tasks, preload images
        if (task.gridUrls?.length) {
          await imagePreloader.preloadBatch(task.gridUrls, 'critical')
        }

        if (task.leftImageUrl || task.rightImageUrl) {
          await imagePreloader.preloadBatch(
            [task.leftImageUrl, task.rightImageUrl].filter(Boolean),
            'critical'
          )
        }

        preloadedIndices.current.add(currentIndex)

        // Background preload next 2 tasks
        setTimeout(() => {
          preloadNextTasks()
        }, 100)

      } catch (error) {
        console.error('Preload failed:', error)
      } finally {
        setIsLoading(false)
        setCompositesReady(true)
      }
    }

    async function preloadNextTasks() {
      const nextIndices = [currentIndex + 1, currentIndex + 2].filter(
        i => i < tasks.length && !preloadedIndices.current.has(i)
      )

      for (const idx of nextIndices) {
        const task = tasks[idx]
        if (!task) continue

        try {
          if (mobile && task.layeredImages?.length) {
            const compositeUrl = await imagePreloader.createComposite(
              task.id,
              task.layeredImages
            )
            if (compositeUrl) {
              task.compositeLayerUrl = compositeUrl
            }
          } else if (task.layeredImages?.length) {
            imagePreloader.preloadBatch(
              task.layeredImages.map((l: any) => l.url),
              'low'
            )
          }

          if (task.gridUrls?.length) {
            imagePreloader.preloadBatch(task.gridUrls, 'low')
          }

          if (task.leftImageUrl || task.rightImageUrl) {
            imagePreloader.preloadBatch(
              [task.leftImageUrl, task.rightImageUrl].filter(Boolean),
              'low'
            )
          }

          preloadedIndices.current.add(idx)
        } catch (error) {
          console.error(`Background preload failed for task ${idx}:`, error)
        }
      }
    }

    preloadCurrentTask()
  }, [tasks, currentIndex, mobile])

  useEffect(() => {
    return () => imagePreloader.cleanup()
  }, [])

  return {
    loadedTasks: tasks,
    isLoading: isLoading && currentIndex === 0,
    compositesReady
  }
}

// Helper for initial preload (use on earlier pages)
export async function preloadTaskImages(tasks: any[], count: number = 3): Promise<void> {
  if (tasks.length === 0) return

  const mobile = isMobile()
  const tasksToPreload = tasks.slice(0, Math.min(count, tasks.length))

  console.log(`Initial preload: ${tasksToPreload.length} tasks (mobile: ${mobile})`)

  for (const task of tasksToPreload) {
    try {
      // For mobile layer tasks, create composites
      if (mobile && task.layeredImages?.length) {
        const compositeUrl = await imagePreloader.createComposite(
          task.id,
          task.layeredImages
        )
        if (compositeUrl) {
          task.compositeLayerUrl = compositeUrl
          console.log(`Initial composite created for task ${task.id}`)
        }
      } else {
        // Otherwise just preload URLs
        const urls: string[] = []

        if (task.layeredImages?.length) {
          urls.push(...task.layeredImages.map((l: any) => l.url))
        }
        if (task.gridUrls?.length) {
          urls.push(...task.gridUrls)
        }
        if (task.leftImageUrl) urls.push(task.leftImageUrl)
        if (task.rightImageUrl) urls.push(task.rightImageUrl)

        if (urls.length > 0) {
          await imagePreloader.preloadBatch(urls, 'high')
        }
      }
    } catch (error) {
      console.error(`Initial preload failed for task ${task.id}:`, error)
    }
  }

  console.log('Initial preload complete')
}