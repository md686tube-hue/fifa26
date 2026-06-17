// /api/events.js
// Vercel serverless function — API-Football (api-football.com) থেকে একটা নির্দিষ্ট
// fixture-এর events (গোল, কার্ড সহ scorer নাম + মিনিট) আনে।
// Usage: /api/events?fixture=<api-football fixture id>
//
// in-memory cache (১২ সেকেন্ড) — Vercel Hobby plan-এও কাজ করে, rate limit এ লাগবে না।

const cache = new Map(); // fixtureId -> { data, ts }
const CACHE_MS = 12000;

const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY || "b06e9dab5f89b1005635062517f6c43d";

export default async function handler(req, res) {
  const { fixture } = req.query;
  if (!fixture) { res.status(400).json({ error: "fixture query param প্রয়োজন" }); return; }

  const now = Date.now();
  const cached = cache.get(fixture);
  if (cached && (now - cached.ts) < CACHE_MS) {
    res.setHeader("X-Cache", "HIT");
    res.status(200).json(cached.data);
    return;
  }
  try {
    const r = await fetch(
      `https://v3.football.api-sports.io/fixtures/events?fixture=${fixture}`,
      { headers: { "x-apisports-key": API_FOOTBALL_KEY } }
    );
    const data = await r.json();
    if (r.ok && !data.errors?.length) {
      cache.set(fixture, { data, ts: now });
      res.setHeader("X-Cache", "MISS");
      res.status(200).json(data);
    } else if (cached) {
      res.setHeader("X-Cache", "STALE-ON-ERROR");
      res.status(200).json(cached.data);
    } else {
      res.status(200).json(data); // errors থাকলেও client কে জানাই, debug এ দেখা যাবে
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
