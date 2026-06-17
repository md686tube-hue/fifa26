// /api/fixtures.js
// Vercel serverless function — API-Football থেকে World Cup 2026-এর সব ফিকশ্চার
// (status, score, fixture id) আনে। client এই fixture id দিয়ে /api/events কল করে
// গোলদাতা আনবে।
//
// in-memory cache ১২ সেকেন্ড — Hobby plan-এও কাজ করে, rate limit এ লাগবে না।

let cache = { data: null, ts: 0 };
const CACHE_MS = 12000;

const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY || "b06e9dab5f89b1005635062517f6c43d";
const WC_LEAGUE_ID = 1;   // FIFA World Cup
const WC_SEASON = 2026;

export default async function handler(req, res) {
  const now = Date.now();
  if (cache.data && (now - cache.ts) < CACHE_MS) {
    res.setHeader("X-Cache", "HIT");
    res.status(200).json(cache.data);
    return;
  }
  try {
    const r = await fetch(
      `https://v3.football.api-sports.io/fixtures?league=${WC_LEAGUE_ID}&season=${WC_SEASON}`,
      { headers: { "x-apisports-key": API_FOOTBALL_KEY } }
    );
    const data = await r.json();
    if (r.ok && !data.errors?.length) {
      cache = { data, ts: now };
      res.setHeader("X-Cache", "MISS");
      res.status(200).json(data);
    } else if (cache.data) {
      res.setHeader("X-Cache", "STALE-ON-ERROR");
      res.status(200).json(cache.data);
    } else {
      res.status(200).json(data);
    }
  } catch (e) {
    if (cache.data) {
      res.setHeader("X-Cache", "STALE-ON-ERROR");
      res.status(200).json(cache.data);
    } else {
      res.status(500).json({ error: String(e?.message || e) });
    }
  }
}
