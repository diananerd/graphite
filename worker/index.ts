/// <reference types="@cloudflare/workers-types" />

/**
 * Graphite — image pipeline Worker.
 *
 *   GET /images/<base>@<width>.avif       → variant from R2 (or on-demand generation)
 *   GET /images/<base>.png                → 404 (originals never served to browsers)
 *   POST /internal/generate-variants      → bearer-auth, pre-generates AVIF variants
 *
 * All other paths delegate to the Astro static assets bundle.
 */

interface Env {
  ASSETS: Fetcher;
  R2: R2Bucket;
  IMAGES: ImagesBinding;
  INTERNAL_KEY?: string;
}

const VARIANTS = [400, 800, 1200] as const;
type Width = (typeof VARIANTS)[number];

interface ImagesBinding {
  input: (blob: Blob | ArrayBuffer | ReadableStream) => ImageTransformer;
}
interface ImageTransformer {
  transform: (opts: { width?: number; fit?: string; metadata?: string }) => ImageTransformer;
  output: (opts: { format: string; quality?: number }) => ImageOutput;
}
interface ImageOutput {
  response: () => Response;
}

async function generateVariants(env: Env, originalKey: string): Promise<void> {
  const original = await env.R2.get(originalKey);
  if (!original) return;

  const blob = await original.blob();

  await Promise.all(
    VARIANTS.map(async (width) => {
      const outKey = originalKey.replace(/\.png$/, `@${width}.avif`);
      const existing = await env.R2.head(outKey);
      if (existing) return;

      const result = env.IMAGES
        .input(blob)
        .transform({ width, fit: 'scale-down', metadata: 'none' })
        .output({ format: 'image/avif', quality: 75 });

      const buffer = await result.response().arrayBuffer();
      await env.R2.put(outKey, buffer, {
        httpMetadata: { contentType: 'image/avif' },
      });
    }),
  );
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Internal: pre-generate variants for a file (called from CI).
    if (url.pathname === '/internal/generate-variants') {
      if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
      }
      if (!env.INTERNAL_KEY) {
        return new Response('Server not configured', { status: 503 });
      }
      const auth = request.headers.get('Authorization');
      if (auth !== `Bearer ${env.INTERNAL_KEY}`) {
        return new Response('Unauthorized', { status: 401 });
      }
      const body = await request.json<{ file?: string }>().catch(() => null);
      const file = body?.file;
      if (!file) return new Response('Bad Request', { status: 400 });
      ctx.waitUntil(generateVariants(env, `images/${file}`));
      return new Response('OK', { status: 202 });
    }

    // Anything outside /images/ → delegate to static assets.
    if (!url.pathname.startsWith('/images/')) {
      return env.ASSETS.fetch(request);
    }

    const cacheKey = new Request(url.toString(), request);
    const cache = (caches as unknown as { default: Cache }).default;
    const cached = await cache.match(cacheKey as RequestInfo);
    if (cached) return cached;

    const r2Key = url.pathname.slice(1);
    const object = await env.R2.get(r2Key);

    let imageBuffer: ArrayBuffer;
    let contentType: string;

    if (object) {
      imageBuffer = await object.arrayBuffer();
      contentType = object.httpMetadata?.contentType ?? 'image/avif';
    } else {
      const variantMatch = r2Key.match(/^(images\/.+)@(\d+)\.avif$/);
      if (!variantMatch) return new Response('Not Found', { status: 404 });

      const [, base, widthStr] = variantMatch;
      const originalKey = `${base}.png`;
      const original = await env.R2.get(originalKey);
      if (!original) return new Response('Not Found', { status: 404 });

      const width = parseInt(widthStr, 10) as Width;
      const result = env.IMAGES
        .input(await original.blob())
        .transform({ width, fit: 'scale-down', metadata: 'none' })
        .output({ format: 'image/avif', quality: 75 });

      imageBuffer = await result.response().arrayBuffer();
      contentType = 'image/avif';

      ctx.waitUntil(
        env.R2.put(r2Key, imageBuffer.slice(0), {
          httpMetadata: { contentType },
        }),
      );
    }

    const response = new Response(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });

    ctx.waitUntil(cache.put(cacheKey as RequestInfo, response.clone()));
    return response;
  },
} satisfies ExportedHandler<Env>;
