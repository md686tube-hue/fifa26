// /api/match.js
// Vercel serverless function — football-data.org-এর একটা নির্দিষ্ট ম্যাচের
// বিস্তারিত তথ্য (গোলদাতা, মিনিট সহ `goals` array) সার্ভার-সাইডে fetch করে রিটার্ন করে।
// Usage: /api/match?id=<football-data match id>

const cache = new Map(); // id -> { data, ts }
const CACHE_MS = 12000;

const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY || "824f73a1c1854c4186ae2acf2446b895";

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) { res.status(400).json({ error: "id query param প্রয়োজন" }); return; }

  const now = Date.now();
  const cached = cache.get(id);
  if (cached && (now - cached.ts) < CACHE_MS) {
    res.setHeader("X-Cache", "HIT");
    res.status(200).json(cached.data);
    return;
  }
  try {
    const r = await fetch(
      `https://api.football-data.org/v4/matches/${id}`,
      { headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY } }
    );
    const data = await r.json();
    if (r.ok) {
      cache.set(id, { data, ts: now });
      res.setHeader("X-Cache", "MISS");
      res.status(200).json(data);
    } else if (cached) {
      res.setHeader("X-Cache", "STALE-ON-ERROR");
      res.status(200).json(cached.data);
    } else {
      res.status(r.status).json(data);
    }
  } catch (e) {
    if (cached) {
      res.setHeader("X-Cache", "STALE-ON-ERROR");
      res.status(200).json(cached.data);
    } else {
      res.status(500).json({ error: String(e?.message || e) });
    }
  }
}
