/**
 * Utility to render Study Layers to a Canvas for high-quality export.
 */

interface LayerImage {
    id: string;
    previewUrl: string;
    secureUrl?: string;
    sourceType?: 'upload' | 'text';
    name?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    pixelWidth?: number;
    pixelHeight?: number;
    textRotation?: number; // Used for text layers
    rotation?: number;     // Sometimes used for image layers
}

interface Layer {
    id: string;
    name: string;
    layer_type?: 'image' | 'text';
    visible?: boolean;
    z?: number;
    transform?: {
        x: number;
        y: number;
        width: number;
        height: number;
        rotation?: number;
    };
    images: LayerImage[];
}

interface Background {
    previewUrl?: string;
    secureUrl?: string;
}

/**
 * Loads an image from a URL and returns a Promise.
 * Handles CORS by routing external URLs through an internal proxy.
 */
const loadImage = (url: string, useProxy: boolean = true): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        let finalUrl = url;
        // If it's an external URL and we want to use the proxy
        if (useProxy && (url.startsWith('http://') || url.startsWith('https://')) && !url.includes(window.location.host)) {
            finalUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
        }

        img.onload = () => resolve(img);
        img.onerror = (err) => reject(new Error(`Failed to load image: ${url}`));
        img.src = finalUrl;
    });
};

/**
 * Helper to draw an image on canvas with 'object-contain' logic.
 */
const drawImageContain = (
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number
) => {
    const imgAspect = img.width / img.height;
    const boxAspect = w / h;
    let drawW: number, drawH: number, drawX: number, drawY: number;

    if (imgAspect > boxAspect) {
        // Image is wider than the target box
        drawW = w;
        drawH = w / imgAspect;
    } else {
        // Image is taller than the target box
        drawH = h;
        drawW = h * imgAspect;
    }

    drawX = x + (w - drawW) / 2;
    drawY = y + (h - drawH) / 2;

    ctx.drawImage(img, drawX, drawY, drawW, drawH);
};

/**
 * Renders the layers onto a canvas and returns the canvas element.
 */
export const renderLayersToCanvas = async (
    background: Background | null,
    layers: Layer[],
    selectedImageIds: Record<string, string>,
    aspect: 'portrait' | 'landscape' | 'square'
): Promise<HTMLCanvasElement> => {
    // 1. Determine target dimensions
    // Target 1080p width/height for high quality
    let canvasWidth = 1080;
    let canvasHeight = 1080;

    if (aspect === 'portrait') {
        canvasWidth = 1080;
        canvasHeight = 1920;
    } else if (aspect === 'landscape') {
        canvasWidth = 1920;
        canvasHeight = 1080;
    }

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error('Could not get canvas context');

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // 2. Load and Draw Background (contain logic)
    let backgroundRect = { x: 0, y: 0, width: canvasWidth, height: canvasHeight };

    if (background && (background.secureUrl || background.previewUrl)) {
        try {
            const bgImg = await loadImage(background.secureUrl || background.previewUrl!, true);
            const imgAspect = bgImg.width / bgImg.height;
            const targetAspect = canvasWidth / canvasHeight;

            if (imgAspect > targetAspect) {
                // Image is wider than canvas
                backgroundRect.width = canvasWidth;
                backgroundRect.height = canvasWidth / imgAspect;
                backgroundRect.y = (canvasHeight - backgroundRect.height) / 2;
            } else {
                // Image is taller or same
                backgroundRect.height = canvasHeight;
                backgroundRect.width = canvasHeight * imgAspect;
                backgroundRect.x = (canvasWidth - backgroundRect.width) / 2;
            }

            ctx.drawImage(bgImg, backgroundRect.x, backgroundRect.y, backgroundRect.width, backgroundRect.height);
        } catch (e) {
            console.error('Failed to load background image for export', e);
        }
    }

    // 3. Draw Layers
    // Sort layers by z-index to ensure correct draw order
    const sortedLayers = [...layers].sort((a, b) => (a.z || 0) - (b.z || 0));

    for (const layer of sortedLayers) {
        if (layer.visible === false) continue;

        const selectedId = selectedImageIds[layer.id];
        const imgData = layer.images.find(img => img.id === selectedId) || layer.images[0];

        if (!imgData) continue;

        const url = imgData.secureUrl || imgData.previewUrl;
        if (!url) continue;

        try {
            // Use proxy only for images that might be external
            const layerImg = await loadImage(url, true);

            // Extract transformation properties. 
            // We prioritize the transform on the layer image itself (imgData).
            const widthPct = imgData.width ?? layer.transform?.width ?? 100;
            const heightPct = imgData.height ?? layer.transform?.height ?? 100;
            const xPct = imgData.x ?? layer.transform?.x ?? 0;
            const yPct = imgData.y ?? layer.transform?.y ?? 0;
            const rotation = imgData.textRotation ?? imgData.rotation ?? layer.transform?.rotation ?? 0;

            // Recalculate dimensions based on the backgroundRect (which is the "fit" area)
            // This ensures parity with the preview modal where layers are relative to the fit box.
            const pxWidth = (widthPct / 100) * backgroundRect.width;
            const pxHeight = (heightPct / 100) * backgroundRect.height;
            const pxX = backgroundRect.x + (xPct / 100) * backgroundRect.width;
            const pxY = backgroundRect.y + (yPct / 100) * backgroundRect.height;

            ctx.save();

            // Move to center of layer for rotation
            ctx.translate(pxX + pxWidth / 2, pxY + pxHeight / 2);
            if (rotation) {
                ctx.rotate((rotation * Math.PI) / 180);
            }

            // Draw image centered at origin using 'contain' logic to preserve aspect ratio
            drawImageContain(ctx, layerImg, -pxWidth / 2, -pxHeight / 2, pxWidth, pxHeight);

            ctx.restore();
        } catch (e) {
            console.error(`Failed to load layer image for export: ${layer.name}`, e);
        }
    }

    return canvas;
};
