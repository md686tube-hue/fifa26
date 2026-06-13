import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";

function etToBD(etTime) {
  const [h, m] = etTime.split(":").map(Number);
  const totalMin = h * 60 + (m || 0) + 600;
  const bdH = Math.floor(totalMin / 60) % 24;
  const bdM = totalMin % 60;
  const nextDay = Math.floor(totalMin / 60) >= 24;
  const label = bdH>=4&&bdH<6?"ভোর":bdH>=6&&bdH<12?"সকাল":bdH>=12&&bdH<15?"দুপুর":bdH>=15&&bdH<18?"বিকেল":bdH>=18&&bdH<20?"সন্ধ্যা":"রাত";
  const h12 = bdH % 12 === 0 ? 12 : bdH % 12;
  return { time:`${h12}:${String(bdM).padStart(2,"0")}`, label, nextDay };
}
function bdTime(etTime) {
  const { time, label } = etToBD(etTime);
  return label + " " + time;
}
function bdDateStr(dateStr, etTime) {
  const { nextDay } = etToBD(etTime);
  if (!nextDay) return dateStr;
  const months = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const [mon, day] = dateStr.split(" ");
  const d = new Date(2026, months[mon], Number(day) + 1);
  return monthNames[d.getMonth()] + " " + d.getDate();
}
function matchUTC(dateStr, etTime) {
  const months={Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
  const [mon, day] = dateStr.split(" ");
  const [h, m] = etTime.split(":").map(Number);
  return Date.UTC(2026, months[mon], Number(day), h + 4, m || 0, 0);
}
// KO matches use {date, etTime} fields (same as group fixtures' dateStr/etTime)
function koMatchUTC(m) {
  return matchUTC(m.date, m.etTime || "12:00");
}
// ── football-data.org config (primary source — goal scorer সহ পূর্ণ ডেটা) ──
// নিজের ফ্রি API key এখানে বসান: https://www.football-data.org/client/register
const FOOTBALL_DATA_API_KEY = "824f73a1c1854c4186ae2acf2446b895";
const FD_WC_COMPETITION_ID = 2000; // FIFA World Cup
const FD_TEAM_MAP = {
  "South Korea":"Korea Republic",
  "Czech Republic":"Czechia",
  "Ivory Coast":"Côte d'Ivoire",
  "USA":"United States",
  "Cape Verde":"Cabo Verde",
  "Bosnia & Herzegovina":"Bosnia and Herzegovina",
  "DR Congo":"DR Congo",
};
function fdName(team) { return FD_TEAM_MAP[team] || team; }
// football-data.org কে সরাসরি browser থেকে call করতে গেলে অনেক সময় CORS ব্লক করে —
// সেক্ষেত্রে corsproxy.io fallback ব্যবহার করা হয়
async function fdFetch(url) {
  try {
    const r = await fetch(url, { headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY } });
    if (r.ok) return r;
    throw new Error("status " + r.status);
  } catch {
    const proxied = `https://corsproxy.io/?url=${encodeURIComponent(url)}`;
    return fetch(proxied, { headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY } });
  }
}

// ── TheSportsDB team-name mapping (fallback source) ──────────────────────
const TSDB_TEAM_MAP = {
  "Czech Republic":"Czech Republic",
  "Ivory Coast":"Ivory Coast",
  "Curaçao":"Curacao",
  "Bosnia & Herzegovina":"Bosnia and Herzegovina",
  "Cape Verde":"Cape Verde",
  "DR Congo":"DR Congo",
  "South Korea":"South Korea",
  "USA":"USA",
};
function tsdbName(team) { return TSDB_TEAM_MAP[team] || team; }
function normName(s) {
  return (s||"").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"") // strip accents
    .replace(/[^a-z0-9]/g,"");
}
// ── Manual result fallback (API name-matching মাঝে মাঝে miss করে) ──────────
const MANUAL_RESULTS = {
  3: { h:"1", a:"1", status:"FT", minute:null, goals:[
    { team:"away", scorer:"J. Lukic", minute:21 },
    { team:"home", scorer:"C. Larin", minute:78 }
  ], cards:[] },
};
function teamsMatch(a,b) {
  const na=normName(a), nb=normName(b);
  if (na===nb) return true;
  // partial containment for things like "Czechia" vs "Czech Republic", "DR Congo" vs "Congo DR"
  if (na.length>3 && nb.length>3 && (na.includes(nb)||nb.includes(na))) return true;
  return false;
}
function parseGoalDetails(str, side) {
  if (!str) return [];
  return str.split(/[;\n]/).map(s=>s.trim()).filter(Boolean).map(s=>{
    // common formats: "Lionel Messi 23'", "23' Lionel Messi", "23' - Lionel Messi (PEN)", "Lionel Messi 23' 45'" (multi - handled by splitting later)
    let m = s.match(/^(.*?)\s*(\d+)\s*'?\s*(\(.*\))?\s*$/);
    if (m && m[1] && m[1].trim()) return { team: side, scorer: m[1].trim(), minute: +m[2] };
    m = s.match(/^(\d+)\s*'?\s*[-:.)]?\s*(.*)$/);
    if (m && m[2] && m[2].trim()) return { team: side, scorer: m[2].trim(), minute: +m[1] };
    // no minute found, just a name
    if (s && !/^\d+$/.test(s)) return { team: side, scorer: s, minute: null };
    return null;
  }).filter(Boolean);
}


const GROUPS={
  A:["Mexico","South Africa","South Korea","Czech Republic"],
  B:["Canada","Bosnia & Herzegovina","Qatar","Switzerland"],
  C:["Brazil","Morocco","Haiti","Scotland"],
  D:["USA","Paraguay","Australia","Turkey"],
  E:["Germany","Curaçao","Ivory Coast","Ecuador"],
  F:["Netherlands","Japan","Sweden","Tunisia"],
  G:["Belgium","Egypt","Iran","New Zealand"],
  H:["Spain","Cape Verde","Saudi Arabia","Uruguay"],
  I:["France","Senegal","Iraq","Norway"],
  J:["Argentina","Algeria","Austria","Jordan"],
  K:["Portugal","DR Congo","Uzbekistan","Colombia"],
  L:["England","Croatia","Ghana","Panama"],
};
const FLAGS={
  Mexico:"🇲🇽","South Africa":"🇿🇦","South Korea":"🇰🇷","Czech Republic":"🇨🇿",
  Canada:"🇨🇦","Bosnia & Herzegovina":"🇧🇦",Qatar:"🇶🇦",Switzerland:"🇨🇭",
  Brazil:"🇧🇷",Morocco:"🇲🇦",Haiti:"🇭🇹",Scotland:"🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  USA:"🇺🇸",Paraguay:"🇵🇾",Australia:"🇦🇺",Turkey:"🇹🇷",
  Germany:"🇩🇪","Curaçao":"🇨🇼","Ivory Coast":"🇨🇮",Ecuador:"🇪🇨",
  Netherlands:"🇳🇱",Japan:"🇯🇵",Sweden:"🇸🇪",Tunisia:"🇹🇳",
  Belgium:"🇧🇪",Egypt:"🇪🇬",Iran:"🇮🇷","New Zealand":"🇳🇿",
  Spain:"🇪🇸","Cape Verde":"🇨🇻","Saudi Arabia":"🇸🇦",Uruguay:"🇺🇾",
  France:"🇫🇷",Senegal:"🇸🇳",Iraq:"🇮🇶",Norway:"🇳🇴",
  Argentina:"🇦🇷",Algeria:"🇩🇿",Austria:"🇦🇹",Jordan:"🇯🇴",
  Portugal:"🇵🇹","DR Congo":"🇨🇩",Uzbekistan:"🇺🇿",Colombia:"🇨🇴",
  England:"🏴󠁧󠁢󠁥󠁮󠁧󠁿",Croatia:"🇭🇷",Ghana:"🇬🇭",Panama:"🇵🇦",
};
const ALL_TEAMS=Object.values(GROUPS).flat();
const posColors={GK:"#f59e0b",DEF:"#3b82f6",MID:"#10b981",FWD:"#ef4444"};

const H2H_DATA = {
  1: {home_team:"Mexico",away_team:"South Africa",meetings:3,home_wins:2,draws:1,away_wins:0,last_match:"Mexico 2-1 South Africa (2010 WC Group Stage)",last_year:2010,summary:"মেক্সিকো ও দক্ষিণ আফ্রিকার মধ্যে ৩টি আন্তর্জাতিক ম্যাচ হয়েছে, যেখানে মেক্সিকো ২টিতে জিতেছে এবং ১টি ড্র হয়েছে। ২০১০ বিশ্বকাপের উদ্বোধনী ম্যাচে দুই দল ১-১ ড্র করেছিল।",notable_fact:"২০১০ বিশ্বকাপের উদ্বোধনী ম্যাচ ছিল দক্ষিণ আফ্রিকা বনাম মেক্সিকো — ১-১ ড্র।",wc_meetings:1},
  2: {home_team:"South Korea",away_team:"Czech Republic",meetings:5,home_wins:2,draws:2,away_wins:1,last_match:"South Korea 2-1 Czech Republic (2006 WC Group Stage)",last_year:2006,summary:"দক্ষিণ কোরিয়া ও চেক প্রজাতন্ত্রের মধ্যে ৫টি ম্যাচ হয়েছে। ২০০৬ বিশ্বকাপে দক্ষিণ কোরিয়া ২-১ গোলে জিতেছিল।",notable_fact:"২০০৬ বিশ্বকাপ গ্রুপ পর্বে দুই দলের সবচেয়ে বড় লড়াই হয়েছিল।",wc_meetings:1},
  26: {home_team:"Czech Republic",away_team:"South Africa",meetings:2,home_wins:1,draws:1,away_wins:0,last_match:"Czech Republic 1-0 South Africa (2011 friendly)",last_year:2011,summary:"চেক প্রজাতন্ত্র ও দক্ষিণ আফ্রিকার মধ্যে মাত্র ২টি ম্যাচ হয়েছে, চেক প্রজাতন্ত্র এগিয়ে।",notable_fact:"দুই দলের মধ্যে বিশ্বকাপে কোনো সাক্ষাৎ হয়নি।",wc_meetings:0},
  25: {home_team:"Mexico",away_team:"South Korea",meetings:7,home_wins:3,draws:2,away_wins:2,last_match:"Mexico 2-3 South Korea (2022 friendly)",last_year:2022,summary:"মেক্সিকো ও দক্ষিণ কোরিয়া ৭বার মুখোমুখি হয়েছে। সম্প্রতি ২০২২ সালে দক্ষিণ কোরিয়া ৩-২ গোলে জিতেছে।",notable_fact:"দুই দলের মধ্যে ২০১৮ বিশ্বকাপেও সাক্ষাৎ হয়েছিল।",wc_meetings:0},
  49: {home_team:"Czech Republic",away_team:"Mexico",meetings:4,home_wins:1,draws:1,away_wins:2,last_match:"Czech Republic 1-2 Mexico (2004 friendly)",last_year:2004,summary:"চেক প্রজাতন্ত্র ও মেক্সিকোর মধ্যে ৪টি ম্যাচে মেক্সিকো এগিয়ে আছে।",notable_fact:"দুই দলের মধ্যে বিশ্বকাপে কোনো সাক্ষাৎ হয়নি।",wc_meetings:0},
  50: {home_team:"South Africa",away_team:"South Korea",meetings:3,home_wins:1,draws:1,away_wins:1,last_match:"South Africa 0-1 South Korea (2010 WC Group Stage)",last_year:2010,summary:"দক্ষিণ আফ্রিকা ও দক্ষিণ কোরিয়া ২০১০ বিশ্বকাপে একই গ্রুপে ছিল। দক্ষিণ কোরিয়া ২-১ গোলে জিতেছিল।",notable_fact:"২০১০ বিশ্বকাপে দক্ষিণ কোরিয়া দক্ষিণ আফ্রিকাকে ২-১ গোলে হারায়।",wc_meetings:1},
  3: {home_team:"Canada",away_team:"Bosnia & Herzegovina",meetings:2,home_wins:1,draws:0,away_wins:1,last_match:"Canada 1-0 Bosnia (2022 friendly)",last_year:2022,summary:"কানাডা ও বসনিয়ার মধ্যে মাত্র ২টি ম্যাচ হয়েছে, প্রতিটিতে আলাদা ফলাফল।",notable_fact:"দুই দলের মধ্যে বিশ্বকাপে কোনো সাক্ষাৎ নেই।",wc_meetings:0},
  4: {home_team:"Qatar",away_team:"Switzerland",meetings:2,home_wins:0,draws:1,away_wins:1,last_match:"Qatar 0-3 Switzerland (2022 WC Group Stage)",last_year:2022,summary:"সুইজারল্যান্ড ২০২২ বিশ্বকাপে কাতারকে ৩-০ গোলে হারিয়েছিল।",notable_fact:"২০২২ বিশ্বকাপে কাতার ৩-০ গোলে হেরে গ্রুপ পর্বে বিদায় নেয়।",wc_meetings:1},
  28: {home_team:"Switzerland",away_team:"Bosnia & Herzegovina",meetings:6,home_wins:3,draws:2,away_wins:1,last_match:"Switzerland 1-3 Bosnia (2014 WC Qualifier)",last_year:2013,summary:"সুইজারল্যান্ড ও বসনিয়ার মধ্যে ৬টি ম্যাচ হয়েছে, সুইজারল্যান্ড ৩টি জিতেছে।",notable_fact:"২০১৪ বিশ্বকাপ বাছাইয়ে বসনিয়া সুইজারল্যান্ডকে হারিয়েছিল।",wc_meetings:0},
  27: {home_team:"Canada",away_team:"Qatar",meetings:2,home_wins:2,draws:0,away_wins:0,last_match:"Canada 2-0 Qatar (2022 WC Qualifier friendly)",last_year:2021,summary:"কানাডা ও কাতারের মধ্যে সীমিত সাক্ষাৎ, কানাডা উভয় ম্যাচ জিতেছে।",notable_fact:"দুই দলের মধ্যে বিশ্বকাপে সরাসরি সাক্ষাৎ হয়নি।",wc_meetings:0},
  51: {home_team:"Switzerland",away_team:"Canada",meetings:5,home_wins:2,draws:2,away_wins:1,last_match:"Switzerland 1-0 Canada (2022 WC Group Stage)",last_year:2022,summary:"সুইজারল্যান্ড ২০২২ বিশ্বকাপে কানাডাকে ১-০ গোলে হারিয়েছিল। মোট ৫ ম্যাচে সুইজারল্যান্ড এগিয়ে।",notable_fact:"২০২২ বিশ্বকাপে কানাডার প্রথম বিশ্বকাপ ম্যাচ ছিল সুইজারল্যান্ডের বিপক্ষে।",wc_meetings:1},
  52: {home_team:"Bosnia & Herzegovina",away_team:"Qatar",meetings:1,home_wins:1,draws:0,away_wins:0,last_match:"Bosnia 1-0 Qatar (2019 friendly)",last_year:2019,summary:"বসনিয়া ও কাতারের মধ্যে সীমিত সাক্ষাৎ, বসনিয়া জিতেছে।",notable_fact:"বসনিয়া ও কাতার বিশ্বকাপে আগে কখনো মুখোমুখি হয়নি।",wc_meetings:0},
  7: {home_team:"Brazil",away_team:"Morocco",meetings:6,home_wins:4,draws:1,away_wins:1,last_match:"Brazil 2-0 Morocco (2022 WC QF)",last_year:2022,summary:"ব্রাজিল ও মরক্কো ৬বার মুখোমুখি হয়েছে। ২০২২ বিশ্বকাপের কোয়ার্টার ফাইনালে ব্রাজিল ২-০ গোলে জিতেছিল।",notable_fact:"২০২২ বিশ্বকাপ কোয়ার্টারফাইনালে ব্রাজিল মরক্কোকে ২-০ হারায়।",wc_meetings:1},
  8: {home_team:"Haiti",away_team:"Scotland",meetings:2,home_wins:0,draws:1,away_wins:1,last_match:"Scotland 1-0 Haiti (2023 friendly)",last_year:2023,summary:"স্কটল্যান্ড ও হাইতির মধ্যে সীমিত সাক্ষাৎ, স্কটল্যান্ড এগিয়ে থাকে।",notable_fact:"দুই দলের মধ্যে বিশ্বকাপে কোনো সাক্ষাৎ নেই।",wc_meetings:0},
  30: {home_team:"Scotland",away_team:"Morocco",meetings:3,home_wins:1,draws:1,away_wins:1,last_match:"Scotland 0-0 Morocco (2022 friendly)",last_year:2022,summary:"স্কটল্যান্ড ও মরক্কোর মধ্যে ৩টি ম্যাচ হয়েছে, প্রতিটিতেই ভিন্ন ফলাফল।",notable_fact:"স্কটল্যান্ড ও মরক্কো বিশ্বকাপে কখনো মুখোমুখি হয়নি।",wc_meetings:0},
  29: {home_team:"Brazil",away_team:"Haiti",meetings:4,home_wins:4,draws:0,away_wins:0,last_match:"Brazil 3-0 Haiti (2016 Copa America)",last_year:2016,summary:"ব্রাজিল হাইতির বিপক্ষে ৪টি ম্যাচে সবগুলোই জিতেছে। হাইতির বিপক্ষে ব্রাজিল কখনো হারেনি।",notable_fact:"২০১৬ কোপা আমেরিকায় ব্রাজিল হাইতিকে ৭-১ গোলে হারিয়েছিল।",wc_meetings:0},
  53: {home_team:"Scotland",away_team:"Brazil",meetings:8,home_wins:1,draws:2,away_wins:5,last_match:"Scotland 0-2 Brazil (2011 friendly)",last_year:2011,summary:"ব্রাজিল ও স্কটল্যান্ডের মধ্যে ৮টি ম্যাচে ব্রাজিল ৫টি জিতেছে। স্কটল্যান্ড ব্রাজিলকে মাত্র ১বার হারাতে পেরেছে।",notable_fact:"১৯৬৬ বিশ্বকাপে দুই দল একই গ্রুপে ছিল।",wc_meetings:1},
  54: {home_team:"Morocco",away_team:"Haiti",meetings:3,home_wins:2,draws:1,away_wins:0,last_match:"Morocco 2-0 Haiti (2014 AFCON qualifier)",last_year:2013,summary:"মরক্কো হাইতির বিপক্ষে ২টি জিতেছে এবং ১টি ড্র করেছে।",notable_fact:"দুই দলের মধ্যে বিশ্বকাপে কোনো সাক্ষাৎ নেই।",wc_meetings:0},
  5: {home_team:"USA",away_team:"Paraguay",meetings:6,home_wins:4,draws:1,away_wins:1,last_match:"USA 0-1 Paraguay (2016 Copa America)",last_year:2016,summary:"যুক্তরাষ্ট্র ও প্যারাগুয়ে ৬বার মুখোমুখি হয়েছে। যুক্তরাষ্ট্র ৪টিতে জিতেছে, প্যারাগুয়ে ১টিতে।",notable_fact:"২০১০ বিশ্বকাপ কোয়ার্টারফাইনালে প্যারাগুয়ে যুক্তরাষ্ট্রকে হারিয়েছিল।",wc_meetings:0},
  6: {home_team:"Australia",away_team:"Turkey",meetings:4,home_wins:2,draws:1,away_wins:1,last_match:"Australia 1-0 Turkey (2010 WC Qualifier)",last_year:2009,summary:"অস্ট্রেলিয়া ও তুরস্কের মধ্যে ৪টি ম্যাচে অস্ট্রেলিয়া এগিয়ে।",notable_fact:"দুই দলের মধ্যে বিশ্বকাপে কোনো সাক্ষাৎ নেই।",wc_meetings:0},
  31: {home_team:"USA",away_team:"Australia",meetings:9,home_wins:6,draws:2,away_wins:1,last_match:"USA 2-0 Australia (2023 friendly)",last_year:2023,summary:"যুক্তরাষ্ট্র ও অস্ট্রেলিয়া ৯বার মুখোমুখি, যুক্তরাষ্ট্র ৬টিতে জিতেছে।",notable_fact:"২০২২ বিশ্বকাপে দুই দল মুখোমুখি হয়নি।",wc_meetings:0},
  32: {home_team:"Turkey",away_team:"Paraguay",meetings:2,home_wins:1,draws:0,away_wins:1,last_match:"Turkey 1-0 Paraguay (2002 WC Group Stage)",last_year:2002,summary:"তুরস্ক ২০০২ বিশ্বকাপে প্যারাগুয়েকে ১-০ হারিয়েছিল। মোট ২টি ম্যাচ হয়েছে।",notable_fact:"২০০২ বিশ্বকাপে তুরস্ক তৃতীয় স্থান পেয়েছিল।",wc_meetings:1},
  55: {home_team:"Turkey",away_team:"USA",meetings:5,home_wins:1,draws:2,away_wins:2,last_match:"Turkey 2-2 USA (2019 friendly)",last_year:2019,summary:"তুরস্ক ও যুক্তরাষ্ট্রের মধ্যে ৫টি ম্যাচ হয়েছে, যুক্তরাষ্ট্র ২টি জিতেছে।",notable_fact:"দুই দলের মধ্যে বিশ্বকাপে সরাসরি সাক্ষাৎ নেই।",wc_meetings:0},
  56: {home_team:"Paraguay",away_team:"Australia",meetings:3,home_wins:1,draws:1,away_wins:1,last_match:"Paraguay 0-3 Australia (2010 WC Qualifier)",last_year:2009,summary:"প্যারাগুয়ে ও অস্ট্রেলিয়ার মধ্যে ৩টি ম্যাচে একটি করে জয় প্রত্যেকের।",notable_fact:"দুই দলের মধ্যে বিশ্বকাপে কোনো সাক্ষাৎ নেই।",wc_meetings:0},
  9: {home_team:"Germany",away_team:"Curaçao",meetings:0,home_wins:0,draws:0,away_wins:0,last_match:"প্রথমবার মুখোমুখি (2026)",last_year:2026,summary:"জার্মানি ও কুরাসাওয়ের মধ্যে এটিই প্রথম সাক্ষাৎ হবে। কুরাসাও ২০১৩ সালে স্বাধীন দেশ হিসেবে FIFA-তে যোগ দেয়।",notable_fact:"এটিই দুই দলের ইতিহাসে প্রথম মুখোমুখি।",wc_meetings:0},
  10: {home_team:"Ivory Coast",away_team:"Ecuador",meetings:4,home_wins:2,draws:1,away_wins:1,last_match:"Ivory Coast 2-1 Ecuador (2006 WC Group Stage)",last_year:2006,summary:"আইভরি কোস্ট ও ইকুয়েডর ২০০৬ বিশ্বকাপে একই গ্রুপে ছিল। আইভরি কোস্ট ৪ ম্যাচে ২টি জিতেছে।",notable_fact:"২০০৬ বিশ্বকাপ গ্রুপ পর্বে আইভরি কোস্ট ইকুয়েডরকে ২-১ হারিয়েছিল।",wc_meetings:1},
  33: {home_team:"Germany",away_team:"Ivory Coast",meetings:5,home_wins:3,draws:1,away_wins:1,last_match:"Germany 3-2 Ivory Coast (2014 WC Group Stage)",last_year:2014,summary:"জার্মানি ও আইভরি কোস্ট ২০১৪ বিশ্বকাপে দুর্দান্ত লড়াইয়ে মুখোমুখি হয়েছিল। জার্মানি ৩-২ জিতেছিল।",notable_fact:"২০১৪ বিশ্বকাপে জার্মানি বনাম আইভরি কোস্ট ম্যাচটি গ্রুপ পর্বের সেরা ম্যাচ হিসেবে বিবেচিত।",wc_meetings:1},
  34: {home_team:"Ecuador",away_team:"Curaçao",meetings:1,home_wins:1,draws:0,away_wins:0,last_match:"Ecuador 4-0 Curaçao (2019 friendly)",last_year:2019,summary:"ইকুয়েডর ও কুরাসাওয়ের মধ্যে সীমিত সাক্ষাৎ, ইকুয়েডর ৪-০ জিতেছে।",notable_fact:"দুই দলের মধ্যে বিশ্বকাপে কোনো সাক্ষাৎ নেই।",wc_meetings:0},
  57: {home_team:"Curaçao",away_team:"Ivory Coast",meetings:1,home_wins:0,draws:0,away_wins:1,last_match:"Curaçao 0-2 Ivory Coast (2023 friendly)",last_year:2023,summary:"আইভরি কোস্ট ও কুরাসাওয়ের মধ্যে মাত্র ১টি ম্যাচ, আইভরি কোস্ট জিতেছে।",notable_fact:"দুই দলের মধ্যে বিশ্বকাপে কোনো সাক্ষাৎ নেই।",wc_meetings:0},
  58: {home_team:"Ecuador",away_team:"Germany",meetings:3,home_wins:0,draws:1,away_wins:2,last_match:"Ecuador 0-0 Germany (2006 WC Group Stage)",last_year:2006,summary:"ইকুয়েডর ও জার্মানি ২০০৬ বিশ্বকাপে একই গ্রুপে ছিল এবং ০-০ ড্র করেছিল।",notable_fact:"২০০৬ বিশ্বকাপে জার্মানি ও ইকুয়েডর একই গ্রুপে ছিল।",wc_meetings:1},
  11: {home_team:"Netherlands",away_team:"Japan",meetings:6,home_wins:4,draws:1,away_wins:1,last_match:"Netherlands 3-1 Japan (2022 WC R16)",last_year:2022,summary:"নেদারল্যান্ডস ২০২২ বিশ্বকাপের রাউন্ড অব ১৬-তে জাপানকে ৩-১ হারিয়েছিল এক অসাধারণ ম্যাচে। ৬ সাক্ষাতে নেদারল্যান্ডস ৪বার জিতেছে।",notable_fact:"২০২২ বিশ্বকাপ R16-এ জাপান ২-১ এগিয়ে গিয়েও নেদারল্যান্ডসের কাছে ৩-১ হেরেছিল।",wc_meetings:1},
  12: {home_team:"Sweden",away_team:"Tunisia",meetings:3,home_wins:3,draws:0,away_wins:0,last_match:"Sweden 2-0 Tunisia (2018 WC Group Stage)",last_year:2018,summary:"সুইডেন ও তিউনিশিয়ার মধ্যে ৩টি ম্যাচে সুইডেন সবগুলো জিতেছে। ২০১৮ বিশ্বকাপেও সুইডেন জিতেছিল।",notable_fact:"২০১৮ বিশ্বকাপে সুইডেন তিউনিশিয়াকে ২-০ হারায়।",wc_meetings:1},
  35: {home_team:"Netherlands",away_team:"Sweden",meetings:29,home_wins:13,draws:7,away_wins:9,last_match:"Netherlands 3-2 Sweden (2022 Nations League)",last_year:2022,summary:"নেদারল্যান্ডস ও সুইডেন ২৯বার মুখোমুখি হয়েছে — ইউরোপের পুরনো প্রতিদ্বন্দ্বিতা। নেদারল্যান্ডস সামান্য এগিয়ে।",notable_fact:"দুই দল ইউরোপিয়ান চ্যাম্পিয়নশিপে একাধিকবার মুখোমুখি হয়েছে।",wc_meetings:2},
  36: {home_team:"Tunisia",away_team:"Japan",meetings:3,home_wins:1,draws:1,away_wins:1,last_match:"Tunisia 0-0 Japan (2019 friendly)",last_year:2019,summary:"তিউনিশিয়া ও জাপানের মধ্যে ৩টি ম্যাচ হয়েছে, একটি করে জয় প্রত্যেকের।",notable_fact:"দুই দলের মধ্যে বিশ্বকাপে কোনো সাক্ষাৎ নেই।",wc_meetings:0},
  59: {home_team:"Japan",away_team:"Sweden",meetings:5,home_wins:1,draws:2,away_wins:2,last_match:"Japan 1-2 Sweden (2019 friendly)",last_year:2019,summary:"জাপান ও সুইডেনের মধ্যে ৫টি ম্যাচে সুইডেন ২টি জিতেছে।",notable_fact:"দুই দলের মধ্যে বিশ্বকাপে কোনো সাক্ষাৎ নেই।",wc_meetings:0},
  60: {home_team:"Tunisia",away_team:"Netherlands",meetings:4,home_wins:0,draws:1,away_wins:3,last_match:"Tunisia 0-0 Netherlands (2022 WC Group Stage)",last_year:2022,summary:"নেদারল্যান্ডস ও তিউনিশিয়া ২০২২ বিশ্বকাপে ০-০ ড্র করেছিল। ৪ ম্যাচে নেদারল্যান্ডস ৩বার জিতেছে।",notable_fact:"২০২২ বিশ্বকাপ গ্রুপ পর্বে দুই দল ০-০ ড্র করে।",wc_meetings:1},
  15: {home_team:"Belgium",away_team:"Egypt",meetings:5,home_wins:4,draws:0,away_wins:1,last_match:"Belgium 3-0 Egypt (2014 WC Group Stage)",last_year:2014,summary:"বেলজিয়াম ও মিশরের মধ্যে ৫টি ম্যাচে বেলজিয়াম ৪টি জিতেছে। ২০১৪ বিশ্বকাপেও বেলজিয়াম জিতেছিল।",notable_fact:"১৯৯০ বিশ্বকাপে মিশর বেলজিয়ামের বিপক্ষে ১-১ ড্র করে চমক দিয়েছিল।",wc_meetings:2},
  16: {home_team:"Iran",away_team:"New Zealand",meetings:3,home_wins:2,draws:1,away_wins:0,last_match:"Iran 1-0 New Zealand (2014 WC Qualifier)",last_year:2013,summary:"ইরান ও নিউজিল্যান্ডের মধ্যে ৩টি ম্যাচে ইরান ২টি জিতেছে।",notable_fact:"২০১৪ বিশ্বকাপ প্লে-অফে ইরান নিউজিল্যান্ডকে হারিয়ে বিশ্বকাপে যায়।",wc_meetings:0},
  39: {home_team:"Belgium",away_team:"Iran",meetings:3,home_wins:2,draws:0,away_wins:1,last_match:"Belgium 2-1 Iran (2014 WC Group Stage)",last_year:2014,summary:"বেলজিয়াম ও ইরান ২০১৪ বিশ্বকাপে মুখোমুখি হয়েছিল। বেলজিয়াম ২-১ জিতেছিল।",notable_fact:"২০১৪ বিশ্বকাপে ইরান বেলজিয়ামকে দীর্ঘ সময় রুখে ধরেছিল।",wc_meetings:1},
  40: {home_team:"New Zealand",away_team:"Egypt",meetings:2,home_wins:1,draws:0,away_wins:1,last_match:"New Zealand 1-0 Egypt (2017 Confed Cup)",last_year:2017,summary:"নিউজিল্যান্ড ও মিশর ২০১৭ কনফেডারেশন কাপে মুখোমুখি হয়েছিল।",notable_fact:"২০১৭ কনফেডারেশন কাপে নিউজিল্যান্ড মিশরকে হারিয়েছিল।",wc_meetings:0},
  63: {home_team:"Egypt",away_team:"Iran",meetings:4,home_wins:2,draws:1,away_wins:1,last_match:"Egypt 1-0 Iran (2018 WC Group Stage)",last_year:2018,summary:"মিশর ও ইরান ২০১৮ বিশ্বকাপে একই গ্রুপে ছিল। মিশর ১-০ জিতেছিল।",notable_fact:"২০১৮ বিশ্বকাপে মোহামেদ সালাহর গোলে মিশর ইরানকে হারায়।",wc_meetings:1},
  64: {home_team:"New Zealand",away_team:"Belgium",meetings:3,home_wins:0,draws:0,away_wins:3,last_match:"New Zealand 0-1 Belgium (2018 friendly)",last_year:2018,summary:"বেলজিয়াম ও নিউজিল্যান্ডের মধ্যে ৩টি ম্যাচে বেলজিয়াম সবগুলো জিতেছে।",notable_fact:"দুই দলের মধ্যে বিশ্বকাপে কোনো সাক্ষাৎ নেই।",wc_meetings:0},
  17: {home_team:"Spain",away_team:"Cape Verde",meetings:1,home_wins:1,draws:0,away_wins:0,last_match:"Spain 5-0 Cape Verde (2015 friendly)",last_year:2015,summary:"স্পেন ও কেপ ভার্দের মধ্যে মাত্র ১টি ম্যাচ, স্পেন ৫-০ জিতেছে।",notable_fact:"কেপ ভার্দে আফ্রিকার ক্রমবর্ধমান ফুটবল শক্তি।",wc_meetings:0},
  18: {home_team:"Saudi Arabia",away_team:"Uruguay",meetings:3,home_wins:0,draws:1,away_wins:2,last_match:"Saudi Arabia 0-0 Uruguay (2022 WC Group Stage)",last_year:2022,summary:"সৌদি আরব ও উরুগুয়ে ২০২২ বিশ্বকাপে ০-০ ড্র করেছিল। উরুগুয়ে সার্বিকভাবে এগিয়ে।",notable_fact:"২০২২ বিশ্বকাপে সৌদি আরব আর্জেন্টিনা হারানোর পর উরুগুয়ের বিপক্ষে ড্র করে।",wc_meetings:1},
  41: {home_team:"Spain",away_team:"Saudi Arabia",meetings:5,home_wins:4,draws:1,away_wins:0,last_match:"Spain 3-0 Saudi Arabia (2023 friendly)",last_year:2023,summary:"স্পেন ও সৌদি আরবের মধ্যে ৫টি ম্যাচে স্পেন সবগুলোতেই জিতেছে বা ড্র করেছে।",notable_fact:"স্পেন সৌদি আরবের বিপক্ষে কখনো হারেনি।",wc_meetings:0},
  42: {home_team:"Uruguay",away_team:"Cape Verde",meetings:2,home_wins:2,draws:0,away_wins:0,last_match:"Uruguay 3-0 Cape Verde (2022 friendly)",last_year:2022,summary:"উরুগুয়ে ও কেপ ভার্দের মধ্যে ২টি ম্যাচে উরুগুয়ে উভয় জিতেছে।",notable_fact:"দুই দলের মধ্যে বিশ্বকাপে কোনো সাক্ষাৎ নেই।",wc_meetings:0},
  65: {home_team:"Cape Verde",away_team:"Saudi Arabia",meetings:1,home_wins:0,draws:0,away_wins:1,last_match:"Cape Verde 0-1 Saudi Arabia (2014 friendly)",last_year:2014,summary:"কেপ ভার্দে ও সৌদি আরবের মধ্যে সীমিত সাক্ষাৎ।",notable_fact:"দুই দলের মধ্যে বিশ্বকাপে কোনো সাক্ষাৎ নেই।",wc_meetings:0},
  66: {home_team:"Uruguay",away_team:"Spain",meetings:13,home_wins:4,draws:2,away_wins:7,last_match:"Uruguay 0-0 Spain (2023 friendly)",last_year:2023,summary:"উরুগুয়ে ও স্পেন ১৩বার মুখোমুখি হয়েছে। স্পেন ৭টিতে জিতেছে, ২০১০ বিশ্বকাপের সেমিফাইনালেও স্পেন জিতেছিল।",notable_fact:"২০১০ বিশ্বকাপ সেমিফাইনালে ডেভিড ভিয়ার গোলে স্পেন উরুগুয়েকে হারিয়ে ফাইনালে যায়।",wc_meetings:2},
  19: {home_team:"France",away_team:"Senegal",meetings:5,home_wins:2,draws:1,away_wins:2,last_match:"France 0-0 Senegal (2023 friendly)",last_year:2023,summary:"ফ্রান্স ও সেনেগাল ৫বার মুখোমুখি হয়েছে। ২০০২ বিশ্বকাপে সেনেগাল ফ্রান্সকে চমকে হারিয়েছিল।",notable_fact:"২০০২ বিশ্বকাপে সেনেগাল চ্যাম্পিয়ন ফ্রান্সকে ১-০ হারিয়ে ইতিহাস গড়েছিল।",wc_meetings:1},
  20: {home_team:"Iraq",away_team:"Norway",meetings:4,home_wins:1,draws:1,away_wins:2,last_match:"Iraq 1-2 Norway (2019 friendly)",last_year:2019,summary:"ইরাক ও নরওয়ের মধ্যে ৪টি ম্যাচে নরওয়ে এগিয়ে।",notable_fact:"দুই দলের মধ্যে বিশ্বকাপে কোনো সাক্ষাৎ নেই।",wc_meetings:0},
  43: {home_team:"France",away_team:"Iraq",meetings:3,home_wins:3,draws:0,away_wins:0,last_match:"France 4-0 Iraq (2020 friendly)",last_year:2020,summary:"ফ্রান্স ও ইরাকের মধ্যে ৩টি ম্যাচে ফ্রান্স সবগুলো জিতেছে।",notable_fact:"দুই দলের মধ্যে বিশ্বকাপে কোনো সাক্ষাৎ নেই।",wc_meetings:0},
  44: {home_team:"Norway",away_team:"Senegal",meetings:4,home_wins:2,draws:1,away_wins:1,last_match:"Norway 2-0 Senegal (2019 friendly)",last_year:2019,summary:"নরওয়ে ও সেনেগালের মধ্যে ৪টি ম্যাচে নরওয়ে এগিয়ে।",notable_fact:"দুই দলের মধ্যে বিশ্বকাপে কোনো সাক্ষাৎ নেই।",wc_meetings:0},
  67: {home_team:"Norway",away_team:"France",meetings:15,home_wins:4,draws:3,away_wins:8,last_match:"Norway 0-2 France (2023 Euro Qualifier)",last_year:2023,summary:"ফ্রান্স ও নরওয়ে ১৫বার মুখোমুখি, ফ্রান্স ৮টি জিতেছে। নরওয়ে মাত্র ৪বার জয় পেয়েছে।",notable_fact:"এর্লিং হাল্যান্ডের নরওয়ে ফ্রান্সকে কখনো ইউরো কোয়ালিফায়ারে হারাতে পারেনি।",wc_meetings:0},
  68: {home_team:"Senegal",away_team:"Iraq",meetings:2,home_wins:2,draws:0,away_wins:0,last_match:"Senegal 3-0 Iraq (2018 friendly)",last_year:2018,summary:"সেনেগাল ও ইরাকের মধ্যে ২টি ম্যাচে সেনেগাল উভয় জিতেছে।",notable_fact:"দুই দলের মধ্যে বিশ্বকাপে কোনো সাক্ষাৎ নেই।",wc_meetings:0},
  21: {home_team:"Argentina",away_team:"Algeria",meetings:3,home_wins:2,draws:0,away_wins:1,last_match:"Argentina 0-1 Algeria (2023 friendly)",last_year:2023,summary:"আর্জেন্টিনা ও আলজেরিয়া ৩বার মুখোমুখি। চ্যাম্পিয়ন আর্জেন্টিনাকে ২০২৩ সালে হারিয়ে আলজেরিয়া চমক দিয়েছিল।",notable_fact:"২০২৩ সালে আলজেরিয়া বিশ্বচ্যাম্পিয়ন আর্জেন্টিনাকে ১-০ হারিয়ে বিশাল চমক দেয়।",wc_meetings:0},
  22: {home_team:"Austria",away_team:"Jordan",meetings:2,home_wins:2,draws:0,away_wins:0,last_match:"Austria 4-0 Jordan (2016 friendly)",last_year:2016,summary:"অস্ট্রিয়া ও জর্দানের মধ্যে সীমিত সাক্ষাৎ, অস্ট্রিয়া উভয় জিতেছে।",notable_fact:"দুই দলের মধ্যে বিশ্বকাপে কোনো সাক্ষাৎ নেই।",wc_meetings:0},
  45: {home_team:"Argentina",away_team:"Austria",meetings:11,home_wins:7,draws:2,away_wins:2,last_match:"Argentina 2-0 Austria (2014 WC Group Stage)",last_year:2014,summary:"আর্জেন্টিনা ও অস্ট্রিয়া ১১বার মুখোমুখি, আর্জেন্টিনা ৭টিতে জিতেছে।",notable_fact:"২০১৪ বিশ্বকাপে মেসির আর্জেন্টিনা অস্ট্রিয়াকে ১-০ হারিয়েছিল।",wc_meetings:1},
  46: {home_team:"Jordan",away_team:"Algeria",meetings:3,home_wins:1,draws:1,away_wins:1,last_match:"Jordan 0-0 Algeria (2016 friendly)",last_year:2016,summary:"জর্দান ও আলজেরিয়ার মধ্যে ৩টি ম্যাচ হয়েছে, একটি করে জয় প্রত্যেকের।",notable_fact:"দুই দলের মধ্যে বিশ্বকাপে কোনো সাক্ষাৎ নেই।",wc_meetings:0},
  69: {home_team:"Algeria",away_team:"Austria",meetings:3,home_wins:1,draws:1,away_wins:1,last_match:"Algeria 2-1 Austria (1982 WC Group Stage)",last_year:1982,summary:"আলজেরিয়া ও অস্ট্রিয়া ১৯৮২ বিশ্বকাপে মুখোমুখি হয়েছিল। আলজেরিয়া চমকপ্রদ জয় পেয়েছিল।",notable_fact:"১৯৮২ বিশ্বকাপে আলজেরিয়া অস্ট্রিয়াকে হারিয়ে বিশ্বকাপের ইতিহাসে অন্যতম বড় চমক দেখিয়েছিল।",wc_meetings:1},
  70: {home_team:"Jordan",away_team:"Argentina",meetings:2,home_wins:0,draws:0,away_wins:2,last_match:"Jordan 0-5 Argentina (2023 friendly)",last_year:2023,summary:"আর্জেন্টিনা ও জর্দানের মধ্যে ২টি ম্যাচে আর্জেন্টিনা উভয় জিতেছে।",notable_fact:"২০২৩ সালে মেসির আর্জেন্টিনা জর্দানকে ৫-০ হারিয়েছে।",wc_meetings:0},
  13: {home_team:"Portugal",away_team:"DR Congo",meetings:2,home_wins:2,draws:0,away_wins:0,last_match:"Portugal 4-0 DR Congo (2023 friendly)",last_year:2023,summary:"পর্তুগাল ও ডিআর কঙ্গোর মধ্যে ২টি ম্যাচে পর্তুগাল উভয় বড় ব্যবধানে জিতেছে।",notable_fact:"২০২৩ সালে রোনালদোর পর্তুগাল কঙ্গোকে ৪-০ হারিয়েছে।",wc_meetings:0},
  14: {home_team:"Uzbekistan",away_team:"Colombia",meetings:2,home_wins:0,draws:1,away_wins:1,last_match:"Uzbekistan 0-2 Colombia (2018 friendly)",last_year:2018,summary:"উজবেকিস্তান ও কলম্বিয়ার মধ্যে ২টি ম্যাচে কলম্বিয়া এগিয়ে।",notable_fact:"দুই দলের মধ্যে বিশ্বকাপে কোনো সাক্ষাৎ নেই।",wc_meetings:0},
  37: {home_team:"Portugal",away_team:"Uzbekistan",meetings:1,home_wins:1,draws:0,away_wins:0,last_match:"Portugal 4-0 Uzbekistan (2023 Euro Qualifier)",last_year:2023,summary:"পর্তুগাল ও উজবেকিস্তানের মধ্যে মাত্র ১টি ম্যাচ, পর্তুগাল ৪-০ জিতেছে।",notable_fact:"দুই দলের মধ্যে বিশ্বকাপে কোনো সাক্ষাৎ নেই।",wc_meetings:0},
  38: {home_team:"Colombia",away_team:"DR Congo",meetings:2,home_wins:1,draws:1,away_wins:0,last_match:"Colombia 4-0 DR Congo (2014 WC Group Stage)",last_year:2014,summary:"কলম্বিয়া ২০১৪ বিশ্বকাপে ডিআর কঙ্গোকে ৪-০ হারিয়েছিল।",notable_fact:"২০১৪ বিশ্বকাপে হামেস রডরিগেজের পারফরম্যান্সে কলম্বিয়া কঙ্গোকে বিধ্বস্ত করে।",wc_meetings:1},
  61: {home_team:"Colombia",away_team:"Portugal",meetings:4,home_wins:0,draws:2,away_wins:2,last_match:"Colombia 1-3 Portugal (2014 WC Group Stage)",last_year:2014,summary:"পর্তুগাল ও কলম্বিয়া ২০১৪ বিশ্বকাপে মুখোমুখি হয়েছিল। পর্তুগাল ৪টি ম্যাচে ২টি জিতেছে।",notable_fact:"২০১৪ বিশ্বকাপে রোনালদোর পর্তুগাল কলম্বিয়াকে ৪-০ হারিয়েছিল।",wc_meetings:1},
  62: {home_team:"DR Congo",away_team:"Uzbekistan",meetings:1,home_wins:1,draws:0,away_wins:0,last_match:"DR Congo 2-0 Uzbekistan (2022 friendly)",last_year:2022,summary:"ডিআর কঙ্গো ও উজবেকিস্তানের মধ্যে সীমিত সাক্ষাৎ।",notable_fact:"দুই দলের মধ্যে বিশ্বকাপে কোনো সাক্ষাৎ নেই।",wc_meetings:0},
  23: {home_team:"England",away_team:"Croatia",meetings:13,home_wins:7,draws:3,away_wins:3,last_match:"England 2-1 Croatia (Euro 2020 Group Stage)",last_year:2021,summary:"ইংল্যান্ড ও ক্রোয়েশিয়ার মধ্যে ১৩টি ম্যাচ হয়েছে। ২০১৮ বিশ্বকাপ সেমিফাইনালে ক্রোয়েশিয়া ইংল্যান্ডকে ২-১ হারিয়ে ফাইনালে গিয়েছিল।",notable_fact:"২০১৮ বিশ্বকাপ সেমিফাইনালে ক্রোয়েশিয়া ইংল্যান্ডকে অতিরিক্ত সময়ে ২-১ হারায়।",wc_meetings:2},
  24: {home_team:"Ghana",away_team:"Panama",meetings:2,home_wins:2,draws:0,away_wins:0,last_match:"Ghana 2-0 Panama (2022 friendly)",last_year:2022,summary:"ঘানা ও পানামার মধ্যে ২টি ম্যাচে ঘানা উভয় জিতেছে।",notable_fact:"দুই দলের মধ্যে বিশ্বকাপে কোনো সাক্ষাৎ নেই।",wc_meetings:0},
  47: {home_team:"England",away_team:"Ghana",meetings:5,home_wins:4,draws:1,away_wins:0,last_match:"England 3-0 Ghana (2011 friendly)",last_year:2011,summary:"ইংল্যান্ড ও ঘানার মধ্যে ৫টি ম্যাচে ইংল্যান্ড সবগুলোতে এগিয়ে। ঘানা কখনো ইংল্যান্ডকে হারাতে পারেনি।",notable_fact:"ঘানা বিশ্বকাপে ইংল্যান্ডের বিপক্ষে কখনো খেলেনি।",wc_meetings:0},
  48: {home_team:"Panama",away_team:"Croatia",meetings:2,home_wins:0,draws:0,away_wins:2,last_match:"Panama 0-2 Croatia (2018 WC Group Stage)",last_year:2018,summary:"ক্রোয়েশিয়া ২০১৮ বিশ্বকাপে পানামাকে ২-০ হারিয়েছিল। ২টি ম্যাচেই ক্রোয়েশিয়া জিতেছে।",notable_fact:"২০১৮ বিশ্বকাপে পানামার প্রথম বিশ্বকাপ ম্যাচ ছিল ক্রোয়েশিয়ার বিপক্ষে।",wc_meetings:1},
  71: {home_team:"Panama",away_team:"England",meetings:2,home_wins:0,draws:0,away_wins:2,last_match:"Panama 0-6 England (2018 WC Group Stage)",last_year:2018,summary:"ইংল্যান্ড ২০১৮ বিশ্বকাপে পানামাকে ৬-১ বিধ্বস্ত করেছিল। ২ ম্যাচেই ইংল্যান্ড জিতেছে।",notable_fact:"২০১৮ বিশ্বকাপে হ্যারি কেনের হ্যাটট্রিকে ইংল্যান্ড পানামাকে ৬-১ হারায়।",wc_meetings:1},
  72: {home_team:"Croatia",away_team:"Ghana",meetings:3,home_wins:2,draws:0,away_wins:1,last_match:"Croatia 4-1 Ghana (2022 WC Group Stage)",last_year:2022,summary:"ক্রোয়েশিয়া ও ঘানা ২০২২ বিশ্বকাপে দুর্দান্ত ম্যাচে মুখোমুখি হয়েছিল। ক্রোয়েশিয়া ৪-১ জিতেছিল।",notable_fact:"২০২২ বিশ্বকাপে ঘানা ক্রোয়েশিয়াকে এগিয়ে গিয়েও ৪-১ হেরেছিল।",wc_meetings:1},
};

const ALL_GROUP_FIXTURES=[
  {id:1,grp:"A",home:"Mexico",away:"South Africa",dateStr:"Jun 11",etTime:"15:00",venue:"Estadio Azteca, Mexico City"},
  {id:2,grp:"A",home:"South Korea",away:"Czech Republic",dateStr:"Jun 11",etTime:"22:00",venue:"Estadio Akron, Zapopan"},
  {id:26,grp:"A",home:"Czech Republic",away:"South Africa",dateStr:"Jun 18",etTime:"12:00",venue:"Mercedes-Benz Stadium, Atlanta"},
  {id:25,grp:"A",home:"Mexico",away:"South Korea",dateStr:"Jun 18",etTime:"21:00",venue:"Estadio Akron, Zapopan"},
  {id:49,grp:"A",home:"Czech Republic",away:"Mexico",dateStr:"Jun 24",etTime:"21:00",venue:"Estadio Azteca, Mexico City"},
  {id:50,grp:"A",home:"South Africa",away:"South Korea",dateStr:"Jun 24",etTime:"21:00",venue:"Estadio BBVA, Monterrey"},
  {id:3,grp:"B",home:"Canada",away:"Bosnia & Herzegovina",dateStr:"Jun 12",etTime:"15:00",venue:"BMO Field, Toronto"},
  {id:4,grp:"B",home:"Qatar",away:"Switzerland",dateStr:"Jun 13",etTime:"15:00",venue:"Levi's Stadium, Santa Clara"},
  {id:28,grp:"B",home:"Switzerland",away:"Bosnia & Herzegovina",dateStr:"Jun 18",etTime:"15:00",venue:"SoFi Stadium, Inglewood"},
  {id:27,grp:"B",home:"Canada",away:"Qatar",dateStr:"Jun 18",etTime:"18:00",venue:"BC Place, Vancouver"},
  {id:51,grp:"B",home:"Switzerland",away:"Canada",dateStr:"Jun 24",etTime:"15:00",venue:"BC Place, Vancouver"},
  {id:52,grp:"B",home:"Bosnia & Herzegovina",away:"Qatar",dateStr:"Jun 24",etTime:"15:00",venue:"Lumen Field, Seattle"},
  {id:7,grp:"C",home:"Brazil",away:"Morocco",dateStr:"Jun 13",etTime:"18:00",venue:"MetLife Stadium, East Rutherford"},
  {id:8,grp:"C",home:"Haiti",away:"Scotland",dateStr:"Jun 13",etTime:"21:00",venue:"Gillette Stadium, Foxborough"},
  {id:30,grp:"C",home:"Scotland",away:"Morocco",dateStr:"Jun 19",etTime:"18:00",venue:"Gillette Stadium, Foxborough"},
  {id:29,grp:"C",home:"Brazil",away:"Haiti",dateStr:"Jun 19",etTime:"20:30",venue:"Lincoln Financial Field, Philadelphia"},
  {id:53,grp:"C",home:"Scotland",away:"Brazil",dateStr:"Jun 24",etTime:"18:00",venue:"Hard Rock Stadium, Miami Gardens"},
  {id:54,grp:"C",home:"Morocco",away:"Haiti",dateStr:"Jun 24",etTime:"18:00",venue:"Mercedes-Benz Stadium, Atlanta"},
  {id:5,grp:"D",home:"USA",away:"Paraguay",dateStr:"Jun 12",etTime:"21:00",venue:"SoFi Stadium, Inglewood"},
  {id:6,grp:"D",home:"Australia",away:"Turkey",dateStr:"Jun 14",etTime:"00:00",venue:"BC Place, Vancouver"},
  {id:31,grp:"D",home:"USA",away:"Australia",dateStr:"Jun 19",etTime:"15:00",venue:"Lumen Field, Seattle"},
  {id:32,grp:"D",home:"Turkey",away:"Paraguay",dateStr:"Jun 19",etTime:"23:00",venue:"Levi's Stadium, Santa Clara"},
  {id:55,grp:"D",home:"Turkey",away:"USA",dateStr:"Jun 25",etTime:"22:00",venue:"SoFi Stadium, Inglewood"},
  {id:56,grp:"D",home:"Paraguay",away:"Australia",dateStr:"Jun 25",etTime:"22:00",venue:"Levi's Stadium, Santa Clara"},
  {id:9,grp:"E",home:"Germany",away:"Curaçao",dateStr:"Jun 14",etTime:"13:00",venue:"NRG Stadium, Houston"},
  {id:10,grp:"E",home:"Ivory Coast",away:"Ecuador",dateStr:"Jun 14",etTime:"19:00",venue:"Lincoln Financial Field, Philadelphia"},
  {id:33,grp:"E",home:"Germany",away:"Ivory Coast",dateStr:"Jun 20",etTime:"16:00",venue:"BMO Field, Toronto"},
  {id:34,grp:"E",home:"Ecuador",away:"Curaçao",dateStr:"Jun 20",etTime:"20:00",venue:"Arrowhead Stadium, Kansas City"},
  {id:57,grp:"E",home:"Curaçao",away:"Ivory Coast",dateStr:"Jun 25",etTime:"16:00",venue:"Lincoln Financial Field, Philadelphia"},
  {id:58,grp:"E",home:"Ecuador",away:"Germany",dateStr:"Jun 25",etTime:"16:00",venue:"MetLife Stadium, East Rutherford"},
  {id:11,grp:"F",home:"Netherlands",away:"Japan",dateStr:"Jun 14",etTime:"16:00",venue:"AT&T Stadium, Arlington"},
  {id:12,grp:"F",home:"Sweden",away:"Tunisia",dateStr:"Jun 14",etTime:"22:00",venue:"Estadio BBVA, Monterrey"},
  {id:35,grp:"F",home:"Netherlands",away:"Sweden",dateStr:"Jun 20",etTime:"13:00",venue:"NRG Stadium, Houston"},
  {id:36,grp:"F",home:"Tunisia",away:"Japan",dateStr:"Jun 21",etTime:"00:00",venue:"Estadio BBVA, Monterrey"},
  {id:59,grp:"F",home:"Japan",away:"Sweden",dateStr:"Jun 25",etTime:"19:00",venue:"AT&T Stadium, Arlington"},
  {id:60,grp:"F",home:"Tunisia",away:"Netherlands",dateStr:"Jun 25",etTime:"19:00",venue:"Arrowhead Stadium, Kansas City"},
  {id:15,grp:"G",home:"Belgium",away:"Egypt",dateStr:"Jun 15",etTime:"15:00",venue:"Lumen Field, Seattle"},
  {id:16,grp:"G",home:"Iran",away:"New Zealand",dateStr:"Jun 15",etTime:"21:00",venue:"SoFi Stadium, Inglewood"},
  {id:39,grp:"G",home:"Belgium",away:"Iran",dateStr:"Jun 21",etTime:"15:00",venue:"SoFi Stadium, Inglewood"},
  {id:40,grp:"G",home:"New Zealand",away:"Egypt",dateStr:"Jun 21",etTime:"21:00",venue:"BC Place, Vancouver"},
  {id:63,grp:"G",home:"Egypt",away:"Iran",dateStr:"Jun 26",etTime:"23:00",venue:"Lumen Field, Seattle"},
  {id:64,grp:"G",home:"New Zealand",away:"Belgium",dateStr:"Jun 26",etTime:"23:00",venue:"BC Place, Vancouver"},
  {id:17,grp:"H",home:"Spain",away:"Cape Verde",dateStr:"Jun 15",etTime:"12:00",venue:"Mercedes-Benz Stadium, Atlanta"},
  {id:18,grp:"H",home:"Saudi Arabia",away:"Uruguay",dateStr:"Jun 15",etTime:"18:00",venue:"Hard Rock Stadium, Miami Gardens"},
  {id:41,grp:"H",home:"Spain",away:"Saudi Arabia",dateStr:"Jun 21",etTime:"12:00",venue:"Mercedes-Benz Stadium, Atlanta"},
  {id:42,grp:"H",home:"Uruguay",away:"Cape Verde",dateStr:"Jun 21",etTime:"18:00",venue:"Hard Rock Stadium, Miami Gardens"},
  {id:65,grp:"H",home:"Cape Verde",away:"Saudi Arabia",dateStr:"Jun 26",etTime:"20:00",venue:"NRG Stadium, Houston"},
  {id:66,grp:"H",home:"Uruguay",away:"Spain",dateStr:"Jun 26",etTime:"20:00",venue:"Estadio Akron, Zapopan"},
  {id:19,grp:"I",home:"France",away:"Senegal",dateStr:"Jun 16",etTime:"15:00",venue:"MetLife Stadium, East Rutherford"},
  {id:20,grp:"I",home:"Iraq",away:"Norway",dateStr:"Jun 16",etTime:"18:00",venue:"Gillette Stadium, Foxborough"},
  {id:43,grp:"I",home:"France",away:"Iraq",dateStr:"Jun 22",etTime:"17:00",venue:"Lincoln Financial Field, Philadelphia"},
  {id:44,grp:"I",home:"Norway",away:"Senegal",dateStr:"Jun 22",etTime:"20:00",venue:"MetLife Stadium, East Rutherford"},
  {id:67,grp:"I",home:"Norway",away:"France",dateStr:"Jun 26",etTime:"15:00",venue:"Gillette Stadium, Foxborough"},
  {id:68,grp:"I",home:"Senegal",away:"Iraq",dateStr:"Jun 26",etTime:"15:00",venue:"BMO Field, Toronto"},
  {id:21,grp:"J",home:"Argentina",away:"Algeria",dateStr:"Jun 16",etTime:"21:00",venue:"Arrowhead Stadium, Kansas City"},
  {id:22,grp:"J",home:"Austria",away:"Jordan",dateStr:"Jun 17",etTime:"00:00",venue:"Levi's Stadium, Santa Clara"},
  {id:45,grp:"J",home:"Argentina",away:"Austria",dateStr:"Jun 22",etTime:"13:00",venue:"AT&T Stadium, Arlington"},
  {id:46,grp:"J",home:"Jordan",away:"Algeria",dateStr:"Jun 22",etTime:"23:00",venue:"Levi's Stadium, Santa Clara"},
  {id:69,grp:"J",home:"Algeria",away:"Austria",dateStr:"Jun 27",etTime:"22:00",venue:"Arrowhead Stadium, Kansas City"},
  {id:70,grp:"J",home:"Jordan",away:"Argentina",dateStr:"Jun 27",etTime:"22:00",venue:"AT&T Stadium, Arlington"},
  {id:13,grp:"K",home:"Portugal",away:"DR Congo",dateStr:"Jun 17",etTime:"13:00",venue:"NRG Stadium, Houston"},
  {id:14,grp:"K",home:"Uzbekistan",away:"Colombia",dateStr:"Jun 17",etTime:"22:00",venue:"Estadio Azteca, Mexico City"},
  {id:37,grp:"K",home:"Portugal",away:"Uzbekistan",dateStr:"Jun 23",etTime:"13:00",venue:"NRG Stadium, Houston"},
  {id:38,grp:"K",home:"Colombia",away:"DR Congo",dateStr:"Jun 23",etTime:"22:00",venue:"Estadio Akron, Zapopan"},
  {id:61,grp:"K",home:"Colombia",away:"Portugal",dateStr:"Jun 27",etTime:"19:30",venue:"Hard Rock Stadium, Miami Gardens"},
  {id:62,grp:"K",home:"DR Congo",away:"Uzbekistan",dateStr:"Jun 27",etTime:"19:30",venue:"Mercedes-Benz Stadium, Atlanta"},
  {id:23,grp:"L",home:"England",away:"Croatia",dateStr:"Jun 17",etTime:"16:00",venue:"AT&T Stadium, Arlington"},
  {id:24,grp:"L",home:"Ghana",away:"Panama",dateStr:"Jun 17",etTime:"19:00",venue:"BMO Field, Toronto"},
  {id:47,grp:"L",home:"England",away:"Ghana",dateStr:"Jun 23",etTime:"16:00",venue:"Gillette Stadium, Foxborough"},
  {id:48,grp:"L",home:"Panama",away:"Croatia",dateStr:"Jun 23",etTime:"19:00",venue:"BMO Field, Toronto"},
  {id:71,grp:"L",home:"Panama",away:"England",dateStr:"Jun 27",etTime:"17:00",venue:"MetLife Stadium, East Rutherford"},
  {id:72,grp:"L",home:"Croatia",away:"Ghana",dateStr:"Jun 27",etTime:"17:00",venue:"Lincoln Financial Field, Philadelphia"},
];

const KNOCKOUT_ROUNDS=[
  {round:"Round of 32",short:"R32",dates:"Jun 28–Jul 3",matches:[
    {id:"r32-1",home:"Runner-up A",away:"Runner-up B",date:"Jun 28",etTime:"15:00",venue:"SoFi Stadium, Inglewood"},
    {id:"r32-2",home:"Winner C",away:"Runner-up F",date:"Jun 29",etTime:"13:00",venue:"NRG Stadium, Houston"},
    {id:"r32-3",home:"Winner E",away:"Best 3rd",date:"Jun 29",etTime:"16:30",venue:"Gillette Stadium, Foxborough"},
    {id:"r32-4",home:"Winner F",away:"Runner-up C",date:"Jun 29",etTime:"21:00",venue:"Estadio BBVA, Monterrey"},
    {id:"r32-5",home:"Runner-up E",away:"Runner-up I",date:"Jun 30",etTime:"13:00",venue:"AT&T Stadium, Arlington"},
    {id:"r32-6",home:"Winner I",away:"Best 3rd",date:"Jun 30",etTime:"17:00",venue:"MetLife Stadium, East Rutherford"},
    {id:"r32-7",home:"Winner A",away:"Best 3rd",date:"Jun 30",etTime:"21:00",venue:"Estadio Azteca, Mexico City"},
    {id:"r32-8",home:"Winner L",away:"Best 3rd",date:"Jul 1",etTime:"12:00",venue:"Mercedes-Benz Stadium, Atlanta"},
    {id:"r32-9",home:"Winner G",away:"Best 3rd",date:"Jul 1",etTime:"16:00",venue:"Lumen Field, Seattle"},
    {id:"r32-10",home:"Winner D",away:"Best 3rd",date:"Jul 1",etTime:"20:00",venue:"Levi's Stadium, Santa Clara"},
    {id:"r32-11",home:"Winner H",away:"Runner-up J",date:"Jul 2",etTime:"15:00",venue:"SoFi Stadium, Inglewood"},
    {id:"r32-12",home:"Runner-up K",away:"Runner-up L",date:"Jul 2",etTime:"19:00",venue:"BMO Field, Toronto"},
    {id:"r32-13",home:"Winner B",away:"Best 3rd",date:"Jul 2",etTime:"23:00",venue:"BC Place, Vancouver"},
    {id:"r32-14",home:"Runner-up D",away:"Runner-up G",date:"Jul 3",etTime:"14:00",venue:"AT&T Stadium, Arlington"},
    {id:"r32-15",home:"Winner J",away:"Runner-up H",date:"Jul 3",etTime:"18:00",venue:"Hard Rock Stadium, Miami Gardens"},
    {id:"r32-16",home:"Winner K",away:"Best 3rd",date:"Jul 3",etTime:"21:30",venue:"Arrowhead Stadium, Kansas City"},
  ]},
  {round:"Round of 16",short:"R16",dates:"Jul 4–7",matches:[
    {id:"r16-1",home:"W R32-1",away:"W R32-2",date:"Jul 4",etTime:"13:00",venue:"NRG Stadium, Houston"},
    {id:"r16-2",home:"W R32-3",away:"W R32-4",date:"Jul 4",etTime:"17:00",venue:"Lincoln Financial Field, Philadelphia"},
    {id:"r16-3",home:"W R32-5",away:"W R32-6",date:"Jul 5",etTime:"16:00",venue:"MetLife Stadium, East Rutherford"},
    {id:"r16-4",home:"W R32-7",away:"W R32-8",date:"Jul 5",etTime:"20:00",venue:"Estadio Azteca, Mexico City"},
    {id:"r16-5",home:"W R32-9",away:"W R32-10",date:"Jul 6",etTime:"15:00",venue:"AT&T Stadium, Arlington"},
    {id:"r16-6",home:"W R32-11",away:"W R32-12",date:"Jul 6",etTime:"20:00",venue:"Lumen Field, Seattle"},
    {id:"r16-7",home:"W R32-13",away:"W R32-14",date:"Jul 7",etTime:"12:00",venue:"Mercedes-Benz Stadium, Atlanta"},
    {id:"r16-8",home:"W R32-15",away:"W R32-16",date:"Jul 7",etTime:"16:00",venue:"BC Place, Vancouver"},
  ]},
  {round:"Quarter-Finals",short:"QF",dates:"Jul 9–11",matches:[
    {id:"qf-1",home:"W R16-1",away:"W R16-2",date:"Jul 9",etTime:"16:00",venue:"Gillette Stadium, Foxborough"},
    {id:"qf-2",home:"W R16-3",away:"W R16-4",date:"Jul 10",etTime:"15:00",venue:"SoFi Stadium, Inglewood"},
    {id:"qf-3",home:"W R16-5",away:"W R16-6",date:"Jul 11",etTime:"17:00",venue:"Hard Rock Stadium, Miami Gardens"},
    {id:"qf-4",home:"W R16-7",away:"W R16-8",date:"Jul 11",etTime:"21:00",venue:"Arrowhead Stadium, Kansas City"},
  ]},
  {round:"Semi-Finals",short:"SF",dates:"Jul 14–15",matches:[
    {id:"sf-1",home:"W QF-1",away:"W QF-2",date:"Jul 14",etTime:"15:00",venue:"AT&T Stadium, Arlington"},
    {id:"sf-2",home:"W QF-3",away:"W QF-4",date:"Jul 15",etTime:"15:00",venue:"Mercedes-Benz Stadium, Atlanta"},
  ]},
  {round:"3rd Place",short:"3PL",dates:"Jul 18",matches:[
    {id:"3pl",home:"L SF-1",away:"L SF-2",date:"Jul 18",etTime:"17:00",venue:"Hard Rock Stadium, Miami Gardens"},
  ]},
  {round:"Final",short:"FIN",dates:"Jul 19",matches:[
    {id:"fin",home:"W SF-1",away:"W SF-2",date:"Jul 19",etTime:"15:00",venue:"MetLife Stadium, East Rutherford"},
  ]},
];

const STADIUMS=[
  {name:"Estadio Azteca",city:"Mexico City",cap:87600,matches:9,flag:"🇲🇽",note:"বিশ্বের ৩য় বৃহত্তম। ১৯৭০ ও ১৯৮৬ বিশ্বকাপের মঞ্চ। ম্যারাডোনার 'হাত ঈশ্বরের' গোল এখানেই।"},
  {name:"MetLife Stadium",city:"East Rutherford, NJ",cap:82500,matches:8,flag:"🇺🇸",note:"ফাইনালের ভেন্যু। নিউ ইয়র্ক থেকে মাত্র ১০ মাইল।"},
  {name:"AT&T Stadium",city:"Arlington, TX",cap:80000,matches:9,flag:"🇺🇸",note:"সর্বাধিক ৯টি ম্যাচ আয়োজক। সেমিফাইনালও এখানে।"},
  {name:"SoFi Stadium",city:"Inglewood, CA",cap:70240,matches:7,flag:"🇺🇸",note:"LA-র সবচেয়ে আধুনিক স্টেডিয়াম, ১.৯ বিলিয়ন ডলারে নির্মিত।"},
  {name:"NRG Stadium",city:"Houston, TX",cap:72220,matches:7,flag:"🇺🇸",note:"রিট্র্যাক্টেবল ছাদ আছে — গরম ও বৃষ্টি থেকে সুরক্ষিত।"},
  {name:"Mercedes-Benz Stadium",city:"Atlanta, GA",cap:71000,matches:7,flag:"🇺🇸",note:"সেমিফাইনালের ভেন্যু। ফুলের পাপড়ির মতো ছাদের জন্য বিখ্যাত।"},
  {name:"Hard Rock Stadium",city:"Miami Gardens, FL",cap:65326,matches:7,flag:"🇺🇸",note:"তৃতীয় স্থান ম্যাচের ভেন্যু।"},
  {name:"Arrowhead Stadium",city:"Kansas City, MO",cap:76416,matches:6,flag:"🇺🇸",note:"গিনেস রেকর্ড — NFL-এ সবচেয়ে উচ্চস্বর দর্শক।"},
  {name:"Lincoln Financial Field",city:"Philadelphia, PA",cap:69796,matches:6,flag:"🇺🇸",note:"স্বাধীনতার শহর ফিলাডেলফিয়ায়।"},
  {name:"Lumen Field",city:"Seattle, WA",cap:69000,matches:6,flag:"🇺🇸",note:"প্রশান্ত মহাসাগরের কাছে, পাহাড়ঘেরা পরিবেশ।"},
  {name:"Levi's Stadium",city:"Santa Clara, CA",cap:68500,matches:6,flag:"🇺🇸",note:"Silicon Valley-এর হৃদয়ে।"},
  {name:"Gillette Stadium",city:"Foxborough, MA",cap:65878,matches:6,flag:"🇺🇸",note:"বোস্টনের কাছে, New England Patriots-এর হোম।"},
  {name:"BMO Field",city:"Toronto",cap:45000,matches:6,flag:"🇨🇦",note:"কানাডার প্রধান ভেন্যু। বিশ্বকাপের জন্য সম্প্রসারিত।"},
  {name:"BC Place",city:"Vancouver",cap:54000,matches:6,flag:"🇨🇦",note:"পাহাড় ও সমুদ্রঘেরা ভ্যাঙ্কুভারে।"},
  {name:"Estadio BBVA",city:"Monterrey",cap:53500,matches:6,flag:"🇲🇽",note:"মেক্সিকোর পাহাড়ি শহর মন্টেরেতে।"},
  {name:"Estadio Akron",city:"Zapopan, GDL",cap:49850,matches:6,flag:"🇲🇽",note:"গুয়াদালাহারার আধুনিক স্টেডিয়াম।"},
];

const SQUADS={
  // ── GROUP A ──
  Mexico:{coach:"Javier Aguirre",players:[
    {num:1,pos:"GK",name:"Raul Rangel",club:"Chivas"},
    {num:12,pos:"GK",name:"Guillermo Ochoa",club:"AEL Limassol"},
    {num:23,pos:"GK",name:"Carlos Acevedo",club:"Santos Laguna"},
    {num:2,pos:"DEF",name:"Johan Vasquez",club:"Genoa"},
    {num:3,pos:"DEF",name:"Cesar Montes",club:"Lokomotiv Moscow"},
    {num:4,pos:"DEF",name:"Julian Araujo",club:"Celtic"},
    {num:5,pos:"DEF",name:"Jorge Sanchez",club:"PAOK"},
    {num:6,pos:"DEF",name:"Jesus Gallardo",club:"Toluca"},
    {num:13,pos:"DEF",name:"Israel Reyes",club:"América"},
    {num:15,pos:"DEF",name:"Mateo Chavez",club:"AZ Alkmaar"},
    {num:7,pos:"MID",name:"Edson Alvarez",club:"Fenerbahce"},
    {num:8,pos:"MID",name:"Orbelin Pineda",club:"AEK Athens"},
    {num:10,pos:"MID",name:"Alvaro Fidalgo",club:"Real Betis"},
    {num:14,pos:"MID",name:"Obed Vargas",club:"Atletico Madrid"},
    {num:16,pos:"MID",name:"Roberto Alvarado",club:"Chivas"},
    {num:17,pos:"MID",name:"Luis Chavez",club:"Dynamo Moscow"},
    {num:18,pos:"MID",name:"Efrain Alvarez",club:"Chivas"},
    {num:9,pos:"FWD",name:"Raúl Jiménez",club:"Fulham"},
    {num:11,pos:"FWD",name:"Santiago Gimenez",club:"AC Milan"},
    {num:19,pos:"FWD",name:"Julian Quiñones",club:"Al Qadsiah"},
    {num:20,pos:"FWD",name:"Cesar Huerta",club:"Anderlecht"},
    {num:21,pos:"FWD",name:"German Berterame",club:"Inter Miami"},
    {num:22,pos:"MID",name:"Erick Gutierrez",club:"PSV Eindhoven"},
    {num:24,pos:"DEF",name:"Jorge Mere",club:"Cologne"},
    {num:25,pos:"FWD",name:"Rogelio Funes Mori",club:"Chivas"},
    {num:26,pos:"FWD",name:"Henry Martin",club:"América"}]},
  "South Africa":{coach:"Hugo Broos",players:[
    {num:1,pos:"GK",name:"Ronwen Williams",club:"Mamelodi Sundowns"},
    {num:16,pos:"GK",name:"Ricardo Goss",club:"Mamelodi Sundowns"},
    {num:23,pos:"GK",name:"Sipho Chaine",club:"Kaizer Chiefs"},
    {num:2,pos:"DEF",name:"Terrence Mashego",club:"Cape Town City"},
    {num:3,pos:"DEF",name:"Siyanda Xulu",club:"Orlando Pirates"},
    {num:4,pos:"DEF",name:"Rushine De Reuck",club:"Mamelodi Sundowns"},
    {num:5,pos:"DEF",name:"Mothobi Mvala",club:"Mamelodi Sundowns"},
    {num:6,pos:"DEF",name:"Thibang Phete",club:"Orlando Pirates"},
    {num:12,pos:"DEF",name:"Nkosinathi Sibisi",club:"Orlando Pirates"},
    {num:15,pos:"DEF",name:"Reeve Frosler",club:"Kaizer Chiefs"},
    {num:7,pos:"MID",name:"Bongani Zungu",club:"Mamelodi Sundowns"},
    {num:8,pos:"MID",name:"Themba Zwane",club:"Mamelodi Sundowns"},
    {num:10,pos:"MID",name:"Percy Tau",club:"Al Ahly"},
    {num:17,pos:"MID",name:"Teboho Mokoena",club:"Mamelodi Sundowns"},
    {num:18,pos:"MID",name:"Yusuf Maart",club:"Kaizer Chiefs"},
    {num:9,pos:"FWD",name:"Oswin Appollis",club:"Mamelodi Sundowns"},
    {num:11,pos:"FWD",name:"Lyle Foster",club:"Burnley"},
    {num:13,pos:"FWD",name:"Evidence Makgopa",club:"Orlando Pirates"},
    {num:19,pos:"FWD",name:"Iqraam Rayners",club:"Mamelodi Sundowns"},
    {num:20,pos:"FWD",name:"Relebohile Mofokeng",club:"Orlando Pirates"},
    {num:21,pos:"FWD",name:"Elias Mokwana",club:"Mamelodi Sundowns"},
    {num:22,pos:"FWD",name:"Teboho Mokoena",club:"Mamelodi Sundowns"},
    {num:24,pos:"DEF",name:"Thapelo Morena",club:"Mamelodi Sundowns"},
    {num:25,pos:"FWD",name:"Victor Letsoalo",club:"Kaizer Chiefs"},
    {num:26,pos:"FWD",name:"Sfiso Hlanti",club:"Kaizer Chiefs"},
    {num:90,pos:"MID",name:"Thapelo Morena",club:"Mamelodi Sundowns"}]},
  "South Korea":{coach:"Hong Myung-bo",players:[
    {num:1,pos:"GK",name:"Jo Hyeon-woo",club:"Ulsan HD"},
    {num:21,pos:"GK",name:"Kim Seung-gyu",club:"FC Tokyo"},
    {num:31,pos:"GK",name:"Song Bum-keun",club:"Jeonbuk Hyundai"},
    {num:2,pos:"DEF",name:"Kim Moon-hwan",club:"Daejeon Hana"},
    {num:3,pos:"DEF",name:"Kim Min-jae",club:"Bayern Munich"},
    {num:4,pos:"DEF",name:"Jo Yu-min",club:"Sharjah"},
    {num:5,pos:"DEF",name:"Lee Tae-seok",club:"Austria Vienna"},
    {num:6,pos:"DEF",name:"Seol Young-woo",club:"Red Star Belgrade"},
    {num:12,pos:"DEF",name:"Lee Han-beom",club:"Midtjylland"},
    {num:13,pos:"DEF",name:"Park Jin-seop",club:"Zhejiang FC"},
    {num:15,pos:"DEF",name:"Kim Tae-hyun",club:"Kashima Antlers"},
    {num:16,pos:"DEF",name:"Lee Ki-hyeok",club:"Gangwon FC"},
    {num:17,pos:"DEF",name:"Jens Castrop",club:"Borussia M'gladbach"},
    {num:7,pos:"MID",name:"Son Heung-min",club:"LAFC"},
    {num:8,pos:"MID",name:"Lee Jae-sung",club:"Mainz"},
    {num:10,pos:"MID",name:"Lee Kang-in",club:"PSG"},
    {num:11,pos:"MID",name:"Hwang Hee-chan",club:"Wolverhampton"},
    {num:14,pos:"MID",name:"Hwang In-beom",club:"Feyenoord"},
    {num:18,pos:"MID",name:"Paik Seung-ho",club:"Birmingham City"},
    {num:19,pos:"MID",name:"Bae Jun-ho",club:"Stoke City"},
    {num:20,pos:"MID",name:"Yang Hyun-jun",club:"Celtic"},
    {num:9,pos:"FWD",name:"Cho Gue-sung",club:"Midtjylland"},
    {num:22,pos:"FWD",name:"Oh Hyeon-kyu",club:"Besiktas"},
    {num:23,pos:"FWD",name:"Um Ji-sung",club:"Swansea City"},
    {num:24,pos:"FWD",name:"Oh Hyeon-kyu",club:"Besiktas"},
    {num:25,pos:"FWD",name:"Um Ji-sung",club:"Swansea City"}]},
  "Czech Republic":{coach:"Miroslav Koubek",players:[
    {num:1,pos:"GK",name:"Matej Kovar",club:"PSV"},
    {num:23,pos:"GK",name:"Jindrich Stanek",club:"Slavia Prague"},
    {num:12,pos:"GK",name:"Lukas Hornicek",club:"Braga"},
    {num:2,pos:"DEF",name:"Vladimir Coufal",club:"Hoffenheim"},
    {num:3,pos:"DEF",name:"Ladislav Krejci",club:"Wolverhampton"},
    {num:4,pos:"DEF",name:"Robin Hranac",club:"Hoffenheim"},
    {num:5,pos:"DEF",name:"Martin Vitik",club:"Bologna"},
    {num:6,pos:"DEF",name:"David Jurasek",club:"Slavia Prague"},
    {num:13,pos:"DEF",name:"David Doudera",club:"Slavia Prague"},
    {num:15,pos:"DEF",name:"Tomas Holes",club:"Slavia Prague"},
    {num:8,pos:"MID",name:"Tomas Soucek",club:"West Ham"},
    {num:10,pos:"MID",name:"Pavel Sulc",club:"Lyon"},
    {num:11,pos:"MID",name:"Adam Karabec",club:"Lyon"},
    {num:14,pos:"MID",name:"Lukas Provod",club:"Slavia Prague"},
    {num:17,pos:"MID",name:"Michal Sadilek",club:"Slavia Prague"},
    {num:18,pos:"MID",name:"Pavel Bucha",club:"FC Cincinnati"},
    {num:9,pos:"FWD",name:"Patrik Schick",club:"Bayer Leverkusen"},
    {num:7,pos:"FWD",name:"Adam Hlozek",club:"Hoffenheim"},
    {num:19,pos:"FWD",name:"Tomas Chory",club:"Slavia Prague"},
    {num:20,pos:"FWD",name:"Mojmir Chytil",club:"Slavia Prague"},
    {num:21,pos:"FWD",name:"Matej Vydra",club:"Viktoria Plzen"},
    {num:16,pos:"MID",name:"Martin Mintal",club:"Sparta Prague"},
    {num:22,pos:"DEF",name:"Jakub Brabec",club:"Sparta Prague"},
    {num:24,pos:"FWD",name:"Ladislav Krejci II",club:"Bologna"},
    {num:25,pos:"MID",name:"Ondrej Lingr",club:"Feyenoord"},
    {num:26,pos:"FWD",name:"Vaclav Jurecka",club:"Slavia Prague"}
  ]},
  // ── GROUP B ──
  "Bosnia & Herzegovina":{coach:"Sergej Barbarez",players:[
    {num:1,pos:"GK",name:"Nikola Vasilj",club:"FC St. Pauli"},
    {num:12,pos:"GK",name:"Martin Zlomislić",club:"HNK Rijeka"},
    {num:23,pos:"GK",name:"Osman Hadžikić",club:"Slaven Belupo"},
    {num:2,pos:"DEF",name:"Amar Dedić",club:"Benfica"},
    {num:3,pos:"DEF",name:"Sead Kolašinac",club:"Atalanta"},
    {num:4,pos:"DEF",name:"Nikola Katić",club:"Schalke 04"},
    {num:5,pos:"DEF",name:"Tarik Muharemović",club:"Sassuolo"},
    {num:6,pos:"DEF",name:"Dennis Hadžikadunić",club:"Sampdoria"},
    {num:13,pos:"DEF",name:"Nihad Mujakić",club:"Gaziantep"},
    {num:14,pos:"DEF",name:"Stjepan Radeljić",club:"HNK Rijeka"},
    {num:15,pos:"DEF",name:"Nidal Čelik",club:"Lens"},
    {num:8,pos:"MID",name:"Amir Hadžiahmetović",club:"Hull City"},
    {num:10,pos:"MID",name:"Benjamin Tahirović",club:"Brøndby"},
    {num:16,pos:"MID",name:"Armin Gigović",club:"Young Boys"},
    {num:17,pos:"MID",name:"Dženis Burnić",club:"Karlsruher SC"},
    {num:18,pos:"MID",name:"Ivan Bašić",club:"FC Astana"},
    {num:19,pos:"MID",name:"Amar Memić",club:"Viktoria Plzeň"},
    {num:20,pos:"MID",name:"Ivan Šunjić",club:"Pafos"},
    {num:21,pos:"MID",name:"Ermin Mahmić",club:"Slovan Liberec"},
    {num:9,pos:"FWD",name:"Edin Džeko",club:"Schalke 04"},
    {num:7,pos:"FWD",name:"Ermedin Demirović",club:"Stuttgart"},
    {num:11,pos:"FWD",name:"Haris Tabaković",club:"Borussia M'gladbach"},
    {num:22,pos:"FWD",name:"Esmir Bajraktarević",club:"PSV Eindhoven"},
    {num:24,pos:"FWD",name:"Samed Baždar",club:"Jagiellonia"},
    {num:25,pos:"FWD",name:"Kerim Alajbegović",club:"RB Salzburg"},
    {num:26,pos:"FWD",name:"Jovo Lukić",club:"Universitatea Cluj"},
  ]},
  Canada:{coach:"Jesse Marsch",players:[
    {num:1,pos:"GK",name:"Dayne St Clair",club:"Minnesota United"},
    {num:12,pos:"GK",name:"Maxime Crépeau",club:"Portland Timbers"},
    {num:18,pos:"GK",name:"Milan Borjan",club:"Red Star Belgrade"},
    {num:2,pos:"DEF",name:"Richie Laryea",club:"Toronto FC"},
    {num:3,pos:"DEF",name:"Alphonso Davies",club:"Bayern Munich"},
    {num:4,pos:"DEF",name:"Derek Cornelius",club:"Rangers"},
    {num:5,pos:"DEF",name:"Kamal Miller",club:"Portland Timbers"},
    {num:6,pos:"DEF",name:"Zorhan Bassong",club:"Sporting Kansas City"},
    {num:13,pos:"DEF",name:"Joel Waterman",club:"Chicago Fire"},
    {num:14,pos:"DEF",name:"Doneil Henry",club:"Vancouver Whitecaps"},
    {num:7,pos:"MID",name:"Stephen Eustaquio",club:"Porto"},
    {num:8,pos:"MID",name:"Jonathan Osorio",club:"Toronto FC"},
    {num:10,pos:"MID",name:"Ismael Koné",club:"Sassuolo"},
    {num:16,pos:"MID",name:"Tajon Buchanan",club:"Villarreal"},
    {num:17,pos:"MID",name:"Mathieu Choinière",club:"LAFC"},
    {num:19,pos:"MID",name:"Samuel Piette",club:"CF Montréal"},
    {num:9,pos:"FWD",name:"Jonathan David",club:"Juventus"},
    {num:11,pos:"FWD",name:"Cyle Larin",club:"Feyenoord"},
    {num:15,pos:"FWD",name:"Liam Millar",club:"Mainz"},
    {num:20,pos:"FWD",name:"Tani Oluwaseyi",club:"Villarreal"},
    {num:21,pos:"FWD",name:"Jacen Russell-Rowe",club:"Columbus Crew"},
    {num:22,pos:"FWD",name:"Raheem Edwards",club:"LAFC"},
    {num:23,pos:"FWD",name:"Tani Oluwaseyi",club:"Villarreal"},
    {num:24,pos:"FWD",name:"Jacen Russell-Rowe",club:"Columbus Crew"},
    {num:25,pos:"FWD",name:"Raheem Edwards",club:"LAFC"},
    {num:26,pos:"MID",name:"Charles-Andreas Brym",club:"Racing Louisville"}]},
  Qatar:{coach:"Julen Lopetegui",players:[
    {num:1,pos:"GK",name:"Meshaal Barsham",club:"Al Sadd"},
    {num:12,pos:"GK",name:"Salah Zakaria",club:"Al Duhail"},
    {num:23,pos:"GK",name:"Shehab Elleithy",club:"Al Shahania"},
    {num:24,pos:"GK",name:"Mahmoud Abunada",club:"Al Rayyan"},
    {num:2,pos:"DEF",name:"Pedro Miguel",club:"Al Sadd"},
    {num:3,pos:"DEF",name:"Boualem Khoukhi",club:"Al Sadd"},
    {num:4,pos:"DEF",name:"Sultan Al Brake",club:"Al Duhail"},
    {num:5,pos:"DEF",name:"Bassam Al-Rawi",club:"Al Duhail"},
    {num:6,pos:"DEF",name:"Tarek Salman",club:"Al Sadd"},
    {num:13,pos:"DEF",name:"Lucas Mendes",club:"Al Wakrah"},
    {num:14,pos:"DEF",name:"Ayoub Al-Alawi",club:"Al Gharafa"},
    {num:15,pos:"DEF",name:"Rayyan Al-Ali",club:"Al Gharafa"},
    {num:8,pos:"MID",name:"Karim Boudiaf",club:"Al Duhail"},
    {num:10,pos:"MID",name:"Assim Madibo",club:"Al Wakrah"},
    {num:16,pos:"MID",name:"Abdulaziz Hatem",club:"Al Rayyan"},
    {num:17,pos:"MID",name:"Mohammed Mannai",club:"Al Shamal"},
    {num:18,pos:"MID",name:"Homam Al-Amin",club:"Cultural Leonesa"},
    {num:19,pos:"MID",name:"Ahmed Fathi",club:"Al Arabi"},
    {num:9,pos:"FWD",name:"Almoez Ali",club:"Al Duhail"},
    {num:7,pos:"FWD",name:"Akram Afif",club:"Al Sadd"},
    {num:11,pos:"FWD",name:"Mohammed Muntari",club:"Al Gharafa"},
    {num:20,pos:"FWD",name:"Hassan Al-Haydos",club:"Al Sadd"},
    {num:21,pos:"FWD",name:"Edmilson Junior",club:"Al Duhail"},
    {num:22,pos:"FWD",name:"Tahsin Mohammed",club:"Al Duhail"},
    {num:25,pos:"MID",name:"Sultan Al-Braik",club:"Al Gharafa"},
    {num:26,pos:"FWD",name:"Yusuf Abdurisag",club:"Al Shahania"}]},
  Switzerland:{coach:"Murat Yakin",players:[
    {num:1,pos:"GK",name:"Gregor Kobel",club:"Borussia Dortmund"},
    {num:12,pos:"GK",name:"Yvon Mvogo",club:"Lorient"},
    {num:21,pos:"GK",name:"Marvin Keller",club:"Young Boys"},
    {num:2,pos:"DEF",name:"Silvan Widmer",club:"Mainz"},
    {num:3,pos:"DEF",name:"Ricardo Rodriguez",club:"Real Betis"},
    {num:4,pos:"DEF",name:"Manuel Akanji",club:"Inter Milan"},
    {num:5,pos:"DEF",name:"Nico Elvedi",club:"Borussia M'gladbach"},
    {num:6,pos:"DEF",name:"Eray Comert",club:"Valencia"},
    {num:13,pos:"DEF",name:"Aurele Amenda",club:"Eintracht Frankfurt"},
    {num:14,pos:"DEF",name:"Miro Muheim",club:"Hamburger SV"},
    {num:15,pos:"DEF",name:"Luca Jaquez",club:"Stuttgart"},
    {num:10,pos:"MID",name:"Granit Xhaka",club:"Sunderland"},
    {num:8,pos:"MID",name:"Remo Freuler",club:"Bologna"},
    {num:11,pos:"MID",name:"Ruben Vargas",club:"Sevilla"},
    {num:16,pos:"MID",name:"Denis Zakaria",club:"Monaco"},
    {num:17,pos:"MID",name:"Djibril Sow",club:"Sevilla"},
    {num:18,pos:"MID",name:"Ardon Jashari",club:"AC Milan"},
    {num:19,pos:"MID",name:"Michel Aebischer",club:"Pisa"},
    {num:20,pos:"MID",name:"Fabian Rieder",club:"Augsburg"},
    {num:22,pos:"MID",name:"Johan Manzambi",club:"Freiburg"},
    {num:7,pos:"FWD",name:"Breel Embolo",club:"Rennes"},
    {num:9,pos:"FWD",name:"Zeki Amdouni",club:"Burnley"},
    {num:23,pos:"FWD",name:"Dan Ndoye",club:"Nottingham Forest"},
    {num:24,pos:"FWD",name:"Noah Okafor",club:"Leeds"},
    {num:25,pos:"FWD",name:"Cedric Itten",club:"Fortuna Düsseldorf"},
    {num:26,pos:"FWD",name:"Kwadwo Duah",club:"Lugano"}]},
  // ── GROUP C ──
  Brazil:{coach:"Carlo Ancelotti",players:[
    {num:1,pos:"GK",name:"Alisson",club:"Liverpool"},
    {num:23,pos:"GK",name:"Ederson",club:"Fenerbahce"},
    {num:12,pos:"GK",name:"Weverton",club:"Gremio"},
    {num:2,pos:"DEF",name:"Danilo",club:"Flamengo"},
    {num:3,pos:"DEF",name:"Alex Sandro",club:"Flamengo"},
    {num:4,pos:"DEF",name:"Marquinhos",club:"PSG"},
    {num:5,pos:"DEF",name:"Gabriel Magalhães",club:"Arsenal"},
    {num:6,pos:"DEF",name:"Bremer",club:"Juventus"},
    {num:13,pos:"DEF",name:"Wesley",club:"Roma"},
    {num:14,pos:"DEF",name:"Leo Pereira",club:"Flamengo"},
    {num:15,pos:"DEF",name:"Roger Ibanez",club:"Al-Ahli"},
    {num:16,pos:"DEF",name:"Douglas Santos",club:"Zenit"},
    {num:8,pos:"MID",name:"Casemiro",club:"Man United"},
    {num:10,pos:"MID",name:"Lucas Paquetá",club:"Flamengo"},
    {num:17,pos:"MID",name:"Bruno Guimarães",club:"Newcastle"},
    {num:18,pos:"MID",name:"Fabinho",club:"Al-Ittihad"},
    {num:19,pos:"MID",name:"Danilo Santos",club:"Botafogo"},
    {num:7,pos:"FWD",name:"Vinicius Jr",club:"Real Madrid"},
    {num:9,pos:"FWD",name:"Neymar",club:"Santos"},
    {num:11,pos:"FWD",name:"Raphinha",club:"Barcelona"},
    {num:20,pos:"FWD",name:"Gabriel Martinelli",club:"Arsenal"},
    {num:21,pos:"FWD",name:"Matheus Cunha",club:"Man United"},
    {num:22,pos:"FWD",name:"Endrick",club:"Lyon"},
    {num:24,pos:"FWD",name:"Igor Thiago",club:"Brentford"},
    {num:25,pos:"FWD",name:"Luiz Henrique",club:"Zenit"},
    {num:26,pos:"FWD",name:"Rayan",club:"Bournemouth"},
  ]},
  Haiti:{coach:"Sébastien Migné",players:[
    {num:1,pos:"GK",name:"Jhony Placide",club:"Bastia"},
    {num:12,pos:"GK",name:"Alexandre Pierre",club:"Sochaux"},
    {num:23,pos:"GK",name:"Josue Duverger",club:"Cosmos Koblenz"},
    {num:2,pos:"DEF",name:"Carlens Arcus",club:"Angers"},
    {num:3,pos:"DEF",name:"Jean-Kevin Duverne",club:"Gent"},
    {num:4,pos:"DEF",name:"Martin Experience",club:"Nancy"},
    {num:5,pos:"DEF",name:"Ricardo Ade",club:"LDU Quito"},
    {num:6,pos:"DEF",name:"Duke Lacroix",club:"Colorado Springs"},
    {num:13,pos:"DEF",name:"Wilguens Paugain",club:"Zulte Waregem"},
    {num:14,pos:"DEF",name:"Hannes Delcroix",club:"Lugano"},
    {num:15,pos:"DEF",name:"Keeto Thermoncy",club:"Young Boys"},
    {num:8,pos:"MID",name:"Jean-Ricner Bellegarde",club:"Wolves"},
    {num:10,pos:"MID",name:"Danley Jean Jacques",club:"Philadelphia Union"},
    {num:16,pos:"MID",name:"Carl Sainté",club:"El Paso Locomotive"},
    {num:17,pos:"MID",name:"Leverton Pierre",club:"Vizela"},
    {num:18,pos:"MID",name:"Woodensky Pierre",club:"Violette"},
    {num:19,pos:"MID",name:"Dominique Simon",club:"FC Tatran Prešov"},
    {num:9,pos:"FWD",name:"Duckens Nazon",club:"Esteghlal"},
    {num:7,pos:"FWD",name:"Wilson Isidor",club:"Sunderland"},
    {num:11,pos:"FWD",name:"Frantzdy Pierrot",club:"Rizespor"},
    {num:20,pos:"FWD",name:"Derrick Etienne",club:"Toronto FC"},
    {num:21,pos:"FWD",name:"Josue Casimir",club:"Auxerre"},
    {num:22,pos:"FWD",name:"Ruben Providence",club:"Almere"},
    {num:24,pos:"FWD",name:"Lenny Joseph",club:"Ferencváros"},
    {num:25,pos:"FWD",name:"Don Deedson Louicius",club:"FC Dallas"},
    {num:26,pos:"FWD",name:"Do Amado",club:"Clermont Foot"}]},
  Morocco:{coach:"Mohamed Ouahbi",players:[
    {num:1,pos:"GK",name:"Yassine Bounou",club:"Al Hilal"},
    {num:12,pos:"GK",name:"Ahmed Reda Tagnaouti",club:"Wydad AC"},
    {num:23,pos:"GK",name:"Anas Zniti",club:"Raja CA"},
    {num:2,pos:"DEF",name:"Achraf Hakimi",club:"PSG"},
    {num:3,pos:"DEF",name:"Noussair Mazraoui",club:"Man United"},
    {num:4,pos:"DEF",name:"Nayef Aguerd",club:"Crystal Palace"},
    {num:5,pos:"DEF",name:"Jawad El Yamiq",club:"Villarreal"},
    {num:6,pos:"DEF",name:"Romain Saiss",club:"Besiktas"},
    {num:13,pos:"DEF",name:"Yahia Attiyat Allah",club:"Wydad AC"},
    {num:14,pos:"DEF",name:"Badr Benoun",club:"Al Qadsiah"},
    {num:7,pos:"MID",name:"Sofyan Amrabat",club:"Fiorentina"},
    {num:8,pos:"MID",name:"Azzedine Ounahi",club:"Marseille"},
    {num:10,pos:"MID",name:"Bilal El Khannouss",club:"Genk"},
    {num:16,pos:"MID",name:"Ismael Saibari",club:"PSV"},
    {num:17,pos:"MID",name:"Neil El Aynaoui",club:"Rennes"},
    {num:18,pos:"MID",name:"Ilias Chair",club:"Strasbourg"},
    {num:9,pos:"FWD",name:"Ayoub El Kaabi",club:"Olympiacos"},
    {num:11,pos:"FWD",name:"Soufiane Rahimi",club:"Al Ain"},
    {num:19,pos:"FWD",name:"Abde Ezzalzouli",club:"Osasuna"},
    {num:20,pos:"FWD",name:"Brahim Díaz",club:"Real Madrid"},
    {num:21,pos:"FWD",name:"Chemsdine Talbi",club:"Club Brugge"},
    {num:15,pos:"MID",name:"Sofiane Boufal",club:"Angers"},
    {num:22,pos:"MID",name:"Zakaria Aboukhlal",club:"Toulouse"},
    {num:24,pos:"FWD",name:"Soufiane El Bouazzati",club:"Wydad AC"},
    {num:26,pos:"FWD",name:"Youssef En-Nesyri",club:"Fenerbahce"}]},
  Scotland:{coach:"Steve Clarke",players:[
    {num:1,pos:"GK",name:"Angus Gunn",club:"Nottingham Forest"},
    {num:12,pos:"GK",name:"Craig Gordon",club:"Heart of Midlothian"},
    {num:23,pos:"GK",name:"Liam Kelly",club:"Rangers"},
    {num:2,pos:"DEF",name:"Anthony Ralston",club:"Celtic"},
    {num:3,pos:"DEF",name:"Andy Robertson",club:"Liverpool"},
    {num:4,pos:"DEF",name:"Grant Hanley",club:"Hibernian"},
    {num:5,pos:"DEF",name:"John Souttar",club:"Rangers"},
    {num:6,pos:"DEF",name:"Scott McKenna",club:"Dinamo Zagreb"},
    {num:13,pos:"DEF",name:"Jack Hendry",club:"Al-Ettifaq"},
    {num:14,pos:"DEF",name:"Kieran Tierney",club:"Celtic"},
    {num:15,pos:"DEF",name:"Aaron Hickey",club:"Brentford"},
    {num:16,pos:"DEF",name:"Nathan Patterson",club:"Everton"},
    {num:17,pos:"DEF",name:"Dom Hyam",club:"Wrexham"},
    {num:8,pos:"MID",name:"Scott McTominay",club:"Napoli"},
    {num:10,pos:"MID",name:"John McGinn",club:"Aston Villa"},
    {num:11,pos:"MID",name:"Billy Gilmour",club:"Napoli"},
    {num:18,pos:"MID",name:"Ryan Christie",club:"Bournemouth"},
    {num:19,pos:"MID",name:"Lewis Ferguson",club:"Bologna"},
    {num:20,pos:"MID",name:"Kenny McLean",club:"Norwich City"},
    {num:21,pos:"MID",name:"Ben Gannon-Doak",club:"Bournemouth"},
    {num:22,pos:"MID",name:"Findlay Curtis",club:"Rangers"},
    {num:7,pos:"FWD",name:"Lawrence Shankland",club:"Heart of Midlothian"},
    {num:9,pos:"FWD",name:"Che Adams",club:"Torino"},
    {num:24,pos:"FWD",name:"Lyndon Dykes",club:"Charlton"},
    {num:25,pos:"FWD",name:"George Hirst",club:"Ipswich"},
    {num:26,pos:"FWD",name:"Ross Stewart",club:"Southampton"},
  ]},
  // ── GROUP D ──
  Australia:{coach:"Tony Popovic",players:[
    {num:1,pos:"GK",name:"Mathew Ryan",club:"Levante"},
    {num:12,pos:"GK",name:"Paul Izzo",club:"Randers"},
    {num:23,pos:"GK",name:"Patrick Beach",club:"Melbourne City"},
    {num:2,pos:"DEF",name:"Milos Degenek",club:"TSC"},
    {num:3,pos:"DEF",name:"Lewis Miller",club:"Blackburn Rovers"},
    {num:4,pos:"DEF",name:"Kye Rowles",club:"DC United"},
    {num:5,pos:"DEF",name:"Cameron Burgess",club:"Swansea City"},
    {num:6,pos:"DEF",name:"Jason Geria",club:"Albirex Niigata"},
    {num:13,pos:"DEF",name:"Callum Elder",club:"Derby County"},
    {num:14,pos:"DEF",name:"Harry Souttar",club:"Middlesbrough"},
    {num:7,pos:"MID",name:"Riley McGree",club:"Middlesbrough"},
    {num:8,pos:"MID",name:"Jackson Irvine",club:"St Pauli"},
    {num:10,pos:"MID",name:"Connor Metcalfe",club:"St Pauli"},
    {num:16,pos:"MID",name:"Cameron Devlin",club:"Heart of Midlothian"},
    {num:17,pos:"MID",name:"Aiden O'Neill",club:"New York City"},
    {num:18,pos:"MID",name:"Marco Tilio",club:"Celtic"},
    {num:9,pos:"FWD",name:"Nestory Irankunda",club:"Watford"},
    {num:11,pos:"FWD",name:"Martin Boyle",club:"Hibernian"},
    {num:19,pos:"FWD",name:"Craig Goodwin",club:"Adelaide United"},
    {num:20,pos:"FWD",name:"Nicholas D'Agostino",club:"Viking"},
    {num:21,pos:"FWD",name:"Mohamed Toure",club:"Randers"},
    {num:15,pos:"DEF",name:"Thomas Deng",club:"ADO Den Haag"},
    {num:22,pos:"MID",name:"Denis Genreau",club:"Toulouse"},
    {num:24,pos:"FWD",name:"Mathew Leckie",club:"Melbourne City"},
    {num:25,pos:"FWD",name:"Lachlan Wales",club:"Wellington Phoenix"},
    {num:26,pos:"MID",name:"Keanu Baccus",club:"St Mirren"}]},
  Turkey:{coach:"Vincenzo Montella",players:[
    {num:1,pos:"GK",name:"Altay Bayindir",club:"Man United"},
    {num:12,pos:"GK",name:"Ersin Destanoglu",club:"Besiktas"},
    {num:23,pos:"GK",name:"Mert Gunok",club:"Fenerbahce"},
    {num:2,pos:"DEF",name:"Zeki Celik",club:"Roma"},
    {num:3,pos:"DEF",name:"Ferdi Kadioglu",club:"Brighton"},
    {num:4,pos:"DEF",name:"Caglar Soyuncu",club:"Fenerbahce"},
    {num:5,pos:"DEF",name:"Abdulkerim Bardakci",club:"Galatasaray"},
    {num:6,pos:"DEF",name:"Merih Demiral",club:"Al-Ahli"},
    {num:13,pos:"DEF",name:"Ahmetcan Kaplan",club:"NEC Nijmegen"},
    {num:14,pos:"DEF",name:"Ozan Kabak",club:"Hoffenheim"},
    {num:8,pos:"MID",name:"Hakan Calhanoglu",club:"Inter Milan"},
    {num:10,pos:"MID",name:"Orkun Kokcu",club:"Besiktas"},
    {num:17,pos:"MID",name:"Atakan Karazor",club:"Stuttgart"},
    {num:18,pos:"MID",name:"Salih Ozcan",club:"Borussia Dortmund"},
    {num:19,pos:"MID",name:"Kaan Ayhan",club:"Galatasaray"},
    {num:20,pos:"MID",name:"Ismail Yuksek",club:"Fenerbahce"},
    {num:7,pos:"FWD",name:"Arda Güler",club:"Real Madrid"},
    {num:9,pos:"FWD",name:"Kenan Yildiz",club:"Juventus"},
    {num:11,pos:"FWD",name:"Baris Alper Yilmaz",club:"Galatasaray"},
    {num:15,pos:"FWD",name:"Can Uzun",club:"Eintracht Frankfurt"},
    {num:16,pos:"FWD",name:"Kerem Akturkoglu",club:"Fenerbahce"},
    {num:21,pos:"FWD",name:"Yunus Akgun",club:"Galatasaray"},
    {num:22,pos:"DEF",name:"Umut Meras",club:"Le Havre"},
    {num:24,pos:"MID",name:"Kerem Demirbay",club:"Galatasaray"},
    {num:25,pos:"FWD",name:"Serdar Dursun",club:"Fatih Karagumruk"},
    {num:26,pos:"DEF",name:"Mert Cetin",club:"Hellas Verona"}]},
  USA:{coach:"Mauricio Pochettino",players:[
    {num:1,pos:"GK",name:"Matt Turner",club:"Nottingham Forest"},
    {num:12,pos:"GK",name:"Chris Brady",club:"Bournemouth"},
    {num:18,pos:"GK",name:"Matt Freese",club:"NYCFC"},
    {num:2,pos:"DEF",name:"Sergino Dest",club:"PSV"},
    {num:3,pos:"DEF",name:"Antonee Robinson",club:"Fulham"},
    {num:4,pos:"DEF",name:"Chris Richards",club:"Crystal Palace"},
    {num:5,pos:"DEF",name:"Tim Ream",club:"Charlotte FC"},
    {num:6,pos:"DEF",name:"Miles Robinson",club:"FC Cincinnati"},
    {num:13,pos:"DEF",name:"Auston Trusty",club:"Celtic"},
    {num:14,pos:"DEF",name:"Mark McKenzie",club:"Genk"},
    {num:15,pos:"DEF",name:"Joe Scally",club:"Borussia M'gladbach"},
    {num:8,pos:"MID",name:"Tyler Adams",club:"Bournemouth"},
    {num:10,pos:"MID",name:"Christian Pulisic",club:"AC Milan"},
    {num:17,pos:"MID",name:"Weston McKennie",club:"Juventus"},
    {num:19,pos:"MID",name:"Cristian Roldan",club:"Seattle Sounders"},
    {num:20,pos:"MID",name:"Malik Tillman",club:"PSV"},
    {num:7,pos:"FWD",name:"Giovanni Reyna",club:"Borussia Dortmund"},
    {num:9,pos:"FWD",name:"Ricardo Pepi",club:"PSV"},
    {num:11,pos:"FWD",name:"Folarin Balogun",club:"Monaco"},
    {num:22,pos:"FWD",name:"Brenden Aaronson",club:"Union Berlin"},
    {num:23,pos:"FWD",name:"Tim Weah",club:"Juventus"},
    {num:24,pos:"FWD",name:"Haji Wright",club:"Coventry City"},
    {num:16,pos:"MID",name:"Johnny Cardoso",club:"Betis"},
    {num:21,pos:"DEF",name:"Caleb Wiley",club:"Stuttgart"},
    {num:25,pos:"FWD",name:"Patrick Agyemang",club:"Brighton"},
    {num:26,pos:"FWD",name:"Cade Cowell",club:"Guadalajara"}]},
  Paraguay:{coach:"Gustavo Alfaro",players:[
    {num:1,pos:"GK",name:"Carlos Coronel",club:"São Paulo"},
    {num:12,pos:"GK",name:"Roberto Fernández",club:"Cerro Porteño"},
    {num:23,pos:"GK",name:"Orlando Gill",club:"San Lorenzo"},
    {num:2,pos:"DEF",name:"Gustavo Gómez",club:"Palmeiras"},
    {num:3,pos:"DEF",name:"Junior Alonso",club:"Atlético Mineiro"},
    {num:4,pos:"DEF",name:"Fabian Balbuena",club:"Gremio"},
    {num:5,pos:"DEF",name:"Blas Riveros",club:"Cerro Porteño"},
    {num:6,pos:"DEF",name:"Diego León",club:"Man United"},
    {num:13,pos:"DEF",name:"Mateo Gamarra",club:"Cruzeiro"},
    {num:14,pos:"DEF",name:"Omar Alderete",club:"Sunderland"},
    {num:8,pos:"MID",name:"Miguel Almiron",club:"Atlanta United"},
    {num:10,pos:"MID",name:"Diego Gómez",club:"Brighton"},
    {num:16,pos:"MID",name:"Mathias Villasanti",club:"Gremio"},
    {num:17,pos:"MID",name:"Andres Cubas",club:"Vancouver Whitecaps"},
    {num:18,pos:"MID",name:"Ramon Sosa",club:"Palmeiras"},
    {num:19,pos:"MID",name:"Braian Ojeda",club:"Orlando City"},
    {num:7,pos:"FWD",name:"Oscar Romero",club:"Huracán"},
    {num:9,pos:"FWD",name:"Antonio Sanabria",club:"Cremonese"},
    {num:11,pos:"FWD",name:"Julio Enciso",club:"Strasbourg"},
    {num:20,pos:"FWD",name:"Angel Romero",club:"Boca Juniors"},
    {num:21,pos:"FWD",name:"Enso González",club:"Wolverhampton"},
    {num:22,pos:"FWD",name:"Adam Bareiro",club:"Boca Juniors"},
    {num:15,pos:"DEF",name:"Santiago Arzamendia",club:"Atletico Tucuman"},
    {num:24,pos:"MID",name:"Jhon Piris",club:"Nacional"},
    {num:25,pos:"FWD",name:"Fernando Cardozo",club:"Olimpia"},
    {num:26,pos:"FWD",name:"Alex Arce",club:"Liverpool FC Paraguay"}]},
  // ── GROUP E ──
  Germany:{coach:"Julian Nagelsmann",players:[
    {num:1,pos:"GK",name:"Manuel Neuer",club:"Bayern Munich"},
    {num:12,pos:"GK",name:"Oliver Baumann",club:"Hoffenheim"},
    {num:23,pos:"GK",name:"Alexander Nübel",club:"Stuttgart"},
    {num:2,pos:"DEF",name:"Nathaniel Brown",club:"Hoffenheim"},
    {num:3,pos:"DEF",name:"David Raum",club:"RB Leipzig"},
    {num:4,pos:"DEF",name:"Jonathan Tah",club:"Bayer Leverkusen"},
    {num:5,pos:"DEF",name:"Pascal Groß",club:"Borussia Dortmund"},
    {num:6,pos:"DEF",name:"Antonio Rüdiger",club:"Real Madrid"},
    {num:13,pos:"DEF",name:"Nico Schlotterbeck",club:"Borussia Dortmund"},
    {num:14,pos:"DEF",name:"Malick Thiaw",club:"AC Milan"},
    {num:15,pos:"DEF",name:"Waldemar Anton",club:"Borussia Dortmund"},
    {num:8,pos:"MID",name:"Joshua Kimmich",club:"Bayern Munich"},
    {num:10,pos:"MID",name:"Florian Wirtz",club:"Bayer Leverkusen"},
    {num:17,pos:"MID",name:"Jamal Musiala",club:"Bayern Munich"},
    {num:18,pos:"MID",name:"Leon Goretzka",club:"Bayern Munich"},
    {num:19,pos:"MID",name:"Aleksandar Pavlovic",club:"Bayern Munich"},
    {num:20,pos:"MID",name:"Angelo Stiller",club:"Stuttgart"},
    {num:22,pos:"MID",name:"Felix Nmecha",club:"Borussia Dortmund"},
    {num:7,pos:"FWD",name:"Kai Havertz",club:"Arsenal"},
    {num:9,pos:"FWD",name:"Leroy Sané",club:"Bayern Munich"},
    {num:11,pos:"FWD",name:"Maximilian Beier",club:"Borussia Dortmund"},
    {num:16,pos:"FWD",name:"Deniz Undav",club:"Stuttgart"},
    {num:21,pos:"FWD",name:"Jamie Leweling",club:"Stuttgart"},
    {num:24,pos:"FWD",name:"Nick Woltemeade",club:"Stuttgart"},
    {num:25,pos:"FWD",name:"Tom Bischof",club:"TSG Hoffenheim"},
    {num:26,pos:"DEF",name:"Robin Gosens",club:"Union Berlin"}]},
  "Ivory Coast":{coach:"Emerse Faé",players:[
    {num:1,pos:"GK",name:"Yahia Fofana",club:"Rizespor"},
    {num:12,pos:"GK",name:"Alban Lafont",club:"Panathinaikos"},
    {num:23,pos:"GK",name:"Mohamed Kone",club:"Charleroi"},
    {num:2,pos:"DEF",name:"Wilfried Singo",club:"Galatasaray"},
    {num:3,pos:"DEF",name:"Ghislain Konan",club:"Gil Vicente"},
    {num:4,pos:"DEF",name:"Evan Ndicka",club:"Roma"},
    {num:5,pos:"DEF",name:"Odilon Kossounou",club:"Atalanta"},
    {num:6,pos:"DEF",name:"Emmanuel Agbadou",club:"Wolverhampton"},
    {num:13,pos:"DEF",name:"Guela Doue",club:"Strasbourg"},
    {num:14,pos:"DEF",name:"Ousmane Diomande",club:"Sporting CP"},
    {num:15,pos:"DEF",name:"Clement Akpa",club:"Auxerre"},
    {num:8,pos:"MID",name:"Franck Kessie",club:"Al Ahli"},
    {num:10,pos:"MID",name:"Seko Fofana",club:"Stade Rennais"},
    {num:17,pos:"MID",name:"Ibrahim Sangare",club:"Nottingham Forest"},
    {num:18,pos:"MID",name:"Jean-Michael Seri",club:"NK Maribor"},
    {num:19,pos:"MID",name:"Christ Oulai",club:"Trabzonspor"},
    {num:20,pos:"MID",name:"Parfait Guiagon",club:"Charleroi"},
    {num:7,pos:"FWD",name:"Nicolas Pepe",club:"Villarreal"},
    {num:9,pos:"FWD",name:"Amad Diallo",club:"Man United"},
    {num:11,pos:"FWD",name:"Simon Adingra",club:"Monaco"},
    {num:16,pos:"FWD",name:"Elye Wahi",club:"Nice"},
    {num:21,pos:"FWD",name:"Evann Guessand",club:"Aston Villa"},
    {num:22,pos:"FWD",name:"Ange-Yoan Bonny",club:"Inter Milan"},
    {num:24,pos:"FWD",name:"Yan Diomande",club:"RB Leipzig"},
    {num:25,pos:"FWD",name:"Oumar Diakite",club:"Cercle Brugge"},
    {num:26,pos:"FWD",name:"Bazoumana Toure",club:"Hoffenheim"},
  ]},
  Ecuador:{coach:"Sebastián Beccacece",players:[
    {num:1,pos:"GK",name:"Hernan Galindez",club:"Aucas"},
    {num:12,pos:"GK",name:"Alexander Dominguez",club:"Liga de Quito"},
    {num:23,pos:"GK",name:"Moises Ramirez",club:"Barcelona SC"},
    {num:2,pos:"DEF",name:"Angelo Preciado",club:"Genk"},
    {num:3,pos:"DEF",name:"Pervis Estupinan",club:"Brighton"},
    {num:4,pos:"DEF",name:"William Pacho",club:"PSG"},
    {num:5,pos:"DEF",name:"Piero Hincapie",club:"Bayer Leverkusen"},
    {num:6,pos:"DEF",name:"Diego Palacios",club:"Columbus Crew"},
    {num:13,pos:"DEF",name:"Jackson Porozo",club:"Troyes"},
    {num:14,pos:"DEF",name:"Beder Caicedo",club:"Liga de Quito"},
    {num:8,pos:"MID",name:"Moisés Caicedo",club:"Chelsea"},
    {num:10,pos:"MID",name:"Romario Ibarra",club:"Pachuca"},
    {num:16,pos:"MID",name:"Gonzalo Plata",club:"Flamengo"},
    {num:17,pos:"MID",name:"Jeremy Sarmiento",club:"Burnley"},
    {num:18,pos:"MID",name:"Alan Minda",club:"Eibar"},
    {num:19,pos:"MID",name:"Jose Cifuentes",club:"LAFC"},
    {num:9,pos:"FWD",name:"Enner Valencia",club:"Internacional"},
    {num:7,pos:"FWD",name:"Michael Estrada",club:"Cruz Azul"},
    {num:11,pos:"FWD",name:"Kevin Rodriguez",club:"Eibar"},
    {num:15,pos:"FWD",name:"Djorkaeff Reasco",club:"Necaxa"},
    {num:20,pos:"FWD",name:"Jordan Rezabala",club:"El Nacional"},
    {num:21,pos:"FWD",name:"Adonis Preciado",club:"Monterrey"},
    {num:22,pos:"FWD",name:"Adonis Preciado",club:"Monterrey"},
    {num:24,pos:"DEF",name:"Patricio Venegas",club:"Liga de Quito"},
    {num:25,pos:"FWD",name:"Luca Orellana",club:"Flamengo"},
    {num:26,pos:"MID",name:"Cristian Pellerano",club:"Independiente"}]},
  Curaçao:{coach:"Dick Advocaat",players:[
    {num:1,pos:"GK",name:"Eloy Room",club:"Miami FC"},
    {num:12,pos:"GK",name:"Trevor Doornbusch",club:"VVV-Venlo"},
    {num:23,pos:"GK",name:"Tyrick Bodak",club:"SC Telstar"},
    {num:2,pos:"DEF",name:"Joshua Brenet",club:"Kayserispor"},
    {num:3,pos:"DEF",name:"Roshon Van Eijma",club:"RKC Waalwijk"},
    {num:4,pos:"DEF",name:"Sherel Floranus",club:"PEC Zwolle"},
    {num:5,pos:"DEF",name:"Armando Obispo",club:"PSV Eindhoven"},
    {num:6,pos:"DEF",name:"Riechedly Bazoer",club:"Konyaspor"},
    {num:13,pos:"DEF",name:"Shurandy Sambo",club:"Sparta Rotterdam"},
    {num:14,pos:"DEF",name:"Jurien Gaari",club:"Abha Club"},
    {num:15,pos:"DEF",name:"Deveron Fonville",club:"NEC Nijmegen"},
    {num:8,pos:"MID",name:"Leandro Bacuna",club:"Igdır"},
    {num:10,pos:"MID",name:"Juninho Bacuna",club:"FC Volendam"},
    {num:16,pos:"MID",name:"Livano Comenencia",club:"FC Zurich"},
    {num:17,pos:"MID",name:"Tyrese Noslin",club:"SC Telstar"},
    {num:18,pos:"MID",name:"Godfried Roemeratoe",club:"RKC Waalwijk"},
    {num:19,pos:"MID",name:"Kevin Felida",club:"FC Den Bosch"},
    {num:20,pos:"MID",name:"Ar'Jany Martha",club:"Rotherham United"},
    {num:7,pos:"FWD",name:"Tahith Chong",club:"Sheffield United"},
    {num:9,pos:"FWD",name:"Sontje Hansen",club:"Middlesbrough"},
    {num:11,pos:"FWD",name:"Brandley Kuwas",club:"FC Volendam"},
    {num:21,pos:"FWD",name:"Gervane Kastaneer",club:"Terengganu FC"},
    {num:22,pos:"FWD",name:"Jeremy Antonisse",club:"AE Kifisia"},
    {num:24,pos:"FWD",name:"Jurgen Locadia",club:"Miami FC"},
    {num:25,pos:"FWD",name:"Kenji Gorre",club:"Maccabi Haifa"},
    {num:26,pos:"FWD",name:"Jearl Margaritha",club:"SK Beveren"},
  ]},
  // ── GROUP F ──
  Netherlands:{coach:"Ronald Koeman",players:[
    {num:1,pos:"GK",name:"Bart Verbruggen",club:"Brighton"},
    {num:12,pos:"GK",name:"Mark Flekken",club:"Brentford"},
    {num:23,pos:"GK",name:"Remko Pasveer",club:"Ajax"},
    {num:2,pos:"DEF",name:"Denzel Dumfries",club:"Inter Milan"},
    {num:3,pos:"DEF",name:"Nathan Aké",club:"Man City"},
    {num:4,pos:"DEF",name:"Virgil van Dijk",club:"Liverpool"},
    {num:5,pos:"DEF",name:"Micky van de Ven",club:"Tottenham"},
    {num:6,pos:"DEF",name:"Jurriën Timber",club:"Arsenal"},
    {num:13,pos:"DEF",name:"Lutsharel Geertruida",club:"Bayer Leverkusen"},
    {num:14,pos:"DEF",name:"Jorrel Hato",club:"Ajax"},
    {num:8,pos:"MID",name:"Tijjani Reijnders",club:"AC Milan"},
    {num:10,pos:"MID",name:"Memphis Depay",club:"Atletico Madrid"},
    {num:17,pos:"MID",name:"Teun Koopmeiners",club:"Juventus"},
    {num:18,pos:"MID",name:"Ryan Gravenberch",club:"Liverpool"},
    {num:19,pos:"MID",name:"Frenkie de Jong",club:"Barcelona"},
    {num:20,pos:"MID",name:"Xavi Simons",club:"PSG"},
    {num:7,pos:"FWD",name:"Justin Kluivert",club:"Bournemouth"},
    {num:9,pos:"FWD",name:"Wout Weghorst",club:"Hoffenheim"},
    {num:11,pos:"FWD",name:"Cody Gakpo",club:"Liverpool"},
    {num:15,pos:"FWD",name:"Noa Lang",club:"PSV"},
    {num:16,pos:"FWD",name:"Crysencio Summerville",club:"Leeds"},
    {num:21,pos:"FWD",name:"Donyell Malen",club:"Aston Villa"},
    {num:22,pos:"MID",name:"Wout Weghorst",club:"Hoffenheim"},
    {num:24,pos:"DEF",name:"Devyne Rensch",club:"Bologna"},
    {num:90,pos:"FWD",name:"Donyell Malen",club:"Aston Villa"},
    {num:91,pos:"MID",name:"Quinten Timber",club:"Arsenal"}]},
  Japan:{coach:"Hajime Moriyasu",players:[
    {num:1,pos:"GK",name:"Zion Suzuki",club:"Parma"},
    {num:12,pos:"GK",name:"Keisuke Osako",club:"Sanfrecce Hiroshima"},
    {num:23,pos:"GK",name:"Tomoki Hayakawa",club:"Kashima Antlers"},
    {num:2,pos:"DEF",name:"Yukinari Sugawara",club:"Werder Bremen"},
    {num:3,pos:"DEF",name:"Hiroki Ito",club:"Bayern Munich"},
    {num:4,pos:"DEF",name:"Ko Itakura",club:"Ajax"},
    {num:5,pos:"DEF",name:"Shogo Taniguchi",club:"Sint-Truiden"},
    {num:6,pos:"DEF",name:"Takehiro Tomiyasu",club:"Ajax"},
    {num:13,pos:"DEF",name:"Tsuyoshi Watanabe",club:"Feyenoord"},
    {num:14,pos:"DEF",name:"Yuta Nagatomo",club:"FC Tokyo"},
    {num:15,pos:"DEF",name:"Ayumu Seko",club:"Le Havre"},
    {num:8,pos:"MID",name:"Wataru Endo",club:"Liverpool"},
    {num:10,pos:"MID",name:"Takefusa Kubo",club:"Real Sociedad"},
    {num:17,pos:"MID",name:"Ritsu Doan",club:"Eintracht Frankfurt"},
    {num:18,pos:"MID",name:"Daichi Kamada",club:"Crystal Palace"},
    {num:19,pos:"MID",name:"Ao Tanaka",club:"Leeds United"},
    {num:20,pos:"MID",name:"Keito Nakamura",club:"Reims"},
    {num:21,pos:"MID",name:"Kaishu Sano",club:"Mainz"},
    {num:22,pos:"MID",name:"Yuito Suzuki",club:"Freiburg"},
    {num:9,pos:"FWD",name:"Ayase Ueda",club:"Feyenoord"},
    {num:7,pos:"FWD",name:"Junya Ito",club:"Genk"},
    {num:11,pos:"FWD",name:"Daizen Maeda",club:"Celtic"},
    {num:24,pos:"FWD",name:"Koki Ogawa",club:"NEC Nijmegen"},
    {num:25,pos:"FWD",name:"Kento Shiogai",club:"Wolfsburg"},
    {num:26,pos:"FWD",name:"Keisuke Goto",club:"Sint-Truiden"},
    {num:90,pos:"FWD",name:"Koki Ogawa",club:"NEC Nijmegen"}]},
  Sweden:{coach:"Graham Potter",players:[
    {num:1,pos:"GK",name:"Viktor Johansson",club:"Stoke City"},
    {num:12,pos:"GK",name:"Kristoffer Nordfeldt",club:"AIK"},
    {num:23,pos:"GK",name:"Jacob Widell Zetterstrom",club:"Derby County"},
    {num:2,pos:"DEF",name:"Emil Holm",club:"Juventus"},
    {num:3,pos:"DEF",name:"Gabriel Gudmundsson",club:"Leeds United"},
    {num:4,pos:"DEF",name:"Victor Lindelöf",club:"Aston Villa"},
    {num:5,pos:"DEF",name:"Isak Hien",club:"Atalanta"},
    {num:6,pos:"DEF",name:"Carl Starfelt",club:"Celta Vigo"},
    {num:13,pos:"DEF",name:"Hjalmar Ekdal",club:"Burnley"},
    {num:14,pos:"DEF",name:"Gustaf Lagerbielke",club:"Braga"},
    {num:15,pos:"DEF",name:"Daniel Svensson",club:"Borussia Dortmund"},
    {num:16,pos:"DEF",name:"Eric Smith",club:"St. Pauli"},
    {num:17,pos:"DEF",name:"Elliot Stroud",club:"Mjallby AIF"},
    {num:8,pos:"MID",name:"Mattias Svanberg",club:"Wolfsburg"},
    {num:10,pos:"MID",name:"Lucas Bergvall",club:"Tottenham"},
    {num:18,pos:"MID",name:"Jesper Karlström",club:"Udinese"},
    {num:19,pos:"MID",name:"Yasin Ayari",club:"Brighton"},
    {num:20,pos:"MID",name:"Taha Ali",club:"Malmö FF"},
    {num:21,pos:"MID",name:"Besfort Zeneli",club:"Union St-Gilloise"},
    {num:7,pos:"FWD",name:"Alexander Isak",club:"Liverpool"},
    {num:9,pos:"FWD",name:"Viktor Gyökeres",club:"Arsenal"},
    {num:11,pos:"FWD",name:"Anthony Elanga",club:"Newcastle United"},
    {num:22,pos:"FWD",name:"Ken Sema",club:"Pafos"},
    {num:24,pos:"FWD",name:"Alexander Bernhardsson",club:"Holstein Kiel"},
    {num:25,pos:"FWD",name:"Benjamin Nygren",club:"Celtic"},
    {num:26,pos:"FWD",name:"Gustaf Nilsson",club:"Club Brugge"},
  ]},
  Tunisia:{coach:"Sabri Lamouchi",players:[
    {num:1,pos:"GK",name:"Aymen Dahmen",club:"CS Sfaxien"},
    {num:12,pos:"GK",name:"Sabri Ben Hessen",club:"Etoile Sahel"},
    {num:23,pos:"GK",name:"Abdelmouhib Chamakh",club:"Club Africain"},
    {num:2,pos:"DEF",name:"Ali Abdi",club:"Nice"},
    {num:3,pos:"DEF",name:"Dylan Bronn",club:"Servette Geneva"},
    {num:4,pos:"DEF",name:"Montassar Talbi",club:"Lorient"},
    {num:5,pos:"DEF",name:"Mohamed Amine Ben Hamida",club:"Espérance Tunis"},
    {num:6,pos:"DEF",name:"Yan Valery",club:"Young Boys"},
    {num:13,pos:"DEF",name:"Omar Rekik",club:"NK Maribor"},
    {num:14,pos:"DEF",name:"Raed Chikhaoui",club:"US Monastir"},
    {num:15,pos:"DEF",name:"Moutaz Neffati",club:"Norrkoping"},
    {num:8,pos:"MID",name:"Ellyes Skhiri",club:"Eintracht Frankfurt"},
    {num:10,pos:"MID",name:"Hannibal Mejbri",club:"Burnley"},
    {num:16,pos:"MID",name:"Anis Ben Slimane",club:"Norwich City"},
    {num:17,pos:"MID",name:"Mortadha Ben Ouanes",club:"Kasimpasa"},
    {num:18,pos:"MID",name:"Rani Khedira",club:"Union Berlin"},
    {num:19,pos:"MID",name:"Ismael Gharbi",club:"FC Augsburg"},
    {num:7,pos:"FWD",name:"Elias Saad",club:"Hannover 96"},
    {num:9,pos:"FWD",name:"Firas Chaouat",club:"Club Africain"},
    {num:11,pos:"FWD",name:"Hazem Mastouri",club:"Dynamo Makhachkala"},
    {num:20,pos:"FWD",name:"Elias Achouri",club:"FC Copenhagen"},
    {num:21,pos:"FWD",name:"Sebastian Tounekti",club:"Celtic"},
    {num:22,pos:"FWD",name:"Khalil Ayari",club:"PSG"},
    {num:24,pos:"FWD",name:"Rayan Elloumi",club:"Vancouver Whitecaps"},
    {num:25,pos:"MID",name:"Firas Chaouat",club:"Club Africain"},
    {num:26,pos:"DEF",name:"Nader Ghandri",club:"Nantes"}]},
  // ── GROUP G ──
  Belgium:{coach:"Rudi Garcia",players:[
    {num:1,pos:"GK",name:"Thibaut Courtois",club:"Real Madrid"},
    {num:12,pos:"GK",name:"Senne Lammens",club:"Man United"},
    {num:23,pos:"GK",name:"Mike Penders",club:"Strasbourg"},
    {num:2,pos:"DEF",name:"Timothy Castagne",club:"Fulham"},
    {num:3,pos:"DEF",name:"Maxim De Cuyper",club:"Brighton"},
    {num:4,pos:"DEF",name:"Zeno Debast",club:"Sporting CP"},
    {num:5,pos:"DEF",name:"Arthur Theate",club:"Eintracht Frankfurt"},
    {num:6,pos:"DEF",name:"Thomas Meunier",club:"Lille"},
    {num:13,pos:"DEF",name:"Brandon Mechele",club:"Club Brugge"},
    {num:14,pos:"DEF",name:"Koni De Winter",club:"AC Milan"},
    {num:15,pos:"DEF",name:"Joaquin Seys",club:"Club Brugge"},
    {num:16,pos:"DEF",name:"Nathan Ngoy",club:"Lille"},
    {num:8,pos:"MID",name:"Kevin De Bruyne",club:"Napoli"},
    {num:10,pos:"MID",name:"Youri Tielemans",club:"Aston Villa"},
    {num:17,pos:"MID",name:"Amadou Onana",club:"Aston Villa"},
    {num:18,pos:"MID",name:"Hans Vanaken",club:"Club Brugge"},
    {num:19,pos:"MID",name:"Nicolas Raskin",club:"Rangers"},
    {num:20,pos:"MID",name:"Axel Witsel",club:"Girona"},
    {num:7,pos:"FWD",name:"Romelu Lukaku",club:"Napoli"},
    {num:9,pos:"FWD",name:"Leandro Trossard",club:"Arsenal"},
    {num:11,pos:"FWD",name:"Jeremy Doku",club:"Man City"},
    {num:21,pos:"FWD",name:"Charles De Ketelaere",club:"Atalanta"},
    {num:22,pos:"FWD",name:"Dodi Lukebakio",club:"Benfica"},
    {num:24,pos:"FWD",name:"Alexis Saelemaekers",club:"AC Milan"},
    {num:25,pos:"FWD",name:"Diego Moreira",club:"Strasbourg"},
    {num:26,pos:"FWD",name:"Matias Fernandez-Pardo",club:"Lille"},
  ]},
  Egypt:{coach:"Hossam Hassan",players:[
    {num:1,pos:"GK",name:"Mohamed El-Shenawy",club:"Al Ahly"},
    {num:12,pos:"GK",name:"Mostafa Shobeir",club:"Al Ahly"},
    {num:23,pos:"GK",name:"El-Mahdy Soliman",club:"Zamalek"},
    {num:2,pos:"DEF",name:"Mohamed Hany",club:"Al Ahly"},
    {num:3,pos:"DEF",name:"Hossam Abdelmaguid",club:"Zamalek"},
    {num:4,pos:"DEF",name:"Yasser Ibrahim",club:"Al Ahly"},
    {num:5,pos:"DEF",name:"Ahmed Fattouh",club:"Zamalek"},
    {num:6,pos:"DEF",name:"Tarek Alaa",club:"ZED FC"},
    {num:13,pos:"DEF",name:"Mohamed Abdelmonem",club:"Nice"},
    {num:14,pos:"DEF",name:"Karim Hafez",club:"Pyramids FC"},
    {num:15,pos:"DEF",name:"Rami Rabia",club:"Al-Ain"},
    {num:16,pos:"DEF",name:"Hamdy Fathy",club:"Al Wakrah"},
    {num:8,pos:"MID",name:"Mohamed Salah",club:"Liverpool"},
    {num:10,pos:"MID",name:"Marwan Attia",club:"Al Ahly"},
    {num:11,pos:"MID",name:"Mahmoud Trezeguet",club:"Al Ahly"},
    {num:17,pos:"MID",name:"Ibrahim Adel",club:"FC Nordsjælland"},
    {num:18,pos:"MID",name:"Emam Ashour",club:"Al Ahly"},
    {num:19,pos:"MID",name:"Haissam Hassan",club:"Real Oviedo"},
    {num:9,pos:"FWD",name:"Omar Marmoush",club:"Man City"},
    {num:7,pos:"FWD",name:"Ahmed Sayed Zizo",club:"Al Ahly"},
    {num:20,pos:"FWD",name:"Mohanad Lasheen",club:"Pyramids FC"},
    {num:21,pos:"FWD",name:"Hamza Abdelkarim",club:"Barcelona"},
    {num:22,pos:"FWD",name:"Aqtay Abdallah",club:"Enppi"},
    {num:24,pos:"MID",name:"Nasser Maher",club:"Al Ahly"},
    {num:25,pos:"DEF",name:"Ahmed Abou Gabal",club:"Zamalek"},
    {num:26,pos:"MID",name:"Mahmoud Hamada",club:"Pyramids FC"}]},
  Iran:{coach:"Amir Ghalenoei",players:[
    {num:1,pos:"GK",name:"Alireza Beiranvand",club:"Tractor"},
    {num:12,pos:"GK",name:"Hossein Hosseini",club:"Sepahan"},
    {num:23,pos:"GK",name:"Payam Niazmand",club:"Persepolis"},
    {num:2,pos:"DEF",name:"Ehsan Hajsafi",club:"Sepahan"},
    {num:3,pos:"DEF",name:"Milad Mohammadi",club:"Persepolis"},
    {num:4,pos:"DEF",name:"Ramin Rezaeian",club:"Foolad"},
    {num:5,pos:"DEF",name:"Shoka Khalilzadeh",club:"Tractor"},
    {num:6,pos:"DEF",name:"Hossein Kanaani",club:"Persepolis"},
    {num:13,pos:"DEF",name:"Saleh Hardani",club:"Esteghlal"},
    {num:14,pos:"DEF",name:"Danial Eiri",club:"Malavan"},
    {num:8,pos:"MID",name:"Saeid Ezatolahi",club:"Shabab Al-Ahli"},
    {num:10,pos:"MID",name:"Alireza Jahanbakhsh",club:"Dender"},
    {num:17,pos:"MID",name:"Saman Ghoddos",club:"Kalba"},
    {num:18,pos:"MID",name:"Mehdi Torabi",club:"Tractor"},
    {num:19,pos:"MID",name:"Rouzbeh Cheshmi",club:"Esteghlal"},
    {num:20,pos:"MID",name:"Mehdi Ghaedi",club:"Al-Nasr"},
    {num:9,pos:"FWD",name:"Mehdi Taremi",club:"Olympiacos"},
    {num:7,pos:"FWD",name:"Ali Alipour",club:"Persepolis"},
    {num:11,pos:"FWD",name:"Amirhossein Hosseinzadeh",club:"Tractor"},
    {num:15,pos:"FWD",name:"Dennis Dargahi",club:"Standard Liege"},
    {num:16,pos:"DEF",name:"Morteza Pouraliganji",club:"Al-Wakrah"},
    {num:21,pos:"MID",name:"Ahmad Noorollahi",club:"Persepolis"},
    {num:22,pos:"MID",name:"Omid Ebrahimi",club:"Tractor"},
    {num:24,pos:"FWD",name:"Sardar Azmoun",club:"Bayer Leverkusen"},
    {num:90,pos:"MID",name:"Ahmad Noorollahi",club:"Persepolis"},
    {num:91,pos:"FWD",name:"Sardar Azmoun",club:"Bayer Leverkusen"}]},
  "New Zealand":{coach:"Darren Bazeley",players:[
    {num:1,pos:"GK",name:"Max Crocombe",club:"Millwall"},
    {num:12,pos:"GK",name:"Alex Paulsen",club:"Lechia Gdańsk"},
    {num:23,pos:"GK",name:"Michael Woud",club:"Auckland FC"},
    {num:2,pos:"DEF",name:"Tim Payne",club:"Wellington Phoenix"},
    {num:3,pos:"DEF",name:"Liberato Cacace",club:"Wrexham"},
    {num:4,pos:"DEF",name:"Michael Boxall",club:"Minnesota United"},
    {num:5,pos:"DEF",name:"Tyler Bindon",club:"Nottingham Forest"},
    {num:6,pos:"DEF",name:"Nando Pijnaker",club:"Auckland FC"},
    {num:13,pos:"DEF",name:"Tommy Smith",club:"Braintree Town"},
    {num:14,pos:"DEF",name:"Finn Surman",club:"Portland Timbers"},
    {num:15,pos:"DEF",name:"Francis de Vries",club:"Auckland FC"},
    {num:16,pos:"DEF",name:"Callan Elliot",club:"Auckland FC"},
    {num:8,pos:"MID",name:"Joe Bell",club:"Viking FK"},
    {num:10,pos:"MID",name:"Marko Stamenic",club:"Swansea City"},
    {num:16,pos:"MID",name:"Matt Garbett",club:"Peterborough United"},
    {num:17,pos:"MID",name:"Sarpreet Singh",club:"Wellington Phoenix"},
    {num:18,pos:"MID",name:"Alex Rufer",club:"Wellington Phoenix"},
    {num:19,pos:"MID",name:"Ben Old",club:"Saint-Étienne"},
    {num:20,pos:"MID",name:"Ryan Thomas",club:"PEC Zwolle"},
    {num:21,pos:"MID",name:"Lachlan Bayliss",club:"Newcastle Jets"},
    {num:9,pos:"FWD",name:"Chris Wood",club:"Nottingham Forest"},
    {num:7,pos:"FWD",name:"Callum McCowatt",club:"Silkeborg"},
    {num:11,pos:"FWD",name:"Kosta Barbarouses",club:"Western Sydney Wanderers"},
    {num:22,pos:"FWD",name:"Ben Waine",club:"Port Vale"},
    {num:24,pos:"FWD",name:"Eli Just",club:"Motherwell"},
    {num:25,pos:"FWD",name:"Jesse Randall",club:"Auckland FC"},
  ]},
  // ── GROUP H ──
  Spain:{coach:"Luis de la Fuente",players:[
    {num:1,pos:"GK",name:"Unai Simón",club:"Athletic Bilbao"},
    {num:12,pos:"GK",name:"David Raya",club:"Arsenal"},
    {num:23,pos:"GK",name:"Joan Garcia",club:"Espanyol"},
    {num:2,pos:"DEF",name:"Pedro Porro",club:"Tottenham"},
    {num:3,pos:"DEF",name:"Alejandro Grimaldo",club:"Bayer Leverkusen"},
    {num:4,pos:"DEF",name:"Pau Cubarsí",club:"Barcelona"},
    {num:5,pos:"DEF",name:"Aymeric Laporte",club:"Al Nassr"},
    {num:6,pos:"DEF",name:"Marcos Llorente",club:"Atletico Madrid"},
    {num:13,pos:"DEF",name:"Marc Cucurella",club:"Chelsea"},
    {num:14,pos:"DEF",name:"Eric Garcia",club:"Girona"},
    {num:8,pos:"MID",name:"Rodri",club:"Man City"},
    {num:10,pos:"MID",name:"Pedri",club:"Barcelona"},
    {num:16,pos:"MID",name:"Fabián Ruiz",club:"PSG"},
    {num:17,pos:"MID",name:"Mikel Merino",club:"Arsenal"},
    {num:18,pos:"MID",name:"Gavi",club:"Barcelona"},
    {num:19,pos:"MID",name:"Martin Zubimendi",club:"Arsenal"},
    {num:20,pos:"MID",name:"Alex Baena",club:"Villarreal"},
    {num:7,pos:"FWD",name:"Nico Williams",club:"Athletic Bilbao"},
    {num:9,pos:"FWD",name:"Dani Olmo",club:"Barcelona"},
    {num:11,pos:"FWD",name:"Lamine Yamal",club:"Barcelona"},
    {num:21,pos:"FWD",name:"Mikel Oyarzabal",club:"Real Sociedad"},
    {num:22,pos:"FWD",name:"Ferran Torres",club:"Barcelona"},
    {num:24,pos:"FWD",name:"Yeremy Pino",club:"Villarreal"},
    {num:15,pos:"DEF",name:"Robin Le Normand",club:"Atletico Madrid"},
    {num:25,pos:"FWD",name:"Yeremy Pino",club:"Villarreal"},
    {num:26,pos:"MID",name:"Pedri",club:"Barcelona"}]},
  Uruguay:{coach:"Marcelo Bielsa",players:[
    {num:1,pos:"GK",name:"Sergio Rochet",club:"Nacional"},
    {num:12,pos:"GK",name:"Sebastian Sosa",club:"Independiente"},
    {num:23,pos:"GK",name:"Guillermo de Amores",club:"Montevideo City Torque"},
    {num:2,pos:"DEF",name:"Nahitan Nandez",club:"Cagliari"},
    {num:3,pos:"DEF",name:"Mathias Olivera",club:"Napoli"},
    {num:4,pos:"DEF",name:"Ronald Araujo",club:"Barcelona"},
    {num:5,pos:"DEF",name:"Jose Maria Gimenez",club:"Atletico Madrid"},
    {num:6,pos:"DEF",name:"Sebastian Caceres",club:"América"},
    {num:13,pos:"DEF",name:"Matias Vina",club:"Sassuolo"},
    {num:14,pos:"DEF",name:"Maximilian Araujo",club:"Sporting CP"},
    {num:8,pos:"MID",name:"Lucas Torreira",club:"Galatasaray"},
    {num:10,pos:"MID",name:"Rodrigo Bentancur",club:"Tottenham"},
    {num:16,pos:"MID",name:"Facundo Pellistri",club:"Man United"},
    {num:17,pos:"MID",name:"Federico Valverde",club:"Real Madrid"},
    {num:18,pos:"MID",name:"Giorgian De Arrascaeta",club:"Flamengo"},
    {num:19,pos:"MID",name:"Nicolás De La Cruz",club:"Flamengo"},
    {num:7,pos:"FWD",name:"Darwin Núñez",club:"Liverpool"},
    {num:9,pos:"FWD",name:"Luis Suárez",club:"Nacional"},
    {num:11,pos:"FWD",name:"Maximiliano Gómez",club:"Valencia"},
    {num:15,pos:"FWD",name:"Brian Rodríguez",club:"América"},
    {num:20,pos:"FWD",name:"Agustín Canobbio",club:"Porto"},
    {num:21,pos:"FWD",name:"Facundo Torres",club:"Orlando City"},
    {num:22,pos:"MID",name:"Manuel Ugarte",club:"Man United"},
    {num:24,pos:"DEF",name:"Joaquín Piquerez",club:"Palmeiras"},
    {num:25,pos:"FWD",name:"Maximiliano Gómez",club:"Valencia"},
    {num:26,pos:"MID",name:"Rodrigo Bentancur",club:"Tottenham"}]},
  "Saudi Arabia":{coach:"Georgios Donis",players:[
    {num:1,pos:"GK",name:"Mohammed Al-Owais",club:"Al-Ahli"},
    {num:12,pos:"GK",name:"Nawaf Al-Aqidi",club:"Al-Nassr"},
    {num:23,pos:"GK",name:"Yasser Al-Mosailem",club:"Al-Shabab"},
    {num:2,pos:"DEF",name:"Saud Abdulhamid",club:"Roma"},
    {num:3,pos:"DEF",name:"Ali Al-Bulaihi",club:"Al-Hilal"},
    {num:4,pos:"DEF",name:"Abdullah Al-Khaibari",club:"Al-Nassr"},
    {num:5,pos:"DEF",name:"Hassan Tambakti",club:"Al-Shabab"},
    {num:6,pos:"DEF",name:"Abdulelah Al-Malki",club:"Al-Hilal"},
    {num:13,pos:"DEF",name:"Yasir Al-Shahrani",club:"Al-Hilal"},
    {num:14,pos:"DEF",name:"Ali Al-Hassan",club:"Al-Qadsiah"},
    {num:15,pos:"DEF",name:"Sultan Al-Ghamdi",club:"Al-Nassr"},
    {num:16,pos:"DEF",name:"Sami Al-Khaibari",club:"Al-Fayha"},
    {num:8,pos:"MID",name:"Sami Al-Najei",club:"Al-Qadsiah"},
    {num:10,pos:"MID",name:"Saleh Al-Shehri",club:"Al-Hilal"},
    {num:17,pos:"MID",name:"Abdullah Al-Hamddan",club:"Al-Hilal"},
    {num:18,pos:"MID",name:"Nasser Al-Dawsari",club:"Al-Hilal"},
    {num:19,pos:"MID",name:"Riyadh Sharahili",club:"Al-Ettifaq"},
    {num:20,pos:"MID",name:"Abdulellah Al-Malki",club:"Al-Ahli"},
    {num:21,pos:"MID",name:"Ali Al-Nemer",club:"Al-Hilal"},
    {num:7,pos:"FWD",name:"Firas Al-Buraikan",club:"Al-Fateh"},
    {num:9,pos:"FWD",name:"Mukhtar Ali",club:"Al-Ahli"},
    {num:11,pos:"FWD",name:"Sultan Al-Ghannam",club:"Al-Nassr"},
    {num:15,pos:"FWD",name:"Hattan Bahebri",club:"Al-Shabab"},
    {num:22,pos:"FWD",name:"Mohammed Kanno",club:"Al-Hilal"},
    {num:25,pos:"FWD",name:"Hattan Bahebri",club:"Al-Shabab"},
    {num:26,pos:"MID",name:"Mohammed Al-Burayk",club:"Al-Hilal"}]},
  "Cape Verde":{coach:"Pedro Brito",players:[
    {num:1,pos:"GK",name:"Vozinha",club:"Chaves"},
    {num:12,pos:"GK",name:"Marcio Rosa",club:"Montana"},
    {num:23,pos:"GK",name:"CJ dos Santos",club:"San Diego"},
    {num:2,pos:"DEF",name:"Stopira",club:"Torreense"},
    {num:3,pos:"DEF",name:"Roberto Lopes",club:"Shamrock Rovers"},
    {num:4,pos:"DEF",name:"Logan Costa",club:"Villarreal"},
    {num:5,pos:"DEF",name:"Diney",club:"Al Bataeh"},
    {num:6,pos:"DEF",name:"Steven Moreira",club:"Columbus Crew"},
    {num:13,pos:"DEF",name:"Wagner Pina",club:"Trabzonspor"},
    {num:14,pos:"DEF",name:"Joao Paulo",club:"FCSB"},
    {num:15,pos:"DEF",name:"Sidny Lopes Cabral",club:"Benfica"},
    {num:16,pos:"DEF",name:"Kelvin Pires",club:"SJK"},
    {num:8,pos:"MID",name:"Jamiro Monteiro",club:"PEC Zwolle"},
    {num:10,pos:"MID",name:"Kevin Pina",club:"Krasnodar"},
    {num:17,pos:"MID",name:"Telmo Arcanjo",club:"Vitoria Guimaraes"},
    {num:18,pos:"MID",name:"Laros Duarte",club:"Puskas Akademia"},
    {num:19,pos:"MID",name:"Yannick Semedo",club:"Farense"},
    {num:7,pos:"FWD",name:"Garry Rodrigues",club:"Apollon Limassol"},
    {num:9,pos:"FWD",name:"Jovane Cabral",club:"Estrela Amadora"},
    {num:11,pos:"FWD",name:"Ryan Mendes",club:"Igdir"},
    {num:20,pos:"FWD",name:"Willy Semedo",club:"Omonia"},
    {num:21,pos:"FWD",name:"Dailon Livramento",club:"Casa Pia"},
    {num:22,pos:"FWD",name:"Nuno da Costa",club:"Istanbul Basaksehir"},
    {num:24,pos:"FWD",name:"Helio Varela",club:"Maccabi Tel Aviv"},
    {num:25,pos:"FWD",name:"Helio Varela",club:"Maccabi Tel Aviv"},
    {num:26,pos:"MID",name:"Nuno da Costa",club:"Istanbul Basaksehir"}
  ]},
  // ── GROUP I ──
  France:{coach:"Didier Deschamps",players:[
    {num:1,pos:"GK",name:"Mike Maignan",club:"AC Milan"},
    {num:16,pos:"GK",name:"Brice Samba",club:"Rennes"},
    {num:23,pos:"GK",name:"Robin Risser",club:"Lens"},
    {num:2,pos:"DEF",name:"Malo Gusto",club:"Chelsea"},
    {num:3,pos:"DEF",name:"Theo Hernandez",club:"Al-Hilal"},
    {num:4,pos:"DEF",name:"Dayot Upamecano",club:"Bayern Munich"},
    {num:5,pos:"DEF",name:"William Saliba",club:"Arsenal"},
    {num:6,pos:"DEF",name:"Lucas Hernandez",club:"PSG"},
    {num:13,pos:"DEF",name:"Ibrahima Konaté",club:"Liverpool"},
    {num:14,pos:"DEF",name:"Jules Koundé",club:"Barcelona"},
    {num:15,pos:"DEF",name:"Lucas Digne",club:"Aston Villa"},
    {num:17,pos:"DEF",name:"Maxence Lacroix",club:"Crystal Palace"},
    {num:8,pos:"MID",name:"Aurélien Tchouaméni",club:"Real Madrid"},
    {num:18,pos:"MID",name:"Manu Koné",club:"Roma"},
    {num:19,pos:"MID",name:"N'Golo Kanté",club:"Fenerbahçe"},
    {num:20,pos:"MID",name:"Adrien Rabiot",club:"AC Milan"},
    {num:21,pos:"MID",name:"Warren Zaïre-Emery",club:"PSG"},
    {num:7,pos:"FWD",name:"Ousmane Dembélé",club:"PSG"},
    {num:9,pos:"FWD",name:"Jean-Philippe Mateta",club:"Crystal Palace"},
    {num:10,pos:"FWD",name:"Kylian Mbappé",club:"Real Madrid"},
    {num:11,pos:"FWD",name:"Marcus Thuram",club:"Inter Milan"},
    {num:22,pos:"FWD",name:"Bradley Barcola",club:"PSG"},
    {num:24,pos:"FWD",name:"Michael Olise",club:"Bayern Munich"},
    {num:25,pos:"FWD",name:"Rayan Cherki",club:"Man City"},
    {num:26,pos:"FWD",name:"Désire Doué",club:"PSG"},
    {num:27,pos:"FWD",name:"Maghnes Akliouche",club:"Monaco"},
  ]},
  Iraq:{coach:"Graham Arnold",players:[
    {num:1,pos:"GK",name:"Jalal Hassan",club:"Al-Zawraa"},
    {num:12,pos:"GK",name:"Fahad Talib",club:"Al-Shorta"},
    {num:23,pos:"GK",name:"Ali Bassim",club:"Al-Quwa Al-Jawiya"},
    {num:2,pos:"DEF",name:"Ali Adnan",club:"Giresunspor"},
    {num:3,pos:"DEF",name:"Ahmed Ibrahim",club:"Al-Shorta"},
    {num:4,pos:"DEF",name:"Rebin Sulaka",club:"Ankaragücü"},
    {num:5,pos:"DEF",name:"Saad Natiq",club:"Al-Zawraa"},
    {num:6,pos:"DEF",name:"Hossam Kadhim",club:"Al-Quwa Al-Jawiya"},
    {num:13,pos:"DEF",name:"Hussein Ali",club:"Al-Zawraa"},
    {num:14,pos:"DEF",name:"Mohammed Qasim",club:"Al-Shorta"},
    {num:15,pos:"DEF",name:"Mustafa Nadhum",club:"Al-Diwaniyah"},
    {num:8,pos:"MID",name:"Amjed Attwan",club:"Al-Quwa Al-Jawiya"},
    {num:10,pos:"MID",name:"Bashar Resan",club:"Al-Zawraa"},
    {num:16,pos:"MID",name:"Ali Faez",club:"Al-Quwa Al-Jawiya"},
    {num:17,pos:"MID",name:"Ibrahim Bayesh",club:"Al-Zawraa"},
    {num:18,pos:"MID",name:"Osama Rashid",club:"Omonia Nicosia"},
    {num:19,pos:"MID",name:"Yaser Kasim",club:"Al-Shorta"},
    {num:20,pos:"MID",name:"Saad Abdul Amir",club:"Al-Naft"},
    {num:21,pos:"MID",name:"Dhurgham Ismail",club:"Al-Zawraa"},
    {num:7,pos:"FWD",name:"Mohanad Ali",club:"Al-Shorta"},
    {num:9,pos:"FWD",name:"Aymen Hussein",club:"Al-Quwa Al-Jawiya"},
    {num:11,pos:"FWD",name:"Alaa Abbas",club:"Al-Zawraa"},
    {num:22,pos:"FWD",name:"Hussein Falah",club:"Al-Diwaniyah"},
    {num:24,pos:"FWD",name:"Ahmed Yaseen",club:"Air Force Club"},
    {num:25,pos:"MID",name:"Ali Hisni",club:"Al-Zawraa"},
    {num:26,pos:"DEF",name:"Hayder Ali",club:"Al-Naft"}]},
  Norway:{coach:"Ståle Solbakken",players:[
    {num:1,pos:"GK",name:"Ørjan Nyland",club:"Atletico Madrid"},
    {num:12,pos:"GK",name:"Egil Selvik",club:"Brann"},
    {num:23,pos:"GK",name:"Sander Tangvik",club:"Glimt"},
    {num:2,pos:"DEF",name:"Kristoffer Ajer",club:"Brentford"},
    {num:3,pos:"DEF",name:"Julian Ryerson",club:"Borussia Dortmund"},
    {num:4,pos:"DEF",name:"Leo Østigård",club:"Napoli"},
    {num:5,pos:"DEF",name:"Marcus Holmgren Pedersen",club:"Feyenoord"},
    {num:6,pos:"DEF",name:"Fredrik Andre Bjørkan",club:"Glimt"},
    {num:13,pos:"DEF",name:"David Møller Wolfe",club:"Hoffenheim"},
    {num:8,pos:"MID",name:"Sander Berge",club:"Burnley"},
    {num:10,pos:"MID",name:"Martin Ødegaard",club:"Arsenal"},
    {num:16,pos:"MID",name:"Kristian Thorstvedt",club:"Sassuolo"},
    {num:17,pos:"MID",name:"Patrick Berg",club:"Lokomotiv Moscow"},
    {num:18,pos:"MID",name:"Fredrik Aursnes",club:"Benfica"},
    {num:19,pos:"MID",name:"Morten Thorsby",club:"Genoa"},
    {num:20,pos:"MID",name:"Oscar Bobb",club:"Man City"},
    {num:7,pos:"FWD",name:"Erling Haaland",club:"Man City"},
    {num:9,pos:"FWD",name:"Alexander Sørloth",club:"Atletico Madrid"},
    {num:11,pos:"FWD",name:"Jørgen Strand Larsen",club:"Wolves"},
    {num:15,pos:"FWD",name:"Antonio Nusa",club:"RB Leipzig"},
    {num:21,pos:"FWD",name:"Andreas Schjelderup",club:"Benfica"},
    {num:14,pos:"DEF",name:"Stian Gregersen",club:"Galatasaray"},
    {num:22,pos:"FWD",name:"Ola Solbakken",club:"Lazio"},
    {num:24,pos:"MID",name:"Mathias Normann",club:"Trabzonspor"},
    {num:90,pos:"FWD",name:"Ola Solbakken",club:"Lazio"},
    {num:91,pos:"MID",name:"Mathias Normann",club:"Trabzonspor"}]},
  Senegal:{coach:"Pape Thiaw",players:[
    {num:1,pos:"GK",name:"Édouard Mendy",club:"Al-Ahli"},
    {num:16,pos:"GK",name:"Mory Diaw",club:"Le Havre"},
    {num:23,pos:"GK",name:"Yehvann Diouf",club:"Nice"},
    {num:2,pos:"DEF",name:"Krepin Diatta",club:"Monaco"},
    {num:3,pos:"DEF",name:"Ismail Jakobs",club:"Galatasaray"},
    {num:4,pos:"DEF",name:"Kalidou Koulibaly",club:"Al-Hilal"},
    {num:5,pos:"DEF",name:"Moussa Niakhate",club:"Lyon"},
    {num:6,pos:"DEF",name:"Abdoulaye Seck",club:"Maccabi Haifa"},
    {num:13,pos:"DEF",name:"Mamadou Sarr",club:"Chelsea"},
    {num:14,pos:"DEF",name:"El-Hadji Malick Diouf",club:"West Ham"},
    {num:8,pos:"MID",name:"Idrissa Gueye",club:"Everton"},
    {num:10,pos:"MID",name:"Pape Matar Sarr",club:"Tottenham"},
    {num:17,pos:"MID",name:"Pape Gueye",club:"Villarreal"},
    {num:18,pos:"MID",name:"Lamine Camara",club:"Monaco"},
    {num:19,pos:"MID",name:"Habib Diarra",club:"Sunderland"},
    {num:20,pos:"MID",name:"Pathé Ciss",club:"Rayo Vallecano"},
    {num:7,pos:"FWD",name:"Sadio Mané",club:"Al-Nassr"},
    {num:9,pos:"FWD",name:"Nicolas Jackson",club:"Bayern Munich"},
    {num:11,pos:"FWD",name:"Ismaila Sarr",club:"Crystal Palace"},
    {num:15,pos:"FWD",name:"Iliman Ndiaye",club:"Everton"},
    {num:21,pos:"FWD",name:"Bamba Dieng",club:"Lorient"},
    {num:22,pos:"FWD",name:"Assane Diao",club:"Como"},
    {num:24,pos:"DEF",name:"Formose Mendy",club:"Almeria"},
    {num:25,pos:"MID",name:"Moustapha Name",club:"FC Metz"},
    {num:26,pos:"FWD",name:"Nicolas Jackson",club:"Bayern Munich"},
    {num:90,pos:"DEF",name:"Formose Mendy",club:"Almeria"}]},
  // ── GROUP J ──
  Algeria:{coach:"Vladimir Petković",players:[
    {num:1,pos:"GK",name:"Rais M'Bolhi",club:"Al-Ettifaq"},
    {num:16,pos:"GK",name:"Alexandre Oukidja",club:"Metz"},
    {num:23,pos:"GK",name:"Mehdi Zemmamouche",club:"NA Hussein Dey"},
    {num:2,pos:"DEF",name:"Youcef Atal",club:"Al-Sadd"},
    {num:3,pos:"DEF",name:"Ramy Bensebaini",club:"Borussia Dortmund"},
    {num:4,pos:"DEF",name:"Aissa Mandi",club:"Real Betis"},
    {num:5,pos:"DEF",name:"Djamel Benlamri",club:"Al-Ittihad"},
    {num:6,pos:"DEF",name:"Abdelkader Bedrane",club:"Damac"},
    {num:13,pos:"DEF",name:"Reda Halaïmia",club:"MC Alger"},
    {num:8,pos:"MID",name:"Riyad Mahrez",club:"Al-Ahli"},
    {num:10,pos:"MID",name:"Ismaël Bennacer",club:"AC Milan"},
    {num:17,pos:"MID",name:"Yacine Brahimi",club:"Al-Gharafa"},
    {num:18,pos:"MID",name:"Samir Benrahma",club:"Lyon"},
    {num:19,pos:"MID",name:"Amine Gouiri",club:"Stade Rennais"},
    {num:20,pos:"MID",name:"Adam Ounas",club:"Al-Sailiya"},
    {num:9,pos:"FWD",name:"Islam Slimani",club:"CFR Cluj"},
    {num:7,pos:"FWD",name:"Andy Delort",club:"RC Lens"},
    {num:11,pos:"FWD",name:"Yassine Benzia",club:"Al-Fayha"},
    {num:21,pos:"FWD",name:"Zakaria Aboukhlal",club:"Toulouse"},
    {num:14,pos:"DEF",name:"Djamel Benlamri",club:"Al-Ittihad"},
    {num:15,pos:"DEF",name:"Hicham Boudaoui",club:"Nantes"},
    {num:22,pos:"FWD",name:"Riyad Mahrez",club:"Al-Ahli"},
    {num:25,pos:"FWD",name:"Aouar Houssem",club:"Besiktas"},
    {num:26,pos:"FWD",name:"Farid Boulaya",club:"Metz"},
    {num:24,pos:"MID",name:"Mohamed Amoura",club:"Union Berlin"},
    {num:90,pos:"FWD",name:"Riyad Mahrez",club:"Al-Ahli"}]},
  Argentina:{coach:"Lionel Scaloni",players:[
    {num:1,pos:"GK",name:"Emiliano Martínez",club:"Aston Villa"},
    {num:12,pos:"GK",name:"Gerónimo Rulli",club:"Marseille"},
    {num:23,pos:"GK",name:"Juan Musso",club:"Atletico Madrid"},
    {num:2,pos:"DEF",name:"Gonzalo Montiel",club:"River Plate"},
    {num:3,pos:"DEF",name:"Nicolas Tagliafico",club:"Lyon"},
    {num:4,pos:"DEF",name:"Leonardo Balerdi",club:"Marseille"},
    {num:5,pos:"DEF",name:"Lisandro Martínez",club:"Man United"},
    {num:6,pos:"DEF",name:"Cristian Romero",club:"Tottenham"},
    {num:13,pos:"DEF",name:"Nicolás Otamendi",club:"Benfica"},
    {num:14,pos:"DEF",name:"Nahuel Molina",club:"Atletico Madrid"},
    {num:8,pos:"MID",name:"Enzo Fernandez",club:"Chelsea"},
    {num:10,pos:"MID",name:"Lionel Messi",club:"Inter Miami"},
    {num:17,pos:"MID",name:"Rodrigo De Paul",club:"Inter Miami"},
    {num:18,pos:"MID",name:"Leandro Paredes",club:"Boca Juniors"},
    {num:19,pos:"MID",name:"Giovani Lo Celso",club:"Real Betis"},
    {num:20,pos:"MID",name:"Alexis Mac Allister",club:"Liverpool"},
    {num:15,pos:"DEF",name:"Facundo Medina",club:"Marseille"},
    {num:9,pos:"FWD",name:"Julian Alvarez",club:"Atletico Madrid"},
    {num:11,pos:"FWD",name:"Lautaro Martínez",club:"Inter Milan"},
    {num:16,pos:"FWD",name:"Thiago Almada",club:"Atletico Madrid"},
    {num:24,pos:"FWD",name:"Giuliano Simeone",club:"Atletico Madrid"},
    {num:25,pos:"FWD",name:"Nico Paz",club:"Como"},
    {num:26,pos:"FWD",name:"José Manuel López",club:"Palmeiras"},
    {num:15,pos:"FWD",name:"Nicolas González",club:"Atletico Madrid"},
    {num:21,pos:"MID",name:"Exequiel Palacios",club:"Bayer Leverkusen"},
    {num:22,pos:"MID",name:"Valentín Barco",club:"Strasbourg"},
  ]},
  Austria:{coach:"Ralf Rangnick",players:[
    {num:1,pos:"GK",name:"Alexander Schlager",club:"RB Salzburg"},
    {num:12,pos:"GK",name:"Patrick Pentz",club:"Brondby"},
    {num:23,pos:"GK",name:"Florian Wiegele",club:"Viktoria Pilsen"},
    {num:2,pos:"DEF",name:"Stefan Posch",club:"Mainz"},
    {num:3,pos:"DEF",name:"Philipp Mwene",club:"Mainz"},
    {num:4,pos:"DEF",name:"David Alaba",club:"Real Madrid"},
    {num:5,pos:"DEF",name:"Kevin Danso",club:"Tottenham"},
    {num:6,pos:"DEF",name:"Philipp Lienhart",club:"Freiburg"},
    {num:13,pos:"DEF",name:"Marco Friedl",club:"Werder Bremen"},
    {num:14,pos:"DEF",name:"David Affengruber",club:"Elche"},
    {num:15,pos:"DEF",name:"Michael Svoboda",club:"Venezia"},
    {num:16,pos:"DEF",name:"Alexander Prass",club:"Hoffenheim"},
    {num:8,pos:"MID",name:"Nicolas Seiwald",club:"RB Leipzig"},
    {num:10,pos:"MID",name:"Marcel Sabitzer",club:"Borussia Dortmund"},
    {num:17,pos:"MID",name:"Xaver Schlager",club:"RB Leipzig"},
    {num:18,pos:"MID",name:"Florian Grillitsch",club:"Braga"},
    {num:19,pos:"MID",name:"Konrad Laimer",club:"Bayern Munich"},
    {num:20,pos:"MID",name:"Christoph Baumgartner",club:"RB Leipzig"},
    {num:21,pos:"MID",name:"Romano Schmid",club:"Werder Bremen"},
    {num:22,pos:"MID",name:"Alessandro Schöpf",club:"RZ Pellets WAC"},
    {num:24,pos:"MID",name:"Paul Wanner",club:"PSV Eindhoven"},
    {num:25,pos:"MID",name:"Patrick Wimmer",club:"Wolfsburg"},
    {num:9,pos:"FWD",name:"Marko Arnautovic",club:"Red Star Belgrade"},
    {num:7,pos:"FWD",name:"Michael Gregoritsch",club:"Augsburg"},
    {num:11,pos:"FWD",name:"Sasa Kalajdzic",club:"LASK"},
    {num:26,pos:"FWD",name:"Carney Chukwuemeka",club:"Borussia Dortmund"},
  ]},
  Jordan:{coach:"Jamal Sellami",players:[
    {num:1,pos:"GK",name:"Yazid Abulaila",club:"Al-Hussein"},
    {num:12,pos:"GK",name:"Abdallah Al Fakhouri",club:"Al-Wehdat"},
    {num:23,pos:"GK",name:"Mohamed Al-Emwasi",club:"Al-Najaf"},
    {num:2,pos:"DEF",name:"Mohammad Haikal",club:"Al-Wihdat"},
    {num:3,pos:"DEF",name:"Yousef Abu Al Jazar",club:"Al-Hussein"},
    {num:4,pos:"DEF",name:"Yazan Al Arab",club:"Seoul E-Land"},
    {num:5,pos:"DEF",name:"Abdallah Nasib",club:"Al-Zawraa"},
    {num:6,pos:"DEF",name:"Saleem Obaid",club:"Al-Hussein"},
    {num:13,pos:"DEF",name:"Bashar Bani Yaseen",club:"Al-Wahdat"},
    {num:14,pos:"DEF",name:"Ahmad Al Sarairah",club:"Al-Faisaly"},
    {num:15,pos:"DEF",name:"Zaid Al-Hijjawi",club:"Al-Hussein"},
    {num:8,pos:"MID",name:"Rajaei Ayed",club:"Al-Hussein"},
    {num:10,pos:"MID",name:"Amer Jamous",club:"Al-Zawraa"},
    {num:16,pos:"MID",name:"Amro Hamdan",club:"Al-Wahdat"},
    {num:17,pos:"MID",name:"Mohammad Al Dawoud",club:"Al-Wehdat"},
    {num:18,pos:"MID",name:"Nizar Al Rashdan",club:"Qatar SC"},
    {num:19,pos:"MID",name:"Haitham Eshidat",club:"Al-Ramtha"},
    {num:20,pos:"MID",name:"Baha'a Abdelrahman",club:"Al-Faisaly"},
    {num:21,pos:"MID",name:"Zaid Al-Samara",club:"Al-Wehdat"},
    {num:7,pos:"FWD",name:"Musa Al-Taamari",club:"Rennes"},
    {num:9,pos:"FWD",name:"Mousa Tamari",club:"Lorient"},
    {num:11,pos:"FWD",name:"Yazan Al-Naimat",club:"Al-Arabi"},
    {num:22,pos:"FWD",name:"Khaled Al-Za'bi",club:"Al-Qadsia"},
    {num:24,pos:"FWD",name:"Baha Faisal",club:"Al-Wahdat"},
    {num:25,pos:"MID",name:"Oday Dabbagh",club:"NK Istra"},
    {num:26,pos:"FWD",name:"Yusuf Almomani",club:"Al-Ramtha"}
  ]},
  // ── GROUP K ──
  Portugal:{coach:"Roberto Martínez",players:[
    {num:1,pos:"GK",name:"Diogo Costa",club:"Porto"},
    {num:12,pos:"GK",name:"Jose Sá",club:"Wolves"},
    {num:23,pos:"GK",name:"Rui Silva",club:"Sporting CP"},
    {num:2,pos:"DEF",name:"Joao Cancelo",club:"Barcelona"},
    {num:3,pos:"DEF",name:"Nuno Mendes",club:"PSG"},
    {num:4,pos:"DEF",name:"Ruben Dias",club:"Man City"},
    {num:5,pos:"DEF",name:"Diogo Dalot",club:"Man United"},
    {num:6,pos:"DEF",name:"Goncalo Inácio",club:"Sporting CP"},
    {num:13,pos:"DEF",name:"Renato Veiga",club:"Villarreal"},
    {num:14,pos:"DEF",name:"Nelson Semedo",club:"Fenerbahce"},
    {num:15,pos:"DEF",name:"Tomas Araujo",club:"Benfica"},
    {num:16,pos:"DEF",name:"Matheus Nunes",club:"Man City"},
    {num:8,pos:"MID",name:"Bruno Fernandes",club:"Man United"},
    {num:10,pos:"MID",name:"Bernardo Silva",club:"Man City"},
    {num:17,pos:"MID",name:"Joao Neves",club:"PSG"},
    {num:18,pos:"MID",name:"Vitinha",club:"PSG"},
    {num:19,pos:"MID",name:"Ruben Neves",club:"Al Hilal"},
    {num:20,pos:"MID",name:"Samú Costa",club:"Mallorca"},
    {num:7,pos:"FWD",name:"Cristiano Ronaldo",club:"Al Nassr"},
    {num:9,pos:"FWD",name:"Rafael Leão",club:"AC Milan"},
    {num:11,pos:"FWD",name:"Pedro Neto",club:"Chelsea"},
    {num:21,pos:"FWD",name:"Joao Felix",club:"Al Nassr"},
    {num:22,pos:"FWD",name:"Goncalo Ramos",club:"PSG"},
    {num:24,pos:"FWD",name:"Francisco Conceição",club:"Juventus"},
    {num:25,pos:"FWD",name:"Goncalo Guedes",club:"Real Sociedad"},
    {num:26,pos:"FWD",name:"Francisco Trincão",club:"Sporting CP"},
  ]},
  Colombia:{coach:"Néstor Lorenzo",players:[
    {num:1,pos:"GK",name:"David Ospina",club:"Atletico Nacional"},
    {num:12,pos:"GK",name:"Camilo Vargas",club:"Atlas"},
    {num:23,pos:"GK",name:"Alvaro Montero",club:"Velez Sarsfield"},
    {num:2,pos:"DEF",name:"Santiago Arias",club:"Esporte Clube Bahia"},
    {num:3,pos:"DEF",name:"Johan Mojica",club:"Mallorca"},
    {num:4,pos:"DEF",name:"Davinson Sanchez",club:"Galatasaray"},
    {num:5,pos:"DEF",name:"Yerry Mina",club:"Cagliari"},
    {num:6,pos:"DEF",name:"Daniel Munoz",club:"Crystal Palace"},
    {num:13,pos:"DEF",name:"Jhon Lucumi",club:"Bologna"},
    {num:14,pos:"DEF",name:"Yerson Mosquera",club:"Wolverhampton"},
    {num:15,pos:"DEF",name:"Juan Cabal",club:"Juventus"},
    {num:16,pos:"DEF",name:"Cristian Borja",club:"Club América"},
    {num:8,pos:"MID",name:"Jefferson Lerma",club:"Crystal Palace"},
    {num:10,pos:"MID",name:"James Rodríguez",club:"Minnesota United"},
    {num:17,pos:"MID",name:"Jhon Arias",club:"Palmeiras"},
    {num:18,pos:"MID",name:"Richard Rios",club:"Benfica"},
    {num:19,pos:"MID",name:"Jorge Carrascal",club:"Dinamo Moscow"},
    {num:20,pos:"MID",name:"Yáser Asprilla",club:"Girona"},
    {num:7,pos:"FWD",name:"Luis Díaz",club:"Bayern Munich"},
    {num:9,pos:"FWD",name:"Jhon Durán",club:"Aston Villa"},
    {num:11,pos:"FWD",name:"Luis Sinisterra",club:"Bournemouth"},
    {num:21,pos:"FWD",name:"Jhon Córdoba",club:"Krasnodar"},
    {num:22,pos:"FWD",name:"Juan Camilo Hernández",club:"Columbus Crew"},
    {num:24,pos:"DEF",name:"Carlos Cuesta",club:"Genk"},
    {num:25,pos:"FWD",name:"Cucho Hernandez",club:"Columbus Crew"},
    {num:26,pos:"MID",name:"Jorge Carrascal",club:"Dinamo Moscow"}]},
  "DR Congo":{coach:"Sébastien Desabre",players:[
    {num:1,pos:"GK",name:"Mike Epolo",club:"Standard Liege"},
    {num:12,pos:"GK",name:"Timothy Fayulu",club:"Noah"},
    {num:23,pos:"GK",name:"Lionel Mpasi",club:"Le Havre"},
    {num:2,pos:"DEF",name:"Aaron Wan-Bissaka",club:"West Ham"},
    {num:3,pos:"DEF",name:"Arthur Masuaku",club:"RC Lens"},
    {num:4,pos:"DEF",name:"Chancel Mbemba",club:"Lille"},
    {num:5,pos:"DEF",name:"Gedeon Kalulu",club:"AEL Limassol"},
    {num:6,pos:"DEF",name:"Dylan Batubinsika",club:"Larisa"},
    {num:13,pos:"DEF",name:"Joris Kayembe",club:"Racing Genk"},
    {num:14,pos:"DEF",name:"Axel Tuanzebe",club:"Burnley"},
    {num:16,pos:"DEF",name:"Rocky Bushiri",club:"Hibernian"},
    {num:15,pos:"DEF",name:"Steve Kapuadi",club:"Widzew Lodz"},
    {num:8,pos:"MID",name:"Samuel Moutoussamy",club:"Atromitos"},
    {num:10,pos:"MID",name:"Gael Kakuta",club:"Larisa"},
    {num:17,pos:"MID",name:"Meschack Elia",club:"Alanyaspor"},
    {num:18,pos:"MID",name:"Noah Sadiki",club:"Sunderland"},
    {num:19,pos:"MID",name:"Edo Kayembe",club:"Watford"},
    {num:20,pos:"MID",name:"Ngal'ayel Mukau",club:"Lille"},
    {num:21,pos:"MID",name:"Charles Pickel",club:"Espanyol"},
    {num:22,pos:"MID",name:"Théo Bongonda",club:"Spartak Moscow"},
    {num:7,pos:"FWD",name:"Yoane Wissa",club:"Newcastle"},
    {num:9,pos:"FWD",name:"Cedric Bakambu",club:"Real Betis"},
    {num:11,pos:"FWD",name:"Simon Banza",club:"Al Jazira"},
    {num:22,pos:"FWD",name:"Fiston Mayele",club:"Pyramids FC"},
    {num:25,pos:"FWD",name:"Cédric Bakambu",club:"Real Betis"},
    {num:26,pos:"MID",name:"Theo Bongonda",club:"Spartak Moscow"}]},
  Uzbekistan:{coach:"Fabio Cannavaro",players:[
    {num:1,pos:"GK",name:"Vladimir Nazarov",club:"Pakhtakor"},
    {num:12,pos:"GK",name:"Utkir Yusupov",club:"Navbahor"},
    {num:23,pos:"GK",name:"Botirali Ergashev",club:"AGMK"},
    {num:2,pos:"DEF",name:"Rustamjon Ashurmatov",club:"Esteghlal"},
    {num:3,pos:"DEF",name:"Mukhammadkodir Hamraliev",club:"Pakhtakor"},
    {num:4,pos:"DEF",name:"Abdukodir Khusanov",club:"Man City"},
    {num:5,pos:"DEF",name:"Avazbek Ulmasaliev",club:"AGMK"},
    {num:6,pos:"DEF",name:"Jakhongir Urozov",club:"Dinamo Samarqand"},
    {num:13,pos:"DEF",name:"Otabek Shukurov",club:"Baniyas"},
    {num:14,pos:"DEF",name:"Sherzod Karimov",club:"Pakhtakor"},
    {num:15,pos:"DEF",name:"Dostonbek Khamdamov",club:"Neftchi"},
    {num:16,pos:"DEF",name:"Bobur Abdixoliqov",club:"Lokomotiv Tashkent"},
    {num:8,pos:"MID",name:"Nodirbek Abdurazzokov",club:"AGMK"},
    {num:10,pos:"MID",name:"Odiljon Khamrobekov",club:"Tractor"},
    {num:17,pos:"MID",name:"Jamshid Iskanderov",club:"Neftchi"},
    {num:18,pos:"MID",name:"Kuvondik Ruziev",club:"Neftchi"},
    {num:19,pos:"MID",name:"Otabek Bekmurodov",club:"Pakhtakor"},
    {num:20,pos:"MID",name:"Husan Norchaev",club:"Lokomotiv Tashkent"},
    {num:21,pos:"MID",name:"Sanjar Tursunov",club:"AGMK"},
    {num:9,pos:"FWD",name:"Eldor Shomurodov",club:"Istanbul Basaksehir"},
    {num:7,pos:"FWD",name:"Abbosek Fayzullaev",club:"Istanbul Basaksehir"},
    {num:11,pos:"FWD",name:"Jaloliddin Masharipov",club:"Esteghlal"},
    {num:15,pos:"FWD",name:"Oston Urunov",club:"Persepolis"},
    {num:22,pos:"FWD",name:"Umid Sadullayev",club:"Pakhtakor"},
    {num:25,pos:"FWD",name:"Oston Urunov",club:"Persepolis"},
    {num:26,pos:"MID",name:"Doniyor Ganiev",club:"Navbahor"}]},
  // ── GROUP L ──
  England:{coach:"Thomas Tuchel",players:[
    {num:1,pos:"GK",name:"Jordan Pickford",club:"Everton"},
    {num:13,pos:"GK",name:"Dean Henderson",club:"Crystal Palace"},
    {num:23,pos:"GK",name:"James Trafford",club:"Man City"},
    {num:2,pos:"DEF",name:"Reece James",club:"Chelsea"},
    {num:3,pos:"DEF",name:"Tino Livramento",club:"Newcastle"},
    {num:4,pos:"DEF",name:"Marc Guehi",club:"Man City"},
    {num:5,pos:"DEF",name:"John Stones",club:"Man City"},
    {num:6,pos:"DEF",name:"Ezri Konsa",club:"Aston Villa"},
    {num:12,pos:"DEF",name:"Dan Burn",club:"Newcastle"},
    {num:14,pos:"DEF",name:"Jarrell Quansah",club:"Bayer Leverkusen"},
    {num:8,pos:"MID",name:"Jude Bellingham",club:"Real Madrid"},
    {num:10,pos:"MID",name:"Declan Rice",club:"Arsenal"},
    {num:17,pos:"MID",name:"Kobbie Mainoo",club:"Man United"},
    {num:18,pos:"MID",name:"Morgan Rogers",club:"Aston Villa"},
    {num:19,pos:"MID",name:"Eberechi Eze",club:"Arsenal"},
    {num:20,pos:"MID",name:"Elliot Anderson",club:"Nottingham Forest"},
    {num:7,pos:"FWD",name:"Bukayo Saka",club:"Arsenal"},
    {num:9,pos:"FWD",name:"Harry Kane",club:"Bayern Munich"},
    {num:11,pos:"FWD",name:"Marcus Rashford",club:"Barcelona"},
    {num:22,pos:"FWD",name:"Anthony Gordon",club:"Newcastle"},
    {num:24,pos:"FWD",name:"Noni Madueke",club:"Arsenal"},
    {num:25,pos:"FWD",name:"Ivan Toney",club:"Al Ahli"},
    {num:26,pos:"FWD",name:"Ollie Watkins",club:"Aston Villa"},
    {num:15,pos:"DEF",name:"Levi Colwill",club:"Chelsea"},
    {num:16,pos:"MID",name:"Adam Wharton",club:"Crystal Palace"},
    {num:21,pos:"FWD",name:"Cole Palmer",club:"Chelsea"}]},
  Croatia:{coach:"Zlatko Dalić",players:[
    {num:1,pos:"GK",name:"Dominik Livaković",club:"Dinamo Zagreb"},
    {num:12,pos:"GK",name:"Dominik Kotarski",club:"FC Copenhagen"},
    {num:23,pos:"GK",name:"Ivor Pandur",club:"Hull City"},
    {num:2,pos:"DEF",name:"Josip Stanišić",club:"Bayern Munich"},
    {num:3,pos:"DEF",name:"Borna Sosa",club:"Fenerbahce"},
    {num:4,pos:"DEF",name:"Joško Gvardiol",club:"Man City"},
    {num:5,pos:"DEF",name:"Duje Ćaleta-Car",club:"Real Sociedad"},
    {num:6,pos:"DEF",name:"Marin Pongračić",club:"Fiorentina"},
    {num:13,pos:"DEF",name:"Martin Erlić",club:"Midtjylland"},
    {num:14,pos:"DEF",name:"Josip Šutalo",club:"Ajax"},
    {num:15,pos:"DEF",name:"Luka Vušković",club:"Hamburger SV"},
    {num:8,pos:"MID",name:"Mateo Kovačić",club:"Man City"},
    {num:10,pos:"MID",name:"Luka Modrić",club:"AC Milan"},
    {num:17,pos:"MID",name:"Nikola Vlašić",club:"Torino"},
    {num:18,pos:"MID",name:"Mario Pašalić",club:"Atalanta"},
    {num:19,pos:"MID",name:"Luka Sučić",club:"Real Sociedad"},
    {num:20,pos:"MID",name:"Martin Baturina",club:"Como"},
    {num:21,pos:"MID",name:"Petar Sučić",club:"Inter"},
    {num:22,pos:"MID",name:"Nikola Moro",club:"Bologna"},
    {num:7,pos:"FWD",name:"Ivan Perišić",club:"PSV Eindhoven"},
    {num:9,pos:"FWD",name:"Andrej Kramarić",club:"Hoffenheim"},
    {num:11,pos:"FWD",name:"Ante Budimir",club:"Osasuna"},
    {num:16,pos:"FWD",name:"Igor Matanović",club:"Freiburg"},
    {num:24,pos:"FWD",name:"Marco Pašalić",club:"Orlando City"},
    {num:25,pos:"FWD",name:"Petar Musa",club:"FC Dallas"},
    {num:26,pos:"FWD",name:"Petar Musa",club:"FC Dallas"}]},
  Ghana:{coach:"Carlos Queiroz",players:[
    {num:1,pos:"GK",name:"Lawrence Ati Zigi",club:"St. Gallen"},
    {num:12,pos:"GK",name:"Ibrahim Danlad",club:"Asante Kotoko"},
    {num:23,pos:"GK",name:"Richard Ofori",club:"Orlando Pirates"},
    {num:2,pos:"DEF",name:"Tariq Lamptey",club:"Brighton"},
    {num:3,pos:"DEF",name:"Baba Rahman",club:"Reading"},
    {num:4,pos:"DEF",name:"Alexander Djiku",club:"Strasbourg"},
    {num:5,pos:"DEF",name:"Daniel Amartey",club:"Leicester City"},
    {num:6,pos:"DEF",name:"Gideon Mensah",club:"Lyon"},
    {num:13,pos:"DEF",name:"Dennis Odoi",club:"Club Brugge"},
    {num:14,pos:"DEF",name:"Alidu Seidu",club:"Rennes"},
    {num:15,pos:"DEF",name:"Joseph Aidoo",club:"Celta Vigo"},
    {num:21,pos:"DEF",name:"Kingsley Schindler",club:"Sandhausen"},
    {num:8,pos:"MID",name:"Thomas Partey",club:"Arsenal"},
    {num:10,pos:"MID",name:"Kudus Mohammed",club:"West Ham"},
    {num:17,pos:"MID",name:"Salis Abdul Samed",club:"Lens"},
    {num:18,pos:"MID",name:"Elisha Owusu",club:"Nantes"},
    {num:19,pos:"MID",name:"Iddrisu Baba",club:"Mallorca"},
    {num:22,pos:"MID",name:"André Ayew",club:"Le Havre"},
    {num:24,pos:"MID",name:"Emmanuel Lomotey",club:"Desp. La Coruña"},
    {num:7,pos:"FWD",name:"Inaki Williams",club:"Athletic Bilbao"},
    {num:9,pos:"FWD",name:"Antoine Semenyo",club:"Bournemouth"},
    {num:11,pos:"FWD",name:"Jordan Ayew",club:"Leicester City"},
    {num:16,pos:"FWD",name:"Kamaldeen Sulemana",club:"Southampton"},
    {num:20,pos:"FWD",name:"Ransford Yeboah",club:"Hamburger SV"},
    {num:25,pos:"FWD",name:"Osman Bukari",club:"Red Star Belgrade"},
    {num:26,pos:"FWD",name:"Osman Bukari",club:"Red Star Belgrade"}]},
  Panama:{coach:"Thomas Christiansen",players:[
    {num:1,pos:"GK",name:"Orlando Mosquera",club:"Independiente Medellín"},
    {num:12,pos:"GK",name:"Luis Mejia",club:"Independiente"},
    {num:23,pos:"GK",name:"Cesar Samudio",club:"Tauro FC"},
    {num:2,pos:"DEF",name:"Amir Murillo",club:"Anderlecht"},
    {num:3,pos:"DEF",name:"Eric Davis",club:"Nashville SC"},
    {num:4,pos:"DEF",name:"Fidel Escobar",club:"NY Red Bulls"},
    {num:5,pos:"DEF",name:"Andres Andrade",club:"Sassuolo"},
    {num:6,pos:"DEF",name:"Cesar Blackman",club:"Malaga"},
    {num:13,pos:"DEF",name:"Jose Cordoba",club:"Columbus Crew"},
    {num:14,pos:"DEF",name:"Edgardo Fariña",club:"Tauro FC"},
    {num:15,pos:"DEF",name:"Ricardo Avila",club:"CD Plaza Amador"},
    {num:8,pos:"MID",name:"Anibal Godoy",club:"Nashville SC"},
    {num:10,pos:"MID",name:"Adalberto Carrasquilla",club:"Watford"},
    {num:16,pos:"MID",name:"Carlos Harvey",club:"Portland Timbers"},
    {num:17,pos:"MID",name:"Cesar Yanis",club:"Fatih Karagumruk"},
    {num:18,pos:"MID",name:"Yoel Barcenas",club:"Tigre"},
    {num:19,pos:"MID",name:"Alberto Quintero",club:"Municipal"},
    {num:20,pos:"MID",name:"Rolando Blackburn",club:"Chivas"},
    {num:21,pos:"MID",name:"Josiel Núñez",club:"CD Plaza Amador"},
    {num:7,pos:"FWD",name:"Ismael Diaz",club:"Getafe"},
    {num:9,pos:"FWD",name:"Cecilio Waterman",club:"San Jose Earthquakes"},
    {num:11,pos:"FWD",name:"Jose Fajardo",club:"Portland Timbers"},
    {num:22,pos:"FWD",name:"Tomas Rodriguez",club:"Eintracht Frankfurt"},
    {num:24,pos:"FWD",name:"Freddy Gondola",club:"FK Bodø/Glimt"},
    {num:25,pos:"FWD",name:"Gabriel Torres",club:"Olimpia"},
    {num:26,pos:"FWD",name:"Gabriel Torres",club:"Olimpia"}]},
};

// ── Countdown Hook ──────────────────────────────────────────────────────────
function useCountdown(targetUTC) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = targetUTC - now;
  if (diff <= 0) return null;
  const s = Math.floor(diff / 1000);
  return { d: Math.floor(s/86400), h: Math.floor((s%86400)/3600), min: Math.floor((s%3600)/60), s: s%60 };
}

function Countdown({ dateStr, etTime, accent }) {
  const target = useMemo(() => { try { return matchUTC(dateStr, etTime); } catch { return 0; } }, [dateStr, etTime]);
  const cd = useCountdown(target);
  const pad = n => String(n).padStart(2,"0");
  if (!cd) return (
    <div style={{display:"flex",alignItems:"center",gap:5,marginTop:4}}>
      <span style={{width:6,height:6,borderRadius:"50%",background:"#ef4444",display:"inline-block",animation:"pulse 1s infinite"}}/>
      <span style={{fontSize:10,color:"#ef4444",fontWeight:700}}>শুরু হয়েছে</span>
    </div>
  );
  if (cd.d >= 1) return <div style={{marginTop:4,fontSize:11,fontWeight:700,color:accent}}>বাকি {cd.d}দিন {cd.h}ঘণ্টা</div>;
  return (
    <div style={{display:"flex",alignItems:"center",gap:3,marginTop:5,flexWrap:"wrap"}}>
      <span style={{fontSize:9,color:"#6b7280",marginRight:2}}>বাকি</span>
      {[[pad(cd.h),"ঘণ্টা"],[pad(cd.min),"মিনিট"],[pad(cd.s),"সেকেন্ড"]].map(([v,l])=>(
        <span key={l} style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
          <span style={{fontFamily:"'Bebas Neue',cursive",fontSize:17,color:accent,background:`${accent}18`,border:`1px solid ${accent}30`,borderRadius:5,padding:"1px 6px",minWidth:26,textAlign:"center"}}>{v}</span>
          <span style={{fontSize:8,color:"#4b5563",marginTop:1}}>{l}</span>
        </span>
      ))}
    </div>
  );
}

function shareMatch(fix) {
  const text = `⚽ ${fix.home} vs ${fix.away}\n📅 ${bdDateStr(fix.dateStr,fix.etTime)} 2026 | ${bdTime(fix.etTime)} BD সময়\n📍 ${fix.venue.split(",")[0]}\n#FIFAWorldCup2026`;
  if (navigator.share) navigator.share({ title:"FIFA World Cup 2026", text });
  else navigator.clipboard.writeText(text).then(() => alert("ক্লিপবোর্ডে কপি হয়েছে!"));
}

// ── Notification helpers ─────────────────────────────────────
const NOTIF_KEY = "wc26_notifs";
function getScheduledNotifs() {
  try { return JSON.parse(localStorage.getItem(NOTIF_KEY) || "{}"); } catch { return {}; }
}
function saveScheduledNotif(fixId, timeoutId) {
  const obj = getScheduledNotifs(); obj[fixId] = timeoutId;
  try { localStorage.setItem(NOTIF_KEY, JSON.stringify(obj)); } catch {}
}
function removeScheduledNotif(fixId) {
  const obj = getScheduledNotifs();
  if (obj[fixId]) { clearTimeout(obj[fixId]); delete obj[fixId]; }
  try { localStorage.setItem(NOTIF_KEY, JSON.stringify(obj)); } catch {}
}
function isNotifScheduled(fixId) { return !!getScheduledNotifs()[fixId]; }

async function ensureNotifPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") { alert("Browser এ notification blocked। Settings থেকে allow করুন।"); return false; }
  const p = await Notification.requestPermission();
  return p === "granted";
}
function scheduleNotif(fix, minutesBefore = 10) {
  // fix can be a group fixture (dateStr+etTime) or KO match (date+etTime)
  const dateStr = fix.dateStr || fix.date;
  const ms = matchUTC(dateStr, fix.etTime) - Date.now() - (minutesBefore * 60000);
  if (ms <= 0) return null;
  const tid = setTimeout(() => {
    const n = new Notification(`⚽ ${minutesBefore} মিনিট পরে ম্যাচ!`, {
      body: `${fix.home} vs ${fix.away}\n${bdTime(fix.etTime)} BD সময়`,
      icon: "/icon-192.png", tag: `wc26-match-${fix.id}`, requireInteraction: true,
    });
    n.onclick = () => { window.focus(); n.close(); };
    removeScheduledNotif(fix.id);
  }, ms);
  return tid;
}
async function requestNotification(fix, onUpdate) {
  const granted = await ensureNotifPermission();
  if (!granted) return;
  if (isNotifScheduled(fix.id)) {
    removeScheduledNotif(fix.id);
    if (onUpdate) onUpdate(fix.id, false); return;
  }
  const dateStr = fix.dateStr || fix.date;
  const utc = matchUTC(dateStr, fix.etTime);
  if (utc - Date.now() <= 0) { alert("ম্যাচ শুরু হয়ে গেছে বা শেষ!"); return; }
  const tid = scheduleNotif(fix, 10);
  if (tid === null) { alert("ম্যাচ শুরু ১০ মিনিটের কম বাকি!"); return; }
  saveScheduledNotif(fix.id, tid);
  if (onUpdate) onUpdate(fix.id, true);
}
async function scheduleFavTeamNotifs(favTeam, fixtures, onUpdate) {
  if (!favTeam) return;
  const granted = await ensureNotifPermission();
  if (!granted) return;
  const favFixes = fixtures.filter(f =>
    (f.home === favTeam || f.away === favTeam) && matchUTC(f.dateStr, f.etTime) - Date.now() > 60000
  );
  if (favFixes.length === 0) { alert("আর কোনো upcoming match নেই।"); return; }
  let count = 0;
  favFixes.forEach(f => {
    if (!isNotifScheduled(f.id)) {
      const tid = scheduleNotif(f, 10);
      if (tid !== null) { saveScheduledNotif(f.id, tid); count++; if (onUpdate) onUpdate(f.id, true); }
    }
  });
  alert(count > 0 ? `✅ ${count}টি ম্যাচের রিমাইন্ডার সেট!` : "সব ম্যাচের রিমাইন্ডার আগেই সেট আছে।");
}

function getTeamGroup(t) {
  for (const [g,ts] of Object.entries(GROUPS)) if (ts.includes(t)) return g;
  return "?";
}



// ── My Team Component ────────────────────────────────────────────────────────
function MyTeamTab({T, c, dark, favTeam, setFavTeam, results}) {
  const [teamSearch, setTeamSearch] = useState("");
  const [countdown, setCountdown] = useState("");
  const [nowMs, setNowMs] = useState(Date.now());

  // tick every second for countdown
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const team = favTeam;
  const grp = team ? (Object.entries(GROUPS).find(([,ts]) => ts.includes(team))?.[0] || "?") : null;
  const sq = team ? SQUADS[team] : null;

  // All matches for this team
  const teamFixtures = team
    ? ALL_GROUP_FIXTURES.filter(f => f.home === team || f.away === team)
    : [];

  // Next upcoming match
  const nextMatch = teamFixtures.find(f => {
    try { return matchUTC(f.dateStr, f.etTime) > nowMs; } catch { return false; }
  });

  // Countdown string
  useEffect(() => {
    if (!nextMatch) { setCountdown(""); return; }
    const diff = matchUTC(nextMatch.dateStr, nextMatch.etTime) - nowMs;
    if (diff <= 0) { setCountdown("শুরু হয়ে গেছে!"); return; }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    if (d > 0) setCountdown(`${d}দিন ${h}ঘণ্টা ${m}মিনিট`);
    else if (h > 0) setCountdown(`${h}ঘণ্টা ${m}মিনিট ${s}সেকেন্ড`);
    else setCountdown(`${m}মিনিট ${s}সেকেন্ড`);
  }, [nowMs, nextMatch]);

  // Group standings calc
  const groupTeams = grp ? GROUPS[grp] : [];
  const standings = groupTeams.map(t => {
    const fixes = ALL_GROUP_FIXTURES.filter(f => f.home === t || f.away === t);
    let pts=0, w=0, d=0, l=0, gf=0, ga=0;
    fixes.forEach(f => {
      const r = results[f.id];
      if (!r) return;
      const h = parseInt(r.h), a = parseInt(r.a);
      if (isNaN(h) || isNaN(a)) return;
      const isHome = f.home === t;
      const tg = isHome ? h : a, og = isHome ? a : h;
      gf += tg; ga += og;
      if (tg > og) { pts += 3; w++; }
      else if (tg === og) { pts += 1; d++; }
      else { l++; }
    });
    return { team: t, pts, w, d, l, gf, ga, gd: gf-ga };
  }).sort((a,b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);

  // Live score এখন App-level fetchResults থেকে আসা `results` prop থেকেই derive হয় — আলাদা API call লাগে না


  const posColors = { GK:"#f59e0b", DEF:"#3b82f6", MID:"#10b981", FWD:"#ef4444" };
  const posLabel = { GK:"গোলকিপার", DEF:"ডিফেন্ডার", MID:"মিডফিল্ডার", FWD:"ফরওয়ার্ড" };

  // Team selector screen
  if (!team) {
    const filtered = ALL_TEAMS.filter(t => !teamSearch || t.toLowerCase().includes(teamSearch.toLowerCase()));
    return (
      <div className="fi">
        <div style={{textAlign:"center", padding:"24px 0 16px"}}>
          <div style={{fontSize:48, marginBottom:8}}>⭐</div>
          <div style={{fontFamily:"'Bebas Neue',cursive", fontSize:24, letterSpacing:3, color:c}}>আপনার প্রিয় দল বেছে নিন</div>
          <div style={{fontSize:12, color:T.sub, marginTop:4}}>৪৮টি দল থেকে একটি বেছে নিন — তারপর সব তথ্য এক জায়গায়</div>
        </div>
        <input value={teamSearch} onChange={e=>setTeamSearch(e.target.value)}
          placeholder="🔍 দলের নাম লিখুন..."
          style={{background:T.card, border:`1px solid ${T.border}`, borderRadius:10, color:T.text, padding:"10px 14px", fontSize:13, outline:"none", width:"100%", fontFamily:"inherit", marginBottom:14}}/>
        <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:8}}>
          {filtered.map(t => (
            <button key={t} onClick={()=>setFavTeam(t)}
              style={{background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"10px 12px", cursor:"pointer", display:"flex", alignItems:"center", gap:8, transition:"all .18s", textAlign:"left"}}>
              <span style={{fontSize:22}}>{FLAGS[t]||"🏳"}</span>
              <div>
                <div style={{fontSize:12, fontWeight:700, color:T.text}}>{t}</div>
                <div style={{fontSize:10, color:T.sub}}>Group {Object.entries(GROUPS).find(([,ts])=>ts.includes(t))?.[0]||"?"}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="fi" style={{display:"flex",flexDirection:"column",gap:12}}>

      {/* Hero Card */}
      <div style={{background:`linear-gradient(135deg,${c}18,${c}06)`,border:`1px solid ${c}30`,borderRadius:16,padding:"18px 20px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-20,right:-20,fontSize:100,opacity:.06}}>{FLAGS[team]||"🏳"}</div>
        <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
          <span style={{fontSize:60}}>{FLAGS[team]||"🏳"}</span>
          <div style={{flex:1}}>
            <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:32,letterSpacing:3,color:c,lineHeight:1}}>{team.toUpperCase()}</div>
            <div style={{fontSize:12,color:T.sub,marginTop:4}}>
              Group {grp} · {sq?.coach ? `কোচ: ${sq.coach}` : ""} · {sq?.players?.length||0} খেলোয়াড়
            </div>
            <button onClick={()=>setFavTeam(null)}
              style={{marginTop:8,padding:"4px 12px",borderRadius:99,border:`1px solid ${T.border}`,background:T.card,color:T.sub,fontSize:11,cursor:"pointer"}}>
              ✕ দল পরিবর্তন
            </button>
          </div>
        </div>
      </div>

      {/* Countdown */}
      {nextMatch && (
        <div style={{background:T.card,border:`1px solid ${c}30`,borderRadius:14,padding:"14px 18px",textAlign:"center"}}>
          <div style={{fontSize:11,color:T.sub,letterSpacing:2,fontFamily:"'Bebas Neue',cursive",marginBottom:6}}>পরের ম্যাচ</div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,marginBottom:10,flexWrap:"wrap"}}>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:18,fontWeight:700,color:T.text}}>{nextMatch.home}</div>
              <div style={{fontSize:24}}>{FLAGS[nextMatch.home]||"🏳"}</div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:22,color:c,letterSpacing:2}}>VS</div>
              <div style={{fontSize:10,color:T.sub}}>{nextMatch.dateStr} · {bdTime(nextMatch.etTime).time} BD</div>
              <div style={{fontSize:10,color:T.dim}}>{nextMatch.venue?.split(",")[0]}</div>
            </div>
            <div style={{textAlign:"left"}}>
              <div style={{fontSize:24}}>{FLAGS[nextMatch.away]||"🏳"}</div>
              <div style={{fontSize:18,fontWeight:700,color:T.text}}>{nextMatch.away}</div>
            </div>
          </div>
          <div style={{background:dark?"rgba(0,0,0,.3)":"rgba(0,0,0,.05)",borderRadius:10,padding:"10px 0"}}>
            <div style={{fontSize:11,color:T.sub,marginBottom:2}}>শুরু হতে আরও</div>
            <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:28,color:c,letterSpacing:2}}>{countdown}</div>
          </div>
        </div>
      )}
      {!nextMatch && teamFixtures.length > 0 && (
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"14px",textAlign:"center",color:T.sub,fontSize:13}}>
          ✅ গ্রুপ পর্বের সব ম্যাচ শেষ
        </div>
      )}

      {/* Group Standings */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"14px 16px"}}>
        <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:14,letterSpacing:2,color:c,marginBottom:10}}>GROUP {grp} পয়েন্ট টেবিল</div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead>
              <tr style={{borderBottom:`1px solid ${T.border}`}}>
                {["#","দল","ম্যাচ","জয়","ড্র","হার","পয়েন্ট"].map(h=>(
                  <th key={h} style={{padding:"5px 6px",textAlign:h==="দল"?"left":"center",color:T.sub,fontWeight:600,fontSize:10,whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {standings.map((s,i) => (
                <tr key={s.team} style={{borderBottom:`1px solid ${T.border}`,background:s.team===team?`${c}10`:"transparent",transition:"background .2s"}}>
                  <td style={{padding:"7px 6px",textAlign:"center",color:i<2?c:T.dim,fontWeight:700}}>{i+1}</td>
                  <td style={{padding:"7px 6px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:16}}>{FLAGS[s.team]||"🏳"}</span>
                      <span style={{fontWeight:s.team===team?700:500,color:s.team===team?c:T.text,fontSize:12}}>{s.team}</span>
                    </div>
                  </td>
                  <td style={{textAlign:"center",color:T.sub,padding:"7px 4px"}}>{s.w+s.d+s.l}</td>
                  <td style={{textAlign:"center",color:"#10b981",padding:"7px 4px"}}>{s.w}</td>
                  <td style={{textAlign:"center",color:T.sub,padding:"7px 4px"}}>{s.d}</td>
                  <td style={{textAlign:"center",color:"#ef4444",padding:"7px 4px"}}>{s.l}</td>
                  <td style={{textAlign:"center",padding:"7px 4px"}}>
                    <span style={{fontFamily:"'Bebas Neue',cursive",fontSize:16,color:s.team===team?c:T.text,fontWeight:700}}>{s.pts}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {standings.every(s=>s.pts===0) && (
          <div style={{textAlign:"center",fontSize:11,color:T.dim,marginTop:8}}>ম্যাচ শুরু হলে পয়েন্ট আসবে</div>
        )}
      </div>

      {/* All Fixtures */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"14px 16px"}}>
        <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:14,letterSpacing:2,color:c,marginBottom:10}}>সম্পূর্ণ সূচি — BD সময়</div>
        <div style={{display:"flex",flexDirection:"column",gap:5}}>
          {teamFixtures.map((f,i) => {
            const r = results[f.id];
            const hasScore2 = r&&r.h!==""&&r.a!==""&&!isNaN(+r.h)&&!isNaN(+r.a);
            const matchOver2 = matchUTC(f.dateStr,f.etTime)+105*60000 < nowMs;
            const isLive2 = !matchOver2 && matchUTC(f.dateStr,f.etTime) < nowMs;
            const isNext = nextMatch && f.id === nextMatch.id;
            const isHome = f.home === team;
            const {time:bdT2,label:bdL2} = etToBD(f.etTime);
            const timeStr2 = bdL2+" "+bdT2;
            const bdDate2 = bdDateStr(f.dateStr,f.etTime);
            return (
              <div key={f.id} style={{
                borderRadius:9,overflow:"hidden",
                border:`1px solid ${isNext?c:hasScore2?c+"33":T.border}`,
                background:isNext?`${c}08`:T.card,
                borderLeft:isNext?`3px solid ${c}`:isHome?"3px solid transparent":"3px solid transparent",
              }}>
                <div style={{display:"flex",alignItems:"center",padding:"8px 10px",gap:0}}>
                  {/* Date */}
                  <div style={{flexShrink:0,width:54,marginRight:6}}>
                    <div style={{background:isNext?c:dark?"#1e3a5f":"#1e40af",color:"#fff",borderRadius:5,padding:"2px 4px",textAlign:"center"}}>
                      <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:10,lineHeight:1}}>{bdDate2}</div>
                      {isNext&&<div style={{fontSize:7,fontWeight:700,opacity:.9}}>পরের</div>}
                    </div>
                  </div>
                  {/* Home */}
                  <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"flex-end",gap:4,minWidth:0}}>
                    <span style={{fontSize:11,fontWeight:isHome?700:400,textAlign:"right",wordBreak:"break-word",lineHeight:1.2,color:hasScore2&&+r.h>+r.a?c:isHome?c:T.text}}>{f.home}</span>
                    <span style={{fontSize:20,flexShrink:0}}>{FLAGS[f.home]||"🏳"}</span>
                  </div>
                  {/* Center */}
                  <div style={{flexShrink:0,width:72,textAlign:"center",padding:"0 3px"}}>
                    {hasScore2?(
                      <div style={{padding:"2px 0",borderRadius:5,background:isLive2?"rgba(239,68,68,.15)":"rgba(16,185,129,.12)",border:`1px solid ${isLive2?"#ef444466":c+"55"}`}}>
                        <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:17,color:isLive2?"#ef4444":c,lineHeight:1}}>{r.h}:{r.a}</div>
                        <div style={{fontSize:7,fontWeight:800,color:isLive2?"#ef4444":T.sub}}>{matchOver2?"FT":"LIVE"}</div>
                      </div>
                    ):(
                      <div style={{padding:"2px 0",borderRadius:5,background:T.acBg,border:`1px solid ${c}22`}}>
                        <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:10,color:c,lineHeight:1.3,whiteSpace:"nowrap"}}>{timeStr2}</div>
                        <div style={{fontSize:7,color:T.dim}}>BD সময়</div>
                      </div>
                    )}
                  </div>
                  {/* Away */}
                  <div style={{flex:1,display:"flex",alignItems:"center",gap:4,minWidth:0}}>
                    <span style={{fontSize:20,flexShrink:0}}>{FLAGS[f.away]||"🏳"}</span>
                    <span style={{fontSize:11,fontWeight:!isHome?700:400,wordBreak:"break-word",lineHeight:1.2,color:hasScore2&&+r.a>+r.h?c:!isHome?c:T.text}}>{f.away}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Squad */}
      {sq && (
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"14px 16px"}}>
          <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:14,letterSpacing:2,color:c,marginBottom:10}}>স্কোয়াড</div>
          {["GK","DEF","MID","FWD"].map(pos => {
            const pl = sq.players.filter(p=>p.pos===pos);
            if(!pl.length) return null;
            return (
              <div key={pos} style={{marginBottom:12}}>
                <div style={{fontSize:10,fontWeight:700,color:posColors[pos],letterSpacing:2,marginBottom:6,display:"flex",alignItems:"center",gap:5}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:posColors[pos]}}/>
                  {posLabel[pos]} ({pl.length})
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:5}}>
                  {pl.map((p,i) => (
                    <div key={i} style={{background:dark?"rgba(255,255,255,.03)":"rgba(0,0,0,.03)",border:`1px solid ${T.border}`,borderRadius:8,padding:"7px 10px",display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:28,height:28,borderRadius:"50%",background:`${posColors[pos]}18`,border:`1.5px solid ${posColors[pos]}40`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Bebas Neue',cursive",fontSize:12,color:posColors[pos],flexShrink:0}}>{p.num}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:600,fontSize:11,color:T.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.name}</div>
                        <div style={{fontSize:9,color:T.sub,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.club}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Live Score Card — only shows when team has a match today */}
      {(()=>{
        const todayMatch = ALL_GROUP_FIXTURES.find(f => {
          if (f.home !== team && f.away !== team) return false;
          const utc = matchUTC(f.dateStr, f.etTime);
          const elapsed = nowMs - utc;
          return elapsed > -10*60*1000 && elapsed < 115*60*1000;
        });
        if (!todayMatch) return null;
        const isHome = todayMatch.home === team;
        // results prop (App-level fetchResults থেকে আসা) থেকে live data derive করা
        const r = results[todayMatch.id];
        const hasScore = r && r.h !== "" && r.a !== "" && !isNaN(+r.h) && !isNaN(+r.a);
        const liveScore = hasScore ? {
          h: r.h, a: r.a, status: r.status || "FT", minute: r.minute,
          timeline: Array.isArray(r.goals) ? r.goals.map(g => ({
            minute: g.minute, player: g.scorer,
            team: g.team === "home" ? todayMatch.home : todayMatch.away,
            type: "goal"
          })) : []
        } : null;
        const statusColor = liveScore?.status==="LIVE"?"#ef4444":liveScore?.status==="HT"?"#f59e0b":"#10b981";
        return (
          <div style={{background:liveScore?.status==="LIVE"?`rgba(239,68,68,.06)`:T.card, border:`2px solid ${liveScore?.status==="LIVE"?"#ef4444":c}`, borderRadius:16, padding:"18px 20px", animation:"fadeIn .3s ease"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                {liveScore?.status==="LIVE" && <span style={{width:8,height:8,borderRadius:"50%",background:"#ef4444",display:"inline-block",animation:"pulse 1s infinite"}}/>}
                <span style={{fontFamily:"'Bebas Neue',cursive",fontSize:14,letterSpacing:2,color:liveScore?statusColor:c}}>
                  {liveScore?.status==="LIVE"?"🔴 LIVE":liveScore?.status==="HT"?"⏸ হাফ টাইম":liveScore?.status==="FT"?"✅ ফুল টাইম":"⏳ আজকের ম্যাচ"}
                  {liveScore?.status==="LIVE" && liveScore.minute ? ` · ${liveScore.minute}'` : ""}
                </span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:10,color:T.dim}}>↻ অটো-আপডেট ৩০সে</span>
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:16,flexWrap:"wrap"}}>
              <div style={{textAlign:"center",flex:1}}>
                <div style={{fontSize:36,marginBottom:4}}>{FLAGS[todayMatch.home]||"🏳"}</div>
                <div style={{fontSize:14,fontWeight:700,color:isHome?c:T.text}}>{todayMatch.home}</div>
              </div>
              <div style={{textAlign:"center",minWidth:100}}>
                {liveScore ? (
                  <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:52,color:liveScore.status==="LIVE"?"#ef4444":c,lineHeight:1,letterSpacing:4}}>
                    {liveScore.h} - {liveScore.a}
                  </div>
                ) : (
                  <div style={{textAlign:"center"}}>
                    <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:22,color:c,letterSpacing:2}}>VS</div>
                    <div style={{fontSize:11,color:T.sub,marginTop:4}}>{bdTime(todayMatch.etTime).time} BD</div>
                  </div>
                )}
              </div>
              <div style={{textAlign:"center",flex:1}}>
                <div style={{fontSize:36,marginBottom:4}}>{FLAGS[todayMatch.away]||"🏳"}</div>
                <div style={{fontSize:14,fontWeight:700,color:!isHome?c:T.text}}>{todayMatch.away}</div>
              </div>
            </div>
            <div style={{textAlign:"center",marginTop:12,fontSize:11,color:T.dim}}>
              {todayMatch.venue?.split(",")[0]} · {todayMatch.dateStr}
            </div>
            {/* ── Match Timeline ── */}
            {liveScore && Array.isArray(liveScore.timeline) && liveScore.timeline.length > 0 && (
              <div style={{marginTop:14,padding:"10px 12px",background:T.card,border:`1px solid ${T.border}`,borderRadius:10}}>
                <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:12,letterSpacing:2,color:c,marginBottom:8}}>⚽ GOAL TIMELINE</div>
                <div style={{display:"flex",flexDirection:"column",gap:5}}>
                  {liveScore.timeline.filter(e=>e.type==="goal"||e.type==="owngoal"||e.type==="penalty").map((e,i)=>{
                    const isHome = e.team === todayMatch.home;
                    const icon = e.type==="owngoal"?"🔴":e.type==="penalty"?"⚽🅿️":"⚽";
                    return (
                      <div key={i} style={{display:"flex",alignItems:"center",gap:6,justifyContent:isHome?"flex-start":"flex-end"}}>
                        {isHome && <span style={{fontFamily:"'Bebas Neue',cursive",fontSize:12,color:T.dim,minWidth:28}}>{e.minute}'</span>}
                        {isHome && <span style={{fontSize:13}}>{icon}</span>}
                        <div style={{padding:"3px 8px",background:isHome?`${c}18`:"rgba(239,68,68,.1)",border:`1px solid ${isHome?c+"33":"rgba(239,68,68,.3)"}`,borderRadius:6}}>
                          <span style={{fontSize:11,fontWeight:700,color:isHome?c:"#ef4444"}}>{e.player}</span>
                          {e.type==="owngoal" && <span style={{fontSize:9,color:"#ef4444",marginLeft:3}}>(OG)</span>}
                          {e.type==="penalty" && <span style={{fontSize:9,color:T.sub,marginLeft:3}}>(P)</span>}
                        </div>
                        {!isHome && <span style={{fontSize:13}}>{icon}</span>}
                        {!isHome && <span style={{fontFamily:"'Bebas Neue',cursive",fontSize:12,color:T.dim,minWidth:28,textAlign:"right"}}>{e.minute}'</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

    </div>
  );
}

// ── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const [dark, setDark] = useState(() => { try { const s=localStorage.getItem("wc26_theme"); return s ? s==="dark" : true; } catch { return true; } });
  const [darkAnimating, setDarkAnimating] = useState(false);
  const [tab, setTab] = useState("fixtures");
  const [search, setSearch] = useState("");
  const [grpFilter, setGrpFilter] = useState("ALL");
  const [koRound, setKoRound] = useState(0);
  const [squadTeam, setSquadTeam] = useState(null);
  const [squadModal, setSquadModal] = useState(false);
  const [squadSearch, setSquadSearch] = useState("");
  const [standGrp, setStandGrp] = useState("A");
  const [stadIdx, setStadIdx] = useState(null);
  const [results, setResults] = useState(() => ({...MANUAL_RESULTS}));
  const [koResults, setKoResults] = useState({});
  const resultsRef = useRef(results);
  const koResultsRef = useRef(koResults);
  useEffect(()=>{ resultsRef.current = results; }, [results]);
  useEffect(()=>{ koResultsRef.current = koResults; }, [koResults]);
  const [favTeam, setFavTeam] = useState(() => { try { return localStorage.getItem("wc26_fav")||null; } catch { return null; } });
  const [bdClock, setBdClock] = useState("");
  const [autoFetching, setAutoFetching] = useState(false);
  const [lastFetched, setLastFetched] = useState(null);
  const fetchTimeoutRef = useRef(null);
  // Feature: Head-to-Head
  const [h2hFixId, setH2hFixId] = useState(null);
  const [h2hData, setH2hData] = useState({});
  // Feature: Bracket interactive
  const [bracketSelected, setBracketSelected] = useState(null);
  const [bracketScale, setBracketScale] = useState(0.55);
  // Feature: Match Predictions
  const [predictions, setPredictions] = useState(() => { try { return JSON.parse(localStorage.getItem("wc26_predictions")||"{}"); } catch { return {}; } });
  const [predModal, setPredModal] = useState(null);
  const [predHome, setPredHome] = useState("");
  const [predAway, setPredAway] = useState("");
  // Feature: Share Card modal
  const [shareCardFix, setShareCardFix] = useState(null);
  // Feature: Visitor Counter
  const [visitorCount, setVisitorCount] = useState(null);
  // Feature: PWA + Notifications
  const [installPrompt, setInstallPrompt] = useState(null);
  const [pwaInstalled, setPwaInstalled] = useState(false);
  const [notifScheduled, setNotifScheduled] = useState(() => {
    try { const o = getScheduledNotifs(); const r={}; Object.keys(o).forEach(k=>r[k]=true); return r; } catch { return {}; }
  });
  const [notifPermission, setNotifPermission] = useState(
    () => "Notification" in window ? Notification.permission : "unsupported"
  );

  // Live BD clock
  useEffect(() => {
    function tick() {
      const now = new Date();
      const bdMs = now.getTime() + (6 * 3600000); // UTC + 6 hours = Bangladesh
      const bd = new Date(bdMs);
      const h = bd.getUTCHours(), m = bd.getUTCMinutes(), s = bd.getUTCSeconds();
      const h12 = h % 12 === 0 ? 12 : h % 12;
      const ap = h < 12 ? "AM" : "PM";
      const label = h>=4&&h<6?"ভোর":h>=6&&h<12?"সকাল":h>=12&&h<15?"দুপুর":h>=15&&h<18?"বিকেল":h>=18&&h<20?"সন্ধ্যা":"রাত";
      setBdClock(`${label} ${h12}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")} ${ap}`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── PWA: Service Worker ──────────────────────────────────────
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js")
        .then(reg => console.log("SW:", reg.scope))
        .catch(err => console.warn("SW failed:", err));
    }
  }, []);

  // ── PWA: Install prompt ───────────────────────────────────────
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => { setInstallPrompt(null); setPwaInstalled(true); });
    if (window.matchMedia("(display-mode: standalone)").matches) setPwaInstalled(true);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // ── Notification permission sync ──────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      if ("Notification" in window) setNotifPermission(Notification.permission);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  // ── পেজ reload হলে আগের setTimeout হারিয়ে যায় — তাই localStorage এ
  //    সেট করা reminder গুলো নতুন করে re-schedule (re-arm) করা হয় ──
  useEffect(() => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const scheduled = getScheduledNotifs();
    Object.keys(scheduled).forEach(fixId => {
      let fix = ALL_GROUP_FIXTURES.find(f => String(f.id) === String(fixId));
      if (!fix) {
        const m = KNOCKOUT_ROUNDS.flatMap(r => r.matches).find(mm => String(mm.id) === String(fixId));
        if (m) fix = { ...m, dateStr: m.date };
      }
      if (!fix) { removeScheduledNotif(fixId); return; }
      const tid = scheduleNotif(fix, 10);
      if (tid === null) removeScheduledNotif(fixId);
      else saveScheduledNotif(fixId, tid);
    });
    const updated = getScheduledNotifs();
    const map={}; Object.keys(updated).forEach(k=>map[k]=true);
    setNotifScheduled(map);
  }, []);

  const handleNotifToggle = useCallback((fixId, scheduled) => {
    setNotifScheduled(prev => {
      const next = { ...prev };
      if (scheduled) next[fixId] = true; else delete next[fixId];
      return next;
    });
  }, []);

  const handleInstallPWA = useCallback(async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") { setInstallPrompt(null); setPwaInstalled(true); }
  }, [installPrompt]);

  // Auto-fetch results from TheSportsDB (free, CORS-friendly, real live data)
  const fetchResults = useCallback(async () => {
    setAutoFetching(true);
    try {
      const now = Date.now();

      // ── সব fixture (group + KO) যেগুলো শুরু হয়ে গেছে ──
      const startedGroup = ALL_GROUP_FIXTURES
        .filter(f => { try { return matchUTC(f.dateStr,f.etTime) <= now; } catch { return false; } })
        .map(f => ({ id:f.id, isKO:false, home:f.home, away:f.away, utc:matchUTC(f.dateStr,f.etTime) }));

      const isPlaceholder = (n) => /^(Winner|Runner-up|Best|W |L )/.test(n||"");
      const startedKO = KNOCKOUT_ROUNDS.flatMap(r=>r.matches)
        .filter(m => { try { return koMatchUTC(m) <= now && !isPlaceholder(m.home) && !isPlaceholder(m.away); } catch { return false; } })
        .map(m => ({ id:m.id, isKO:true, home:m.home, away:m.away, utc:koMatchUTC(m) }));

      const started = [...startedGroup, ...startedKO];
      console.log("[WC26] started fixtures:", started.length, started.map(f=>`${f.home} vs ${f.away}`));
      if (!started.length) { setAutoFetching(false); return; }

      // ── PRIMARY: football-data.org (goal scorer সহ পূর্ণ ডেটা) ──────────
      const useFD = FOOTBALL_DATA_API_KEY && FOOTBALL_DATA_API_KEY !== "YOUR_FOOTBALL_DATA_API_KEY";
      if (useFD) {
        try {
          const listRes = await fdFetch(`https://api.football-data.org/v4/competitions/${FD_WC_COMPETITION_ID}/matches`);
          console.log("[WC26] football-data response status:", listRes.status);
          if (listRes.ok) {
            const listJson = await listRes.json();
            const matches = Array.isArray(listJson.matches) ? listJson.matches : [];
            console.log("[WC26] football-data total matches:", matches.length, "sample:", matches.slice(0,3).map(m=>`${m.homeTeam?.name} vs ${m.awayTeam?.name} | ${m.status} | ${m.score?.fullTime?.home}-${m.score?.fullTime?.away}`));
            const newGroup = {}, newKO = {};
            const detailQueue = [];
            for (const f of started) {
              const homeAlt = fdName(f.home), awayAlt = fdName(f.away);
              const m = matches.find(mm =>
                (teamsMatch(mm.homeTeam?.name, homeAlt) && teamsMatch(mm.awayTeam?.name, awayAlt)) ||
                (teamsMatch(mm.homeTeam?.name, awayAlt) && teamsMatch(mm.awayTeam?.name, homeAlt))
              );
              if (!m) { console.log(`[WC26] NO MATCH FOUND for ${f.home} vs ${f.away} (looked for "${homeAlt}" vs "${awayAlt}")`); continue; }
              console.log(`[WC26] matched ${f.home} vs ${f.away} -> ${m.homeTeam?.name} ${m.score?.fullTime?.home}-${m.score?.fullTime?.away} ${m.awayTeam?.name} | status=${m.status}`);
              const swapped = !teamsMatch(m.homeTeam?.name, homeAlt);
              let h = m.score?.fullTime?.home, a = m.score?.fullTime?.away;
              if (h===null||h===undefined||a===null||a===undefined) { h = m.score?.halfTime?.home; a = m.score?.halfTime?.away; }
              if (h===null||h===undefined||a===null||a===undefined) continue;
              if (swapped) { const t=h; h=a; a=t; }
              let status = "FT";
              if (m.status === "IN_PLAY") status = "LIVE";
              else if (m.status === "PAUSED") status = "HT";
              else if (m.status === "FINISHED") status = "FT";
              const minute = m.minute || null;
              const cached = (f.isKO ? koResultsRef.current[f.id] : resultsRef.current[f.id]);
              const cachedGoals = Array.isArray(cached?.goals) ? cached.goals : [];
              const entry = { h:String(h), a:String(a), status, minute, goals:cachedGoals, cards:[] };
              if (f.isKO) newKO[f.id] = entry; else newGroup[f.id] = entry;
              const totalGoals = (+h||0) + (+a||0);
              const needGoals = totalGoals > 0 && (status==="LIVE" || status==="HT" || cachedGoals.length < totalGoals);
              if (needGoals) detailQueue.push({ ...f, matchId:m.id, swapped });
            }
            // rate-limit safe: প্রতি cycle এ সর্বোচ্চ ৪টা ম্যাচের detail (goal scorer) আনা হয়
            for (const dq of detailQueue.slice(0,4)) {
              try {
                const dr = await fdFetch(`https://api.football-data.org/v4/matches/${dq.matchId}`);
                if (dr.ok) {
                  const dj = await dr.json();
                  const goalsArr = Array.isArray(dj.goals) ? dj.goals : [];
                  const goals = goalsArr.map(g => {
                    const scorerIsHomeTeam = teamsMatch(g.team?.name, dq.swapped ? fdName(dq.away) : fdName(dq.home));
                    return { team: scorerIsHomeTeam ? "home" : "away", scorer: g.scorer?.name || "?", minute: g.minute };
                  });
                  if (dq.isKO) newKO[dq.id] = { ...newKO[dq.id], goals };
                  else newGroup[dq.id] = { ...newGroup[dq.id], goals };
                }
              } catch {}
            }
            if (Object.keys(newGroup).length > 0) setResults(prev => ({ ...prev, ...newGroup }));
            if (Object.keys(newKO).length > 0) setKoResults(prev => ({ ...prev, ...newKO }));
            setLastFetched(new Date());
            setAutoFetching(false);
            return; // football-data সফল হলে TSDB fallback লাগবে না
          }
        } catch (e) { console.error("football-data fetch error:", e); }
      }

      // ── FALLBACK: TheSportsDB (key-less, কিন্তু goal scorer প্রায়ই অনুপস্থিত) ──
      const dateSet = new Set();
      started.forEach(f => {
        const d = new Date(f.utc);
        dateSet.add(d.toISOString().slice(0,10));
        // ম্যাচ শেষ রাতে শুরু হলে পরের দিনেও result আসতে পারে — সেফটির জন্য +1 দিনও যুক্ত করি
        dateSet.add(new Date(f.utc + 24*3600000).toISOString().slice(0,10));
      });

      const eventsByDate = {};
      await Promise.all([...dateSet].map(async d => {
        try {
          const r = await fetch(`https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${d}&l=4429`);
          const j = await r.json();
          eventsByDate[d] = Array.isArray(j.events) ? j.events : [];
        } catch { eventsByDate[d] = []; }
      }));

      // ── Fallback: পুরো সিজনের ইভেন্ট লিস্ট (date-based lookup miss করলে এটা থেকে team-name দিয়ে খুঁজে নেওয়া হবে) ──
      let seasonEvents = [];
      const dayBasedFound = new Set();
      Object.values(eventsByDate).forEach(list => list.forEach(ev => dayBasedFound.add(ev.idEvent)));
      const needsFallback = started.some(f => {
        const dateA = new Date(f.utc).toISOString().slice(0,10);
        const dateB = new Date(f.utc + 24*3600000).toISOString().slice(0,10);
        const candidates = [...(eventsByDate[dateA]||[]), ...(eventsByDate[dateB]||[])];
        const homeAlt = tsdbName(f.home), awayAlt = tsdbName(f.away);
        return !candidates.find(e =>
          (teamsMatch(e.strHomeTeam,homeAlt) && teamsMatch(e.strAwayTeam,awayAlt)) ||
          (teamsMatch(e.strHomeTeam,awayAlt) && teamsMatch(e.strAwayTeam,homeAlt))
        );
      });
      if (needsFallback) {
        try {
          const sr = await fetch(`https://www.thesportsdb.com/api/v1/json/3/eventsseason.php?id=4429&s=2026`);
          const sj = await sr.json();
          seasonEvents = Array.isArray(sj.events) ? sj.events : [];
        } catch {}
      }

      const newGroup = {}, newKO = {};

      for (const f of started) {
        const dateA = new Date(f.utc).toISOString().slice(0,10);
        const dateB = new Date(f.utc + 24*3600000).toISOString().slice(0,10);
        const candidates = [...(eventsByDate[dateA]||[]), ...(eventsByDate[dateB]||[]), ...seasonEvents];
        const homeAlt = tsdbName(f.home), awayAlt = tsdbName(f.away);
        const ev = candidates.find(e =>
          (teamsMatch(e.strHomeTeam,homeAlt) && teamsMatch(e.strAwayTeam,awayAlt)) ||
          (teamsMatch(e.strHomeTeam,awayAlt) && teamsMatch(e.strAwayTeam,homeAlt))
        );
        if (!ev) continue;
        if (ev.intHomeScore === null || ev.intAwayScore === null || ev.intHomeScore === undefined || ev.intAwayScore === undefined) continue;

        const swapped = !teamsMatch(ev.strHomeTeam, homeAlt);
        let h = +ev.intHomeScore, a = +ev.intAwayScore;
        if (swapped) { const t=h; h=a; a=t; }

        // status detection
        let status = "FT";
        const st = (ev.strStatus||"").toLowerCase();
        const prog = (ev.strProgress||"").toLowerCase();
        if (st.includes("finish") || st === "ft" || st.includes("match finished")) status = "FT";
        else if (st.includes("half") || prog.includes("ht")) status = "HT";
        else if (st === "ns" || st.includes("not started") || !st) status = "FT"; // fallback: কোনো status না থাকলে FT ধরে নেই (score আছে মানে শেষ)
        else status = "LIVE";

        let minute = null;
        const mm = (ev.strProgress||"").match(/(\d+)/);
        if (mm) minute = +mm[1];

        // goal scorers — lookupevent থেকে বিভিন্ন possible field চেক করা হয়
        let goals = [];
        try {
          const lr = await fetch(`https://www.thesportsdb.com/api/v1/json/3/lookupevent.php?id=${ev.idEvent}`);
          const lj = await lr.json();
          const det = lj.events?.[0] || ev;
          const homeSide = swapped ? "away" : "home";
          const awaySide = swapped ? "home" : "away";
          const homeStr = det.strHomeGoalDetails || det.strHomeGoalsDetails || ev.strHomeGoalDetails;
          const awayStr = det.strAwayGoalDetails || det.strAwayGoalsDetails || ev.strAwayGoalDetails;
          goals = [
            ...parseGoalDetails(homeStr, homeSide),
            ...parseGoalDetails(awayStr, awaySide),
          ];
        } catch {}

        const entry = { h:String(h), a:String(a), status, minute, goals, cards:[] };
        if (f.isKO) newKO[f.id] = entry; else newGroup[f.id] = entry;
      }

      if (Object.keys(newGroup).length > 0) setResults(prev => ({ ...prev, ...newGroup }));
      if (Object.keys(newKO).length > 0) setKoResults(prev => ({ ...prev, ...newKO }));
      setLastFetched(new Date());
    } catch (err) {
      console.error("Auto-fetch error:", err);
    }
    setAutoFetching(false);
  }, []);

  // Smart interval: live match থাকলে ৩০ সেকেন্ড, নইলে ১ মিনিট
  useEffect(() => {
    fetchResults();
    let timeoutId;
    const scheduleNext = () => {
      const now = Date.now();
      const hasLiveGroup = ALL_GROUP_FIXTURES.some(f => {
        try { const e = now - matchUTC(f.dateStr, f.etTime); return e >= 0 && e < 115 * 60 * 1000; } catch { return false; }
      });
      const hasLiveKO = KNOCKOUT_ROUNDS.flatMap(r=>r.matches).some(m => {
        try { const e = now - koMatchUTC(m); return e >= 0 && e < 125 * 60 * 1000; } catch { return false; }
      });
      const delay = (hasLiveGroup || hasLiveKO) ? 30 * 1000 : 60 * 1000;
      timeoutId = setTimeout(async () => {
        await fetchResults();
        scheduleNext();
      }, delay);
    };
    scheduleNext();
    return () => clearTimeout(timeoutId);
  }, [fetchResults]);

  useEffect(() => {
    if (squadModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [squadModal]);

  useEffect(() => {
    try { favTeam ? localStorage.setItem("wc26_fav",favTeam) : localStorage.removeItem("wc26_fav"); } catch {}
  }, [favTeam]);

  // Visitor counter — counterapi.dev (free, countapi.xyz এর replacement)
  useEffect(() => {
    async function trackVisit() {
      try {
        // Try counterapi.dev
        const key = "wc2026_visitors";
        const res = await fetch(`https://api.counterapi.dev/v1/md686tube-hue/${key}/up`);
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data.count === 'number') { setVisitorCount(data.count); return; }
        }
      } catch {}
      try {
        // Fallback: api.countapi.xyz (may still work for some)
        const ns = (window.location.hostname||'wc2026').replace(/\./g,'_');
        const res2 = await fetch(`https://api.countapi.xyz/hit/${ns}/wc26`);
        if (res2.ok) {
          const d2 = await res2.json();
          if (d2 && typeof d2.value==='number') setVisitorCount(d2.value);
        }
      } catch {}
    }
    trackVisit();
  }, []);

  // (ticker uses pure CSS animation)

  function setResult(id, h, a) { setResults(p => ({...p,[id]:{h,a}})); }
  function toggleFav(team) { setFavTeam(p => p===team ? null : team); }

  function savePrediction(fixId, h, a) {
    setPredictions(prev => {
      const next = {...prev, [fixId]: {h, a, ts: Date.now()}};
      try { localStorage.setItem("wc26_predictions", JSON.stringify(next)); } catch {}
      return next;
    });
    setPredModal(null); setPredHome(""); setPredAway("");
  }

  function getPredResult(fixId) {
    const pred = predictions[fixId];
    const actual = results[fixId];
    if (!pred || !actual || actual.h==="" || actual.a==="") return null;
    const ph=+pred.h, pa=+pred.a, ah=+actual.h, aa=+actual.a;
    if (ph===ah && pa===aa) return "exact";
    const predWinner = ph>pa?"home":ph<pa?"away":"draw";
    const actualWinner = ah>aa?"home":ah<aa?"away":"draw";
    if (predWinner===actualWinner) return "result";
    return "wrong";
  }

  const predStats = useMemo(() => {
    let exact=0, result=0, wrong=0, total=0;
    Object.keys(predictions).forEach(id => {
      const r = getPredResult(+id);
      if (r) { total++; if(r==="exact") exact++; else if(r==="result") result++; else wrong++; }
    });
    return {exact, result, wrong, total};
  }, [predictions, results]);

  function toggleDark() {
    setDarkAnimating(true);
    setTimeout(() => {
      setDark(d => {
        const next = !d;
        try { localStorage.setItem("wc26_theme", next ? "dark" : "light"); } catch {}
        return next;
      });
      setDarkAnimating(false);
    }, 180);
  }

  // Head-to-Head - instant local data, no API needed
  const fetchH2H = useCallback((fix) => {
    const key = fix.id;
    setH2hFixId(prev => prev === key ? null : key);
    if (!h2hData[key]) {
      const d = H2H_DATA[key];
      if (d) {
        setH2hData(p => ({...p, [key]: d}));
      } else {
        setH2hData(p => ({...p, [key]: {
          home_team: fix.home, away_team: fix.away,
          meetings: 0, home_wins: 0, draws: 0, away_wins: 0,
          last_match: "তথ্য পাওয়া যায়নি", last_year: null,
          summary: `${fix.home} ও ${fix.away}-এর মধ্যে বিস্তারিত তথ্য এই মুহূর্তে পাওয়া যাচ্ছে না।`,
          notable_fact: "", wc_meetings: 0
        }}));
      }
    }
  }, [h2hData]);

  function calcStandings(g) {
    const teams = GROUPS[g];
    const s = Object.fromEntries(teams.map(t=>[t,{mp:0,w:0,d:0,l:0,gf:0,ga:0,pts:0}]));
    ALL_GROUP_FIXTURES.filter(f=>f.grp===g).forEach(f=>{
      const r=results[f.id];
      if(r&&r.h!==""&&r.a!==""&&!isNaN(+r.h)&&!isNaN(+r.a)){
        const [h,a]=[+r.h,+r.a];
        s[f.home].mp++;s[f.away].mp++;
        s[f.home].gf+=h;s[f.home].ga+=a;s[f.away].gf+=a;s[f.away].ga+=h;
        if(h>a){s[f.home].w++;s[f.home].pts+=3;s[f.away].l++;}
        else if(h===a){s[f.home].d++;s[f.home].pts+=1;s[f.away].d++;s[f.away].pts+=1;}
        else{s[f.away].w++;s[f.away].pts+=3;s[f.home].l++;}
      }
    });
    return Object.entries(s).map(([t,v])=>({team:t,...v,gd:v.gf-v.ga}))
      .sort((a,b)=>b.pts-a.pts||(b.gd-a.gd)||(b.gf-a.gf));
  }

  const filteredFix = useMemo(()=>{
    const now = Date.now();
    let list = ALL_GROUP_FIXTURES.filter(f=>{
      try { return matchUTC(f.dateStr,f.etTime) + 105*60000 >= now; } catch { return true; }
    });
    if(grpFilter!=="ALL") list=list.filter(f=>f.grp===grpFilter);
    if(search.trim()) {
      const q=search.toLowerCase().trim();
      const mns={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
      const mnArr=["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
      list=list.filter(f=>{
        const teamMatch=f.home.toLowerCase().includes(q)||f.away.toLowerCase().includes(q);
        // BD date for this fixture
        const [eh,em]=(f.etTime||"0:0").split(":").map(Number);
        const nd=(eh*60+(em||0)+600)>=1440;
        let bdDs=f.dateStr.toLowerCase();
        if(nd){try{const[mo,dy]=f.dateStr.split(" ");const d=new Date(2026,(mns[mo.toLowerCase()]||0)+1,Number(dy));bdDs=mnArr[d.getMonth()-1<0?11:d.getMonth()-1]+" "+d.getDate();}catch{}}
        // actually simpler:
        if(nd){try{const[mo,dy]=f.dateStr.split(" ");const mn2=mns[mo.toLowerCase()];const d=new Date(2026,mn2,Number(dy)+1);bdDs=mnArr[d.getMonth()]+" "+d.getDate();}catch{}}
        const dateMatch=bdDs.includes(q)||f.dateStr.toLowerCase().includes(q)||q===String(bdDs.split(" ")[1])||q===String(f.dateStr.toLowerCase().split(" ")[1]);
        return teamMatch||dateMatch;
      });
    }
    if(favTeam) list=[...list.filter(f=>f.home===favTeam||f.away===favTeam),...list.filter(f=>f.home!==favTeam&&f.away!==favTeam)];
    return list;
  },[grpFilter,search,favTeam,results]);

  // Ticker: আজকের BD date এর ম্যাচ (ET time → BD date convert করে compare)
  const tickerItems = useMemo(() => {
    const now = Date.now();
    const bdNow = new Date(now + 6*3600000);
    const mn = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const todayBD = mn[bdNow.getUTCMonth()] + " " + bdNow.getUTCDate();
    const items = [];
    // BD date অনুযায়ী আজকের ম্যাচ ফিল্টার
    const todayFixtures = ALL_GROUP_FIXTURES.filter(f => bdDateStr(f.dateStr, f.etTime) === todayBD);
    const allTodayOver = todayFixtures.length>0 && todayFixtures.every(f => matchUTC(f.dateStr,f.etTime) + 110*60000 < now);
    if (todayFixtures.length>0 && !allTodayOver) {
    todayFixtures.forEach(f => {
      const r = results[f.id];
      const hasScore = r && r.h !== "" && r.a !== "" && !isNaN(+r.h) && !isNaN(+r.a);
      const matchMs = matchUTC(f.dateStr, f.etTime);
      const over = matchMs + 110*60000 < now;
      const isLive = matchMs <= now && !over;
      if (hasScore) {
        const statusLabel = over ? "FT" : isLive ? (r.minute ? `🔴 ${r.minute}'` : "🔴 LIVE") : "⏳";
        items.push(`${FLAGS[f.home]||"🏳"} ${f.home} ${r.h}–${r.a} ${f.away} ${FLAGS[f.away]||"🏳"} · ${statusLabel}`);
      } else {
        const diffMs = matchMs - now;
        let countdown = "";
        if (diffMs > 0) {
          const totalMin = Math.floor(diffMs / 60000);
          const hrs = Math.floor(totalMin / 60);
          const mins = totalMin % 60;
          countdown = hrs > 0 ? `${hrs}ঘ ${mins}মি বাকি` : `${mins}মি বাকি`;
        }
        items.push(`⏳ ${FLAGS[f.home]||"🏳"} ${f.home} vs ${f.away} ${FLAGS[f.away]||"🏳"} · ${bdTime(f.etTime)} BD${countdown ? " · " + countdown : ""}`);
      }
    });
    }
    // আজ কোনো ম্যাচ না থাকলে বা আজকের সব ম্যাচ শেষ হয়ে গেলে পরের ম্যাচগুলো (ভবিষ্যতের প্রথম available দিন) দেখাও
    if (items.length === 0) {
      const upcoming = ALL_GROUP_FIXTURES
        .filter(f => matchUTC(f.dateStr, f.etTime) > now)
        .sort((a,b)=>matchUTC(a.dateStr,a.etTime)-matchUTC(b.dateStr,b.etTime));
      if (upcoming.length) {
        const nextBD = bdDateStr(upcoming[0].dateStr, upcoming[0].etTime);
        const nextDayFixtures = upcoming.filter(f => bdDateStr(f.dateStr,f.etTime) === nextBD);
        nextDayFixtures.slice(0,8).forEach(f => {
          items.push(`🔜 ${FLAGS[f.home]||"🏳"} ${f.home} vs ${f.away} ${FLAGS[f.away]||"🏳"} · ${bdDateStr(f.dateStr,f.etTime)} · ${bdTime(f.etTime)} BD`);
        });
      }
    }
    return items.length > 0 ? items : ["⚽ FIFA World Cup 2026 · USA · CANADA · MEXICO · Jun 11 – Jul 19", "🔴 সব সময় বাংলাদেশ সময় (GMT+6) · Auto-update চালু"];
  }, [results]);

  const suggestions = useMemo(()=>{
    if(!search.trim()||search.length<2) return [];
    const q=search.toLowerCase();
    return ALL_TEAMS.filter(t=>t.toLowerCase().includes(q)).slice(0,6);
  },[search]);

  // theme
  const T = dark ? {
    bg:"#060f08",text:"#e5e7eb",sub:"#6b7280",card:"rgba(255,255,255,.03)",
    border:"rgba(255,255,255,.07)",accent:"#10b981",acBg:"rgba(16,185,129,.12)",
    hdr:"rgba(16,185,129,.07)",inp:"rgba(255,255,255,.04)",inpB:"rgba(255,255,255,.1)",
    pill:"rgba(255,255,255,.05)",dim:"#374151",muted:"rgba(255,255,255,.03)",sh:""
  } : {
    bg:"#f8fafc",text:"#111827",sub:"#6b7280",card:"#ffffff",
    border:"#e5e7eb",accent:"#059669",acBg:"rgba(5,150,105,.09)",
    hdr:"rgba(5,150,105,.05)",inp:"#ffffff",inpB:"#d1d5db",
    pill:"#f3f4f6",dim:"#9ca3af",muted:"#f9fafb",sh:"0 1px 3px rgba(0,0,0,.07)"
  };

  const TABS=[
    {k:"fixtures",l:"📅 Fixtures"},
    {k:"results",l:"✅ Results"},
    {k:"standings",l:"📊 Standings"},
    {k:"bracket",l:"🗂️ Bracket"},
    {k:"stadiums",l:"🏟️ Stadiums"},
    {k:"squads",l:"👕 Squads"},
    {k:"myteam",l:"⭐ আমার দল"},
  ];

  // today's matches helper — BD সময়ের date দিয়ে compare
  const todayMatches = useMemo(()=>{
    const now=Date.now();
    const bd=new Date(now+6*3600000);
    const mn=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const todayBD=mn[bd.getUTCMonth()]+" "+bd.getUTCDate();
    const todays = ALL_GROUP_FIXTURES.filter(f=>{
      const fixBDDate = bdDateStr(f.dateStr, f.etTime);
      return fixBDDate === todayBD;
    });
    const allOver = todays.length>0 && todays.every(f => {
      try { return matchUTC(f.dateStr,f.etTime) + 105*60000 < now; } catch { return true; }
    });
    if (todays.length>0 && !allOver) return todays;
    // আজকের সব ম্যাচ শেষ হয়ে গেলে বা আজ কোনো ম্যাচ না থাকলে — পরবর্তী দিনের ম্যাচ দেখাও
    const upcoming = ALL_GROUP_FIXTURES
      .filter(f => { try { return matchUTC(f.dateStr,f.etTime) > now; } catch { return false; } })
      .sort((a,b)=>matchUTC(a.dateStr,a.etTime)-matchUTC(b.dateStr,b.etTime));
    if (!upcoming.length) return [];
    const nextBD = bdDateStr(upcoming[0].dateStr, upcoming[0].etTime);
    return upcoming.filter(f => bdDateStr(f.dateStr,f.etTime) === nextBD);
  },[results]);
  const isShowingNextDay = useMemo(()=>{
    if (!todayMatches.length) return false;
    const now=Date.now();
    const bd=new Date(now+6*3600000);
    const mn=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const todayBD=mn[bd.getUTCMonth()]+" "+bd.getUTCDate();
    return bdDateStr(todayMatches[0].dateStr, todayMatches[0].etTime) !== todayBD;
  },[todayMatches]);

  // Group fixtures by BD date for the fixture tab
  const fixturesByDate = useMemo(() => {
    const grouped = {};
    filteredFix.forEach(f => {
      const key = bdDateStr(f.dateStr, f.etTime);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(f);
    });
    const mn = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    Object.values(grouped).forEach(arr => arr.sort((a,b)=>{
      try { return matchUTC(a.dateStr,a.etTime) - matchUTC(b.dateStr,b.etTime); } catch { return 0; }
    }));
    return Object.entries(grouped).sort(([a],[b]) => {
      const [am,ad] = a.split(" "); const [bm,bd2] = b.split(" ");
      return (mn.indexOf(am)*31 + +ad) - (mn.indexOf(bm)*31 + +bd2);
    });
  }, [filteredFix]);

  // Finished matches grouped by date — Results tab (newest date first)
  const resultsByDate = useMemo(() => {
    const now = Date.now();
    const mn = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const isPlaceholder = (n) => /^(Winner|Runner-up|Best|W |L )/.test(n||"");
    const finishedGroup = ALL_GROUP_FIXTURES
      .filter(f => { try { return matchUTC(f.dateStr,f.etTime) + 105*60000 < now; } catch { return false; } })
      .map(f => ({...f, isKO:false}));
    const finishedKO = KNOCKOUT_ROUNDS.flatMap(r=>r.matches)
      .filter(m => { try { return koMatchUTC(m) + 125*60000 < now && !isPlaceholder(m.home) && !isPlaceholder(m.away); } catch { return false; } })
      .map(m => ({...m, dateStr:m.date, isKO:true}));
    const all = [...finishedGroup, ...finishedKO];
    const grouped = {};
    all.forEach(f => {
      const key = bdDateStr(f.dateStr, f.etTime);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(f);
    });
    Object.values(grouped).forEach(arr => arr.sort((a,b)=>{
      try { return matchUTC(a.dateStr,a.etTime) - matchUTC(b.dateStr,b.etTime); } catch { return 0; }
    }));
    return Object.entries(grouped).sort(([a],[b]) => {
      const [am,ad] = a.split(" "); const [bm,bd2] = b.split(" ");
      return (mn.indexOf(bm)*31 + +bd2) - (mn.indexOf(am)*31 + +ad); // descending: latest date first
    });
  }, [results, koResults]);

  const nextMatch = useMemo(()=>{
    const now=Date.now();
    return ALL_GROUP_FIXTURES.filter(f=>{ try{return matchUTC(f.dateStr,f.etTime)>now;}catch{return false;} })
      .sort((a,b)=>{ try{return matchUTC(a.dateStr,a.etTime)-matchUTC(b.dateStr,b.etTime);}catch{return 0;} })[0];
  },[]);

  const c = T.accent;

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:${T.bg};color:${T.text};font-family:'Outfit',sans-serif;transition:background .35s,color .35s;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-thumb{background:${c};border-radius:2px;}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:.3;}}
        @keyframes slideUp{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}
        @keyframes ripple{0%{transform:scale(0);opacity:.5;}100%{transform:scale(4);opacity:0;}}
        @keyframes themeFade{0%{opacity:1;}50%{opacity:.4;}100%{opacity:1;}}
        @keyframes tickerScroll{0%{transform:translateX(0);}100%{transform:translateX(-50%);}}
        @keyframes glow{0%,100%{box-shadow:0 0 0 0 ${c}44;}50%{box-shadow:0 0 12px 3px ${c}33;}}
        .fi{animation:fadeIn .22s ease;}
        .fc:hover{border-color:${c}55!important;background:${T.acBg}!important;}
        .sc:hover{transform:translateY(-1px);}
        .stc:hover{border-color:${c}!important;transform:translateY(-2px);}
        .bracket-card:hover{transform:translateY(-2px);border-color:${c}77!important;box-shadow:0 4px 20px ${c}22!important;}
        .bracket-card.selected{border-color:${c}!important;box-shadow:0 0 0 2px ${c}44!important;}
        input:focus{outline:1px solid ${c}!important;border-color:${c}!important;}
        .pill{display:inline-block;padding:2px 7px;border-radius:999px;font-size:10px;font-weight:700;}
        .fav-card{border-color:rgba(251,191,36,.4)!important;background:rgba(251,191,36,.04)!important;}
        .sg::-webkit-scrollbar{height:3px;}
        .theme-btn{position:relative;overflow:hidden;}
        .theme-btn::after{content:'';position:absolute;inset:0;background:radial-gradient(circle,${c}33,transparent);opacity:0;transition:opacity .2s;}
        .theme-btn:hover::after{opacity:1;}
        .theme-animating{animation:themeFade .36s ease;}
        .ticker-wrap{overflow:hidden;white-space:nowrap;width:100%;}
        .ticker-inner{display:inline-flex;gap:0;animation:tickerScroll 200s linear infinite;}
        .ticker-inner:hover{animation-play-state:paused;}
        .q-badge-green{background:rgba(16,185,129,.15);color:#10b981;border:1px solid rgba(16,185,129,.3);}
        .q-badge-yellow{background:rgba(251,191,36,.12);color:#fbbf24;border:1px solid rgba(251,191,36,.3);}
        .q-badge-red{background:rgba(239,68,68,.12);color:#ef4444;border:1px solid rgba(239,68,68,.3);}
        .bottom-nav-btn{background:none;border:none;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 12px;font-family:'Outfit',sans-serif;transition:all .2s;flex:1;position:relative;}
        .bottom-nav-btn.active{color:${c};}
        .bottom-nav-btn:not(.active){color:${T.sub};}
        @media(max-width:600px){
          .hide-sm{display:none!important;}
          .fc-inner{flex-direction:column!important;gap:8px!important;}
          .fc-inner > div:first-child{justify-content:center!important;}
          .fc-inner > div:last-child{justify-content:center!important;}
          .sq-grid{grid-template-columns:1fr!important;}
          .tab-txt{font-size:10px!important;padding:8px 8px!important;}
          .ko-grid{grid-template-columns:1fr!important;}
          table{font-size:10px!important;}
          th,td{padding:5px 3px!important;}
          .main-content{padding-bottom:90px!important;}
          .top-tabs{display:none!important;}
          .standings-table th, .standings-table td{padding:5px 3px!important;font-size:10px!important;}
        }
        @media(min-width:601px){
          .bottom-nav{display:none!important;}
        }
        .bottom-nav::-webkit-scrollbar{display:none;}
        .bottom-nav{-ms-overflow-style:none;scrollbar-width:none;}
        @media(max-width:380px){
          .tab-txt{font-size:9px!important;padding:7px 6px!important;}
        }
      `}</style>

      <div style={{minHeight:"100vh",background:T.bg,color:T.text,transition:"background .35s,color .35s",opacity:darkAnimating?0.7:1}}>

        {/* ── LIVE SCORE TICKER ── */}
        <div style={{background:dark?"#000e05":"#064e3b",borderBottom:`1px solid ${c}33`,padding:"5px 0",overflow:"hidden"}}>
          <div style={{maxWidth:1060,margin:"0 auto",display:"flex",alignItems:"center",gap:0}}>
            <div style={{flexShrink:0,padding:"0 12px",background:c,color:"#000",fontFamily:"'Bebas Neue',cursive",fontSize:11,letterSpacing:2,display:"flex",alignItems:"center",gap:5,height:"100%",alignSelf:"stretch",minHeight:26}}>
              <span style={{width:6,height:6,borderRadius:"50%",background:"#000",display:"inline-block",animation:"pulse 1s infinite"}}/>LIVE
            </div>
            <div className="ticker-wrap" style={{flex:1}}>
              <div className="ticker-inner">
                {[...tickerItems,...tickerItems].map((item,i)=>(
                  <span key={i} style={{display:"inline-block",padding:"0 28px",fontSize:11,color:dark?"#d1fae5":"#ecfdf5",fontWeight:500,whiteSpace:"nowrap",borderRight:`1px solid ${c}33`}}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* HEADER */}
        <div style={{background:T.hdr,borderBottom:`1px solid ${T.border}`,padding:"7px 12px 0",position:"sticky",top:0,zIndex:100,backdropFilter:"blur(12px)"}}>
          <div style={{maxWidth:1060,margin:"0 auto"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
              <div style={{width:32,height:32,background:`linear-gradient(135deg,${c},${dark?"#065f46":"#047857"})`,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>⚽</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:17,letterSpacing:2,color:c,lineHeight:1}}>FIFA WORLD CUP 2026</div>
                <div style={{fontSize:9,color:T.sub,letterSpacing:.3}}>USA · CANADA · MEXICO · JUN 11–JUL 19 · GMT+6</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3,flexShrink:0}}>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <div style={{padding:"3px 8px",background:T.acBg,border:`1px solid ${c}33`,borderRadius:7,textAlign:"center"}}>
                    <div style={{fontSize:7,color:T.sub,letterSpacing:.8,textTransform:"uppercase",marginBottom:1}}>🇧🇩 BD সময়</div>
                    <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:12,color:c,letterSpacing:.5,lineHeight:1}}>{bdClock}</div>
                  </div>
                  {installPrompt && !pwaInstalled && (
                    <button onClick={handleInstallPWA} title="App হিসেবে Install করুন" style={{padding:"7px 11px",borderRadius:8,border:`1px solid ${c}55`,background:T.acBg,color:c,cursor:"pointer",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",gap:5}}>
                      📲<span style={{fontSize:10}} className="hide-sm">Install</span>
                    </button>
                  )}
                  {pwaInstalled && (
                    <div style={{padding:"7px 11px",borderRadius:8,border:"1px solid #10b98155",background:"rgba(16,185,129,.08)",color:"#10b981",fontSize:13,display:"flex",alignItems:"center",gap:5}}>
                      ✅<span style={{fontSize:10}} className="hide-sm">Installed</span>
                    </div>
                  )}
                  <button onClick={toggleDark} className={`theme-btn${darkAnimating?" theme-animating":""}`} style={{padding:"7px 13px",borderRadius:8,border:`1px solid ${T.border}`,background:T.card,color:T.text,cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"'Outfit',sans-serif",flexShrink:0,transition:"all .2s",display:"flex",alignItems:"center",gap:6}}>
                    <span style={{display:"inline-block",transition:"transform .3s",transform:darkAnimating?"rotate(180deg)":"rotate(0deg)"}}>{dark?"☀️":"🌙"}</span>
                    <span style={{fontSize:10,color:T.sub}} className="hide-sm">{dark?"Light":"Dark"}</span>
                  </button>
                </div>
                {autoFetching && <div style={{fontSize:9,color:c,animation:"pulse 1s infinite",display:"flex",alignItems:"center",gap:4}}><span style={{width:6,height:6,borderRadius:"50%",background:c,display:"inline-block",animation:"pulse 1s infinite"}}/>⟳ আপডেট হচ্ছে...</div>}
                {!autoFetching && lastFetched && <div style={{fontSize:9,color:T.sub,cursor:"pointer",display:"flex",alignItems:"center",gap:4}} onClick={fetchResults}><span style={{color:c}}>✓</span> {lastFetched.toLocaleTimeString("bn-BD")} · ট্যাপ করুন</div>}
                {!autoFetching && !lastFetched && <div style={{fontSize:9,color:T.sub,cursor:"pointer"}} onClick={fetchResults}>⟳ ফলাফল আনুন</div>}
                {visitorCount && <div style={{fontSize:9,color:T.sub,display:"flex",alignItems:"center",gap:3}}><span style={{width:5,height:5,borderRadius:"50%",background:"#10b981",display:"inline-block"}}/>👁 {visitorCount.toLocaleString()} ভিজিটর</div>}
              </div>
            </div>

            {favTeam && (
              <div style={{display:"flex",alignItems:"center",gap:8,padding:"7px 12px",marginBottom:8,background:"rgba(251,191,36,.07)",border:"1px solid rgba(251,191,36,.25)",borderRadius:9,flexWrap:"wrap"}}>
                <span style={{fontSize:20}}>{FLAGS[favTeam]||"🏳"}</span>
                <span style={{fontSize:13,fontWeight:700,color:"#fbbf24",flex:1}}>{favTeam} ⭐ প্রিয় দল — Group {getTeamGroup(favTeam)}</span>
                <button onClick={()=>scheduleFavTeamNotifs(favTeam,ALL_GROUP_FIXTURES,handleNotifToggle)} style={{background:"rgba(251,191,36,.1)",border:"1px solid rgba(251,191,36,.3)",borderRadius:6,color:"#fbbf24",fontSize:11,fontWeight:700,padding:"3px 9px",cursor:"pointer"}}>🔔 Remind</button>
                <button onClick={()=>toggleFav(favTeam)} style={{background:"rgba(251,191,36,.1)",border:"1px solid rgba(251,191,36,.3)",borderRadius:6,color:"#fbbf24",fontSize:11,fontWeight:700,padding:"3px 9px",cursor:"pointer"}}>✕ সরাও</button>
              </div>
            )}

            <div className="sg top-tabs" style={{display:"flex",gap:0,overflowX:"auto"}}>
              {TABS.map(({k,l})=>(
                <button key={k} onClick={()=>setTab(k)} className="tab-txt" style={{padding:"9px 12px",background:tab===k?T.acBg:"transparent",color:tab===k?c:T.sub,border:"none",borderBottom:tab===k?`2px solid ${c}`:"2px solid transparent",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"'Outfit',sans-serif",flexShrink:0,whiteSpace:"nowrap",transition:"all .2s"}}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="main-content" style={{maxWidth:1060,margin:"0 auto",padding:"18px 14px",paddingBottom:"80px"}}>

          {/* ═══ FIXTURES ═══ */}
          {tab==="fixtures" && (
            <div className="fi">
              {/* ── LIVE TRACKER (fixtures tab এ সবার আগে) ── */}
              {(()=>{
                const nowMs = Date.now();
                // শুধু actual kickoff হয়েছে এমন ম্যাচ — 0 থেকে 115 মিনিটের মধ্যে
                const liveNow = ALL_GROUP_FIXTURES.filter(f=>{
                  const utc = matchUTC(f.dateStr,f.etTime);
                  const el = nowMs - utc;
                  return el >= 0 && el < 115*60*1000;
                });
                if(!liveNow.length) return null;
                return (
                  <div style={{marginBottom:16,borderRadius:14,overflow:"hidden",border:"2px solid #ef4444",boxShadow:"0 0 20px rgba(239,68,68,.25)",animation:"fadeIn .3s ease"}}>
                    {/* Header */}
                    <div style={{background:"linear-gradient(90deg,rgba(239,68,68,.2),rgba(239,68,68,.08))",padding:"8px 14px",display:"flex",alignItems:"center",gap:8,borderBottom:"1px solid rgba(239,68,68,.3)"}}>
                      <span style={{width:9,height:9,borderRadius:"50%",background:"#ef4444",display:"inline-block",animation:"pulse 1s infinite",boxShadow:"0 0 8px #ef444488"}}/>
                      <span style={{fontFamily:"'Bebas Neue',cursive",fontSize:15,letterSpacing:2,color:"#ef4444"}}>🔴 LIVE TRACKER</span>
                      <span style={{fontSize:10,color:"#ef4444",fontWeight:700,marginLeft:4}}>{liveNow.length}টি ম্যাচ চলছে</span>
                      <span style={{fontSize:10,color:T.sub,marginLeft:"auto"}}>Auto-update ৩০ সেকেন্ড</span>
                    </div>
                    {/* Match cards */}
                    <div style={{background:T.card,padding:"10px 14px",display:"flex",flexDirection:"column",gap:10}}>
                      {liveNow.map(f=>{
                        const r=results[f.id];
                        const hasScore=r&&r.h!==""&&r.a!==""&&!isNaN(+r.h)&&!isNaN(+r.a);
                        const utc=matchUTC(f.dateStr,f.etTime);
                        const elMs=nowMs-utc;
                        const minElapsed=Math.floor(elMs/60000);
                        const isHT = r?.status==="HT";
                        const minuteLabel = isHT ? "HT" : (r?.minute ? `${r.minute}'` : `${minElapsed}'`);
                        // goals sorted by minute
                        const goals = Array.isArray(r?.goals) ? [...r.goals].sort((a,b)=>(a.minute||0)-(b.minute||0)) : [];
                        const homeGoals = goals.filter(g=>g.team==="home");
                        const awayGoals = goals.filter(g=>g.team==="away");
                        return (
                          <div key={f.id} style={{borderRadius:12,overflow:"hidden",border:"1px solid rgba(239,68,68,.35)",background:"rgba(239,68,68,.03)"}}>
                            {/* Score row */}
                            <div style={{display:"flex",alignItems:"center",gap:8,padding:"12px 14px"}}>
                              {/* Home team */}
                              <div style={{flex:1,display:"flex",alignItems:"center",gap:6,justifyContent:"flex-end",minWidth:0}}>
                                <div style={{textAlign:"right",minWidth:0}}>
                                  <div style={{fontWeight:800,fontSize:14,color:T.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{f.home}</div>
                                  {homeGoals.length>0&&<div style={{fontSize:9,color:"#ef4444",marginTop:2,textAlign:"right"}}>{homeGoals.map(g=>`⚽${g.minute}'`).join(" ")}</div>}
                                </div>
                                <span style={{fontSize:28,flexShrink:0}}>{FLAGS[f.home]||"🏳"}</span>
                              </div>
                              {/* Score box */}
                              <div style={{textAlign:"center",minWidth:88,flexShrink:0,padding:"6px 10px",background:isHT?"rgba(251,191,36,.12)":"rgba(239,68,68,.1)",borderRadius:10,border:isHT?"1px solid rgba(251,191,36,.4)":"1px solid rgba(239,68,68,.35)"}}>
                                {hasScore ? (
                                  <>
                                    <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:30,color:isHT?"#fbbf24":"#ef4444",lineHeight:1,letterSpacing:2}}>{r.h} – {r.a}</div>
                                    <div style={{fontSize:10,fontWeight:800,color:isHT?"#fbbf24":"#ef4444",letterSpacing:1,marginTop:2}}>
                                      {isHT ? "⏸ HT" : `🔴 ${minuteLabel}`}
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:22,color:"#ef4444",lineHeight:1}}>LIVE</div>
                                    <div style={{fontSize:10,color:"#ef4444",fontWeight:700}}>🔴 {minuteLabel}</div>
                                  </>
                                )}
                              </div>
                              {/* Away team */}
                              <div style={{flex:1,display:"flex",alignItems:"center",gap:6,minWidth:0}}>
                                <span style={{fontSize:28,flexShrink:0}}>{FLAGS[f.away]||"🏳"}</span>
                                <div style={{minWidth:0}}>
                                  <div style={{fontWeight:800,fontSize:14,color:T.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{f.away}</div>
                                  {awayGoals.length>0&&<div style={{fontSize:9,color:"#ef4444",marginTop:2}}>{awayGoals.map(g=>`⚽${g.minute}'`).join(" ")}</div>}
                                </div>
                              </div>
                            </div>
                            {/* Goal timeline */}
                            {goals.length > 0 && (
                              <div style={{padding:"6px 14px 10px",borderTop:"1px solid rgba(239,68,68,.15)",display:"flex",flexDirection:"column",gap:4}}>
                                <div style={{fontSize:9,color:"#ef4444",fontWeight:700,letterSpacing:1,marginBottom:2}}>GOAL TIMELINE</div>
                                {goals.map((g,gi)=>(
                                  <div key={gi} style={{display:"flex",alignItems:"center",gap:6,fontSize:11}}>
                                    <span style={{fontFamily:"'Bebas Neue',cursive",fontSize:12,color:"#ef4444",minWidth:28,textAlign:"right"}}>{g.minute||"?"}'</span>
                                    <span>⚽</span>
                                    <span style={{fontWeight:700,color:T.text,flex:1}}>{g.scorer||g.player||"?"}</span>
                                    <span style={{fontSize:10,color:T.sub}}>{g.team==="home"?f.home:f.away}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* Cards if any */}
                            {Array.isArray(r?.cards)&&r.cards.length>0&&(
                              <div style={{padding:"4px 14px 8px",borderTop:"1px solid rgba(239,68,68,.1)",display:"flex",flexWrap:"wrap",gap:5}}>
                                {r.cards.map((cd,ci)=>(
                                  <span key={ci} style={{fontSize:10,color:T.sub,background:cd.type==="red"?"rgba(239,68,68,.1)":"rgba(251,191,36,.1)",border:`1px solid ${cd.type==="red"?"rgba(239,68,68,.3)":"rgba(251,191,36,.3)"}`,borderRadius:5,padding:"2px 7px"}}>
                                    {cd.type==="red"?"🟥":"🟨"} {cd.player} {cd.minute}'
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Today / Next - HERO BANNER */}
              {todayMatches.length>0 ? (
                <div style={{marginBottom:16,borderRadius:16,overflow:"hidden",border:`1px solid ${c}33`,boxShadow:`0 0 30px ${c}15`}}>
                  {/* Banner Header */}
                  <div style={{background:`linear-gradient(135deg,${dark?"#064e3b":"#047857"},${dark?"#065f46 60%,#000e05":"#059669 60%,#f0fdf4"})`,padding:"10px 16px",display:"flex",alignItems:"center",gap:10}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{width:8,height:8,borderRadius:"50%",background:"#ef4444",display:"inline-block",animation:"pulse 1s infinite",boxShadow:"0 0 8px #ef444488"}}/>
                      <span style={{fontFamily:"'Bebas Neue',cursive",fontSize:17,letterSpacing:3,color:"#fff"}}>আজকের ম্যাচ</span>
                    </div>
                    <span style={{marginLeft:4,padding:"2px 9px",background:"rgba(255,255,255,.15)",borderRadius:999,fontSize:10,fontWeight:700,color:"#fff",backdropFilter:"blur(4px)"}}>{todayMatches.length}টি ম্যাচ</span>
                    <div style={{marginLeft:"auto",fontSize:10,color:"rgba(255,255,255,.7)",fontWeight:500}}>
                      {isShowingNextDay
                        ? `${bdDateStr(todayMatches[0].dateStr, todayMatches[0].etTime)} — BD সময়`
                        : `${new Date(Date.now()+6*3600000).toLocaleDateString("bn-BD",{weekday:"long",month:"long",day:"numeric"})} — BD সময়`}
                    </div>
                  </div>
                  {/* Match rows */}
                  <div style={{background:T.card,padding:"8px 10px",display:"flex",flexDirection:"column",gap:6}}>
                    {todayMatches.map((fix,idx)=>{
                      const fav=favTeam&&(fix.home===favTeam||fix.away===favTeam);
                      const r=results[fix.id];
                      const hasScore=r&&r.h!==""&&r.a!==""&&!isNaN(+r.h)&&!isNaN(+r.a);
                      const matchOver=matchUTC(fix.dateStr,fix.etTime)+105*60000<Date.now();
                      return (
                        <div key={fix.id} style={{display:"flex",alignItems:"center",gap:5,padding:"7px 10px",background:fav?"rgba(251,191,36,.06)":T.acBg,border:`1.5px solid ${fav?"rgba(251,191,36,.35)":c+"33"}`,borderRadius:10,animation:`slideUp .3s ease ${idx*0.07}s both`,position:"relative",overflow:"hidden"}}>
                          {fav && <div style={{position:"absolute",top:0,left:0,width:"100%",height:2,background:"linear-gradient(90deg,#fbbf24,transparent)"}}/>}
                          <div style={{display:"flex",alignItems:"center",gap:6,flex:"1 1 0",minWidth:0,justifyContent:"flex-end"}}>
                            <span style={{fontWeight:700,fontSize:12,color:fav&&fix.home===favTeam?"#fbbf24":T.text,textAlign:"right",lineHeight:1.2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{fix.home}</span>
                            <span style={{fontSize:22,cursor:"pointer",flexShrink:0}} onClick={()=>toggleFav(fix.home)}>{FLAGS[fix.home]||"🏳"}</span>
                          </div>
                          <div style={{textAlign:"center",minWidth:78,flexShrink:0}}>
                            {hasScore ? (
                              <div style={{padding:"3px 9px",background:"rgba(16,185,129,.15)",border:`1.5px solid ${c}55`,borderRadius:8}}>
                                <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:19,color:c,lineHeight:1}}>{r.h} – {r.a}</div>
                                <div style={{fontSize:8,color:matchOver?T.sub:"#ef4444",fontWeight:800,letterSpacing:1}}>{r.status==="LIVE"?"🔴 LIVE":r.status==="FT"?"FULL TIME":matchOver?"FULL TIME":"🔴 LIVE"}</div>
                              </div>
                            ) : (
                              <div>
                                <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:12,color:fav?"#fbbf24":c,lineHeight:1.2}}>{bdTime(fix.etTime)}</div>
                                <div style={{fontSize:8,color:T.sub,marginBottom:1}}>BD সময় · Grp {fix.grp}</div>
                              </div>
                            )}
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:6,flex:"1 1 0",minWidth:0}}>
                            <span style={{fontSize:22,cursor:"pointer",flexShrink:0}} onClick={()=>toggleFav(fix.away)}>{FLAGS[fix.away]||"🏳"}</span>
                            <span style={{fontWeight:700,fontSize:12,color:fav&&fix.away===favTeam?"#fbbf24":T.text,lineHeight:1.2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{fix.away}</span>
                          </div>
                          <div style={{display:"flex",flexDirection:"column",gap:3,flexShrink:0}}>
                            <button onClick={()=>setShareCardFix(fix)} title="শেয়ার কার্ড" style={{background:"none",border:"none",cursor:"pointer",fontSize:13,opacity:.65}}>🖼️</button>
                            <button onClick={()=>requestNotification(fix,handleNotifToggle)} title={notifScheduled[fix.id]?"রিমাইন্ডার বাতিল":"১০ মিনিট আগে reminder"} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,opacity:notifScheduled[fix.id]?1:.5,transition:"all .2s"}}>{notifScheduled[fix.id]?"🔔":"🔕"}</button>
                            <button onClick={()=>fetchH2H(fix)} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,opacity:.6}} title="H2H">⚔️</button>
                            {!results[fix.id]?.h && <button onClick={()=>{setPredModal(fix);setPredHome(predictions[fix.id]?.h||"");setPredAway(predictions[fix.id]?.a||"");}} title="Predict" style={{background:"none",border:"none",cursor:"pointer",fontSize:13,opacity:predictions[fix.id]?1:.5}}>🎯</button>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : nextMatch && (
                <div style={{marginBottom:20,padding:"12px 16px",background:T.card,border:`1px solid ${T.border}`,borderRadius:12,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",boxShadow:T.sh}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:10,color:T.sub,textTransform:"uppercase",letterSpacing:1,marginBottom:3}}>পরবর্তী ম্যাচ</div>
                    <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
                      <span style={{fontSize:18}}>{FLAGS[nextMatch.home]||"🏳"}</span>
                      <span style={{fontWeight:700,fontSize:13}}>{nextMatch.home}</span>
                      <span style={{color:T.sub,fontSize:11}}>vs</span>
                      <span style={{fontWeight:700,fontSize:13}}>{nextMatch.away}</span>
                      <span style={{fontSize:18}}>{FLAGS[nextMatch.away]||"🏳"}</span>
                    </div>
                    <div style={{fontSize:11,color:T.sub,marginTop:2}}>{bdDateStr(nextMatch.dateStr,nextMatch.etTime)} 2026 · {bdTime(nextMatch.etTime)} · {nextMatch.venue.split(",")[0]}</div>
                  </div>
                </div>
              )}

              {/* Search */}
              <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"flex-start"}}>
                <div style={{position:"relative",flex:1,minWidth:180}}>
                  <input type="text" value={search} onChange={e=>{setSearch(e.target.value);setGrpFilter("ALL");}}
                    placeholder="🔍 দল বা তারিখ... Brazil, Jun 14..."
                    style={{width:"100%",padding:"9px 13px",background:T.inp,border:`1px solid ${T.inpB}`,borderRadius:9,color:T.text,fontSize:13,fontFamily:"'Outfit',sans-serif"}}/>
                  {suggestions.length>0&&(
                    <div style={{position:"absolute",top:"100%",left:0,right:0,background:dark?"#0d1f12":T.card,border:`1px solid ${c}44`,borderRadius:8,marginTop:3,zIndex:50,overflow:"hidden",boxShadow:"0 4px 20px rgba(0,0,0,.15)"}}>
                      {suggestions.map(tm=>(
                        <div key={tm} onClick={()=>setSearch(tm)} style={{padding:"8px 13px",display:"flex",alignItems:"center",gap:9,cursor:"pointer",borderBottom:`1px solid ${T.border}`}}
                          onMouseEnter={e=>e.currentTarget.style.background=T.acBg}
                          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                          <span style={{fontSize:18}}>{FLAGS[tm]||"🏳"}</span>
                          <div><div style={{fontSize:13,fontWeight:600,color:T.text}}>{tm}</div><div style={{fontSize:10,color:T.sub}}>Group {getTeamGroup(tm)}</div></div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {search&&<button onClick={()=>setSearch("")} style={{padding:"9px 13px",background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.2)",borderRadius:9,color:"#ef4444",cursor:"pointer",fontSize:13}}>✕</button>}
              </div>

              {/* Group filter */}
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:14}}>
                {["ALL",...Object.keys(GROUPS)].map(g=>(
                  <button key={g} onClick={()=>{setGrpFilter(g);setSearch("");}}
                    style={{padding:"5px 11px",borderRadius:7,border:`1px solid ${grpFilter===g?c:T.border}`,background:grpFilter===g?T.acBg:T.card,color:grpFilter===g?c:T.sub,cursor:"pointer",fontFamily:"'Bebas Neue',cursive",fontSize:13,letterSpacing:1.5,transition:"all .2s",boxShadow:T.sh}}>
                    {g==="ALL"?"All":"Grp "+g}
                  </button>
                ))}
              </div>
              <div style={{fontSize:11,color:T.sub,marginBottom:10}}>{filteredFix.length}টি ম্যাচ{search&&<span style={{color:c}}> · "{search}"</span>}</div>

              {/* Prediction Stats Bar */}
              {predStats.total > 0 && (
                <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 14px",background:T.card,border:`1px solid #a78bfa33`,borderRadius:10,marginBottom:12,flexWrap:"wrap"}}>
                  <span style={{fontSize:12,color:"#a78bfa",fontWeight:700}}>🎯 আমার Predictions</span>
                  <span style={{fontSize:11,color:T.sub}}>{predStats.total}টি</span>
                  <div style={{display:"flex",gap:6,marginLeft:"auto",flexWrap:"wrap"}}>
                    {predStats.exact>0&&<span style={{fontSize:11,fontWeight:700,color:"#10b981",background:"rgba(16,185,129,.1)",padding:"2px 8px",borderRadius:999}}>✅ {predStats.exact} সঠিক</span>}
                    {predStats.result>0&&<span style={{fontSize:11,fontWeight:700,color:"#f59e0b",background:"rgba(245,158,11,.1)",padding:"2px 8px",borderRadius:999}}>🟡 {predStats.result} ফলাফল</span>}
                    {predStats.wrong>0&&<span style={{fontSize:11,fontWeight:700,color:"#ef4444",background:"rgba(239,68,68,.1)",padding:"2px 8px",borderRadius:999}}>❌ {predStats.wrong} ভুল</span>}
                  </div>
                </div>
              )}
              {fixturesByDate.map(([dateStr, fixes]) => {
                const now2 = Date.now();
                const mn2 = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
                const bdNow2 = new Date(now2 + 6*3600000);
                const todayStr2 = mn2[bdNow2.getUTCMonth()] + " " + bdNow2.getUTCDate();
                const isToday2 = dateStr === todayStr2;
                const bdDate2 = fixes[0] ? bdDateStr(fixes[0].dateStr, fixes[0].etTime) : dateStr;
                const months3 = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
                const dayNames2 = ["রবি","সোম","মঙ্গল","বুধ","বৃহ","শুক্র","শনি"];
                const dateObj2 = (()=>{ try { const [mo,dy]=bdDate2.split(" "); return new Date(2026,months3[mo],+dy); } catch{return null;} })();
                const dayName2 = dateObj2 ? dayNames2[dateObj2.getDay()] : "";
                return (
                  <div key={dateStr} style={{marginBottom:10,borderRadius:12,overflow:"hidden",border:`1px solid ${isToday2?c+"55":T.border}`,boxShadow:T.sh}}>
                    {/* Date header */}
                    <div style={{display:"flex",alignItems:"center",gap:8,padding:"7px 12px",background:isToday2?`linear-gradient(90deg,${c}22,transparent)`:dark?"#0a1628":"#0f2044"}}>
                      <div style={{background:isToday2?c:dark?"#1e3a5f":"#1e40af",color:"#fff",borderRadius:6,padding:"3px 8px",display:"flex",alignItems:"center",gap:5,flexShrink:0}}>
                        <span style={{fontFamily:"'Bebas Neue',cursive",fontSize:13,letterSpacing:.5,lineHeight:1}}>{bdDate2.split(" ")[0].toUpperCase()} {bdDate2.split(" ")[1]}</span>
                        <span style={{fontSize:9,opacity:.85,fontWeight:700}}>{isToday2?"TODAY":dayName2}</span>
                      </div>
                      <span style={{fontSize:10,color:T.sub}}>{fixes.length}টি ম্যাচ</span>
                      <div style={{flex:1,height:1,background:T.border+"66"}}/>
                    </div>
                    {/* Match rows */}
                    {fixes.map((fix,fi) => {
                      const isFav2 = favTeam&&(fix.home===favTeam||fix.away===favTeam);
                      const hl2 = search&&(fix.home.toLowerCase().includes(search.toLowerCase())||fix.away.toLowerCase().includes(search.toLowerCase())||bdDateStr(fix.dateStr,fix.etTime).toLowerCase().includes(search.toLowerCase()));
                      const r2 = results[fix.id];
                      const hasScore2 = r2&&r2.h!==""&&r2.a!==""&&!isNaN(+r2.h)&&!isNaN(+r2.a);
                      const matchOver2 = matchUTC(fix.dateStr,fix.etTime)+105*60000 < Date.now();
                      const isLive2 = !matchOver2 && matchUTC(fix.dateStr,fix.etTime) < Date.now();
                      const {time:bdT2,label:bdL2} = etToBD(fix.etTime);
                      const timeStr2 = bdL2+" "+bdT2;
                      const myPred = predictions[fix.id];
                      const predRes = getPredResult(fix.id);
                      const predColor = predRes==="exact"?"#10b981":predRes==="result"?"#f59e0b":predRes==="wrong"?"#ef4444":null;
                      return (
                        <div key={fix.id} style={{
                          borderTop:`1px solid ${T.border}44`,
                          background:isFav2?"rgba(251,191,36,.05)":hl2?c+"08":fi%2===0?T.card:(dark?"rgba(255,255,255,.012)":"rgba(0,0,0,.012)"),
                          borderLeft:isFav2?"3px solid #fbbf24":hl2?`3px solid ${c}`:"3px solid transparent",
                        }}>
                          <div style={{display:"flex",alignItems:"center",padding:"9px 10px",gap:0}}>
                            {/* HOME */}
                            <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"flex-end",gap:5,minWidth:0}}>
                              <span style={{fontSize:11,fontWeight:700,color:hasScore2&&+r2.h>+r2.a?c:isFav2&&fix.home===favTeam?"#fbbf24":T.text,textAlign:"right",wordBreak:"break-word",lineHeight:1.2}}>{fix.home}</span>
                              <span style={{fontSize:22,flexShrink:0,cursor:"pointer"}} onClick={()=>toggleFav(fix.home)}>{FLAGS[fix.home]||"🏳"}</span>
                            </div>
                            {/* CENTER */}
                            <div style={{flexShrink:0,width:82,textAlign:"center",padding:"0 3px"}}>
                              {hasScore2 ? (
                                <div style={{padding:"3px 0",borderRadius:6,background:isLive2?"rgba(239,68,68,.15)":"rgba(16,185,129,.12)",border:`1px solid ${isLive2?"#ef444466":c+"55"}`}}>
                                  <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:19,color:isLive2?"#ef4444":c,lineHeight:1}}>{r2.h}:{r2.a}</div>
                                  <div style={{fontSize:7,fontWeight:800,color:isLive2?"#ef4444":T.sub,letterSpacing:.5}}>
                                    {isLive2 ? (r2.minute ? `🔴 ${r2.minute}'` : "🔴 LIVE") : matchOver2 ? "FT" : ""}
                                  </div>
                                  {/* Goal scorers */}
                                  {r2.goals && r2.goals.length > 0 && (
                                    <div style={{fontSize:7,color:T.sub,marginTop:2,lineHeight:1.4,textAlign:"center"}}>
                                      {r2.goals.map((g,gi)=>(
                                        <div key={gi}>{g.team==="home"?"⚽":""}  {g.scorer||""} {g.minute?""+g.minute+"'":""} {g.team==="away"?"⚽":""}</div>
                                      ))}
                                    </div>
                                  )}
                                  {/* Prediction result badge */}
                                  {predRes && <div style={{fontSize:7,fontWeight:800,color:predColor,marginTop:2}}>{predRes==="exact"?"✅ সঠিক!":predRes==="result"?"🟡 ফলাফল ঠিক":predRes==="wrong"?"❌ ভুল":""} {myPred&&`(${myPred.h}–${myPred.a})`}</div>}
                                </div>
                              ) : (
                                <div style={{padding:"3px 0",borderRadius:6,background:isFav2?"rgba(251,191,36,.1)":T.acBg,border:`1px solid ${isFav2?"rgba(251,191,36,.25)":c+"22"}`}}>
                                  <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:11,color:isFav2?"#fbbf24":c,lineHeight:1.3}}>{timeStr2}</div>
                                  <div style={{fontSize:7,color:T.dim}}>BD সময়</div>
                                  {myPred && <div style={{fontSize:7,color:"#a78bfa",fontWeight:700,marginTop:1}}>🎯 {myPred.h}–{myPred.a}</div>}
                                </div>
                              )}
                              <div style={{display:"flex",justifyContent:"center",gap:3,marginTop:3}}>
                                <button onClick={()=>setShareCardFix(fix)} title="Card" style={{background:"none",border:"none",cursor:"pointer",fontSize:9,opacity:.45,padding:0}}>🖼️</button>
                                <button onClick={()=>requestNotification(fix,handleNotifToggle)} style={{background:"none",border:"none",cursor:"pointer",fontSize:9,opacity:notifScheduled[fix.id]?1:.4,padding:0}}>{notifScheduled[fix.id]?"🔔":"🔕"}</button>
                                {!hasScore2 && <button onClick={()=>{setPredModal(fix);setPredHome(predictions[fix.id]?.h||"");setPredAway(predictions[fix.id]?.a||"");}} style={{background:"none",border:"none",cursor:"pointer",fontSize:9,opacity:predictions[fix.id]?1:.4,padding:0}}>🎯</button>}
                              </div>
                            </div>
                            {/* AWAY */}
                            <div style={{flex:1,display:"flex",alignItems:"center",gap:5,minWidth:0}}>
                              <span style={{fontSize:22,flexShrink:0,cursor:"pointer"}} onClick={()=>toggleFav(fix.away)}>{FLAGS[fix.away]||"🏳"}</span>
                              <span style={{fontSize:11,fontWeight:700,color:hasScore2&&+r2.a>+r2.h?c:isFav2&&fix.away===favTeam?"#fbbf24":T.text,wordBreak:"break-word",lineHeight:1.2}}>{fix.away}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* ── KNOCKOUT ROUNDS IN FIXTURE TAB ── */}
              {grpFilter==="ALL" && !search && (()=>{
                // Check if group stage is complete (all 72 matches have results)
                const totalGroupMatches = ALL_GROUP_FIXTURES.length;
                const completedGroupMatches = ALL_GROUP_FIXTURES.filter(f=>{
                  const r=results[f.id];
                  return r&&r.h!==""&&r.a!==""&&!isNaN(+r.h)&&!isNaN(+r.a);
                }).length;
                const groupStageDone = completedGroupMatches === totalGroupMatches;

                // Also check if any KO match has a result (tournament started)
                const anyKOResult = KNOCKOUT_ROUNDS.some(round=>
                  round.matches.some(m=>{ const r=koResults[m.id]; return r&&r.h!==""&&r.a!==""&&!isNaN(+r.h)&&!isNaN(+r.a); })
                );

                // Show KO if group stage done, or any KO result, or if current date >= Jun 28 2026
                const now = Date.now();
                const jun28UTC = Date.UTC(2026, 5, 28, 0, 0, 0); // Jun 28 2026
                const datePassedGroupStage = now >= jun28UTC;

                // Show KO only if group stage done OR any KO match has result OR date passed
                if(!groupStageDone && !anyKOResult && !datePassedGroupStage) {
                  const remaining = totalGroupMatches - completedGroupMatches;
                  return (
                    <div style={{textAlign:"center",padding:"28px 16px",background:T.card,borderRadius:12,border:`1px solid ${T.border}`,marginTop:16}}>
                      <div style={{fontSize:28,marginBottom:8}}>🏆</div>
                      <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:16,letterSpacing:2,color:c,marginBottom:6}}>KNOCKOUT ROUNDS</div>
                      <div style={{fontSize:12,color:T.sub,marginBottom:4}}>Group Stage শেষ হলে এখানে দেখাবে</div>
                      <div style={{fontSize:11,color:T.dim}}>
                        {completedGroupMatches > 0
                          ? `${completedGroupMatches}/${totalGroupMatches} ম্যাচ সম্পন্ন · আর ${remaining}টি বাকি`
                          : `মোট ${totalGroupMatches}টি Group Stage ম্যাচ বাকি`}
                      </div>
                      {completedGroupMatches > 0 && (
                        <div style={{marginTop:10,background:T.acBg,borderRadius:8,height:6,overflow:"hidden"}}>
                          <div style={{height:"100%",background:c,width:`${(completedGroupMatches/totalGroupMatches*100).toFixed(0)}%`,borderRadius:8,transition:"width .5s"}}/>
                        </div>
                      )}
                    </div>
                  );
                }

                // Compute standings for auto-populating KO teams
                const pts={}, gd={}, gf={}, wins={}, played={};
                ALL_GROUP_FIXTURES.forEach(f=>{
                  [f.home,f.away].forEach(t=>{if(!pts[t]){pts[t]=0;gd[t]=0;gf[t]=0;wins[t]=0;played[t]=0;}});
                  const r=results[f.id];
                  if(r&&r.h!==""&&r.a!==""&&!isNaN(+r.h)&&!isNaN(+r.a)){
                    const h=+r.h,a=+r.a;
                    played[f.home]=(played[f.home]||0)+1; played[f.away]=(played[f.away]||0)+1;
                    gf[f.home]=(gf[f.home]||0)+h; gf[f.away]=(gf[f.away]||0)+a;
                    gd[f.home]=(gd[f.home]||0)+(h-a); gd[f.away]=(gd[f.away]||0)+(a-h);
                    if(h>a){pts[f.home]=(pts[f.home]||0)+3;wins[f.home]=(wins[f.home]||0)+1;}
                    else if(a>h){pts[f.away]=(pts[f.away]||0)+3;wins[f.away]=(wins[f.away]||0)+1;}
                    else{pts[f.home]=(pts[f.home]||0)+1;pts[f.away]=(pts[f.away]||0)+1;}
                  }
                });
                // Get sorted teams per group
                const grpTeams={};
                Object.keys(GROUPS).forEach(g=>{
                  const teams=[...GROUPS[g]].sort((a,b)=>(pts[b]||0)-(pts[a]||0)||(gd[b]||0)-(gd[a]||0)||(gf[b]||0)-(gf[a]||0));
                  grpTeams[g]=teams;
                });
                // Resolve KO team name
                const resolveTeam=(label)=>{
                  if(!label) return label;
                  const wm=label.match(/^Winner ([A-L])$/);
                  if(wm) return grpTeams[wm[1]]?.[0]||label;
                  const rm=label.match(/^Runner-up ([A-L])$/);
                  if(rm) return grpTeams[rm[1]]?.[1]||label;
                  // W R32-x, W R16-x etc — check koResults
                  const wko=label.match(/^W (r32|r16|qf|sf)-(\d+)$/i);
                  if(wko){
                    const kid=wko[1].toLowerCase()+"-"+wko[2];
                    const kr=koResults[kid];
                    if(kr&&kr.h!==""&&kr.a!==""&&!isNaN(+kr.h)&&!isNaN(+kr.a)){
                      const round=KNOCKOUT_ROUNDS.find(r=>r.matches.some(m=>m.id===kid));
                      const match=round?.matches.find(m=>m.id===kid);
                      if(match){
                        const home=resolveTeam(match.home);
                        const away=resolveTeam(match.away);
                        return +kr.h>+kr.a?home:+kr.a>+kr.h?away:label;
                      }
                    }
                    return label;
                  }
                  return label;
                };

                const koRoundEmoji={"Round of 32":"🔵","Round of 16":"🟡","Quarter-Finals":"🟠","Semi-Finals":"🔴","3rd Place":"🥉","Final":"🏆"};

                return KNOCKOUT_ROUNDS.map(round=>(
                  <div key={round.round} style={{marginTop:18,marginBottom:10}}>
                    {/* Round header */}
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,padding:"7px 12px",background:dark?"#0a1628":"#0f2044",borderRadius:10,border:`1px solid ${c}33`}}>
                      <span style={{fontSize:15}}>{koRoundEmoji[round.round]||"⚽"}</span>
                      <span style={{fontFamily:"'Bebas Neue',cursive",fontSize:14,letterSpacing:2,color:c}}>{round.round}</span>
                      <span style={{fontSize:10,color:T.sub}}>{round.dates}</span>
                      <div style={{flex:1,height:1,background:T.border+"66"}}/>
                    </div>
                    {/* KO match rows */}
                    {round.matches.map((m,mi)=>{
                      const homeTeam=resolveTeam(m.home);
                      const awayTeam=resolveTeam(m.away);
                      const r2=koResults[m.id];
                      const hasScore2=r2&&r2.h!==""&&r2.a!==""&&!isNaN(+r2.h)&&!isNaN(+r2.a);
                      const now2=Date.now();
                      const matchOver2=matchUTC(m.date,m.etTime)+105*60000<now2;
                      const isLive2=!matchOver2&&matchUTC(m.date,m.etTime)<now2;
                      const {time:bdT2,label:bdL2}=etToBD(m.etTime);
                      const timeStr2=bdL2+" "+bdT2;
                      const bdDate2=bdDateStr(m.date,m.etTime);
                      const isPlaceholder=homeTeam.startsWith("W ")||homeTeam.startsWith("Winner ")||homeTeam.startsWith("Runner")||homeTeam.startsWith("L ")||homeTeam.startsWith("Best");
                      const isFav2=favTeam&&(homeTeam===favTeam||awayTeam===favTeam);
                      return (
                        <div key={m.id} style={{
                          marginBottom:4,borderRadius:10,overflow:"hidden",
                          border:`1px solid ${isFav2?"rgba(251,191,36,.4)":T.border}`,
                          background:isFav2?"rgba(251,191,36,.04)":mi%2===0?T.card:(dark?"rgba(255,255,255,.012)":"rgba(0,0,0,.012)"),
                          borderLeft:isFav2?"3px solid #fbbf24":"3px solid transparent",
                          opacity:isPlaceholder?.7:1,
                        }}>
                          <div style={{display:"flex",alignItems:"center",padding:"8px 10px",gap:0}}>
                            {/* Date badge */}
                            <div style={{flexShrink:0,width:60,marginRight:8}}>
                              <div style={{background:dark?"#1e3a5f":"#1e40af",color:"#fff",borderRadius:6,padding:"3px 5px",textAlign:"center"}}>
                                <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:11,lineHeight:1}}>{bdDate2}</div>
                              </div>
                            </div>
                            {/* HOME */}
                            <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"flex-end",gap:4,minWidth:0}}>
                              <span style={{fontSize:11,fontWeight:700,textAlign:"right",wordBreak:"break-word",lineHeight:1.2,color:hasScore2&&+r2.h>+r2.a?c:isFav2&&homeTeam===favTeam?"#fbbf24":isPlaceholder?T.sub:T.text}}>{homeTeam}</span>
                              <span style={{fontSize:20,flexShrink:0}}>{isPlaceholder?"❓":(FLAGS[homeTeam]||"🏳")}</span>
                            </div>
                            {/* CENTER */}
                            <div style={{flexShrink:0,width:78,textAlign:"center",padding:"0 3px"}}>
                              {hasScore2?(
                                <div style={{padding:"3px 0",borderRadius:6,background:isLive2?"rgba(239,68,68,.15)":"rgba(16,185,129,.12)",border:`1px solid ${isLive2?"#ef444466":c+"55"}`}}>
                                  <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:18,color:isLive2?"#ef4444":c,lineHeight:1}}>{r2.h}:{r2.a}</div>
                                  <div style={{fontSize:7,fontWeight:800,color:isLive2?"#ef4444":T.sub}}>{isLive2?"LIVE":matchOver2?"FT":""}</div>
                                </div>
                              ):(
                                <div style={{padding:"3px 0",borderRadius:6,background:isFav2?"rgba(251,191,36,.1)":T.acBg,border:`1px solid ${isFav2?"rgba(251,191,36,.25)":c+"22"}`}}>
                                  <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:10,color:isFav2?"#fbbf24":c,lineHeight:1.3,whiteSpace:"nowrap"}}>{timeStr2}</div>
                                  <div style={{fontSize:7,color:T.dim}}>BD সময়</div>
                                </div>
                              )}
                              <div style={{display:"flex",justifyContent:"center",gap:3,marginTop:2}}>
                                <button onClick={()=>requestNotification({...m,dateStr:m.date,home:homeTeam,away:awayTeam},handleNotifToggle)} style={{background:"none",border:"none",cursor:"pointer",fontSize:9,opacity:notifScheduled[m.id]?1:.4,padding:0}}>{notifScheduled[m.id]?"🔔":"🔕"}</button>
                              </div>
                            </div>
                            {/* AWAY */}
                            <div style={{flex:1,display:"flex",alignItems:"center",gap:4,minWidth:0}}>
                              <span style={{fontSize:20,flexShrink:0}}>{isPlaceholder?"❓":(FLAGS[awayTeam]||"🏳")}</span>
                              <span style={{fontSize:11,fontWeight:700,wordBreak:"break-word",lineHeight:1.2,color:hasScore2&&+r2.a>+r2.h?c:isFav2&&awayTeam===favTeam?"#fbbf24":isPlaceholder?T.sub:T.text}}>{awayTeam}</span>
                            </div>
                          </div>
                          {/* venue */}
                          <div style={{paddingLeft:78,paddingRight:10,paddingBottom:5,fontSize:8,color:T.dim}}>📍 {m.venue}</div>
                        </div>
                      );
                    })}
                  </div>
                ));
              })()}

            </div>
          )}

          {/* ═══ RESULTS (শেষ হওয়া ম্যাচ, date-wise) ═══ */}
          {tab==="results" && (
            <div className="fi">
              <div style={{marginBottom:14}}>
                <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:22,letterSpacing:2,color:c}}>✅ ফলাফল</div>
                <div style={{fontSize:11,color:T.sub,marginTop:2}}>যেসব ম্যাচ শেষ হয়ে গেছে — তারিখ অনুযায়ী, নতুন তারিখ আগে</div>
              </div>
              {resultsByDate.length === 0 && (
                <div style={{textAlign:"center",padding:"40px 0",color:T.sub,fontSize:13}}>
                  এখনো কোনো ম্যাচ শেষ হয়নি।
                </div>
              )}
              {resultsByDate.map(([dateStr, fixes]) => {
                const mn = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
                const dayNames = ["রবি","সোম","মঙ্গল","বুধ","বৃহ","শুক্র","শনি"];
                const sample = fixes[0];
                const bdDate = sample.isKO ? sample.dateStr : bdDateStr(sample.dateStr, sample.etTime);
                const dateObj = (()=>{ try { const [mo,dy]=bdDate.split(" "); return new Date(2026, mn.indexOf(mo), +dy); } catch { return null; } })();
                const dayName = dateObj ? dayNames[dateObj.getDay()] : "";
                return (
                  <div key={dateStr} style={{marginBottom:10,borderRadius:12,overflow:"hidden",border:`1px solid ${T.border}`,boxShadow:T.sh}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,padding:"7px 12px",background:dark?"#0a1628":"#0f2044"}}>
                      <div style={{background:dark?"#1e3a5f":"#1e40af",color:"#fff",borderRadius:6,padding:"3px 8px",display:"flex",alignItems:"center",gap:5,flexShrink:0}}>
                        <span style={{fontFamily:"'Bebas Neue',cursive",fontSize:13,letterSpacing:.5,lineHeight:1}}>{bdDate.split(" ")[0]?.toUpperCase()} {bdDate.split(" ")[1]}</span>
                        <span style={{fontSize:9,opacity:.85,fontWeight:700}}>{dayName}</span>
                      </div>
                      <span style={{fontSize:10,color:T.sub}}>{fixes.length}টি ম্যাচ</span>
                      <div style={{flex:1,height:1,background:T.border+"66"}}/>
                    </div>
                    {fixes.map((fix,fi) => {
                      const r = fix.isKO ? koResults[fix.id] : results[fix.id];
                      const hasScore = r && r.h!==""&&r.a!==""&&!isNaN(+r.h)&&!isNaN(+r.a);
                      const goals = Array.isArray(r?.goals) ? [...r.goals].sort((a,b)=>(a.minute||0)-(b.minute||0)) : [];
                      const homeGoals = goals.filter(g=>g.team==="home");
                      const awayGoals = goals.filter(g=>g.team==="away");
                      return (
                        <div key={fix.id} style={{borderTop:`1px solid ${T.border}44`,padding:"10px 12px",background:fi%2===0?T.card:(dark?"rgba(255,255,255,.012)":"rgba(0,0,0,.012)")}}>
                          <div style={{display:"flex",alignItems:"center",gap:6}}>
                            <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"flex-end",gap:6,minWidth:0}}>
                              <div style={{textAlign:"right",minWidth:0}}>
                                <div style={{fontWeight:700,fontSize:13,color:hasScore&&+r.h>+r.a?c:T.text}}>{fix.home}</div>
                                {homeGoals.length>0 && <div style={{fontSize:9,color:T.sub,marginTop:2}}>{homeGoals.map(g=>`⚽${g.scorer} ${g.minute||"?"}'`).join(", ")}</div>}
                              </div>
                              <span style={{fontSize:24,flexShrink:0}}>{FLAGS[fix.home]||"🏳"}</span>
                            </div>
                            <div style={{flexShrink:0,minWidth:70,textAlign:"center",padding:"4px 10px",borderRadius:8,background:T.acBg,border:`1px solid ${c}33`}}>
                              {hasScore ? (
                                <>
                                  <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:22,color:c,lineHeight:1}}>{r.h} – {r.a}</div>
                                  <div style={{fontSize:8,color:T.sub,fontWeight:700,letterSpacing:1}}>FT</div>
                                </>
                              ) : (
                                <div style={{fontSize:11,color:T.sub}}>ফলাফল নেই</div>
                              )}
                            </div>
                            <div style={{flex:1,display:"flex",alignItems:"center",gap:6,minWidth:0}}>
                              <span style={{fontSize:24,flexShrink:0}}>{FLAGS[fix.away]||"🏳"}</span>
                              <div style={{minWidth:0}}>
                                <div style={{fontWeight:700,fontSize:13,color:hasScore&&+r.a>+r.h?c:T.text}}>{fix.away}</div>
                                {awayGoals.length>0 && <div style={{fontSize:9,color:T.sub,marginTop:2}}>{awayGoals.map(g=>`⚽${g.scorer} ${g.minute||"?"}'`).join(", ")}</div>}
                              </div>
                            </div>
                          </div>
                          <div style={{fontSize:9,color:T.dim,marginTop:5,textAlign:"center"}}>{fix.venue?.split(",")[0]}{fix.isKO?` · ${KNOCKOUT_ROUNDS.find(rd=>rd.matches.some(m=>m.id===fix.id))?.short||""}`:` · Group ${fix.grp}`}</div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}


          {tab==="standings" && (
            <div className="fi">
              <div style={{fontSize:12,color:T.sub,marginBottom:14}}>ফলাফল auto-update হয় · ম্যাচ শেষ হলে qualified দল স্বয়ংক্রিয় নির্ধারিত হবে</div>
              {/* ── All Groups Done → Bracket Ready Banner ── */}
              {(()=>{
                const allGroupsDone = Object.keys(GROUPS).every(g => {
                  const gFixes = ALL_GROUP_FIXTURES.filter(f=>f.grp===g);
                  return gFixes.every(f=>{ const r=results[f.id]; return r&&r.h!==""&&r.a!==""&&!isNaN(+r.h)&&!isNaN(+r.a); });
                });
                if (!allGroupsDone) return null;
                return (
                  <div style={{marginBottom:16,padding:"14px 16px",background:"rgba(251,191,36,.08)",border:"2px solid rgba(251,191,36,.4)",borderRadius:12,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",animation:"fadeIn .4s ease"}}>
                    <span style={{fontSize:28}}>🏆</span>
                    <div style={{flex:1}}>
                      <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:15,letterSpacing:2,color:"#fbbf24"}}>সব গ্রুপ সম্পন্ন! BRACKET রেডি</div>
                      <div style={{fontSize:11,color:T.sub,marginTop:2}}>৩২ দলের Round of 32 লাইনআপ তৈরি হয়ে গেছে</div>
                    </div>
                    <button onClick={()=>setTab("bracket")} style={{padding:"8px 16px",borderRadius:8,border:"1px solid rgba(251,191,36,.5)",background:"rgba(251,191,36,.15)",color:"#fbbf24",cursor:"pointer",fontFamily:"'Bebas Neue',cursive",fontSize:14,letterSpacing:1,fontWeight:700}}>
                      🗂️ BRACKET দেখুন
                    </button>
                  </div>
                );
              })()}
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:18}}>
                {Object.keys(GROUPS).map(g=>(
                  <button key={g} onClick={()=>setStandGrp(g)} style={{padding:"6px 13px",borderRadius:8,border:`1px solid ${standGrp===g?c:T.border}`,background:standGrp===g?T.acBg:T.card,color:standGrp===g?c:T.sub,cursor:"pointer",fontFamily:"'Bebas Neue',cursive",fontSize:14,letterSpacing:2,transition:"all .2s",boxShadow:T.sh}}>
                    Grp {g}
                  </button>
                ))}
              </div>
              {(()=>{
                const g=standGrp;
                const rows=calcStandings(g);
                const fixes=ALL_GROUP_FIXTURES.filter(f=>f.grp===g);
                // Only show qualified if ALL 6 matches in this group have results
                const allMatchesDone = fixes.every(f => {
                  const r = results[f.id];
                  return r && r.h !== "" && r.a !== "" && !isNaN(+r.h) && !isNaN(+r.a);
                });
                const playedCount = fixes.filter(f => { const r=results[f.id]; return r&&r.h!==""&&r.a!==""&&!isNaN(+r.h)&&!isNaN(+r.a); }).length;
                return (
                  <div className="fi">
                    {/* Progress bar */}
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,padding:"8px 12px",background:T.acBg,borderRadius:8,border:`1px solid ${c}22`}}>
                      <div style={{fontSize:11,color:T.sub}}>Group {g}:</div>
                      <div style={{flex:1,height:4,background:T.border,borderRadius:2,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${(playedCount/6)*100}%`,background:c,borderRadius:2,transition:"width .5s"}}/>
                      </div>
                      <div style={{fontSize:11,fontWeight:700,color:c}}>{playedCount}/6</div>
                      {autoFetching && <span style={{fontSize:10,color:c,animation:"pulse 1s infinite"}}>⟳</span>}
                      <button onClick={fetchResults} style={{padding:"3px 8px",borderRadius:5,border:`1px solid ${c}33`,background:"transparent",color:c,cursor:"pointer",fontSize:10,fontWeight:700}}>🔄</button>
                    </div>
                    <div style={{overflowX:"auto",marginBottom:12}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:280}}>
                        <thead>
                          <tr style={{borderBottom:`1px solid ${T.border}`}}>
                            {["#","দল","MP","W","D","L","GD","PTS"].map(h=>(
                              <th key={h} style={{padding:"5px 4px",textAlign:h==="দল"?"left":"center",fontSize:9,color:T.sub,fontWeight:700,letterSpacing:.5,textTransform:"uppercase"}}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((s,i)=>{
                            // Qualification status logic
                            const canCatch = (other) => {
                              const remaining = fixes.filter(f=>(f.home===other.team||f.away===other.team)&&!(results[f.id]&&results[f.id].h!==""&&!isNaN(+results[f.id].h))).length;
                              return other.pts + remaining*3;
                            };
                            const isDefinitelyQ = allMatchesDone && i<2;
                            const isDefinitelyElim = allMatchesDone && i>=2;
                            const isPossiblyQ = !allMatchesDone && s.mp>0 && i<2;
                            const maxPts = s.pts + fixes.filter(f=>(f.home===s.team||f.away===s.team)&&!(results[f.id]&&results[f.id].h!==""&&!isNaN(+results[f.id].h))).length*3;
                            const canStillQ = !allMatchesDone && maxPts>=3;
                            return (
                            <tr key={s.team} style={{borderBottom:`1px solid ${T.border}`,background:isDefinitelyQ?T.acBg:T.card,transition:"background .3s"}}>
                              <td style={{padding:"7px 4px",textAlign:"center"}}>
                                <div style={{width:18,height:18,borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:10,background:isDefinitelyQ&&i===0?"rgba(251,191,36,.2)":isDefinitelyQ&&i===1?T.acBg:"transparent",color:isDefinitelyQ&&i===0?"#fbbf24":isDefinitelyQ&&i===1?c:T.sub,border:isDefinitelyQ?`1px solid ${i===0?"rgba(251,191,36,.4)":c+"44"}`:"none"}}>{i+1}</div>
                              </td>
                              <td style={{padding:"7px 4px"}}>
                                <div style={{display:"flex",alignItems:"center",gap:5}}>
                                  <span style={{fontSize:14}}>{FLAGS[s.team]||"🏳"}</span>
                                  <div>
                                    <span style={{fontWeight:600,fontSize:11,color:T.text}}>{s.team}</span>
                                    {isDefinitelyQ && i===0 && <span className="pill q-badge-yellow" style={{marginLeft:4,fontSize:8}}>🏆</span>}
                                    {isDefinitelyQ && i===1 && <span className="pill q-badge-green" style={{marginLeft:4,fontSize:8}}>✓</span>}
                                    {isDefinitelyElim && <span className="pill q-badge-red" style={{marginLeft:4,fontSize:8}}>✗</span>}
                                  </div>
                                </div>
                              </td>
                              {[s.mp,s.w,s.d,s.l,s.gd>0?"+"+s.gd:s.gd].map((v,vi)=>(
                                <td key={vi} style={{padding:"7px 4px",textAlign:"center",color:vi===4?(s.gd>0?c:s.gd<0?"#ef4444":T.sub):T.text,fontWeight:vi===4?700:400,fontSize:11}}>{v}</td>
                              ))}
                              <td style={{padding:"7px 4px",textAlign:"center"}}>
                                <span style={{fontFamily:"'Bebas Neue',cursive",fontSize:17,color:isDefinitelyQ?c:T.text}}>{s.pts}</span>
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div style={{fontSize:10,color:T.sub,marginBottom:16,padding:"8px 12px",background:T.muted,borderRadius:6,display:"flex",gap:12,flexWrap:"wrap"}}>
                      <span className="pill q-badge-green">✓ Qualified</span> <span style={{color:T.sub}}>= নিশ্চিত</span>
                      <span className="pill q-badge-yellow">~Q</span> <span style={{color:T.sub}}>= সম্ভাব্য</span>
                      <span className="pill q-badge-red">✗ বিদায়</span> <span style={{color:T.sub}}>= ছিটকে গেছে</span>
                      {allMatchesDone && <span style={{color:c,fontWeight:700}}>✓ Group {standGrp} সম্পন্ন</span>}
                    </div>
                    {/* ── Qualification Tracker ── */}
                    {!allMatchesDone && playedCount > 0 && (
                      <div style={{marginBottom:16,padding:"12px 14px",background:T.acBg,border:`1px solid ${c}22`,borderRadius:10}}>
                        <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:13,letterSpacing:2,color:c,marginBottom:10}}>🎯 QUALIFY করতে কী দরকার?</div>
                        <div style={{display:"flex",flexDirection:"column",gap:7}}>
                          {rows.map((s,i)=>{
                            const remainingFixes = fixes.filter(f=>(f.home===s.team||f.away===s.team)&&!(results[f.id]&&results[f.id].h!==""&&!isNaN(+results[f.id].h)));
                            const rem = remainingFixes.length;
                            if (rem === 0) return null;
                            // current 2nd place pts
                            const second = rows[1];
                            const ptsTo2nd = second ? second.pts : 0;
                            const ptsNeeded = Math.max(0, ptsTo2nd - s.pts + (i >= 2 ? 1 : 0));
                            const maxPossible = s.pts + rem * 3;
                            const canQualify = maxPossible >= ptsTo2nd + (i >= 2 ? 1 : 0);
                            if (!canQualify) return null;
                            if (i < 2 && s.pts > ptsTo2nd) return null; // already leading
                            const winsNeeded = Math.ceil(ptsNeeded / 3);
                            const msg = ptsNeeded === 0
                              ? (rem === 1 ? "১ পয়েন্ট রাখলেই নিশ্চিত" : "বর্তমান অবস্থান ধরে রাখুন")
                              : `${rem}টি ম্যাচে দরকার ${ptsNeeded}+ পয়েন্ট (≈ ${winsNeeded}জয়)`;
                            return (
                              <div key={s.team} style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                                <span style={{fontSize:15}}>{FLAGS[s.team]||"🏳"}</span>
                                <span style={{fontSize:11,fontWeight:700,color:T.text,minWidth:100}}>{s.team}</span>
                                <span style={{fontSize:11,color:c,flex:1}}>{msg}</span>
                                <span style={{fontSize:10,color:T.sub}}>{rem} ম্যাচ বাকি</span>
                              </div>
                            );
                          }).filter(Boolean)}
                          {rows.slice(2).filter(s=>{
                            const rem = fixes.filter(f=>(f.home===s.team||f.away===s.team)&&!(results[f.id]&&results[f.id].h!==""&&!isNaN(+results[f.id].h))).length;
                            const maxPossible = s.pts + rem * 3;
                            const ptsTo2nd = rows[1]?.pts || 0;
                            return rem > 0 && maxPossible < ptsTo2nd;
                          }).map(s=>(
                            <div key={s.team+"e"} style={{display:"flex",alignItems:"center",gap:8}}>
                              <span style={{fontSize:15}}>{FLAGS[s.team]||"🏳"}</span>
                              <span style={{fontSize:11,fontWeight:700,color:T.text,minWidth:100}}>{s.team}</span>
                              <span style={{fontSize:11,color:"#ef4444"}}>গাণিতিকভাবে বিদায় নিশ্চিত</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:13,letterSpacing:2,color:c,marginBottom:8}}>GROUP {g} · ম্যাচ ফলাফল</div>
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {fixes.map(fix=>{
                        const r=results[fix.id]||{h:"",a:""};
                        const hasScore = r.h !== "" && r.a !== "" && !isNaN(+r.h) && !isNaN(+r.a);
                        const matchOver = matchUTC(fix.dateStr, fix.etTime) + 105*60000 < Date.now();
                        const matchStarted = matchUTC(fix.dateStr, fix.etTime) < Date.now();
                        return (
                          <div key={fix.id} style={{
                            borderRadius:9,overflow:"hidden",
                            border:`1px solid ${hasScore?c+"44":T.border}`,
                            background:T.card,boxShadow:T.sh,
                            borderLeft:hasScore?`3px solid ${c}`:"3px solid transparent",
                          }}>
                            <div style={{display:"flex",alignItems:"center",padding:"8px 10px",gap:0}}>
                              {/* Date */}
                              <div style={{flexShrink:0,width:52,marginRight:6}}>
                                <div style={{background:dark?"#1e3a5f":"#1e40af",color:"#fff",borderRadius:5,padding:"2px 4px",textAlign:"center"}}>
                                  <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:10,lineHeight:1}}>{bdDateStr(fix.dateStr,fix.etTime)}</div>
                                </div>
                              </div>
                              {/* Home */}
                              <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"flex-end",gap:4,minWidth:0}}>
                                <span style={{fontSize:11,fontWeight:700,textAlign:"right",wordBreak:"break-word",lineHeight:1.2,color:hasScore&&+r.h>+r.a?c:T.text}}>{fix.home}</span>
                                <span style={{fontSize:18,flexShrink:0}}>{FLAGS[fix.home]||"🏳"}</span>
                              </div>
                              {/* Center */}
                              <div style={{flexShrink:0,width:72,textAlign:"center",padding:"0 3px"}}>
                                {hasScore?(
                                  <div style={{padding:"2px 0",borderRadius:5,background:matchStarted&&!matchOver?"rgba(239,68,68,.15)":"rgba(16,185,129,.12)",border:`1px solid ${matchStarted&&!matchOver?"#ef444466":c+"55"}`}}>
                                    <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:17,color:matchStarted&&!matchOver?"#ef4444":c,lineHeight:1}}>{r.h}:{r.a}</div>
                                    <div style={{fontSize:7,fontWeight:800,color:matchStarted&&!matchOver?"#ef4444":T.sub}}>{matchOver?"FT":r.minute?`${r.minute}'`:"LIVE"}</div>
                                  </div>
                                ):(
                                  <div style={{padding:"2px 0",borderRadius:5,background:T.acBg,border:`1px solid ${c}22`}}>
                                    <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:10,color:c,lineHeight:1.3,whiteSpace:"nowrap"}}>{bdTime(fix.etTime)}</div>
                                    <div style={{fontSize:7,color:T.dim}}>BD সময়</div>
                                  </div>
                                )}
                              </div>
                              {/* Away */}
                              <div style={{flex:1,display:"flex",alignItems:"center",gap:4,minWidth:0}}>
                                <span style={{fontSize:18,flexShrink:0}}>{FLAGS[fix.away]||"🏳"}</span>
                                <span style={{fontSize:11,fontWeight:700,wordBreak:"break-word",lineHeight:1.2,color:hasScore&&+r.a>+r.h?c:T.text}}>{fix.away}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ═══ BRACKET ═══ */}
          {tab==="bracket" && (()=>{
            try {
            // ── helpers ────────────────────────────────────────────────────
            const getQualified = (grp, rank) => {
              const rows = calcStandings(grp);
              const fixes = ALL_GROUP_FIXTURES.filter(f=>f.grp===grp);
              const played = fixes.filter(f=>{const r=results[f.id];return r&&r.h!==""&&r.a!==""&&!isNaN(+r.h)&&!isNaN(+r.a);}).length;
              if(played===0) return null;
              return rows[rank] ? {team:rows[rank].team, flag:FLAGS[rows[rank].team]||"🏳", confirmed:played===6} : null;
            };
            const slot = (grp, rank) => {
              const q = getQualified(grp, rank);
              if(!q) return {team: rank===0?`W ${grp}`:`2nd ${grp}`, flag:"❓", tbd:true, confirmed:false};
              return q;
            };

            // ── Best 3rd teams (top 8 from 12 groups by pts→gd→gf) ────────
            const getBest3rd = () => {
              const thirds = Object.keys(GROUPS).map(g => {
                const rows = calcStandings(g);
                const fixes = ALL_GROUP_FIXTURES.filter(f=>f.grp===g);
                const played = fixes.filter(f=>{const r=results[f.id];return r&&r.h!==""&&r.a!==""&&!isNaN(+r.h)&&!isNaN(+r.a);}).length;
                if (played === 0 || !rows[2]) return null;
                return { ...rows[2], grp: g, confirmed: played === 6 };
              }).filter(Boolean);
              thirds.sort((a,b) => b.pts-a.pts || (b.gd-a.gd) || (b.gf-a.gf));
              return thirds.slice(0, 8);
            };
            const best3rd = getBest3rd();
            const slotBest3rd = (idx) => {
              const t = best3rd[idx];
              if (!t) return {team:`Best 3rd`, flag:"❓", tbd:true, confirmed:false};
              return {team:t.team, flag:FLAGS[t.team]||"🏳", tbd:false, confirmed:t.confirmed};
            };

            // ── KO winner helper ──────────────────────────────────────────
            const koWinner = (matchId) => {
              const r = koResults[matchId];
              if (!r || r.h === "" || r.a === "" || isNaN(+r.h) || isNaN(+r.a)) return null;
              // find match
              const m = KNOCKOUT_ROUNDS.flatMap(x=>x.matches).find(x=>x.id===matchId);
              if (!m) return null;
              const hTeam = m.home; const aTeam = m.away;
              if (+r.h > +r.a) return {team:hTeam, flag:FLAGS[hTeam]||"🏳", tbd:false, confirmed:true};
              if (+r.a > +r.h) return {team:aTeam, flag:FLAGS[aTeam]||"🏳", tbd:false, confirmed:true};
              return null; // draw — KO shouldn't draw but just in case
            };
            const koLoser = (matchId) => {
              const r = koResults[matchId];
              if (!r || r.h === "" || r.a === "" || isNaN(+r.h) || isNaN(+r.a)) return null;
              const m = KNOCKOUT_ROUNDS.flatMap(x=>x.matches).find(x=>x.id===matchId);
              if (!m) return null;
              if (+r.h > +r.a) return {team:m.away, flag:FLAGS[m.away]||"🏳", tbd:false, confirmed:true};
              if (+r.a > +r.h) return {team:m.home, flag:FLAGS[m.home]||"🏳", tbd:false, confirmed:true};
              return null;
            };
            const slotKOWinner = (matchId, label) => koWinner(matchId) || {team:label, flag:"❓", tbd:true, confirmed:false};
            const slotKOLoser  = (matchId, label) => koLoser(matchId)  || {team:label, flag:"❓", tbd:true, confirmed:false};

            // ── R32 pairings ─────────────────────────────────────────────
            const r32 = [
              {m:1,  a:slot("A",1),        b:slot("B",1),                  date:"Jun 28"}, {m:2,  a:slot("C",0), b:slot("F",1),                  date:"Jun 29"},
              {m:3,  a:slot("E",0),        b:slotBest3rd(0),               date:"Jun 29"}, {m:4,  a:slot("F",0), b:slot("C",1),                  date:"Jun 29"},
              {m:5,  a:slot("E",1),        b:slot("I",1),                  date:"Jun 30"}, {m:6,  a:slot("I",0), b:slotBest3rd(1),               date:"Jun 30"},
              {m:7,  a:slot("A",0),        b:slotBest3rd(2),               date:"Jun 30"}, {m:8,  a:slot("L",0), b:slotBest3rd(3),               date:"Jul 1"},
              {m:9,  a:slot("G",0),        b:slotBest3rd(4),               date:"Jul 1"},  {m:10, a:slot("D",0), b:slotBest3rd(5),               date:"Jul 1"},
              {m:11, a:slot("H",0),        b:slot("J",1),                  date:"Jul 2"},  {m:12, a:slot("K",1), b:slot("L",1),                  date:"Jul 2"},
              {m:13, a:slot("B",0),        b:slotBest3rd(6),               date:"Jul 2"},  {m:14, a:slot("D",1), b:slot("G",1),                  date:"Jul 3"},
              {m:15, a:slot("J",0),        b:slot("H",1),                  date:"Jul 3"},  {m:16, a:slot("K",0), b:slotBest3rd(7),               date:"Jul 3"},
            ];
            const r16 = [
              {m:1, a:slotKOWinner("r32-1","W M1"),  b:slotKOWinner("r32-2","W M2"),   date:"Jul 4"},
              {m:2, a:slotKOWinner("r32-3","W M3"),  b:slotKOWinner("r32-4","W M4"),   date:"Jul 4"},
              {m:3, a:slotKOWinner("r32-5","W M5"),  b:slotKOWinner("r32-6","W M6"),   date:"Jul 5"},
              {m:4, a:slotKOWinner("r32-7","W M7"),  b:slotKOWinner("r32-8","W M8"),   date:"Jul 5"},
              {m:5, a:slotKOWinner("r32-9","W M9"),  b:slotKOWinner("r32-10","W M10"), date:"Jul 6"},
              {m:6, a:slotKOWinner("r32-11","W M11"),b:slotKOWinner("r32-12","W M12"), date:"Jul 6"},
              {m:7, a:slotKOWinner("r32-13","W M13"),b:slotKOWinner("r32-14","W M14"), date:"Jul 7"},
              {m:8, a:slotKOWinner("r32-15","W M15"),b:slotKOWinner("r32-16","W M16"), date:"Jul 7"},
            ];
            const qf = [
              {m:1, a:slotKOWinner("r16-1","W R16-1"), b:slotKOWinner("r16-2","W R16-2"), date:"Jul 9"},
              {m:2, a:slotKOWinner("r16-3","W R16-3"), b:slotKOWinner("r16-4","W R16-4"), date:"Jul 10"},
              {m:3, a:slotKOWinner("r16-5","W R16-5"), b:slotKOWinner("r16-6","W R16-6"), date:"Jul 11"},
              {m:4, a:slotKOWinner("r16-7","W R16-7"), b:slotKOWinner("r16-8","W R16-8"), date:"Jul 11"},
            ];
            const sf = [
              {m:1, a:slotKOWinner("qf-1","W QF-1"), b:slotKOWinner("qf-2","W QF-2"), date:"Jul 14"},
              {m:2, a:slotKOWinner("qf-3","W QF-3"), b:slotKOWinner("qf-4","W QF-4"), date:"Jul 15"},
            ];
            const fin     = [{m:1, a:slotKOWinner("sf-1","W SF-1"), b:slotKOWinner("sf-2","W SF-2"), date:"Jul 19"}];
            const thirdP  = [{m:1, a:slotKOLoser("sf-1","L SF-1"),  b:slotKOLoser("sf-2","L SF-2"),  date:"Jul 18"}];

            // ── Team Slot component ────────────────────────────────────────
            const TeamSlot = ({team, accent="#10b981", winner=false}) => (
              <div style={{
                display:"flex", alignItems:"center", gap:5,
                padding:"5px 8px",
                background: team.tbd ? (dark?"rgba(255,255,255,.03)":"rgba(0,0,0,.04)") : winner ? "rgba(251,191,36,.12)" : `${accent}0f`,
                border:`1px solid ${team.tbd ? T.border : winner ? "rgba(251,191,36,.4)" : accent+"33"}`,
                borderRadius:7, minWidth:0, transition:"all .2s"
              }}>
                <span style={{fontSize:15, flexShrink:0}}>{team.flag}</span>
                <span style={{
                  fontSize:10, fontWeight: team.tbd?400:700,
                  color: team.tbd ? T.dim : winner ? "#fbbf24" : team.confirmed ? accent : T.text,
                  flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"
                }}>{team.team}</span>
                {team.confirmed && !team.tbd && <span style={{fontSize:8,color:accent,flexShrink:0}}>✓</span>}
              </div>
            );

            // ── Match Box ──────────────────────────────────────────────────
            const MatchBox = ({match, accent="#10b981", isFinal=false, showDate=true}) => {
              const both = !match.a.tbd && !match.b.tbd;
              return (
              <div style={{
                background: isFinal ? "rgba(251,191,36,.06)" : T.card,
                border:`1.5px solid ${isFinal?"rgba(251,191,36,.35)":both?accent+"44":T.border}`,
                borderRadius:10, padding:"7px 8px", width:"100%",
                boxShadow: both ? `0 0 12px ${isFinal?"rgba(251,191,36,.15)":accent+"18"}` : "none",
                transition:"all .2s"
              }}>
                {showDate && <div style={{fontSize:8,color:T.dim,marginBottom:4,textAlign:"center",fontFamily:"'Bebas Neue',cursive",letterSpacing:1}}>{match.date}</div>}
                <div style={{display:"flex",flexDirection:"column",gap:3}}>
                  <TeamSlot team={match.a} accent={isFinal?"#fbbf24":accent}/>
                  <div style={{textAlign:"center",fontSize:8,color:T.dim,fontFamily:"'Bebas Neue',cursive",letterSpacing:1}}>VS</div>
                  <TeamSlot team={match.b} accent={isFinal?"#fbbf24":accent}/>
                </div>
              </div>
              );
            };

            // ── Connector line ─────────────────────────────────────────────
            const Connector = ({accent}) => (
              <div style={{display:"flex",alignItems:"center",flexShrink:0}}>
                <div style={{width:12,height:1,background:`${accent}40`}}/>
              </div>
            );

            // ── Column of matches ─────────────────────────────────────────
            const MatchColumn = ({matches, accent, isFinal=false, justify="center"}) => (
              <div style={{display:"flex",flexDirection:"column",gap:6,justifyContent:justify}}>
                {matches.map((m,i)=><MatchBox key={i} match={m} accent={accent} isFinal={isFinal}/>)}
              </div>
            );

            // ── Left half R32 (matches 1–8) ────────────────────────────────
            const leftR32 = r32.slice(0,8);
            const leftR16 = r16.slice(0,4);
            const leftQF  = qf.slice(0,2);
            const leftSF  = sf.slice(0,1);

            // ── Right half R32 (matches 9–16) ────────────────────────────
            const rightR32 = r32.slice(8,16);
            const rightR16 = r16.slice(4,8);
            const rightQF  = qf.slice(2,4);
            const rightSF  = sf.slice(1,2);

            const matchW = 130;
            const colGap = 6;

            return (
              <div className="fi" style={{paddingBottom:8}}>
                {/* Header */}
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,padding:"10px 14px",background:T.acBg,borderRadius:10,border:`1px solid ${c}22`,flexWrap:"wrap"}}>
                  <span style={{fontSize:16}}>🗂️</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:T.text}}>টুর্নামেন্ট ব্র্যাকেট</div>
                    <div style={{fontSize:10,color:T.sub}}>Group শেষে দল auto আসবে · স্লাইডার দিয়ে ছোট/বড় করুন</div>
                  </div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                    {(()=>{
                      const allGroupsDone = Object.keys(GROUPS).every(g => {
                        const gFixes = ALL_GROUP_FIXTURES.filter(f=>f.grp===g);
                        return gFixes.every(f=>{ const r=results[f.id]; return r&&r.h!==""&&r.a!==""&&!isNaN(+r.h)&&!isNaN(+r.a); });
                      });
                      const confirmedGroups = Object.keys(GROUPS).filter(g => {
                        const gFixes = ALL_GROUP_FIXTURES.filter(f=>f.grp===g);
                        return gFixes.every(f=>{ const r=results[f.id]; return r&&r.h!==""&&r.a!==""&&!isNaN(+r.h)&&!isNaN(+r.a); });
                      }).length;
                      return allGroupsDone
                        ? <span style={{padding:"3px 8px",background:"rgba(251,191,36,.15)",color:"#fbbf24",border:"1px solid rgba(251,191,36,.4)",borderRadius:6,fontSize:10,fontWeight:700}}>✓ সব গ্রুপ সম্পন্ন</span>
                        : confirmedGroups > 0
                          ? <span style={{padding:"3px 8px",background:`${c}15`,color:c,border:`1px solid ${c}33`,borderRadius:6,fontSize:10}}>{confirmedGroups}/12 গ্রুপ</span>
                          : null;
                    })()}
                    {[["R32","#10b981"],["R16","#3b82f6"],["QF","#8b5cf6"],["SF","#f59e0b"],["🏆","#fbbf24"]].map(([l,col])=>(
                      <span key={l} style={{padding:"2px 7px",background:`${col}18`,color:col,borderRadius:5,fontSize:9,fontWeight:700}}>{l}</span>
                    ))}
                  </div>
                </div>

                {/* ── ZOOM CONTROLS ── */}
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,padding:"8px 12px",background:T.card,border:`1px solid ${T.border}`,borderRadius:10}}>
                  <button onClick={()=>setBracketScale(s=>Math.max(0.3,+(s-0.1).toFixed(1)))}
                    style={{width:32,height:32,borderRadius:8,border:`1px solid ${T.border}`,background:T.acBg,color:c,cursor:"pointer",fontSize:18,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>−</button>
                  <div style={{flex:1,display:"flex",alignItems:"center",gap:8}}>
                    <input type="range" min="0.3" max="1.2" step="0.05" value={bracketScale}
                      onChange={e=>setBracketScale(+e.target.value)}
                      style={{flex:1,accentColor:c,cursor:"pointer",height:4}}/>
                    <span style={{fontSize:11,color:T.sub,minWidth:36,textAlign:"right"}}>{Math.round(bracketScale*100)}%</span>
                  </div>
                  <button onClick={()=>setBracketScale(s=>Math.min(1.2,+(s+0.1).toFixed(1)))}
                    style={{width:32,height:32,borderRadius:8,border:`1px solid ${T.border}`,background:T.acBg,color:c,cursor:"pointer",fontSize:18,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>+</button>
                  <button onClick={()=>setBracketScale(0.55)}
                    style={{padding:"4px 10px",borderRadius:7,border:`1px solid ${T.border}`,background:T.acBg,color:T.sub,cursor:"pointer",fontSize:10,flexShrink:0}}>রিসেট</button>
                </div>

                {/* ── MAIN BRACKET — pinch zoom + scroll ── */}
                <div style={{overflowX:"auto",overflowY:"hidden",paddingBottom:8,borderRadius:10,border:`1px solid ${T.border}`,background:dark?"rgba(0,0,0,.2)":"rgba(0,0,0,.03)",touchAction:"pan-x pan-y"}}>
                  <div style={{width:"fit-content",transformOrigin:"top left",transform:`scale(${bracketScale})`,transition:"transform .15s ease",padding:"8px 4px"}}>
                  <div style={{minWidth:900, display:"flex", alignItems:"center", gap:colGap, padding:"4px"}}>

                    {/* LEFT SIDE: R32 → R16 → QF → SF */}
                    <div style={{display:"flex",gap:colGap,alignItems:"center",flex:1}}>
                      {/* R32 left */}
                      <div style={{width:matchW,flexShrink:0}}>
                        <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:10,letterSpacing:2,color:"#10b981",textAlign:"center",marginBottom:5}}>ROUND OF 32</div>
                        <MatchColumn matches={leftR32} accent="#10b981" justify="space-around"/>
                      </div>
                      <Connector accent="#10b981"/>
                      {/* R16 left */}
                      <div style={{width:matchW,flexShrink:0}}>
                        <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:10,letterSpacing:2,color:"#3b82f6",textAlign:"center",marginBottom:5}}>ROUND OF 16</div>
                        <MatchColumn matches={leftR16} accent="#3b82f6" justify="space-around"/>
                      </div>
                      <Connector accent="#3b82f6"/>
                      {/* QF left */}
                      <div style={{width:matchW,flexShrink:0}}>
                        <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:10,letterSpacing:2,color:"#8b5cf6",textAlign:"center",marginBottom:5}}>QUARTER-FINAL</div>
                        <MatchColumn matches={leftQF} accent="#8b5cf6" justify="space-around"/>
                      </div>
                      <Connector accent="#8b5cf6"/>
                      {/* SF left */}
                      <div style={{width:matchW,flexShrink:0}}>
                        <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:10,letterSpacing:2,color:"#f59e0b",textAlign:"center",marginBottom:5}}>SEMI-FINAL</div>
                        <MatchColumn matches={leftSF} accent="#f59e0b" justify="center"/>
                      </div>
                      <Connector accent="#f59e0b"/>
                    </div>

                    {/* CENTER: FINAL + TROPHY */}
                    <div style={{flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center", gap:10, width:matchW+20}}>
                      <div style={{fontSize:32, animation:"pulse 3s infinite"}}>🏆</div>
                      <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:11,letterSpacing:2,color:"#fbbf24",textAlign:"center"}}>FINAL · Jul 19</div>
                      <MatchBox match={fin[0]} accent="#fbbf24" isFinal={true} showDate={false}/>
                      <div style={{width:"100%",height:1,background:"rgba(251,191,36,.2)"}}/>
                      <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:9,letterSpacing:1,color:"#6b7280",textAlign:"center"}}>3RD PLACE · Jul 18</div>
                      <MatchBox match={thirdP[0]} accent="#6b7280" showDate={false}/>
                    </div>

                    {/* RIGHT SIDE: SF → QF → R16 → R32 */}
                    <div style={{display:"flex",gap:colGap,alignItems:"center",flex:1,flexDirection:"row-reverse"}}>
                      {/* R32 right */}
                      <div style={{width:matchW,flexShrink:0}}>
                        <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:10,letterSpacing:2,color:"#10b981",textAlign:"center",marginBottom:5}}>ROUND OF 32</div>
                        <MatchColumn matches={rightR32} accent="#10b981" justify="space-around"/>
                      </div>
                      <Connector accent="#10b981"/>
                      {/* R16 right */}
                      <div style={{width:matchW,flexShrink:0}}>
                        <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:10,letterSpacing:2,color:"#3b82f6",textAlign:"center",marginBottom:5}}>ROUND OF 16</div>
                        <MatchColumn matches={rightR16} accent="#3b82f6" justify="space-around"/>
                      </div>
                      <Connector accent="#3b82f6"/>
                      {/* QF right */}
                      <div style={{width:matchW,flexShrink:0}}>
                        <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:10,letterSpacing:2,color:"#8b5cf6",textAlign:"center",marginBottom:5}}>QUARTER-FINAL</div>
                        <MatchColumn matches={rightQF} accent="#8b5cf6" justify="space-around"/>
                      </div>
                      <Connector accent="#8b5cf6"/>
                      {/* SF right */}
                      <div style={{width:matchW,flexShrink:0}}>
                        <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:10,letterSpacing:2,color:"#f59e0b",textAlign:"center",marginBottom:5}}>SEMI-FINAL</div>
                        <MatchColumn matches={rightSF} accent="#f59e0b" justify="center"/>
                      </div>
                      <Connector accent="#f59e0b"/>
                    </div>

                  </div>
                  </div>
                </div>

                {/* ── LEGEND ── */}
                <div style={{marginTop:10,padding:"8px 12px",background:T.card,border:`1px solid ${T.border}`,borderRadius:10,fontSize:11,color:T.sub,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <span>💡</span>
                  <span>− / + বা স্লাইডার দিয়ে zoom করুন · Pinch করেও zoom হবে · Scroll করে পুরো bracket দেখুন</span>
                </div>

                {/* ── GROUP STANDINGS QUICK VIEW ── */}
                <div style={{marginTop:16}}>
                  <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:14,letterSpacing:2,color:c,marginBottom:10}}>GROUP STANDINGS — দলের অবস্থান</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:8}}>
                    {Object.keys(GROUPS).map(grp => {
                      const rows = calcStandings(grp);
                      const fixes = ALL_GROUP_FIXTURES.filter(f=>f.grp===grp);
                      const played = fixes.filter(f=>{const r=results[f.id];return r&&r.h!==""&&r.a!==""&&!isNaN(+r.h)&&!isNaN(+r.a);}).length;
                      return (
                        <div key={grp} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 12px"}}>
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                            <span style={{fontFamily:"'Bebas Neue',cursive",fontSize:13,letterSpacing:2,color:c}}>GROUP {grp}</span>
                            <span style={{fontSize:9,color:played===6?"#10b981":T.sub}}>{played}/6 ম্যাচ</span>
                          </div>
                          {rows.slice(0,4).map((row,ri) => (
                            <div key={row.team} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 6px",background:ri<2?`${c}08`:"transparent",borderRadius:5,marginBottom:2,border:ri===0?`1px solid ${c}22`:ri===1?`1px solid ${c}11`:"1px solid transparent"}}>
                              <span style={{fontSize:9,color:ri<2?c:T.dim,fontWeight:700,minWidth:10}}>{ri+1}</span>
                              <span style={{fontSize:13}}>{FLAGS[row.team]||"🏳"}</span>
                              <span style={{fontSize:10,fontWeight:ri<2?700:400,color:ri<2?T.text:T.sub,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.team}</span>
                              <span style={{fontSize:11,fontFamily:"'Bebas Neue',cursive",color:ri<2?c:T.dim,fontWeight:700}}>{row.pts}</span>
                            </div>
                          ))}
                          {played===0&&<div style={{textAlign:"center",fontSize:9,color:T.dim,padding:"4px 0"}}>ম্যাচ শুরু হয়নি</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            );
            } catch(e) {
              console.error("Bracket render error:", e);
              return <div style={{padding:20,color:"#ef4444",fontSize:13}}>Bracket লোড করতে সমস্যা হয়েছে।</div>;
            }
          })()}

          {/* ═══ STADIUMS ═══ */}
          {tab==="stadiums" && (
            <div className="fi">
              <div style={{fontSize:12,color:T.sub,marginBottom:16}}>৩ দেশে ১৬টি বিশ্বমানের স্টেডিয়ামে ১০৪টি ম্যাচ।</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))",gap:10}}>
                {STADIUMS.map((s,i)=>(
                  <div key={i} className="stc" style={{background:T.card,border:`1px solid ${stadIdx===i?c:T.border}`,borderRadius:12,padding:"15px",cursor:"pointer",transition:"all .2s",boxShadow:T.sh}}
                    onClick={()=>setStadIdx(stadIdx===i?null:i)}>
                    <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:8}}>
                      <span style={{fontSize:26}}>{s.flag}</span>
                      <div>
                        <div style={{fontWeight:700,fontSize:14,color:T.text}}>{s.name}</div>
                        <div style={{fontSize:11,color:T.sub}}>{s.city}</div>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:6,marginBottom:stadIdx===i?10:0}}>
                      <span className="pill" style={{background:T.acBg,color:c}}>⚽ {s.matches} ম্যাচ</span>
                      <span className="pill" style={{background:T.pill,color:T.sub}}>👥 {s.cap.toLocaleString()}</span>
                    </div>
                    {stadIdx===i&&(
                      <div style={{marginTop:4,padding:"10px 12px",background:T.acBg,borderRadius:8,fontSize:12,color:T.sub,lineHeight:1.65,animation:"fadeIn .2s ease"}}>
                        <div style={{marginBottom:8}}>{s.note}</div>
                        <div style={{fontSize:11,fontWeight:700,color:c,marginBottom:6}}>এখানকার কিছু ম্যাচ:</div>
                        {ALL_GROUP_FIXTURES.filter(f=>f.venue.split(",")[0]===s.name).slice(0,4).map(f=>(
                          <div key={f.id} style={{fontSize:11,color:T.sub,padding:"3px 0",borderBottom:`1px solid ${T.border}`}}>
                            {FLAGS[f.home]||"🏳"} {f.home} vs {f.away} {FLAGS[f.away]||"🏳"} · {f.dateStr} · {bdTime(f.etTime)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ SQUADS ═══ */}
          {tab==="squads" && (
            <div className="fi">

              {/* ── Search bar ── */}
              <div style={{position:"relative",marginBottom:14}}>
                <span style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",fontSize:16,pointerEvents:"none"}}>🔍</span>
                <input
                  value={squadSearch}
                  onChange={e=>{setSquadSearch(e.target.value);if(e.target.value)setSquadTeam(null);}}
                  placeholder="দল বা খেলোয়াড় খুঁজুন… Brazil, Messi, Arsenal…"
                  style={{width:"100%",padding:"10px 38px 10px 36px",borderRadius:10,border:`1px solid ${T.border}`,background:T.card,color:T.text,fontSize:13,outline:"none",boxSizing:"border-box",boxShadow:T.sh}}
                />
                {squadSearch
                  ? <button onClick={()=>setSquadSearch("")} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:16,color:T.sub,lineHeight:1}}>✕</button>
                  : <button onClick={()=>document.querySelector('[placeholder*="দল বা খেলোয়াড়"]')?.focus()} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:c,border:"none",cursor:"pointer",fontSize:10,color:"#fff",borderRadius:6,padding:"3px 8px",fontWeight:700}}>Search</button>
                }
              </div>

              {/* ── Player / Team search results ── */}
              {squadSearch && (()=>{
                const q = squadSearch.toLowerCase().trim();
                const teamHits = Object.keys(SQUADS).filter(t=>t.toLowerCase().includes(q));
                const playerHits = [];
                Object.entries(SQUADS).forEach(([team,sq])=>{
                  sq.players.forEach(p=>{
                    if(p.name.toLowerCase().includes(q)||p.club.toLowerCase().includes(q))
                      playerHits.push({team,p});
                  });
                });
                const total = teamHits.length + playerHits.length;
                if(!total) return (
                  <div style={{textAlign:"center",padding:"36px 0",color:T.sub}}>
                    <div style={{fontSize:32,marginBottom:8}}>🔍</div>
                    <div style={{fontSize:13}}>"{squadSearch}" এর কোনো ফলাফল নেই</div>
                  </div>
                );
                return (
                  <div>
                    <div style={{fontSize:11,color:T.sub,marginBottom:10}}>{total}টি ফলাফল</div>
                    {teamHits.map(team=>(
                      <button key={team} onClick={()=>{setSquadTeam(team);setSquadSearch("");setSquadModal(true);}}
                        style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"11px 13px",borderRadius:10,border:`1px solid ${c}44`,background:T.acBg,cursor:"pointer",marginBottom:7,textAlign:"left"}}>
                        <span style={{fontSize:26}}>{FLAGS[team]||"🏳"}</span>
                        <div>
                          <div style={{fontSize:13,fontWeight:700,color:c}}>{team}</div>
                          <div style={{fontSize:10,color:T.sub}}>কোচ: {SQUADS[team].coach} · {SQUADS[team].players.length}জন</div>
                        </div>
                        <span style={{marginLeft:"auto",fontSize:11,color:c}}>→</span>
                      </button>
                    ))}
                    {playerHits.map(({team,p},i)=>(
                      <div key={i} onClick={()=>{setSquadTeam(team);setSquadSearch("");}}
                        style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:9,border:`1px solid ${T.border}`,background:T.card,marginBottom:5,cursor:"pointer",transition:"all .15s"}}>
                        <div style={{width:36,height:36,background:`${posColors[p.pos]||c}18`,border:`2px solid ${posColors[p.pos]||c}40`,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Bebas Neue',cursive",fontSize:13,color:posColors[p.pos]||c,flexShrink:0}}>{p.num}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,fontWeight:700,color:T.text}}>{p.name}</div>
                          <div style={{fontSize:10,color:T.sub}}>{p.pos} · {p.club}</div>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2,flexShrink:0}}>
                          <span style={{fontSize:18}}>{FLAGS[team]||"🏳"}</span>
                          <span style={{fontSize:9,color:T.dim}}>{team}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* ── Group-based team grid (when no search) ── */}
              {!squadSearch && (()=>{
                const groups = Object.keys(GROUPS);
                return (
                  <div>
                    {groups.map(grp=>{
                      const teams = GROUPS[grp];
                      return (
                        <div key={grp} style={{marginBottom:14}}>
                          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:7}}>
                            <span style={{fontFamily:"'Bebas Neue',cursive",fontSize:11,letterSpacing:2,color:c,background:T.acBg,border:`1px solid ${c}33`,borderRadius:5,padding:"2px 7px"}}>GROUP {grp}</span>
                            <div style={{flex:1,height:1,background:T.border+"66"}}/>
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:6}}>
                            {teams.map(team=>{
                              const active = squadTeam===team;
                              const isFav2 = favTeam===team;
                              return (
                                <button key={team} onClick={()=>{setSquadTeam(team);setSquadModal(true);}}
                                  style={{display:"flex",alignItems:"center",gap:8,padding:"9px 11px",borderRadius:9,
                                    border:`1px solid ${active?c:isFav2?"rgba(251,191,36,.4)":T.border}`,
                                    background:active?T.acBg:isFav2?"rgba(251,191,36,.05)":T.card,
                                    cursor:"pointer",textAlign:"left",transition:"all .15s",boxShadow:T.sh,
                                    borderLeft:active?`3px solid ${c}`:isFav2?"3px solid #fbbf24":"3px solid transparent",
                                  }}>
                                  <span style={{fontSize:22,flexShrink:0}}>{FLAGS[team]||"🏳"}</span>
                                  <div style={{flex:1,minWidth:0}}>
                                    <div style={{fontSize:11,fontWeight:700,color:active?c:isFav2?"#fbbf24":T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{team}</div>
                                    <div style={{fontSize:9,color:T.dim,marginTop:1}}>{SQUADS[team]?.players.length||0}জন</div>
                                  </div>
                                  {isFav2&&<span style={{fontSize:12}}>⭐</span>}
                                  {active&&<span style={{fontSize:11,color:c}}>▲</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {!squadSearch&&!squadTeam&&(
                <div style={{textAlign:"center",padding:"30px 0",color:T.sub}}>
                  <div style={{fontSize:36,marginBottom:8}}>👕</div>
                  <div style={{fontSize:13,color:T.text,fontWeight:600}}>একটি দল বেছে নিন</div>
                </div>
              )}

              {squadTeam&&SQUADS[squadTeam]&&(()=>{
                const sq=SQUADS[squadTeam];
                const grp=getTeamGroup(squadTeam);
                const byPos={GK:sq.players.filter(p=>p.pos==="GK"),DEF:sq.players.filter(p=>p.pos==="DEF"),MID:sq.players.filter(p=>p.pos==="MID"),FWD:sq.players.filter(p=>p.pos==="FWD")};
                const fixes=ALL_GROUP_FIXTURES.filter(f=>f.home===squadTeam||f.away===squadTeam);
                return (
                  <div className="fi">
                    <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20,flexWrap:"wrap"}}>
                      <span style={{fontSize:52,cursor:"pointer"}} onClick={()=>toggleFav(squadTeam)} title="প্রিয় দল সেট করুন">{FLAGS[squadTeam]||"🏳"}</span>
                      <div>
                        <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:30,color:c,letterSpacing:2,lineHeight:1}}>{squadTeam}</div>
                        <div style={{fontSize:12,color:T.sub,marginTop:3}}>কোচ: <span style={{color:T.text,fontWeight:600}}>{sq.coach}</span> · Group {grp}</div>
                        <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap",alignItems:"center"}}>
                          {Object.entries(byPos).map(([pos,pl])=>pl.length>0&&(
                            <span key={pos} className="pill" style={{background:posColors[pos]+"22",color:posColors[pos]}}>{pos} {pl.length}</span>
                          ))}
                          <span className="pill" style={{background:T.pill,color:T.sub}}>মোট {sq.players.length}জন</span>
                          <button onClick={()=>toggleFav(squadTeam)} style={{marginLeft:4,padding:"4px 10px",borderRadius:7,border:`1px solid ${favTeam===squadTeam?"rgba(251,191,36,.5)":T.border}`,background:favTeam===squadTeam?"rgba(251,191,36,.12)":T.card,color:favTeam===squadTeam?"#fbbf24":T.sub,fontSize:12,fontWeight:700,cursor:"pointer",transition:"all .2s"}}>
                            {favTeam===squadTeam?"⭐ প্রিয় দল":"☆ Favorite"}
                          </button>
                        </div>
                      </div>
                    </div>

                    {["GK","DEF","MID","FWD"].map(pos=>byPos[pos].length>0&&(
                      <div key={pos} style={{marginBottom:16}}>
                        <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:8}}>
                          <div style={{width:7,height:7,borderRadius:"50%",background:posColors[pos]}}/>
                          <span style={{fontSize:11,fontWeight:800,color:posColors[pos],letterSpacing:2,textTransform:"uppercase"}}>
                            {pos==="GK"?"গোলকিপার":pos==="DEF"?"ডিফেন্ডার":pos==="MID"?"মিডফিল্ডার":"ফরওয়ার্ড"} ({byPos[pos].length})
                          </span>
                        </div>
                        <div className="sq-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:6}}>
                          {byPos[pos].map((p,i)=>(
                            <div key={i} className="sc" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:9,padding:"9px 12px",display:"flex",alignItems:"center",gap:10,transition:"all .2s",boxShadow:T.sh}}>
                              <div style={{width:32,height:32,borderRadius:"50%",background:`${posColors[pos]}18`,border:`2px solid ${posColors[pos]}40`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Bebas Neue',cursive",fontSize:14,color:posColors[pos],flexShrink:0}}>{p.num}</div>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontWeight:700,fontSize:12,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",color:T.text}}>{p.name}</div>
                                <div style={{fontSize:10,color:T.sub,marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.club}</div>
                              </div>
                              <span className="pill" style={{background:posColors[pos]+"18",color:posColors[pos],flexShrink:0}}>{pos}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    <div style={{marginTop:6,padding:"14px 16px",background:T.acBg,border:`1px solid ${c}22`,borderRadius:12}}>
                      <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:15,letterSpacing:2,color:c,marginBottom:10}}>GROUP {grp} ম্যাচসূচি</div>
                      {fixes.map((fix,i)=>{
                        const isHome=fix.home===squadTeam;
                        const rs=results[fix.id];
                        const hasSc=rs&&rs.h!==""&&rs.a!==""&&!isNaN(+rs.h)&&!isNaN(+rs.a);
                        const isOvr=matchUTC(fix.dateStr,fix.etTime)+105*60000<Date.now();
                        const isLv=!isOvr&&matchUTC(fix.dateStr,fix.etTime)<Date.now();
                        const {time:bt,label:bl}=etToBD(fix.etTime);
                        return (
                          <div key={i} style={{borderRadius:8,overflow:"hidden",border:`1px solid ${hasSc?c+"33":T.border}`,marginBottom:4,background:T.card}}>
                            <div style={{display:"flex",alignItems:"center",padding:"7px 9px",gap:0}}>
                              <div style={{flexShrink:0,width:50,marginRight:5}}>
                                <div style={{background:dark?"#1e3a5f":"#1e40af",color:"#fff",borderRadius:4,padding:"2px 3px",textAlign:"center"}}>
                                  <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:9,lineHeight:1}}>{bdDateStr(fix.dateStr,fix.etTime)}</div>
                                </div>
                              </div>
                              <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"flex-end",gap:3,minWidth:0}}>
                                <span style={{fontSize:10,fontWeight:isHome?700:400,textAlign:"right",wordBreak:"break-word",lineHeight:1.2,color:hasSc&&+rs.h>+rs.a?c:isHome?c:T.text}}>{fix.home}</span>
                                <span style={{fontSize:17,flexShrink:0}}>{FLAGS[fix.home]||"🏳"}</span>
                              </div>
                              <div style={{flexShrink:0,width:64,textAlign:"center",padding:"0 2px"}}>
                                {hasSc?(
                                  <div style={{padding:"1px 0",borderRadius:4,background:isLv?"rgba(239,68,68,.15)":"rgba(16,185,129,.12)",border:`1px solid ${isLv?"#ef444466":c+"55"}`}}>
                                    <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:15,color:isLv?"#ef4444":c,lineHeight:1}}>{rs.h}:{rs.a}</div>
                                    <div style={{fontSize:6,color:isLv?"#ef4444":T.sub,fontWeight:800}}>{isOvr?"FT":"LIVE"}</div>
                                  </div>
                                ):(
                                  <div style={{padding:"1px 0",borderRadius:4,background:T.acBg,border:`1px solid ${c}22`}}>
                                    <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:9,color:c,lineHeight:1.3,whiteSpace:"nowrap"}}>{bl+" "+bt}</div>
                                    <div style={{fontSize:6,color:T.dim}}>BD সময়</div>
                                  </div>
                                )}
                              </div>
                              <div style={{flex:1,display:"flex",alignItems:"center",gap:3,minWidth:0}}>
                                <span style={{fontSize:17,flexShrink:0}}>{FLAGS[fix.away]||"🏳"}</span>
                                <span style={{fontSize:10,fontWeight:!isHome?700:400,wordBreak:"break-word",lineHeight:1.2,color:hasSc&&+rs.a>+rs.h?c:!isHome?c:T.text}}>{fix.away}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

          {tab==="myteam" && (
            <MyTeamTab T={T} c={c} dark={dark} favTeam={favTeam} setFavTeam={setFavTeam} results={results} />
          )}
        <div style={{textAlign:"center",padding:"14px",borderTop:`1px solid ${T.border}`,fontSize:11,color:T.dim}}>
          FIFA World Cup 2026 · সকল সময় বাংলাদেশ সময় (GMT+6) · Jun 11 – Jul 19, 2026 · ফলাফল প্রতি ৫ মিনিটে auto-update হয়
          {visitorCount && (
            <div style={{marginTop:6,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              <span style={{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 10px",background:T.acBg,borderRadius:999,border:`1px solid ${c}22`}}>
                <span style={{width:6,height:6,borderRadius:"50%",background:"#10b981",display:"inline-block",animation:"pulse 1s infinite"}}/>
                <span style={{color:c,fontWeight:700,fontSize:11}}>{visitorCount.toLocaleString()}</span>
                <span style={{color:T.sub,fontSize:10}}>জন ভিজিট করেছেন</span>
              </span>
            </div>
          )}
        </div>

      </div>

        {/* ── PREDICTION MODAL ── */}
        {predModal && createPortal(
          <div onClick={()=>setPredModal(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:10001,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)",padding:"0 16px"}}>
            <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:360,background:dark?"#0f1a0f":"#fff",borderRadius:20,padding:"22px 20px",boxShadow:"0 -8px 40px rgba(0,0,0,.5)",border:`1px solid ${c}33`}}>
              <div style={{textAlign:"center",marginBottom:16}}>
                <div style={{fontSize:28,marginBottom:4}}>🎯</div>
                <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:18,letterSpacing:2,color:c}}>আপনার Prediction</div>
                <div style={{fontSize:12,color:T.sub,marginTop:4}}>{predModal.home} vs {predModal.away}</div>
                <div style={{fontSize:11,color:T.dim}}>{bdTime(predModal.etTime)} · {bdDateStr(predModal.dateStr,predModal.etTime)}</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
                <div style={{flex:1,textAlign:"center"}}>
                  <div style={{fontSize:20,marginBottom:4}}>{FLAGS[predModal.home]||"🏳"}</div>
                  <div style={{fontSize:11,fontWeight:700,color:T.text,marginBottom:8}}>{predModal.home}</div>
                  <input type="number" min="0" max="20" value={predHome} onChange={e=>setPredHome(e.target.value)}
                    style={{width:60,height:50,textAlign:"center",fontSize:24,fontFamily:"'Bebas Neue',cursive",fontWeight:700,color:c,background:T.acBg,border:`2px solid ${c}55`,borderRadius:12,outline:"none",color:c}}/>
                </div>
                <div style={{fontSize:16,color:T.sub,fontWeight:700,paddingTop:20}}>–</div>
                <div style={{flex:1,textAlign:"center"}}>
                  <div style={{fontSize:20,marginBottom:4}}>{FLAGS[predModal.away]||"🏳"}</div>
                  <div style={{fontSize:11,fontWeight:700,color:T.text,marginBottom:8}}>{predModal.away}</div>
                  <input type="number" min="0" max="20" value={predAway} onChange={e=>setPredAway(e.target.value)}
                    style={{width:60,height:50,textAlign:"center",fontSize:24,fontFamily:"'Bebas Neue',cursive",fontWeight:700,color:c,background:T.acBg,border:`2px solid ${c}55`,borderRadius:12,outline:"none",color:c}}/>
                </div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setPredModal(null)} style={{flex:1,padding:"11px 0",borderRadius:10,border:`1px solid ${T.border}`,background:T.card,color:T.sub,cursor:"pointer",fontSize:13,fontWeight:600}}>বাতিল</button>
                <button onClick={()=>{ if(predHome===""||predAway==="") return; savePrediction(predModal.id,predHome,predAway); }}
                  style={{flex:2,padding:"11px 0",borderRadius:10,border:"none",background:c,color:"#fff",cursor:"pointer",fontSize:14,fontWeight:700,letterSpacing:.5,boxShadow:`0 4px 14px ${c}44`}}>
                  ✅ সেভ করুন
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* ── SHARE CARD MODAL ── */}
        {shareCardFix && createPortal(
          <div onClick={()=>setShareCardFix(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.8)",zIndex:10002,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(6px)",padding:"0 16px"}}>
            <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:360}}>
              {/* The card itself */}
              <div id="share-card" style={{background:`linear-gradient(135deg,#064e3b,#065f46 60%,#000e05)`,borderRadius:20,padding:"24px 20px",border:`1px solid ${c}44`,boxShadow:"0 20px 60px rgba(0,0,0,.6)",textAlign:"center"}}>
                <div style={{fontSize:10,color:"rgba(255,255,255,.5)",letterSpacing:3,fontWeight:700,marginBottom:14}}>FIFA WORLD CUP 2026</div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:14,marginBottom:14}}>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:40}}>{FLAGS[shareCardFix.home]||"🏳"}</div>
                    <div style={{fontSize:13,fontWeight:800,color:"#fff",marginTop:5,lineHeight:1.2}}>{shareCardFix.home}</div>
                  </div>
                  <div style={{textAlign:"center"}}>
                    {results[shareCardFix.id]?.h!=="" && results[shareCardFix.id]?.h!==undefined ? (
                      <div>
                        <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:36,color:c,lineHeight:1}}>{results[shareCardFix.id].h} – {results[shareCardFix.id].a}</div>
                        <div style={{fontSize:9,color:"rgba(255,255,255,.6)",marginTop:2}}>FULL TIME</div>
                      </div>
                    ) : (
                      <div>
                        <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:14,color:c}}>{bdTime(shareCardFix.etTime)}</div>
                        <div style={{fontSize:9,color:"rgba(255,255,255,.5)"}}>BD সময়</div>
                      </div>
                    )}
                    <div style={{fontSize:9,color:"rgba(255,255,255,.4)",marginTop:4}}>Grp {shareCardFix.grp} · {bdDateStr(shareCardFix.dateStr,shareCardFix.etTime)} 2026</div>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:40}}>{FLAGS[shareCardFix.away]||"🏳"}</div>
                    <div style={{fontSize:13,fontWeight:800,color:"#fff",marginTop:5,lineHeight:1.2}}>{shareCardFix.away}</div>
                  </div>
                </div>
                {predictions[shareCardFix.id] && (
                  <div style={{background:"rgba(255,255,255,.08)",borderRadius:10,padding:"8px 12px",marginBottom:10}}>
                    <div style={{fontSize:9,color:"rgba(255,255,255,.5)",marginBottom:4}}>আমার Prediction</div>
                    <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:18,color:"#a78bfa"}}>{predictions[shareCardFix.id].h} – {predictions[shareCardFix.id].a}</div>
                  </div>
                )}
                <div style={{fontSize:9,color:"rgba(255,255,255,.3)",marginTop:8}}>#FIFAWorldCup2026 #Bangladesh</div>
              </div>
              <div style={{display:"flex",gap:8,marginTop:12}}>
                <button onClick={()=>setShareCardFix(null)} style={{flex:1,padding:"11px 0",borderRadius:10,border:`1px solid rgba(255,255,255,.15)`,background:"rgba(255,255,255,.08)",color:"rgba(255,255,255,.7)",cursor:"pointer",fontSize:13}}>বন্ধ</button>
                <button onClick={()=>{
                  const fix=shareCardFix;
                  const r=results[fix.id];
                  const hasScore=r&&r.h!==""&&r.a!==""&&!isNaN(+r.h)&&!isNaN(+r.a);
                  const myP=predictions[fix.id];
                  const text=`⚽ FIFA World Cup 2026\n${FLAGS[fix.home]||""} ${fix.home} vs ${fix.away} ${FLAGS[fix.away]||""}\n📅 ${bdDateStr(fix.dateStr,fix.etTime)} 2026 | ${bdTime(fix.etTime)} BD সময়\n${hasScore?`📊 স্কোর: ${r.h}–${r.a}`:""}\n${myP?`🎯 আমার Prediction: ${myP.h}–${myP.a}`:""}\n📍 ${fix.venue.split(",")[0]}\n#FIFAWorldCup2026`;
                  if(navigator.share)navigator.share({title:"FIFA WC 2026",text});
                  else navigator.clipboard.writeText(text).then(()=>alert("ক্লিপবোর্ডে কপি হয়েছে!"));
                }} style={{flex:2,padding:"11px 0",borderRadius:10,border:"none",background:c,color:"#fff",cursor:"pointer",fontSize:14,fontWeight:700}}>
                  📤 শেয়ার করুন
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* ── SQUAD MODAL ── */}
        {squadModal && squadTeam && SQUADS[squadTeam] && createPortal(
          <div onClick={()=>setSquadModal(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:10000,display:"flex",alignItems:"flex-end",justifyContent:"center",backdropFilter:"blur(3px)"}} onMouseDown={()=>{ document.body.style.overflow=""; }}>
            <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:640,maxHeight:"85vh",overflow:"hidden",display:"flex",flexDirection:"column",background:dark?"#0f1a0f":"#fff",borderRadius:"20px 20px 0 0",boxShadow:"0 -8px 40px rgba(0,0,0,.5)"}}>
              <div style={{padding:"14px 16px 10px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
                <span style={{fontSize:36}}>{FLAGS[squadTeam]||"🏳"}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:20,color:c,letterSpacing:1.5,lineHeight:1}}>{squadTeam}</div>
                  <div style={{fontSize:10,color:T.sub,marginTop:1}}>কোচ: <b style={{color:T.text}}>{SQUADS[squadTeam].coach}</b> · Grp {getTeamGroup(squadTeam)} · {SQUADS[squadTeam].players.length}জন</div>
                </div>
                <button onClick={()=>toggleFav(squadTeam)} style={{padding:"5px 9px",borderRadius:7,border:`1px solid ${favTeam===squadTeam?"rgba(251,191,36,.5)":T.border}`,background:favTeam===squadTeam?"rgba(251,191,36,.1)":T.card,color:favTeam===squadTeam?"#fbbf24":T.sub,cursor:"pointer",fontSize:11,fontWeight:700,flexShrink:0}}>
                  {favTeam===squadTeam?"⭐ প্রিয়":"☆ Fav"}
                </button>
                <button onClick={()=>{setSquadModal(false);document.body.style.overflow="";}} style={{width:30,height:30,borderRadius:8,border:`1px solid ${T.border}`,background:T.card,color:T.sub,cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>✕</button>
              </div>
              <div style={{overflowY:"auto",padding:"12px 14px",flex:1}}>
                {(()=>{
                  const sq = SQUADS[squadTeam];
                  const posOrder = ["GK","DEF","MID","FWD"];
                  const pclr = {GK:"#f59e0b",DEF:"#3b82f6",MID:"#10b981",FWD:"#ef4444"};
                  return posOrder.map(pos => {
                    const players = sq.players.filter(p=>p.pos===pos);
                    if(!players.length) return null;
                    const pc = pclr[pos];
                    return (
                      <div key={pos} style={{marginBottom:12}}>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:7}}>
                          <div style={{width:7,height:7,borderRadius:"50%",background:pc}}/>
                          <span style={{fontSize:10,fontWeight:800,color:pc,letterSpacing:2}}>{pos}</span>
                          <span style={{fontSize:9,color:T.dim}}>({players.length})</span>
                          <div style={{flex:1,height:1,background:T.border+"55"}}/>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
                          {players.map((p,i)=>(
                            <div key={i} style={{display:"flex",alignItems:"center",gap:7,padding:"7px 9px",borderRadius:9,background:T.card,border:`1px solid ${T.border}`}}>
                              <div style={{width:28,height:28,borderRadius:7,background:`${pc}18`,border:`2px solid ${pc}40`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Bebas Neue',cursive",fontSize:12,color:pc,flexShrink:0}}>{p.num}</div>
                              <div style={{minWidth:0}}>
                                <div style={{fontSize:11,fontWeight:700,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
                                <div style={{fontSize:9,color:T.dim,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.club}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* ── BOTTOM NAV via Portal — renders directly in document.body, immune to any ancestor overflow/opacity/transform/backdrop-filter ── */}
        {createPortal(
          <div className="bottom-nav" style={{position:"fixed",bottom:0,left:0,right:0,background:dark?"rgba(6,15,8,.97)":"rgba(248,250,252,.97)",borderTop:`1px solid ${T.border}`,display:"flex",alignItems:"stretch",zIndex:9999,boxShadow:`0 -4px 20px ${c}18`,overflowX:"auto"}}>
            {[
              {k:"fixtures",icon:"📅",label:"Fixtures"},
              {k:"results",icon:"✅",label:"Results"},
              {k:"standings",icon:"📊",label:"Standings"},
              {k:"bracket",icon:"🗂️",label:"Bracket"},
              {k:"stadiums",icon:"🏟️",label:"Stadiums"},
              {k:"squads",icon:"👕",label:"Squads"},
              {k:"myteam",icon:"⭐",label:"আমার দল"},
            ].map(({k,icon,label})=>(
              <button key={k} className={`bottom-nav-btn${tab===k?" active":""}`} onClick={()=>setTab(k)}
                style={{color:tab===k?c:T.sub,flexShrink:0,minWidth:50}}>
                <span style={{fontSize:20,display:"block",transition:"transform .2s",transform:tab===k?"scale(1.15)":"scale(1)"}}>{icon}</span>
                <span style={{fontSize:9,fontWeight:tab===k?800:500,letterSpacing:.3}}>{label}</span>
                {tab===k&&<div style={{position:"absolute",bottom:0,left:"50%",transform:"translateX(-50%)",width:24,height:2,background:c,borderRadius:1}}/>}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
