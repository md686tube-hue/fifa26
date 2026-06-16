// /api/scores.js
// Vercel serverless function — football-data.org থেকে World Cup 2026-এর সব ম্যাচের
// লিস্ট (score, status, minute) সার্ভার-সাইডে fetch করে রিটার্ন করে।
// browser থেকে সরাসরি call করলে CORS/X-Auth-Token সমস্যা হয় — এই function
// সেই সমস্যা সম্পূর্ণভাবে এড়িয়ে যায় কারণ এটা সার্ভার-টু-সার্ভার call।
//
// ⚠️ in-memory cache: s-maxage header শুধু Vercel-এর paid/CDN plan-এ কাজ করে —
// Hobby plan-এ serverless function নিজে নিজে cache করে না। তাই এখানে module-level
// variable দিয়ে নিজেরাই cache রাখা হচ্ছে (একই serverless instance যতক্ষণ "warm"
// থাকে, প্রতিটা ইউজারের রিকোয়েস্ট সরাসরি football-data.org-কে hit না করে cached
// data পাবে) — এর ফলে অনেক ভিজিটর থাকলেও rate limit (free tier: 10 req/min) এ
// কখনো লাগবে না।
let cache = { data: null, ts: 0 };
const CACHE_MS = 12000; // ১২ সেকেন্ড — rate limit থেকে নিরাপদ দূরত্বে রেখে যথাসম্ভব fresh

const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY || "824f73a1c1854c4186ae2acf2446b895";
const FD_WC_COMPETITION_ID = 2000; // FIFA World Cup

export default async function handler(req, res) {
  const now = Date.now();
  if (cache.data && (now - cache.ts) < CACHE_MS) {
    res.setHeader("X-Cache", "HIT");
    res.status(200).json(cache.data);
    return;
  }
  try {
    const r = await fetch(
      `https://api.football-data.org/v4/competitions/${FD_WC_COMPETITION_ID}/matches`,
      { headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY } }
    );
    const data = await r.json();
    if (r.ok) {
      cache = { data, ts: now };
      res.setHeader("X-Cache", "MISS");
      res.status(200).json(data);
    } else if (cache.data) {
      // rate-limited বা অন্য error হলে, থাকলে পুরনো cached data দিয়ে দাও (কিছুই না দেওয়ার চেয়ে ভালো)
      res.setHeader("X-Cache", "STALE-ON-ERROR");
      res.status(200).json(cache.data);
    } else {
      res.status(r.status).json(data);
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
