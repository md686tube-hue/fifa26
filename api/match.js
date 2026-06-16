// /api/match.js
// Vercel serverless function — football-data.org-এর একটা নির্দিষ্ট ম্যাচের
// বিস্তারিত তথ্য (গোলদাতা, মিনিট সহ `goals` array) সার্ভার-সাইডে fetch করে রিটার্ন করে।
// Usage: /api/match?id=<football-data match id>

const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY || "824f73a1c1854c4186ae2acf2446b895";

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) { res.status(400).json({ error: "id query param প্রয়োজন" }); return; }
  try {
    const r = await fetch(
      `https://api.football-data.org/v4/matches/${id}`,
      { headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY } }
    );
    const data = await r.json();
    res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=45");
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
