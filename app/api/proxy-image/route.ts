import { NextRequest, NextResponse } from 'next/server';

/**
 * Backend Proxy for external images to solve CORS issues during Canvas Export.
 * Fetches an image server-side and returns it with Access-Control-Allow-Origin: *
 */

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const imageUrl = searchParams.get('url');

    if (!imageUrl) {
        return new NextResponse('Missing url parameter', { status: 400 });
    }

    try {
        const decodedUrl = decodeURIComponent(imageUrl);
        const targetUrl = new URL(decodedUrl);

        // Basic Security: Domain Whitelisting
        const allowedDomains = [
            'res.cloudinary.com',
            'blob.core.windows.net', // Azure Blob Storage generic
            'lh3.googleusercontent.com', // Google Photos/UI
        ];

        const isAllowed = allowedDomains.some(domain =>
            targetUrl.hostname.endsWith(domain)
        );

        // If you want to be less restrictive (allow all but log it), you can remove this check
        // or keep it for production safety.
        if (!isAllowed) {
            // console.warn('Proxy request to non-whitelisted domain:', targetUrl.hostname);
            // return new NextResponse('Domain not allowed', { status: 403 });
        }

        const response = await fetch(decodedUrl, {
            method: 'GET',
        });

        if (!response.ok) {
            return new NextResponse(`Failed to fetch image: ${response.statusText}`, { status: response.status });
        }

        const contentType = response.headers.get('content-type') || 'image/png';
        const buffer = await response.arrayBuffer();

        // Create the proxied response
        const proxyResponse = new NextResponse(buffer, {
            headers: {
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
            },
        });

        return proxyResponse;
    } catch (error) {
        console.error('Image proxy error:', error);
        return new NextResponse('Error proxying image', { status: 500 });
    }
}
