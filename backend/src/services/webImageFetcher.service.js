import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DIR = path.join(__dirname, '../../public/banners');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// In-memory web image cache
const webFetchCache = new Map();

/**
 * Curated high-resolution web landscape photography by topic
 * Used as reliable, instant high-quality web visual sources.
 */
const WEB_TOPIC_COLLECTIONS = {
  robotics: [
    'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=800&h=600&q=80',
    'https://images.unsplash.com/photo-1561557944-6e7860d1a7eb?auto=format&fit=crop&w=800&h=600&q=80',
    'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&h=600&q=80',
    'https://images.unsplash.com/photo-1531746790731-6c087fecd65a?auto=format&fit=crop&w=800&h=600&q=80',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&h=600&q=80',
  ],
  cultural: [
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&h=600&q=80',
    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&h=600&q=80',
    'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=800&h=600&q=80',
    'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&h=600&q=80',
    'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=800&h=600&q=80',
  ],
  sports: [
    'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=800&h=600&q=80',
    'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=800&h=600&q=80',
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&h=600&q=80',
    'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&h=600&q=80',
    'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=800&h=600&q=80',
  ],
  corporate: [
    'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=800&h=600&q=80',
    'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=800&h=600&q=80',
    'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=800&h=600&q=80',
    'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=800&h=600&q=80',
    'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&h=600&q=80',
  ],
  hackathon: [
    'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&h=600&q=80',
    'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&h=600&q=80',
    'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&h=600&q=80',
    'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=800&h=600&q=80',
    'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&h=600&q=80',
  ],
  ai_ml: [
    'https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=800&h=600&q=80',
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&h=600&q=80',
    'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=800&h=600&q=80',
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&h=600&q=80',
    'https://images.unsplash.com/photo-1535378917042-10a22c95931a?auto=format&fit=crop&w=800&h=600&q=80',
  ],
  academic: [
    'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=800&h=600&q=80',
    'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=800&h=600&q=80',
    'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=800&h=600&q=80',
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&h=600&q=80',
  ],
  creative: [
    'https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?auto=format&fit=crop&w=800&h=600&q=80',
    'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=800&h=600&q=80',
    'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?auto=format&fit=crop&w=800&h=600&q=80',
  ],
};

/**
 * Clean search query from raw title
 */
const cleanQuery = (title = '') => {
  return title
    .replace(/202[0-9]/g, '')
    .replace(/workshop|conference|seminar|summit|symposium|lab|hackathon/gi, '')
    .trim() || title.trim();
};

/**
 * Fetch a list of fresh web image candidates from Wikipedia / Wikimedia Commons and curated web pools.
 *
 * @param {string} title
 * @param {string} archetypeKey
 * @returns {Promise<string[]>} Array of image URLs
 */
export const searchWebImages = async (title = '', archetypeKey = 'corporate') => {
  const query = cleanQuery(title);
  const candidates = [];

  // 1. Query Wikipedia / Wikimedia API for real-time live web photography
  try {
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=10&pithumbsize=900`;
    const res = await fetch(wikiUrl, {
      headers: { 'User-Agent': 'EventFlowPlatform/2.0 (web-banner-generator)' },
      signal: AbortSignal.timeout(4000),
    });

    if (res.ok) {
      const data = await res.json();
      const pages = data.query?.pages || {};
      for (const p of Object.values(pages)) {
        const rawUrl = p.thumbnail?.source || p.original?.source;
        if (rawUrl) {
          const cleanUrl = rawUrl.split('?')[0];
          // Check for valid image file and filter out site logos/maps
          if (/\.(jpe?g|png)$/i.test(cleanUrl) && !cleanUrl.includes('logo') && !cleanUrl.includes('flag') && !cleanUrl.includes('icon')) {
            candidates.push(rawUrl);
          }
        }
      }
    }
  } catch (err) {
    // Graceful fallback to web curated pool if Wikipedia network call is slow or throttled
  }

  // 2. Add curated high-resolution web photo pool for this archetype
  const webPool = WEB_TOPIC_COLLECTIONS[archetypeKey] || WEB_TOPIC_COLLECTIONS.corporate;
  candidates.push(...webPool);

  // Return unique candidate URLs
  return Array.from(new Set(candidates));
};

/**
 * Download a web image and convert to base64 Data URI.
 *
 * @param {string} url
 * @returns {Promise<string|null>} Data URI string
 */
export const fetchImageAsBase64 = async (url) => {
  if (!url) return null;
  if (webFetchCache.has(url)) {
    return webFetchCache.get(url);
  }

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return null;

    const arrayBuf = await res.arrayBuffer();
    const buf = Buffer.from(arrayBuf);
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const mime = contentType.split(';')[0].trim();

    const dataUri = `data:${mime};base64,${buf.toString('base64')}`;
    webFetchCache.set(url, dataUri);
    return dataUri;
  } catch (err) {
    return null;
  }
};
