import 'dotenv/config';
import fs from 'fs';
import path from 'path';

const API_KEY = process.env.AUDIUS_API_KEY;
const API_URL = 'https://api.audius.co/v1';
const DAY_MS = 24 * 60 * 60 * 1000;

if (!API_KEY) {
  console.error('Error: AUDIUS_API_KEY is not set in .env');
  // Continuing without API key might work for public endpoints, but ideally we should have one.
  // Many Audius endpoints are open, but rate limits apply.
  console.warn('Proceeding without API key (might hit rate limits)...');
}

const HEADERS = API_KEY ? { 'x-api-key': API_KEY } : {};

// Helper: Gem Score Logic (replicated from webapp-v2/app.js)
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function getGemMetrics(t) {
  const plays = Number(t.play_count || t.playCount || 0);
  const favorites = Number(t.favorite_count || t.favoriteCount || 0);
  const reposts = Number(t.repost_count || t.repostCount || 0);
  const followers = Number(t.user?.follower_count || t.user?.followerCount || 0);
  const created = t.createdAt || t.created_at || t.releaseDate || null;

  const engagementRaw = (favorites + reposts * 1.5) / Math.max(plays, 1);
  const engagement = clamp(engagementRaw * 100, 0, 100);

  let freshness = 30;
  if (created) {
    const ageDays = (Date.now() - new Date(created).getTime()) / DAY_MS;
    freshness = clamp(100 - ageDays * 3, 0, 100);
  }

  // higher score for lower-followed artists
  const underdog = clamp(100 - Math.log10(Math.max(followers, 1)) * 20, 0, 100);

  const mainstreamPenalty = plays > 250000 ? 20 : 0;
  const scoreRaw = 0.4 * engagement + 0.4 * freshness + 0.2 * underdog - mainstreamPenalty;
  const score = Math.round(clamp(scoreRaw, 0, 100));

  return { score, engagement, freshness, underdog, plays, followers };
}

function getGemReason(m) {
  if (m.engagement > 18 && m.plays < 60000) return 'High engagement on relatively low-play track';
  if (m.freshness > 75) return 'Fresh release with early momentum';
  if (m.underdog > 65) return 'Underrated artist signal (low follower base)';
  if (m.plays < 120000) return 'Emerging track with room to break out';
  return 'Balanced momentum across discovery signals';
}

// Fetch helper
async function fetchAudius(endpoint) {
  const url = `${API_URL}${endpoint}`;
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
      throw new Error(`API ${res.status} ${res.statusText}`);
    }
    const json = await res.json();
    return json.data || [];
  } catch (err) {
    console.error(`Failed to fetch ${endpoint}:`, err.message);
    return [];
  }
}

async function runScout() {
  console.log('🔍 Starting GemRadar Auto-Scout...');
  
  const keywords = ['electronic', 'pop', 'indie', 'lo-fi', 'hip-hop'];
  let allTracks = [];

  // 1. Fetch Trending
  console.log('Fetching Trending...');
  const trending = await fetchAudius('/tracks/trending?limit=100');
  allTracks = [...allTracks, ...trending];

  // 2. Fetch by Keywords
  for (const kw of keywords) {
    console.log(`Fetching Search: "${kw}"...`);
    const results = await fetchAudius(`/tracks/search?query=${encodeURIComponent(kw)}&limit=50`);
    allTracks = [...allTracks, ...results];
  }

  // 3. Deduplicate
  const uniqueTracks = new Map();
  allTracks.forEach(t => {
    if (t.id && !uniqueTracks.has(t.id)) {
      uniqueTracks.set(t.id, t);
    }
  });
  
  console.log(`Processing ${uniqueTracks.size} unique tracks...`);

  // 4. Filter for Gem Score 80-90
  const gems = [];
  for (const t of uniqueTracks.values()) {
    const metrics = getGemMetrics(t);
    
    // STRICTLY between 80 and 90 (exclusive or inclusive? "between" usually implies strict range or inclusive. 
    // "strictly between" means 80 < score < 90. Let's interpret "strictly between 80 and 90" as 80 < s < 90.
    // However, usually "between X and Y" means inclusive [X, Y].
    // Given the phrasing "strictly between", I'll use > 80 && < 90.
    // BUT, usually people want the range inclusive if it's integer scores.
    // Let's stick to the prompt: "strictly between 80 and 90".
    
    // Wait, prompt says: "strictly between 80 and 90".
    // I'll do > 80 && < 90.
    if (metrics.score > 80 && metrics.score < 90) {
      // Add gem metadata for display
      t.gemMetrics = metrics;
      t.gemReason = getGemReason(metrics);
      gems.push(t);
    }
  }

  console.log(`Found ${gems.length} gems in the 80-90 range.`);

  // 5. Save to JSON
  const outputDir = path.join(process.cwd(), 'webapp-v2/scouts');
  const outputPath = path.join(outputDir, 'gems-80-90.json');

  // Ensure directory exists (recursive just in case)
  if (!fs.existsSync(outputDir)){
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(gems, null, 2));
  console.log(`✅ Saved gems to ${outputPath}`);
}

runScout().catch(err => console.error(err));
