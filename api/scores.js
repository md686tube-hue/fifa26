// /api/scores.js
// Vercel serverless function — football-data.org থেকে World Cup 2026-এর সব ম্যাচের
// লিস্ট (score, status, minute) সার্ভার-সাইডে fetch করে রিটার্ন করে।
// browser থেকে সরাসরি call করলে CORS/X-Auth-Token সমস্যা হয় — এই function
// সেই সমস্যা সম্পূর্ণভাবে এড়িয়ে যায় কারণ এটা সার্ভার-টু-সার্ভার call।

const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY || "824f73a1c1854c4186ae2acf2446b895";
const FD_WC_COMPETITION_ID = 2000; // FIFA World Cup

export default async function handler(req, res) {
  try {
    const r = await fetch(
      `https://api.football-data.org/v4/competitions/${FD_WC_COMPETITION_ID}/matches`,
      { headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY } }
    );
    const data = await r.json();
    // ১৫ সেকেন্ড edge-cache, এর মধ্যে stale data সার্ভ করে background-এ revalidate করে —
    // ফলে অনেক ভিজিটর থাকলেও football-data.org-এর rate-limit (10 req/min) এ লাগে না
    res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=45");
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
