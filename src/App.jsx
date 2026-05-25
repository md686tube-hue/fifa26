import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import TournamentJourneyMap from "./components/TournamentJourneyMap";
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
  const { time, label, nextDay } = etToBD(etTime);
  return label + " " + time + (nextDay ? " (+1)" : "");
}
function matchUTC(dateStr, etTime) {
  const months={Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
  const [mon, day] = dateStr.split(" ");
  const [h, m] = etTime.split(":").map(Number);
  return Date.UTC(2026, months[mon], Number(day), h + 4, m || 0, 0);
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
  Mexico:{coach:"Javier Aguirre",players:[
    {num:1,pos:"GK",name:"Guillermo Ochoa",club:"Club América"},
    {num:13,pos:"GK",name:"Luis Malagón",club:"Club América"},
    {num:22,pos:"GK",name:"Rodolfo Cota",club:"Cruz Azul"},
    {num:2,pos:"DEF",name:"Jorge Sánchez",club:"Ajax"},
    {num:3,pos:"DEF",name:"César Montes",club:"Espanyol"},
    {num:5,pos:"DEF",name:"Johan Vásquez",club:"Genoa"},
    {num:15,pos:"DEF",name:"Héctor Moreno",club:"Chivas"},
    {num:19,pos:"DEF",name:"Kevin Álvarez",club:"Pachuca"},
    {num:23,pos:"DEF",name:"Jesús Gallardo",club:"Club León"},
    {num:8,pos:"MID",name:"Orbelin Pineda",club:"AEK Athens"},
    {num:10,pos:"MID",name:"Edson Álvarez",club:"West Ham"},
    {num:14,pos:"MID",name:"Carlos Rodríguez",club:"Cruz Azul"},
    {num:18,pos:"MID",name:"Luis Romo",club:"Cruz Azul"},
    {num:20,pos:"MID",name:"Roberto Alvarado",club:"Chivas"},
    {num:7,pos:"FWD",name:"Henry Martín",club:"Club América"},
    {num:9,pos:"FWD",name:"Raúl Jiménez",club:"Fulham"},
    {num:11,pos:"FWD",name:"Alexis Vega",club:"Querétaro"},
    {num:17,pos:"FWD",name:"Santiago Giménez",club:"Feyenoord"},
    {num:22,pos:"FWD",name:"Hirving Lozano",club:"PSV"},
  ]},
  "South Africa":{coach:"Hugo Broos",players:[
    {num:1,pos:"GK",name:"Ronwen Williams",club:"Mamelodi Sundowns"},
    {num:16,pos:"GK",name:"Petros Mthembu",club:"Orlando Pirates"},
    {num:23,pos:"GK",name:"Veli Mothwa",club:"AmaZulu"},
    {num:2,pos:"DEF",name:"Tercious Musi",club:"Orlando Pirates"},
    {num:3,pos:"DEF",name:"Lyle Foster",club:"Burnley"},
    {num:5,pos:"DEF",name:"Teboho Mokoena",club:"Mamelodi Sundowns"},
    {num:6,pos:"DEF",name:"Mothobi Mvala",club:"Mamelodi Sundowns"},
    {num:15,pos:"DEF",name:"Siyanda Xulu",club:"Orlando Pirates"},
    {num:4,pos:"DEF",name:"Sifiso Hlanti",club:"Bidvest Wits"},
    {num:8,pos:"MID",name:"Bongani Zungu",club:"Royal AM"},
    {num:10,pos:"MID",name:"Themba Zwane",club:"Mamelodi Sundowns"},
    {num:14,pos:"MID",name:"Mpho Makitle",club:"Mamelodi Sundowns"},
    {num:17,pos:"MID",name:"Sipho Mbule",club:"Supersport United"},
    {num:20,pos:"MID",name:"Grant Kekana",club:"Mamelodi Sundowns"},
    {num:7,pos:"FWD",name:"Percy Tau",club:"Al-Ahly"},
    {num:9,pos:"FWD",name:"Evidence Makgopa",club:"Orlando Pirates"},
    {num:11,pos:"FWD",name:"Elias Mokwana",club:"Mamelodi Sundowns"},
    {num:18,pos:"FWD",name:"Oswin Appollis",club:"Polokwane City"},
    {num:19,pos:"FWD",name:"Lebo Mothiba",club:"Strasbourg"},
  ]},
  "South Korea":{coach:"Hong Myung-bo",players:[
    {num:1,pos:"GK",name:"Kim Seung-Gyu",club:"Jeonbuk Hyundai"},
    {num:21,pos:"GK",name:"Jo Hyeon-woo",club:"Ulsan HD"},
    {num:31,pos:"GK",name:"Song Bum-keun",club:"Suwon Samsung"},
    {num:3,pos:"DEF",name:"Kim Min-jae",club:"Bayern Munich"},
    {num:12,pos:"DEF",name:"Cho Yu-min",club:"Stuttgart"},
    {num:14,pos:"DEF",name:"Kim Moon-hwan",club:"Jeonbuk Hyundai"},
    {num:15,pos:"DEF",name:"Seol Young-woo",club:"Jeonbuk Hyundai"},
    {num:16,pos:"DEF",name:"Jens Castrop",club:"Freiburg"},
    {num:20,pos:"DEF",name:"Lee Tae-seok",club:"Daejeon Citizen"},
    {num:6,pos:"MID",name:"Bae Jun-ho",club:"Stoke City"},
    {num:7,pos:"MID",name:"Lee Jae-sung",club:"Mainz"},
    {num:8,pos:"MID",name:"Hwang In-beom",club:"Freiburg"},
    {num:11,pos:"MID",name:"Yang Hyun-jun",club:"Celtic"},
    {num:17,pos:"MID",name:"Hwang Hee-chan",club:"Wolves"},
    {num:19,pos:"MID",name:"Lee Kang-in",club:"PSG"},
    {num:7,pos:"FWD",name:"Son Heung-min",club:"LA FC"},
    {num:9,pos:"FWD",name:"Cho Gue-sung",club:"Middlesbrough"},
    {num:18,pos:"FWD",name:"Oh Hyeon-gyu",club:"Celtic"},
    {num:22,pos:"FWD",name:"Kwon Chang-hoon",club:"Jeonbuk Hyundai"},
  ]},
  "Czech Republic":{coach:"Miroslav Koubek",players:[
    {num:1,pos:"GK",name:"Jiří Staněk",club:"Sparta Prague"},
    {num:12,pos:"GK",name:"Jan Laštůvka",club:"Baník Ostrava"},
    {num:23,pos:"GK",name:"Tomáš Vaclík",club:"Slavia Prague"},
    {num:2,pos:"DEF",name:"Vladimír Coufal",club:"West Ham"},
    {num:3,pos:"DEF",name:"Jan Bořil",club:"Slavia Prague"},
    {num:4,pos:"DEF",name:"Ladislav Krejčí",club:"Sparta Prague"},
    {num:5,pos:"DEF",name:"David Pavelka",club:"Fatih Karagümrük"},
    {num:6,pos:"DEF",name:"Tomáš Holeš",club:"Slavia Prague"},
    {num:15,pos:"DEF",name:"Lukáš Holeš",club:"Slavia Prague"},
    {num:8,pos:"MID",name:"Tomáš Souček",club:"West Ham"},
    {num:10,pos:"MID",name:"Jan Kuchta",club:"Slavia Prague"},
    {num:16,pos:"MID",name:"Lukáš Sadílek",club:"Twente"},
    {num:20,pos:"MID",name:"Ondřej Lingr",club:"Feyenoord"},
    {num:22,pos:"MID",name:"Alex Kral",club:"Spartak Moscow"},
    {num:7,pos:"FWD",name:"Patrik Schick",club:"Bayer Leverkusen"},
    {num:9,pos:"FWD",name:"Tomáš Chorý",club:"Slavia Prague"},
    {num:11,pos:"FWD",name:"Adam Hložek",club:"Bayer Leverkusen"},
    {num:17,pos:"FWD",name:"Ondřej Lingr",club:"Feyenoord"},
    {num:18,pos:"FWD",name:"Martin Fillo",club:"Sparta Prague"},
  ]},
  Canada:{coach:"Jesse Marsch",players:[
    {num:1,pos:"GK",name:"Maxime Crépeau",club:"LA Galaxy"},
    {num:12,pos:"GK",name:"Dayne St Clair",club:"Minnesota United"},
    {num:18,pos:"GK",name:"Milan Borjan",club:"Red Star Belgrade"},
    {num:2,pos:"DEF",name:"Richie Laryea",club:"Toronto FC"},
    {num:3,pos:"DEF",name:"Alphonso Davies",club:"Bayern Munich"},
    {num:4,pos:"DEF",name:"Derek Cornelius",club:"Mallorca"},
    {num:5,pos:"DEF",name:"Kamal Miller",club:"Portland Timbers"},
    {num:6,pos:"DEF",name:"Steven Vitória",club:"Sporting CP"},
    {num:13,pos:"DEF",name:"Doneil Henry",club:"Vancouver Whitecaps"},
    {num:7,pos:"MID",name:"Stephen Eustaquio",club:"Porto"},
    {num:8,pos:"MID",name:"Samuel Piette",club:"CF Montréal"},
    {num:14,pos:"MID",name:"Atiba Hutchinson",club:"Besiktas"},
    {num:16,pos:"MID",name:"Ismael Koné",club:"Marseille"},
    {num:20,pos:"MID",name:"Jonathan David",club:"Lille"},
    {num:9,pos:"FWD",name:"Cyle Larin",club:"Mallorca"},
    {num:11,pos:"FWD",name:"Tajon Buchanan",club:"Club Brugge"},
    {num:15,pos:"FWD",name:"David Wotherspoon",club:"St Johnstone"},
    {num:17,pos:"FWD",name:"Liam Millar",club:"Mainz"},
    {num:19,pos:"FWD",name:"Lucas Cavallini",club:"Vancouver Whitecaps"},
  ]},
  "Bosnia & Herzegovina":{coach:"Sergej Barbarez",players:[
    {num:1,pos:"GK",name:"Nikola Vasilj",club:"St. Pauli"},
    {num:12,pos:"GK",name:"Martin Zlomislic",club:"Dinamo Zagreb"},
    {num:23,pos:"GK",name:"Osman Hadzikic",club:"NK Olimpija"},
    {num:2,pos:"DEF",name:"Amar Dedic",club:"RB Salzburg"},
    {num:3,pos:"DEF",name:"Nikola Katic",club:"Hajduk Split"},
    {num:4,pos:"DEF",name:"Tarik Muharemovic",club:"Internacional"},
    {num:5,pos:"DEF",name:"Sead Kolasinac",club:"Atalanta"},
    {num:6,pos:"DEF",name:"Dennis Hadzikadunic",club:"Rennes"},
    {num:16,pos:"DEF",name:"Nihad Mujakic",club:"Bayer Leverkusen"},
    {num:8,pos:"MID",name:"Amir Hadziahmetovic",club:"Kasımpaşa"},
    {num:10,pos:"MID",name:"Dzenis Burnic",club:"Fortuna Düsseldorf"},
    {num:14,pos:"MID",name:"Ivan Sunjic",club:"Hertha BSC"},
    {num:15,pos:"MID",name:"Benjamin Tahirovic",club:"Ajax"},
    {num:20,pos:"MID",name:"Esmir Bajraktarevic",club:"New England Revolution"},
    {num:9,pos:"FWD",name:"Edin Džeko",club:"Fenerbahçe"},
    {num:7,pos:"FWD",name:"Haris Tabakovic",club:"Hertha BSC"},
    {num:11,pos:"FWD",name:"Ermedin Demirovic",club:"Stuttgart"},
    {num:19,pos:"FWD",name:"Samed Bazdar",club:"VfL Osnabrück"},
    {num:22,pos:"FWD",name:"Jovo Lukic",club:"Eintracht Frankfurt"},
  ]},
  Qatar:{coach:"Julen Lopetegui",players:[
    {num:1,pos:"GK",name:"Meshaal Barsham",club:"Al-Sadd"},
    {num:13,pos:"GK",name:"Yousef Hassan",club:"Al-Gharafa"},
    {num:22,pos:"GK",name:"Saad Al-Sheeb",club:"Al-Sadd"},
    {num:6,pos:"DEF",name:"Boualem Khoukhi",club:"Al-Sadd"},
    {num:5,pos:"DEF",name:"Bassam Al-Rawi",club:"Al-Sadd"},
    {num:3,pos:"DEF",name:"Tarek Salman",club:"Al-Arabi"},
    {num:13,pos:"DEF",name:"Abdelkarim Hassan",club:"Al-Sadd"},
    {num:16,pos:"DEF",name:"Homam Al-Amin",club:"Al-Sadd"},
    {num:21,pos:"DEF",name:"Pedro Miguel",club:"Al-Duhail"},
    {num:7,pos:"MID",name:"Salem Al-Hajri",club:"Al-Arabi"},
    {num:8,pos:"MID",name:"Karim Boudiaf",club:"Al-Duhail"},
    {num:12,pos:"MID",name:"Assim Madibo",club:"FC Dallas"},
    {num:14,pos:"MID",name:"Mohammed Waad",club:"Al-Duhail"},
    {num:20,pos:"MID",name:"Ismail Mohammed",club:"Al-Wakra"},
    {num:10,pos:"FWD",name:"Hassan Al-Haydos",club:"Al-Sadd"},
    {num:11,pos:"FWD",name:"Akram Afif",club:"Al-Sadd"},
    {num:17,pos:"FWD",name:"Yusuf Abdurisag",club:"Al-Gharafa"},
    {num:19,pos:"FWD",name:"Almoez Ali",club:"Al-Duhail"},
    {num:9,pos:"FWD",name:"Mohammed Muntari",club:"Al-Duhail"},
  ]},
  Switzerland:{coach:"Murat Yakin",players:[
    {num:1,pos:"GK",name:"Gregor Kobel",club:"Borussia Dortmund"},
    {num:12,pos:"GK",name:"Yvon Mvogo",club:"Lorient"},
    {num:21,pos:"GK",name:"Marvin Keller",club:"Grasshoppers"},
    {num:2,pos:"DEF",name:"Silvan Widmer",club:"Mainz"},
    {num:3,pos:"DEF",name:"Miro Muheim",club:"HSV"},
    {num:4,pos:"DEF",name:"Nico Elvedi",club:"Borussia M'gladbach"},
    {num:5,pos:"DEF",name:"Manuel Akanji",club:"Man City"},
    {num:6,pos:"DEF",name:"Eray Comert",club:"Valencia"},
    {num:13,pos:"DEF",name:"Ricardo Rodríguez",club:"Torino"},
    {num:8,pos:"MID",name:"Remo Freuler",club:"Bologna"},
    {num:10,pos:"MID",name:"Granit Xhaka",club:"Sunderland"},
    {num:15,pos:"MID",name:"Denis Zakaria",club:"Chelsea"},
    {num:16,pos:"MID",name:"Djibril Sow",club:"Eintracht Frankfurt"},
    {num:19,pos:"MID",name:"Fabian Rieder",club:"Stade Rennais"},
    {num:7,pos:"FWD",name:"Breel Embolo",club:"Monaco"},
    {num:9,pos:"FWD",name:"Zeki Amdouni",club:"Burnley"},
    {num:11,pos:"FWD",name:"Noah Okafor",club:"AC Milan"},
    {num:17,pos:"FWD",name:"Dan Ndoye",club:"Bologna"},
    {num:18,pos:"FWD",name:"Cedric Itten",club:"Young Boys"},
  ]},
  Brazil:{coach:"Carlo Ancelotti",players:[
    {num:1,pos:"GK",name:"Alisson",club:"Liverpool"},
    {num:12,pos:"GK",name:"Weverton",club:"Palmeiras"},
    {num:23,pos:"GK",name:"Ederson",club:"Man City"},
    {num:2,pos:"DEF",name:"Danilo",club:"Juventus"},
    {num:3,pos:"DEF",name:"Alex Sandro",club:"Juventus"},
    {num:4,pos:"DEF",name:"Marquinhos",club:"PSG"},
    {num:5,pos:"DEF",name:"Gabriel Magalhães",club:"Arsenal"},
    {num:6,pos:"DEF",name:"Bremer",club:"Juventus"},
    {num:13,pos:"DEF",name:"Wesley",club:"Flamengo"},
    {num:8,pos:"MID",name:"Casemiro",club:"Man United"},
    {num:10,pos:"MID",name:"Lucas Paquetá",club:"West Ham"},
    {num:14,pos:"MID",name:"Fabinho",club:"Al-Ittihad"},
    {num:16,pos:"MID",name:"Danilo Santos",club:"Nottm Forest"},
    {num:17,pos:"MID",name:"Bruno Guimarães",club:"Newcastle"},
    {num:7,pos:"FWD",name:"Vinicius Jr",club:"Real Madrid"},
    {num:9,pos:"FWD",name:"Gabriel Martinelli",club:"Arsenal"},
    {num:10,pos:"FWD",name:"Neymar",club:"Al-Hilal"},
    {num:11,pos:"FWD",name:"Raphinha",club:"Barcelona"},
    {num:18,pos:"FWD",name:"Matheus Cunha",club:"Wolves"},
    {num:19,pos:"FWD",name:"Endrick",club:"Real Madrid"},
  ]},
  Morocco:{coach:"Walid Regragui",players:[
    {num:1,pos:"GK",name:"Yassine Bounou",club:"Al-Hilal"},
    {num:12,pos:"GK",name:"Ahmed Tagnaouti",club:"FUS Rabat"},
    {num:16,pos:"GK",name:"Munir Mohamedi",club:"RC Celta"},
    {num:2,pos:"DEF",name:"Achraf Hakimi",club:"PSG"},
    {num:3,pos:"DEF",name:"Noussair Mazraoui",club:"Bayern Munich"},
    {num:5,pos:"DEF",name:"Nayef Aguerd",club:"West Ham"},
    {num:6,pos:"DEF",name:"Romain Saïss",club:"Besiktas"},
    {num:13,pos:"DEF",name:"Yahia Attiyat Allah",club:"Wydad"},
    {num:14,pos:"DEF",name:"Samy Mmaee",club:"Ferencváros"},
    {num:4,pos:"MID",name:"Sofyan Amrabat",club:"Fiorentina"},
    {num:7,pos:"MID",name:"Hakim Ziyech",club:"Galatasaray"},
    {num:8,pos:"MID",name:"Ilias Chair",club:"QPR"},
    {num:17,pos:"MID",name:"Azzedine Ounahi",club:"Marseille"},
    {num:20,pos:"MID",name:"Bilal El Khannouss",club:"Leicester"},
    {num:9,pos:"FWD",name:"Abdessamad Ezzalzouli",club:"Real Betis"},
    {num:11,pos:"FWD",name:"Soufiane Boufal",club:"Angers"},
    {num:15,pos:"FWD",name:"Abde Ait",club:"Club Brugge"},
    {num:18,pos:"FWD",name:"Ayoub El Kaabi",club:"Olympiacos"},
    {num:19,pos:"FWD",name:"Youssef En-Nesyri",club:"Fenerbahçe"},
  ]},
  Haiti:{coach:"Sébastien Migné",players:[
    {num:1,pos:"GK",name:"Johny Placide",club:"Zulte Waregem"},
    {num:18,pos:"GK",name:"Alexandre Pierre",club:"Cavalier FC"},
    {num:22,pos:"GK",name:"Josue Duverger",club:"Sporting Kansas City"},
    {num:3,pos:"DEF",name:"Carlens Arcus",club:"PAOK"},
    {num:4,pos:"DEF",name:"Duke Lacroix",club:"Viborg"},
    {num:5,pos:"DEF",name:"Jean-Kevin Duverne",club:"Young Boys"},
    {num:6,pos:"DEF",name:"Hannes Delcroix",club:"Anderlecht"},
    {num:13,pos:"DEF",name:"Keeto Thermoncy",club:"Épinal"},
    {num:16,pos:"DEF",name:"Wilguens Paugain",club:"Valenciennes"},
    {num:8,pos:"MID",name:"Danley Jean Jacques",club:"Al Ittifaq"},
    {num:10,pos:"MID",name:"Jean-Ricner Bellegarde",club:"Strasbourg"},
    {num:14,pos:"MID",name:"Leverton Pierre",club:"Portland Timbers"},
    {num:17,pos:"MID",name:"Carl Sainte",club:"Valenciennes"},
    {num:20,pos:"MID",name:"Woodensky Pierre",club:"Havre"},
    {num:7,pos:"FWD",name:"Derrick Etienne Jr",club:"Columbus Crew"},
    {num:9,pos:"FWD",name:"Wilson Isidor",club:"Celtic"},
    {num:11,pos:"FWD",name:"Duckens Nazon",club:"Dijon"},
    {num:15,pos:"FWD",name:"Josue Casimir",club:"Charlotte FC"},
    {num:19,pos:"FWD",name:"Frantzdy Pierrot",club:"Inter Miami"},
  ]},
  Scotland:{coach:"Steve Clarke",players:[
    {num:1,pos:"GK",name:"Angus Gunn",club:"Norwich City"},
    {num:12,pos:"GK",name:"Liam Kelly",club:"Middlesbrough"},
    {num:13,pos:"GK",name:"Craig Gordon",club:"Hearts"},
    {num:2,pos:"DEF",name:"Anthony Ralston",club:"Celtic"},
    {num:3,pos:"DEF",name:"Andy Robertson",club:"Liverpool"},
    {num:4,pos:"DEF",name:"Scott McKenna",club:"Nottm Forest"},
    {num:5,pos:"DEF",name:"Kieran Tierney",club:"Arsenal"},
    {num:6,pos:"DEF",name:"John Souttar",club:"Rangers"},
    {num:14,pos:"DEF",name:"Jack Hendry",club:"Club Brugge"},
    {num:8,pos:"MID",name:"Scott McTominay",club:"Napoli"},
    {num:7,pos:"MID",name:"John McGinn",club:"Aston Villa"},
    {num:10,pos:"MID",name:"Kenny McLean",club:"Norwich City"},
    {num:11,pos:"MID",name:"Billy Gilmour",club:"Brighton"},
    {num:18,pos:"MID",name:"Ryan Christie",club:"Bournemouth"},
    {num:9,pos:"FWD",name:"Lawrence Shankland",club:"Hearts"},
    {num:17,pos:"FWD",name:"Che Adams",club:"Torino"},
    {num:22,pos:"FWD",name:"Ross Stewart",club:"Sunderland"},
    {num:23,pos:"FWD",name:"Lyndon Dykes",club:"QPR"},
    {num:19,pos:"FWD",name:"Lewis Ferguson",club:"Bologna"},
  ]},
  USA:{coach:"Mauricio Pochettino",players:[
    {num:1,pos:"GK",name:"Matt Turner",club:"Nottm Forest"},
    {num:12,pos:"GK",name:"Ethan Horvath",club:"Luton Town"},
    {num:18,pos:"GK",name:"Patrick Schulte",club:"Columbus Crew"},
    {num:2,pos:"DEF",name:"Sergiño Dest",club:"PSV"},
    {num:3,pos:"DEF",name:"Antonee Robinson",club:"Arsenal"},
    {num:5,pos:"DEF",name:"Chris Richards",club:"Crystal Palace"},
    {num:6,pos:"DEF",name:"Walker Zimmermann",club:"Nashville SC"},
    {num:14,pos:"DEF",name:"Cameron Carter-Vickers",club:"Celtic"},
    {num:15,pos:"DEF",name:"Joe Scally",club:"Borussia M'gladbach"},
    {num:4,pos:"MID",name:"Tyler Adams",club:"Bournemouth"},
    {num:7,pos:"MID",name:"Weston McKennie",club:"Juventus"},
    {num:8,pos:"MID",name:"Yunus Musah",club:"AC Milan"},
    {num:11,pos:"MID",name:"Brenden Aaronson",club:"Leeds United"},
    {num:17,pos:"MID",name:"Gio Reyna",club:"Nottm Forest"},
    {num:9,pos:"FWD",name:"Ricardo Pepi",club:"PSV"},
    {num:10,pos:"FWD",name:"Christian Pulisic",club:"AC Milan"},
    {num:13,pos:"FWD",name:"Folarin Balogun",club:"Monaco"},
    {num:21,pos:"FWD",name:"Tim Weah",club:"Juventus"},
    {num:22,pos:"FWD",name:"Josh Sargent",club:"Norwich City"},
  ]},
  Paraguay:{coach:"Gustavo Alfaro",players:[
    {num:1,pos:"GK",name:"Gastón Fernández",club:"Olimpia"},
    {num:12,pos:"GK",name:"Antony Silva",club:"Olimpia"},
    {num:23,pos:"GK",name:"Alan Benítez",club:"Cerro Porteño"},
    {num:2,pos:"DEF",name:"Alex Duarte",club:"San Lorenzo"},
    {num:3,pos:"DEF",name:"Blas Riveros",club:"FC Basel"},
    {num:4,pos:"DEF",name:"Júnior Alonso",club:"Atlético Mineiro"},
    {num:5,pos:"DEF",name:"Gustavo Gómez",club:"Palmeiras"},
    {num:6,pos:"DEF",name:"Omar Alderete",club:"Valencia"},
    {num:14,pos:"DEF",name:"Diego Viera",club:"Olimpia"},
    {num:7,pos:"MID",name:"Diego León",club:"Man United"},
    {num:8,pos:"MID",name:"Rodrigo Rojas",club:"Racing Club"},
    {num:10,pos:"MID",name:"Miguel Almirón",club:"Atlanta United"},
    {num:15,pos:"MID",name:"Gabriel Villarreal",club:"Olimpia"},
    {num:16,pos:"MID",name:"Andrés Cubas",club:"Lens"},
    {num:9,pos:"FWD",name:"Antonio Sanabria",club:"Torino"},
    {num:11,pos:"FWD",name:"Julio Enciso",club:"Brighton"},
    {num:17,pos:"FWD",name:"Ángel Romero",club:"Corinthians"},
    {num:19,pos:"FWD",name:"Darío Lezcano",club:"Olimpia"},
    {num:22,pos:"FWD",name:"Carlos González",club:"Washington DC"},
  ]},
  Australia:{coach:"Tony Popovic",players:[
    {num:1,pos:"GK",name:"Mathew Ryan",club:"Stade de Reims"},
    {num:12,pos:"GK",name:"Thomas Glover",club:"Midtjylland"},
    {num:18,pos:"GK",name:"Danny Vukovic",club:"Central Coast Mariners"},
    {num:2,pos:"DEF",name:"Milos Degenek",club:"Columbus Crew"},
    {num:3,pos:"DEF",name:"Aziz Behich",club:"Dundee Utd"},
    {num:5,pos:"DEF",name:"Kye Rowles",club:"Hearts"},
    {num:6,pos:"DEF",name:"Aleksandar Susnjar",club:"Red Star Belgrade"},
    {num:16,pos:"DEF",name:"Nathaniel Atkinson",club:"Hearts"},
    {num:19,pos:"DEF",name:"Ryan Strain",club:"Cádiz"},
    {num:7,pos:"MID",name:"Riley McGree",club:"Middlesbrough"},
    {num:8,pos:"MID",name:"Jackson Irvine",club:"St Pauli"},
    {num:10,pos:"MID",name:"Tom Rogic",club:"West Brom"},
    {num:14,pos:"MID",name:"Denis Genreau",club:"Toulouse"},
    {num:20,pos:"MID",name:"Lachlan Wales",club:"Western United"},
    {num:9,pos:"FWD",name:"Mitch Duke",club:"Fagiano Okayama"},
    {num:11,pos:"FWD",name:"Martin Boyle",club:"Hibernian"},
    {num:13,pos:"FWD",name:"Adam Taggart",club:"Central Coast Mariners"},
    {num:17,pos:"FWD",name:"Mathew Leckie",club:"Melbourne City"},
    {num:22,pos:"FWD",name:"Jason Cummings",club:"Central Coast Mariners"},
  ]},
  Turkey:{coach:"Vincenzo Montella",players:[
    {num:1,pos:"GK",name:"Uğurcan Çakır",club:"Trabzonspor"},
    {num:12,pos:"GK",name:"Altay Bayındır",club:"Man United"},
    {num:23,pos:"GK",name:"Mert Günok",club:"Beşiktaş"},
    {num:2,pos:"DEF",name:"Zeki Çelik",club:"Roma"},
    {num:3,pos:"DEF",name:"Merih Demiral",club:"Al-Qadsiah"},
    {num:5,pos:"DEF",name:"Ozan Kabak",club:"Hoffenheim"},
    {num:6,pos:"DEF",name:"İbrahim Drešević",club:"Lugano"},
    {num:15,pos:"DEF",name:"Ferdi Kadıoğlu",club:"Brighton"},
    {num:17,pos:"DEF",name:"Mert Müldür",club:"Sassuolo"},
    {num:4,pos:"MID",name:"Kaan Ayhan",club:"Galatasaray"},
    {num:8,pos:"MID",name:"Hakan Çalhanoğlu",club:"Inter Milan"},
    {num:10,pos:"MID",name:"Salih Özcan",club:"Borussia Dortmund"},
    {num:11,pos:"MID",name:"Yusuf Yazıcı",club:"Lille"},
    {num:16,pos:"MID",name:"Barış Alper Yılmaz",club:"Galatasaray"},
    {num:7,pos:"FWD",name:"Kenan Yıldız",club:"Juventus"},
    {num:10,pos:"FWD",name:"Arda Güler",club:"Real Madrid"},
    {num:14,pos:"FWD",name:"Cengiz Ünder",club:"Marseille"},
    {num:9,pos:"FWD",name:"Serdar Dursun",club:"Darmstadt"},
    {num:22,pos:"FWD",name:"Berat Özdemir",club:"Trabzonspor"},
  ]},
  Germany:{coach:"Julian Nagelsmann",players:[
    {num:1,pos:"GK",name:"Manuel Neuer",club:"Bayern Munich"},
    {num:12,pos:"GK",name:"Oliver Baumann",club:"Hoffenheim"},
    {num:23,pos:"GK",name:"Alexander Nubel",club:"Stuttgart"},
    {num:2,pos:"DEF",name:"Antonio Rüdiger",club:"Real Madrid"},
    {num:3,pos:"DEF",name:"Nico Schlotterbeck",club:"Borussia Dortmund"},
    {num:4,pos:"DEF",name:"Jonathan Tah",club:"Bayer Leverkusen"},
    {num:5,pos:"DEF",name:"Malick Thiaw",club:"AC Milan"},
    {num:6,pos:"DEF",name:"Joshua Kimmich",club:"Bayern Munich"},
    {num:14,pos:"DEF",name:"Pascal Gross",club:"Borussia Dortmund"},
    {num:7,pos:"MID",name:"Jamal Musiala",club:"Bayern Munich"},
    {num:8,pos:"MID",name:"Leon Goretzka",club:"Bayern Munich"},
    {num:10,pos:"MID",name:"Florian Wirtz",club:"Bayer Leverkusen"},
    {num:11,pos:"MID",name:"Leroy Sané",club:"Bayern Munich"},
    {num:16,pos:"MID",name:"Aleksandar Pavlovic",club:"Bayern Munich"},
    {num:9,pos:"FWD",name:"Kai Havertz",club:"Arsenal"},
    {num:13,pos:"FWD",name:"Denis Undav",club:"Stuttgart"},
    {num:17,pos:"FWD",name:"Nick Woltemade",club:"Stuttgart"},
    {num:18,pos:"FWD",name:"Angelo Stiller",club:"Stuttgart"},
    {num:19,pos:"FWD",name:"Maximilian Beier",club:"Borussia Dortmund"},
  ]},
  "Curaçao":{coach:"Dick Advocaat",players:[
    {num:1,pos:"GK",name:"Eloy Room",club:"Columbus Crew"},
    {num:12,pos:"GK",name:"Trevor Doornbusch",club:"Twente"},
    {num:22,pos:"GK",name:"Tyrick Bodak",club:"Almere City"},
    {num:2,pos:"DEF",name:"Jurien Gaari",club:"OH Leuven"},
    {num:3,pos:"DEF",name:"Sherel Floranus",club:"Twente"},
    {num:4,pos:"DEF",name:"Shurandy Sambo",club:"FC Utrecht"},
    {num:5,pos:"DEF",name:"Roshon van Eijma",club:"PEC Zwolle"},
    {num:6,pos:"DEF",name:"Joshua Brenet",club:"Twente"},
    {num:13,pos:"DEF",name:"Armando Obispo",club:"PSV"},
    {num:8,pos:"MID",name:"Leandro Bacuna",club:"Reading"},
    {num:10,pos:"MID",name:"Juninho Bacuna",club:"Birmingham City"},
    {num:16,pos:"MID",name:"Livano Comenencia",club:"Almere City"},
    {num:17,pos:"MID",name:"Tyrese Noslin",club:"Lazio"},
    {num:20,pos:"MID",name:"Godfried Roemeratoe",club:"Ajax"},
    {num:7,pos:"FWD",name:"Sontje Hansen",club:"Ajax"},
    {num:9,pos:"FWD",name:"Kenji Gorre",club:"NAC Breda"},
    {num:11,pos:"FWD",name:"Brandley Kuwas",club:"Twente"},
    {num:14,pos:"FWD",name:"Jurgen Locadia",club:"Beerschot"},
    {num:19,pos:"FWD",name:"Tahith Chong",club:"Burnley"},
  ]},
  "Ivory Coast":{coach:"Emerse Faé",players:[
    {num:1,pos:"GK",name:"Yahia Fofana",club:"Leicester"},
    {num:16,pos:"GK",name:"Alban Lafont",club:"Nantes"},
    {num:23,pos:"GK",name:"Mohamed Kone",club:"Amiens"},
    {num:2,pos:"DEF",name:"Wilfried Singo",club:"Monaco"},
    {num:3,pos:"DEF",name:"Ghislain Konan",club:"Stade de Reims"},
    {num:4,pos:"DEF",name:"Evan Ndicka",club:"Roma"},
    {num:5,pos:"DEF",name:"Odilon Kossounou",club:"Bayer Leverkusen"},
    {num:6,pos:"DEF",name:"Emmanuel Agbadou",club:"Stade de Reims"},
    {num:15,pos:"DEF",name:"Ousmane Diomande",club:"Sporting CP"},
    {num:8,pos:"MID",name:"Franck Kessié",club:"Al-Ahli"},
    {num:10,pos:"MID",name:"Jean Michael Seri",club:"Galatasaray"},
    {num:11,pos:"MID",name:"Simon Adingra",club:"Brighton"},
    {num:14,pos:"MID",name:"Seko Fofana",club:"Al-Nassr"},
    {num:20,pos:"MID",name:"Ibrahim Sangaré",club:"Nottm Forest"},
    {num:7,pos:"FWD",name:"Nicolas Pépé",club:"Trabzonspor"},
    {num:9,pos:"FWD",name:"Elye Wahi",club:"Eintracht Frankfurt"},
    {num:17,pos:"FWD",name:"Amad Diallo",club:"Man United"},
    {num:19,pos:"FWD",name:"Ange Yoan Bonny",club:"Parma"},
    {num:22,pos:"FWD",name:"Sébastien Haller",club:"Borussia Dortmund"},
  ]},
  Ecuador:{coach:"Sebastián Beccacece",players:[
    {num:1,pos:"GK",name:"Hernán Galíndez",club:"Aucas"},
    {num:12,pos:"GK",name:"Alexander Domínguez",club:"Liga de Quito"},
    {num:23,pos:"GK",name:"Wellington Ramírez",club:"Independiente del Valle"},
    {num:2,pos:"DEF",name:"Byron Castillo",club:"Liga de Quito"},
    {num:3,pos:"DEF",name:"Piero Hincapié",club:"Bayer Leverkusen"},
    {num:4,pos:"DEF",name:"Robert Arboleda",club:"São Paulo"},
    {num:5,pos:"DEF",name:"Félix Torres",club:"Santos Laguna"},
    {num:6,pos:"DEF",name:"Enner Valencia",club:"Internacional"},
    {num:22,pos:"DEF",name:"Angelo Preciado",club:"Genk"},
    {num:7,pos:"MID",name:"Romario Ibarra",club:"Pachuca"},
    {num:8,pos:"MID",name:"Carlos Gruezo",club:"FC Augsburg"},
    {num:10,pos:"MID",name:"Moisés Caicedo",club:"Chelsea"},
    {num:14,pos:"MID",name:"Jeremy Sarmiento",club:"Brighton"},
    {num:16,pos:"MID",name:"Gonzalo Plata",club:"Valladolid"},
    {num:9,pos:"FWD",name:"Leonardo Campana",club:"Inter Miami"},
    {num:11,pos:"FWD",name:"Kevin Rodríguez",club:"Ipswich Town"},
    {num:17,pos:"FWD",name:"Alan Minda",club:"Famalicão"},
    {num:18,pos:"FWD",name:"Djorkaeff Reasco",club:"Nottm Forest"},
    {num:19,pos:"FWD",name:"Michael Estrada",club:"Cruz Azul"},
  ]},
  Netherlands:{coach:"Ronald Koeman",players:[
    {num:1,pos:"GK",name:"Bart Verbruggen",club:"Brighton"},
    {num:13,pos:"GK",name:"Justin Bijlow",club:"Feyenoord"},
    {num:22,pos:"GK",name:"Mark Flekken",club:"Brentford"},
    {num:2,pos:"DEF",name:"Jurriën Timber",club:"Arsenal"},
    {num:3,pos:"DEF",name:"Matthijs de Ligt",club:"Bayern Munich"},
    {num:4,pos:"DEF",name:"Virgil van Dijk",club:"Liverpool"},
    {num:5,pos:"DEF",name:"Nathan Aké",club:"Man City"},
    {num:6,pos:"DEF",name:"Stefan de Vrij",club:"Inter Milan"},
    {num:22,pos:"DEF",name:"Denzel Dumfries",club:"Inter Milan"},
    {num:8,pos:"MID",name:"Tijjani Reijnders",club:"AC Milan"},
    {num:10,pos:"MID",name:"Xavi Simons",club:"PSG"},
    {num:14,pos:"MID",name:"Teun Koopmeiners",club:"Juventus"},
    {num:16,pos:"MID",name:"Mats Wieffer",club:"Brighton"},
    {num:21,pos:"MID",name:"Frenkie de Jong",club:"Barcelona"},
    {num:7,pos:"FWD",name:"Donyell Malen",club:"Aston Villa"},
    {num:9,pos:"FWD",name:"Brian Brobbey",club:"Ajax"},
    {num:10,pos:"FWD",name:"Memphis Depay",club:"Atlético Madrid"},
    {num:11,pos:"FWD",name:"Cody Gakpo",club:"Liverpool"},
    {num:19,pos:"FWD",name:"Wout Weghorst",club:"Hoffenheim"},
  ]},
  Japan:{coach:"Hajime Moriyasu",players:[
    {num:1,pos:"GK",name:"Zion Suzuki",club:"Parma"},
    {num:12,pos:"GK",name:"Keisuke Osako",club:"Sanfrecce Hiroshima"},
    {num:18,pos:"GK",name:"Tomoki Hayakawa",club:"Kashima Antlers"},
    {num:2,pos:"DEF",name:"Takehiro Tomiyasu",club:"Ajax"},
    {num:4,pos:"DEF",name:"Hiroki Ito",club:"Bayern Munich"},
    {num:5,pos:"DEF",name:"Yuto Nagatomo",club:"FC Tokyo"},
    {num:6,pos:"DEF",name:"Yukinari Sugawara",club:"Werder Bremen"},
    {num:14,pos:"DEF",name:"Shogo Taniguchi",club:"Sint-Truiden"},
    {num:16,pos:"DEF",name:"Ko Itakura",club:"Ajax"},
    {num:3,pos:"MID",name:"Wataru Endo",club:"Liverpool"},
    {num:7,pos:"MID",name:"Ao Tanaka",club:"Leeds United"},
    {num:8,pos:"MID",name:"Ritsu Doan",club:"Eintracht Frankfurt"},
    {num:10,pos:"MID",name:"Daichi Kamada",club:"Crystal Palace"},
    {num:11,pos:"MID",name:"Takefusa Kubo",club:"Real Sociedad"},
    {num:9,pos:"FWD",name:"Ayase Ueda",club:"Feyenoord"},
    {num:13,pos:"FWD",name:"Keito Nakamura",club:"Stade de Reims"},
    {num:17,pos:"FWD",name:"Junya Ito",club:"Genk"},
    {num:19,pos:"FWD",name:"Daizen Maeda",club:"Celtic"},
    {num:22,pos:"FWD",name:"Koki Ogawa",club:"NEC Nijmegen"},
  ]},
  Sweden:{coach:"Graham Potter",players:[
    {num:1,pos:"GK",name:"Kristoffer Nordfeldt",club:"Göztepe"},
    {num:12,pos:"GK",name:"Viktor Johansson",club:"Middlesbrough"},
    {num:23,pos:"GK",name:"Jacob Widell Zetterstrom",club:"Borussia Dortmund"},
    {num:2,pos:"DEF",name:"Victor Lindelöf",club:"Man United"},
    {num:3,pos:"DEF",name:"Emil Holm",club:"Atalanta"},
    {num:4,pos:"DEF",name:"Hjalmar Ekdal",club:"Sampdoria"},
    {num:5,pos:"DEF",name:"Isak Hien",club:"Atalanta"},
    {num:6,pos:"DEF",name:"Carl Starfelt",club:"Celtic"},
    {num:15,pos:"DEF",name:"Daniel Svensson",club:"IF Elfsborg"},
    {num:8,pos:"MID",name:"Mattias Svanberg",club:"Wolfsburg"},
    {num:10,pos:"MID",name:"Jesper Karlström",club:"Lazio"},
    {num:14,pos:"MID",name:"Yasin Ayari",club:"Brighton"},
    {num:17,pos:"MID",name:"Besfort Zeneli",club:"Valenciennes"},
    {num:20,pos:"MID",name:"Lucas Bergvall",club:"Tottenham"},
    {num:7,pos:"FWD",name:"Alexander Isak",club:"Newcastle"},
    {num:9,pos:"FWD",name:"Ken Sema",club:"Watford"},
    {num:11,pos:"FWD",name:"Viktor Gyokeres",club:"Sporting CP"},
    {num:19,pos:"FWD",name:"Anthony Elanga",club:"Nottm Forest"},
    {num:22,pos:"FWD",name:"Benjamin Nygren",club:"IF Elfsborg"},
  ]},
  Tunisia:{coach:"Sabri Lamouchi",players:[
    {num:1,pos:"GK",name:"Aymen Dahmen",club:"Montpellier"},
    {num:12,pos:"GK",name:"Mouhib Chamakh",club:"ES Sahel"},
    {num:22,pos:"GK",name:"Sabri Ben Hassen",club:"FK Vojvodina"},
    {num:2,pos:"DEF",name:"Yan Valery",club:"Angers"},
    {num:3,pos:"DEF",name:"Ali Abdi",club:"Valenciennes"},
    {num:4,pos:"DEF",name:"Mohamed Amine Ben Hamida",club:"Stade Tunisien"},
    {num:5,pos:"DEF",name:"Montassar Talbi",club:"Lorient"},
    {num:6,pos:"DEF",name:"Dylan Bronn",club:"Granada"},
    {num:14,pos:"DEF",name:"Raed Chikhaoui",club:"Al-Nassr"},
    {num:7,pos:"MID",name:"Rani Khedira",club:"FC Augsburg"},
    {num:8,pos:"MID",name:"Ellyes Skhiri",club:"Eintracht Frankfurt"},
    {num:10,pos:"MID",name:"Hannibal Mejbri",club:"Burnley"},
    {num:14,pos:"MID",name:"Anis Ben Slimane",club:"Brighton"},
    {num:16,pos:"MID",name:"Mortadha Ben Ouanes",club:"CS Sfaxien"},
    {num:9,pos:"FWD",name:"Hazem Mastouri",club:"Stade Tunisien"},
    {num:11,pos:"FWD",name:"Elias Achouri",club:"Nantes"},
    {num:17,pos:"FWD",name:"Firas Chaouat",club:"Al-Adalah"},
    {num:19,pos:"FWD",name:"Elias Saad",club:"OH Leuven"},
    {num:22,pos:"FWD",name:"Rayan Elloumi",club:"Zamalek"},
  ]},
  Belgium:{coach:"Rudi Garcia",players:[
    {num:1,pos:"GK",name:"Thibaut Courtois",club:"Real Madrid"},
    {num:12,pos:"GK",name:"Mike Penders",club:"Chelsea"},
    {num:23,pos:"GK",name:"Senne Lammens",club:"Antwerp"},
    {num:2,pos:"DEF",name:"Timothy Castagne",club:"Fulham"},
    {num:3,pos:"DEF",name:"Maxim De Cuyper",club:"Club Brugge"},
    {num:4,pos:"DEF",name:"Brandon Mechele",club:"Club Brugge"},
    {num:5,pos:"DEF",name:"Arthur Theate",club:"Eintracht Frankfurt"},
    {num:6,pos:"DEF",name:"Zeno Debast",club:"Sporting CP"},
    {num:15,pos:"DEF",name:"Thomas Meunier",club:"Lille"},
    {num:4,pos:"MID",name:"Amadou Onana",club:"Aston Villa"},
    {num:6,pos:"MID",name:"Axel Witsel",club:"Atlético Madrid"},
    {num:7,pos:"MID",name:"Kevin De Bruyne",club:"Napoli"},
    {num:8,pos:"MID",name:"Youri Tielemans",club:"Aston Villa"},
    {num:18,pos:"MID",name:"Nicolas Raskin",club:"Rangers"},
    {num:9,pos:"FWD",name:"Romelu Lukaku",club:"Napoli"},
    {num:10,pos:"FWD",name:"Charles De Ketelaere",club:"Atalanta"},
    {num:11,pos:"FWD",name:"Jeremy Doku",club:"Man City"},
    {num:14,pos:"FWD",name:"Dodi Lukebakio",club:"Sevilla"},
    {num:17,pos:"FWD",name:"Leandro Trossard",club:"Arsenal"},
  ]},
  Egypt:{coach:"Hossam Hassan",players:[
    {num:1,pos:"GK",name:"Mohamed Abou Gabal",club:"Zamalek"},
    {num:12,pos:"GK",name:"Ahmed El-Shenawy",club:"Al-Ahly"},
    {num:23,pos:"GK",name:"Ahmed Farouk",club:"Al-Masry"},
    {num:2,pos:"DEF",name:"Ahmed Fatouh",club:"Al-Ahly"},
    {num:3,pos:"DEF",name:"Karim Hafez",club:"Smouha"},
    {num:4,pos:"DEF",name:"Mahmoud Hamdy",club:"Al-Ahly"},
    {num:5,pos:"DEF",name:"Ahmed Hegazi",club:"Al-Ittihad"},
    {num:6,pos:"DEF",name:"Mohamed Abdel-Moneim",club:"Pyramids FC"},
    {num:15,pos:"DEF",name:"Omar Kamal",club:"Al-Masry"},
    {num:7,pos:"MID",name:"Mahmoud Trezeguet",club:"Trabzonspor"},
    {num:8,pos:"MID",name:"Tarek Hamed",club:"Al-Ahly"},
    {num:10,pos:"MID",name:"Amr El-Solia",club:"Al-Ahly"},
    {num:14,pos:"MID",name:"Emam Ashour",club:"Al-Ahly"},
    {num:16,pos:"MID",name:"Mohamed Hany",club:"Pyramids FC"},
    {num:9,pos:"FWD",name:"Omar Marmoush",club:"Man City"},
    {num:11,pos:"FWD",name:"Mohamed Salah",club:"Liverpool"},
    {num:17,pos:"FWD",name:"Ahmed Sayed Zizo",club:"Pyramids FC"},
    {num:18,pos:"FWD",name:"Ramadan Sobhi",club:"Pyramids FC"},
    {num:19,pos:"FWD",name:"Mostafa Mohamed",club:"Galatasaray"},
  ]},
  Iran:{coach:"Amir Ghalenoei",players:[
    {num:1,pos:"GK",name:"Alireza Beiranvand",club:"Antwerp"},
    {num:12,pos:"GK",name:"Amir Abedzadeh",club:"CS Maritimo"},
    {num:13,pos:"GK",name:"Payam Niazmand",club:"Sepahan"},
    {num:2,pos:"DEF",name:"Sadegh Moharrami",club:"Dinamo Zagreb"},
    {num:3,pos:"DEF",name:"Ehsan Hajsafi",club:"Panathinaikos"},
    {num:4,pos:"DEF",name:"Milad Mohammadi",club:"AZ Alkmaar"},
    {num:5,pos:"DEF",name:"Majid Hosseini",club:"Kasımpaşa"},
    {num:6,pos:"DEF",name:"Shoja Khalilzadeh",club:"Al-Qadisiyah"},
    {num:15,pos:"DEF",name:"Ramin Rezaeian",club:"Aarau"},
    {num:7,pos:"MID",name:"Alireza Jahanbakhsh",club:"Feyenoord"},
    {num:8,pos:"MID",name:"Saeid Ezatolahi",club:"Rosenborg"},
    {num:9,pos:"MID",name:"Mehdi Taremi",club:"Inter Milan"},
    {num:10,pos:"MID",name:"Ahmad Noorollahi",club:"Al-Shamal"},
    {num:20,pos:"MID",name:"Ali Karimi",club:"Sepahan"},
    {num:11,pos:"FWD",name:"Sardar Azmoun",club:"Bayer Leverkusen"},
    {num:14,pos:"FWD",name:"Saman Ghoddos",club:"Brentford"},
    {num:17,pos:"FWD",name:"Ali Gholizadeh",club:"Charleroi"},
    {num:19,pos:"FWD",name:"Vahid Amiri",club:"Persepolis"},
    {num:22,pos:"FWD",name:"Karim Ansarifard",club:"Olympiacos"},
  ]},
  "New Zealand":{coach:"Darren Bazeley",players:[
    {num:1,pos:"GK",name:"Max Crocombe",club:"Huddersfield Town"},
    {num:12,pos:"GK",name:"Alex Paulsen",club:"Wellington Phoenix"},
    {num:23,pos:"GK",name:"Michael Woud",club:"Go Ahead Eagles"},
    {num:2,pos:"DEF",name:"Tim Payne",club:"Wellington Phoenix"},
    {num:3,pos:"DEF",name:"Liberato Cacace",club:"Empoli"},
    {num:4,pos:"DEF",name:"Michael Boxall",club:"Minnesota United"},
    {num:5,pos:"DEF",name:"Nando Pijnaker",club:"HNK Gorica"},
    {num:6,pos:"DEF",name:"Francis de Vries",club:"Aalborg"},
    {num:14,pos:"DEF",name:"Tyler Bindon",club:"Colorado Rapids"},
    {num:7,pos:"MID",name:"Sarpreet Singh",club:"Kaiserslautern"},
    {num:8,pos:"MID",name:"Joe Bell",club:"Middlesbrough"},
    {num:10,pos:"MID",name:"Matthew Garbett",club:"Torino"},
    {num:11,pos:"MID",name:"Alex Rufer",club:"Young Boys"},
    {num:16,pos:"MID",name:"Marko Stamenic",club:"FK Jablonec"},
    {num:9,pos:"FWD",name:"Chris Wood",club:"Nottm Forest"},
    {num:17,pos:"FWD",name:"Ben Old",club:"Wellington Phoenix"},
    {num:19,pos:"FWD",name:"Kosta Barbarouses",club:"Melbourne City"},
    {num:20,pos:"MID",name:"Callum McCowatt",club:"Sparta Rotterdam"},
    {num:22,pos:"FWD",name:"Ben Waine",club:"Wellington Phoenix"},
  ]},
  Spain:{coach:"Luis de la Fuente",players:[
    {num:1,pos:"GK",name:"Unai Simón",club:"Athletic Bilbao"},
    {num:13,pos:"GK",name:"Álex Remiro",club:"Real Sociedad"},
    {num:23,pos:"GK",name:"David Raya",club:"Arsenal"},
    {num:2,pos:"DEF",name:"Dani Carvajal",club:"Real Madrid"},
    {num:3,pos:"DEF",name:"Marc Cucurella",club:"Chelsea"},
    {num:4,pos:"DEF",name:"Pau Cubarsí",club:"Barcelona"},
    {num:6,pos:"DEF",name:"Robin Le Normand",club:"Atlético Madrid"},
    {num:14,pos:"DEF",name:"Aymeric Laporte",club:"Al-Nassr"},
    {num:15,pos:"DEF",name:"Alejandro Grimaldo",club:"Bayer Leverkusen"},
    {num:6,pos:"MID",name:"Gavi",club:"Barcelona"},
    {num:7,pos:"MID",name:"Fabián Ruiz",club:"PSG"},
    {num:8,pos:"MID",name:"Pedri",club:"Barcelona"},
    {num:10,pos:"MID",name:"Dani Olmo",club:"Barcelona"},
    {num:16,pos:"MID",name:"Rodri",club:"Man City"},
    {num:9,pos:"FWD",name:"Álvaro Morata",club:"AC Milan"},
    {num:11,pos:"FWD",name:"Nico Williams",club:"Athletic Bilbao"},
    {num:17,pos:"FWD",name:"Mikel Oyarzabal",club:"Real Sociedad"},
    {num:19,pos:"FWD",name:"Lamine Yamal",club:"Barcelona"},
    {num:22,pos:"FWD",name:"Ferran Torres",club:"Barcelona"},
  ]},
  "Cape Verde":{coach:"Bubista",players:[
    {num:1,pos:"GK",name:"Vozinha",club:"Arouca"},
    {num:12,pos:"GK",name:"CJ Dos Santos",club:"LA Galaxy"},
    {num:23,pos:"GK",name:"Marcio Rosa",club:"FC Feirense"},
    {num:2,pos:"DEF",name:"Steven Moreira",club:"Huesca"},
    {num:3,pos:"DEF",name:"Joao Paulo",club:"Boavista"},
    {num:4,pos:"DEF",name:"Logan Costa",club:"Toulouse"},
    {num:5,pos:"DEF",name:"Stopira",club:"Arouca"},
    {num:6,pos:"DEF",name:"Roberto Lopes",club:"Shamrock Rovers"},
    {num:15,pos:"DEF",name:"Wagner Pina",club:"Farense"},
    {num:7,pos:"MID",name:"Laros Duarte",club:"PSV"},
    {num:8,pos:"MID",name:"Kevin Pina",club:"Málaga"},
    {num:10,pos:"MID",name:"Jamiro Monteiro",club:"Philadelphia Union"},
    {num:14,pos:"MID",name:"Deroy Duarte",club:"Bohemian FC"},
    {num:17,pos:"MID",name:"Yannick Semedo",club:"Gil Vicente"},
    {num:9,pos:"FWD",name:"Ryan Mendes",club:"Nice"},
    {num:11,pos:"FWD",name:"Garry Rodrigues",club:"Galatasaray"},
    {num:17,pos:"FWD",name:"Jovane Cabral",club:"Sporting CP"},
    {num:19,pos:"FWD",name:"Nuno da Costa",club:"Strasbourg"},
    {num:22,pos:"FWD",name:"Dailon Livramento",club:"New England Revolution"},
  ]},
  "Saudi Arabia":{coach:"Georgios Donis",players:[
    {num:1,pos:"GK",name:"Mohammed Al-Owais",club:"Al-Hilal"},
    {num:13,pos:"GK",name:"Abdullah Al-Mayouf",club:"Al-Ittihad"},
    {num:22,pos:"GK",name:"Sultan Al-Ghannam",club:"Al-Ahli"},
    {num:2,pos:"DEF",name:"Ziyad Al-Sahafi",club:"Al-Ettifaq"},
    {num:3,pos:"DEF",name:"Hassan Tambakti",club:"Al-Shabab"},
    {num:5,pos:"DEF",name:"Abdullah Madu",club:"Al-Ittihad"},
    {num:6,pos:"DEF",name:"Ali Al-Bulayhi",club:"Al-Hilal"},
    {num:13,pos:"DEF",name:"Mohammed Al-Burayk",club:"Al-Hilal"},
    {num:15,pos:"DEF",name:"Abdulellah Al-Malki",club:"Al-Shabab"},
    {num:7,pos:"MID",name:"Nasser Al-Dawsari",club:"Al-Hilal"},
    {num:8,pos:"MID",name:"Sami Al-Najei",club:"Al-Hilal"},
    {num:10,pos:"MID",name:"Salem Al-Dawsari",club:"Al-Hilal"},
    {num:16,pos:"MID",name:"Abdulelah Al-Malki",club:"Al-Shabab"},
    {num:20,pos:"MID",name:"Hattan Bahbri",club:"Al-Shabab"},
    {num:9,pos:"FWD",name:"Saleh Al-Shehri",club:"Al-Ittihad"},
    {num:11,pos:"FWD",name:"Firas Al-Buraikan",club:"Al-Fateh"},
    {num:14,pos:"FWD",name:"Hendo Al-Shalhoub",club:"Al-Ittifaq"},
    {num:17,pos:"FWD",name:"Mohamed Kanno",club:"Al-Hilal"},
    {num:19,pos:"FWD",name:"Abdullah Radif",club:"Al-Qadisiyah"},
  ]},
  Uruguay:{coach:"Marcelo Bielsa",players:[
    {num:1,pos:"GK",name:"Sergio Rochet",club:"Inter Milan"},
    {num:12,pos:"GK",name:"Sebastián Sosa",club:"Independiente"},
    {num:23,pos:"GK",name:"Martín Campaña",club:"Independiente"},
    {num:2,pos:"DEF",name:"José María Giménez",club:"Atlético Madrid"},
    {num:3,pos:"DEF",name:"Diego Godín",club:"Vélez Sársfield"},
    {num:4,pos:"DEF",name:"Sebastián Coates",club:"Sporting CP"},
    {num:5,pos:"DEF",name:"Nahitan Nández",club:"Cagliari"},
    {num:19,pos:"DEF",name:"Ronald Araújo",club:"Barcelona"},
    {num:22,pos:"DEF",name:"Matías Viña",club:"Sassuolo"},
    {num:6,pos:"MID",name:"Rodrigo Bentancur",club:"Tottenham"},
    {num:8,pos:"MID",name:"Federico Valverde",club:"Real Madrid"},
    {num:10,pos:"MID",name:"Giorgian de Arrascaeta",club:"Flamengo"},
    {num:14,pos:"MID",name:"Lucas Torreira",club:"Galatasaray"},
    {num:16,pos:"MID",name:"Maxi Gómez",club:"Celta Vigo"},
    {num:7,pos:"FWD",name:"Luis Suárez",club:"Grêmio"},
    {num:9,pos:"FWD",name:"Darwin Núñez",club:"Liverpool"},
    {num:11,pos:"FWD",name:"Facundo Torres",club:"Orlando City"},
    {num:17,pos:"FWD",name:"Agustín Canobbio",club:"Atlético Paranaense"},
    {num:18,pos:"FWD",name:"Matías Arezo",club:"Granada"},
  ]},
  France:{coach:"Didier Deschamps",players:[
    {num:1,pos:"GK",name:"Mike Maignan",club:"AC Milan"},
    {num:16,pos:"GK",name:"Brice Samba",club:"Lens"},
    {num:23,pos:"GK",name:"Robin Risser",club:"Fribourg"},
    {num:2,pos:"DEF",name:"Malo Gusto",club:"Chelsea"},
    {num:4,pos:"DEF",name:"Dayot Upamecano",club:"Bayern Munich"},
    {num:5,pos:"DEF",name:"Jules Koundé",club:"Barcelona"},
    {num:12,pos:"DEF",name:"William Saliba",club:"Arsenal"},
    {num:13,pos:"DEF",name:"Ibrahima Konaté",club:"Liverpool"},
    {num:21,pos:"DEF",name:"Lucas Hernandez",club:"PSG"},
    {num:6,pos:"MID",name:"Warren Zaïre-Emery",club:"PSG"},
    {num:7,pos:"MID",name:"N'Golo Kanté",club:"Al-Ittihad"},
    {num:8,pos:"MID",name:"Aurélien Tchouaméni",club:"Real Madrid"},
    {num:14,pos:"MID",name:"Adrien Rabiot",club:"Marseille"},
    {num:18,pos:"MID",name:"Manu Koné",club:"Real Madrid"},
    {num:9,pos:"FWD",name:"Marcus Thuram",club:"Inter Milan"},
    {num:10,pos:"FWD",name:"Kylian Mbappé",club:"Real Madrid"},
    {num:11,pos:"FWD",name:"Ousmane Dembélé",club:"PSG"},
    {num:17,pos:"FWD",name:"Bradley Barcola",club:"PSG"},
    {num:19,pos:"FWD",name:"Michael Olise",club:"Bayern Munich"},
  ]},
  Senegal:{coach:"Pape Thiaw",players:[
    {num:1,pos:"GK",name:"Edouard Mendy",club:"Al-Ahli"},
    {num:12,pos:"GK",name:"Seny Dieng",club:"Middlesbrough"},
    {num:16,pos:"GK",name:"Alfred Gomis",club:"Rennes"},
    {num:3,pos:"DEF",name:"Kalidou Koulibaly",club:"Al-Hilal"},
    {num:4,pos:"DEF",name:"Formose Mendy",club:"Nice"},
    {num:5,pos:"DEF",name:"Abdou Diallo",club:"Al-Arabi"},
    {num:13,pos:"DEF",name:"Moussa Niakhaté",club:"Nottm Forest"},
    {num:15,pos:"DEF",name:"Krepin Diatta",club:"Monaco"},
    {num:20,pos:"DEF",name:"Ismail Jakobs",club:"Monaco"},
    {num:6,pos:"MID",name:"Nampalys Mendy",club:"Leicester"},
    {num:8,pos:"MID",name:"Idrissa Gueye",club:"Everton"},
    {num:10,pos:"MID",name:"Habib Diallo",club:"Strasbourg"},
    {num:16,pos:"MID",name:"Lamine Camara",club:"Monaco"},
    {num:17,pos:"MID",name:"Pape Matar Sarr",club:"Tottenham"},
    {num:7,pos:"FWD",name:"Nicolas Jackson",club:"Chelsea"},
    {num:9,pos:"FWD",name:"Boulaye Dia",club:"Lazio"},
    {num:10,pos:"FWD",name:"Sadio Mané",club:"Al-Nassr"},
    {num:11,pos:"FWD",name:"Ismaïla Sarr",club:"Crystal Palace"},
    {num:22,pos:"FWD",name:"Cheikhou Kouyaté",club:"DC United"},
  ]},
  Iraq:{coach:"Graham Arnold",players:[
    {num:1,pos:"GK",name:"Jalal Hassan",club:"Al-Zawra"},
    {num:12,pos:"GK",name:"Dhurgham Ismail",club:"Al-Quwa Al-Jawiya"},
    {num:23,pos:"GK",name:"Saad Natiq",club:"Al-Talaba"},
    {num:2,pos:"DEF",name:"Saad Natiq",club:"Al-Mina"},
    {num:3,pos:"DEF",name:"Ali Adnan",club:"Almería"},
    {num:4,pos:"DEF",name:"Salam Shaker",club:"Al-Shorta"},
    {num:5,pos:"DEF",name:"Hussein Ali",club:"Al-Zawra"},
    {num:6,pos:"DEF",name:"Rebin Sulaka",club:"Al-Quwa Al-Jawiya"},
    {num:15,pos:"DEF",name:"Ahmad Ibrahim",club:"Zagros Sulaymaniyah"},
    {num:7,pos:"MID",name:"Safaa Hadi",club:"Al-Shorta"},
    {num:8,pos:"MID",name:"Amjad Attwan",club:"Al-Zawra"},
    {num:10,pos:"MID",name:"Bashar Resan",club:"Al-Zawra"},
    {num:14,pos:"MID",name:"Ibrahim Bayesh",club:"Al-Quwa Al-Jawiya"},
    {num:16,pos:"MID",name:"Osama Rashid",club:"Al-Zawra"},
    {num:9,pos:"FWD",name:"Mohanad Ali",club:"Al-Zawra"},
    {num:11,pos:"FWD",name:"Aymen Hussein",club:"Al-Zawra"},
    {num:17,pos:"FWD",name:"Hammadi Ahmad",club:"Al-Quwa Al-Jawiya"},
    {num:19,pos:"FWD",name:"Ali Jasim",club:"Al-Quwa Al-Jawiya"},
    {num:22,pos:"FWD",name:"Ahmed Yasin",club:"Al-Zawra"},
  ]},
  Norway:{coach:"Ståle Solbakken",players:[
    {num:1,pos:"GK",name:"Ørjan Nyland",club:"Brentford"},
    {num:12,pos:"GK",name:"Egil Selvik",club:"FC Nordsjælland"},
    {num:23,pos:"GK",name:"Sander Tangvik",club:"Häcken"},
    {num:2,pos:"DEF",name:"Kristoffer Ajer",club:"Brentford"},
    {num:3,pos:"DEF",name:"Marcus Holmgren Pedersen",club:"Feyenoord"},
    {num:4,pos:"DEF",name:"Fredrik Bjørkan",club:"Club Brugge"},
    {num:5,pos:"DEF",name:"Leo Østigård",club:"Napoli"},
    {num:6,pos:"DEF",name:"Julian Ryerson",club:"Borussia Dortmund"},
    {num:15,pos:"DEF",name:"Sondre Langås",club:"Tromsø"},
    {num:6,pos:"MID",name:"Sander Berge",club:"Burnley"},
    {num:7,pos:"MID",name:"Morten Thorsby",club:"Genoa"},
    {num:8,pos:"MID",name:"Martin Ødegaard",club:"Arsenal"},
    {num:10,pos:"MID",name:"Antonio Nusa",club:"Club Brugge"},
    {num:14,pos:"MID",name:"Fredrik Aursnes",club:"Benfica"},
    {num:9,pos:"FWD",name:"Erling Haaland",club:"Man City"},
    {num:11,pos:"FWD",name:"Alexander Sørloth",club:"Atlético Madrid"},
    {num:17,pos:"FWD",name:"Jørgen Strand Larsen",club:"Celta Vigo"},
    {num:18,pos:"MID",name:"Oscar Bobb",club:"Man City"},
    {num:19,pos:"FWD",name:"Ola Solbakken",club:"Roma"},
  ]},
  Argentina:{coach:"Lionel Scaloni",players:[
    {num:1,pos:"GK",name:"Emiliano Martínez",club:"Aston Villa"},
    {num:12,pos:"GK",name:"Franco Armani",club:"River Plate"},
    {num:23,pos:"GK",name:"Gerónimo Rulli",club:"Ajax"},
    {num:3,pos:"DEF",name:"Nicolás Tagliafico",club:"Lyon"},
    {num:6,pos:"DEF",name:"Lisandro Martínez",club:"Man United"},
    {num:8,pos:"DEF",name:"Marcos Acuña",club:"Sevilla"},
    {num:13,pos:"DEF",name:"Cristian Romero",club:"Tottenham"},
    {num:19,pos:"DEF",name:"Nicolás Otamendi",club:"Benfica"},
    {num:26,pos:"DEF",name:"Nahuel Molina",club:"Atlético Madrid"},
    {num:5,pos:"MID",name:"Leandro Paredes",club:"Roma"},
    {num:7,pos:"MID",name:"Rodrigo De Paul",club:"Atlético Madrid"},
    {num:18,pos:"MID",name:"Giovani Lo Celso",club:"Villarreal"},
    {num:20,pos:"MID",name:"Alexis Mac Allister",club:"Liverpool"},
    {num:24,pos:"MID",name:"Enzo Fernández",club:"Chelsea"},
    {num:9,pos:"FWD",name:"Julián Álvarez",club:"Atlético Madrid"},
    {num:10,pos:"FWD",name:"Lionel Messi",club:"Inter Miami"},
    {num:11,pos:"FWD",name:"Nicolás González",club:"Juventus"},
    {num:21,pos:"FWD",name:"Paulo Dybala",club:"Roma"},
    {num:22,pos:"FWD",name:"Lautaro Martínez",club:"Inter Milan"},
  ]},
  Algeria:{coach:"Vladimir Petković",players:[
    {num:1,pos:"GK",name:"Raïs M'Bolhi",club:"Al-Ettifaq"},
    {num:16,pos:"GK",name:"Alexandre Oukidja",club:"FC Metz"},
    {num:23,pos:"GK",name:"Mehdi Zemmamouche",club:"NA Hussein Dey"},
    {num:2,pos:"DEF",name:"Hossam Omeich",club:"USMA"},
    {num:3,pos:"DEF",name:"Ramy Bensebaini",club:"Borussia Dortmund"},
    {num:4,pos:"DEF",name:"Djamel Benlamri",club:"Al-Ittihad"},
    {num:5,pos:"DEF",name:"Aissa Mandi",club:"Real Betis"},
    {num:13,pos:"DEF",name:"Ayoub Abdellaoui",club:"Angers"},
    {num:15,pos:"DEF",name:"Lyès Miali",club:"MC Alger"},
    {num:7,pos:"MID",name:"Riyad Mahrez",club:"Al-Ahli"},
    {num:8,pos:"MID",name:"Ismaël Bennacer",club:"AC Milan"},
    {num:11,pos:"MID",name:"Samir Benrahma",club:"Bayer Leverkusen"},
    {num:14,pos:"MID",name:"Youcef Atal",club:"Nice"},
    {num:16,pos:"MID",name:"Mehdi Tahrat",club:"CR Belouizdad"},
    {num:9,pos:"FWD",name:"Islam Slimani",club:"Sport Boys"},
    {num:10,pos:"FWD",name:"Andy Delort",club:"RC Lens"},
    {num:17,pos:"FWD",name:"Yacine Brahimi",club:"Porto"},
    {num:19,pos:"FWD",name:"Amine Gouiri",club:"Stade Rennais"},
    {num:22,pos:"FWD",name:"Said Benrahma",club:"Lyon"},
  ]},
  Austria:{coach:"Ralf Rangnick",players:[
    {num:1,pos:"GK",name:"Alexander Schlager",club:"RB Salzburg"},
    {num:12,pos:"GK",name:"Patrick Pentz",club:"Brondby"},
    {num:23,pos:"GK",name:"Florian Wiegele",club:"Viktoria Plzen"},
    {num:3,pos:"DEF",name:"Stefan Posch",club:"Como"},
    {num:4,pos:"DEF",name:"Marco Friedl",club:"Werder Bremen"},
    {num:5,pos:"DEF",name:"Kevin Danso",club:"Tottenham"},
    {num:6,pos:"DEF",name:"Philipp Lienhart",club:"SC Freiburg"},
    {num:14,pos:"DEF",name:"David Alaba",club:"Real Madrid"},
    {num:20,pos:"DEF",name:"Alexander Prass",club:"Hoffenheim"},
    {num:6,pos:"MID",name:"Nicolas Seiwald",club:"RB Leipzig"},
    {num:7,pos:"MID",name:"Christoph Baumgartner",club:"RB Leipzig"},
    {num:8,pos:"MID",name:"Marcel Sabitzer",club:"Borussia Dortmund"},
    {num:10,pos:"MID",name:"Xaver Schlager",club:"RB Leipzig"},
    {num:11,pos:"MID",name:"Romano Schmid",club:"Werder Bremen"},
    {num:9,pos:"FWD",name:"Marko Arnautovic",club:"Inter Milan"},
    {num:17,pos:"MID",name:"Konrad Laimer",club:"Bayern Munich"},
    {num:18,pos:"FWD",name:"Sasa Kalajdzic",club:"Eintracht Frankfurt"},
    {num:19,pos:"FWD",name:"Michael Gregoritsch",club:"SC Freiburg"},
    {num:22,pos:"FWD",name:"Patrick Wimmer",club:"Wolfsburg"},
  ]},
  Jordan:{coach:"Jamal Sellami",players:[
    {num:1,pos:"GK",name:"Yahia Iqbaliq",club:"Al-Faisaly"},
    {num:12,pos:"GK",name:"Ahmad Musa",club:"Al-Wahdat"},
    {num:23,pos:"GK",name:"Salem Al-Dameiry",club:"Al-Shabab"},
    {num:2,pos:"DEF",name:"Ehsan Haddad",club:"Al-Wahdat"},
    {num:3,pos:"DEF",name:"Yazan Al-Naimat",club:"Al-Hussein"},
    {num:4,pos:"DEF",name:"Abdallah Nasib",club:"Al-Faisaly"},
    {num:5,pos:"DEF",name:"Ahmad Hayel",club:"Al-Wahdat"},
    {num:13,pos:"DEF",name:"Mohammad Al-Dmeiri",club:"Al-Jazira"},
    {num:15,pos:"DEF",name:"Oday Dabbagh",club:"Royal Antwerp"},
    {num:7,pos:"MID",name:"Musa Al-Taamari",club:"Montpellier"},
    {num:8,pos:"MID",name:"Yazan Alarnab",club:"Club Brugge"},
    {num:10,pos:"MID",name:"Ahmad Ibrahim",club:"Al-Wahdat"},
    {num:16,pos:"MID",name:"Baha Faisal",club:"Al-Wahdat"},
    {num:17,pos:"MID",name:"Mahmoud Mardawi",club:"Al-Wahdat"},
    {num:9,pos:"FWD",name:"Ahmad Saleh",club:"Al-Wahdat"},
    {num:11,pos:"FWD",name:"Yaqoub Qahtan",club:"Al-Faisaly"},
    {num:19,pos:"FWD",name:"Mahmoud Al-Mardi",club:"Reus Deportiu"},
    {num:22,pos:"FWD",name:"Mousa Al-Taamari",club:"Montpellier"},
    {num:4,pos:"MID",name:"Yasser Al-Bakoor",club:"Al-Wahdat"},
  ]},
  Portugal:{coach:"Carlos Queiroz",players:[
    {num:1,pos:"GK",name:"Diogo Costa",club:"Porto"},
    {num:12,pos:"GK",name:"José Sá",club:"Wolves"},
    {num:23,pos:"GK",name:"Rui Silva",club:"Real Betis"},
    {num:2,pos:"DEF",name:"Diogo Dalot",club:"Man United"},
    {num:3,pos:"DEF",name:"Renato Veiga",club:"Chelsea"},
    {num:4,pos:"DEF",name:"Rúben Dias",club:"Man City"},
    {num:6,pos:"DEF",name:"Tomas Araújo",club:"Benfica"},
    {num:14,pos:"DEF",name:"Gonçalo Inácio",club:"Sporting CP"},
    {num:19,pos:"DEF",name:"Nuno Mendes",club:"PSG"},
    {num:8,pos:"MID",name:"Bruno Fernandes",club:"Man United"},
    {num:10,pos:"MID",name:"Bernardo Silva",club:"Man City"},
    {num:15,pos:"MID",name:"João Neves",club:"PSG"},
    {num:16,pos:"MID",name:"Vitinha",club:"PSG"},
    {num:17,pos:"MID",name:"Rúben Neves",club:"Al-Hilal"},
    {num:7,pos:"FWD",name:"Cristiano Ronaldo",club:"Al-Nassr"},
    {num:9,pos:"FWD",name:"Gonçalo Ramos",club:"PSG"},
    {num:11,pos:"FWD",name:"Rafael Leão",club:"AC Milan"},
    {num:21,pos:"FWD",name:"Francisco Conceição",club:"Juventus"},
    {num:20,pos:"DEF",name:"João Cancelo",club:"Barcelona"},
  ]},
  "DR Congo":{coach:"Sébastien Desabre",players:[
    {num:1,pos:"GK",name:"Lionel Mpasi",club:"AS Vita Club"},
    {num:12,pos:"GK",name:"Timothy Fayulu",club:"AS Vita Club"},
    {num:23,pos:"GK",name:"Matthieu Epolo",club:"Nottm Forest"},
    {num:2,pos:"DEF",name:"Joris Kayembe",club:"Gent"},
    {num:3,pos:"DEF",name:"Arthur Masuaku",club:"Besiktas"},
    {num:4,pos:"DEF",name:"Gedeon Kalulu",club:"Juventus"},
    {num:5,pos:"DEF",name:"Chancel Mbemba",club:"Marseille"},
    {num:6,pos:"DEF",name:"Dylan Batubinsika",club:"Panathinaikos"},
    {num:15,pos:"DEF",name:"Aaron Wan-Bissaka",club:"West Ham"},
    {num:7,pos:"MID",name:"Edo Kayembe",club:"Watford"},
    {num:8,pos:"MID",name:"Samuel Moutoussamy",club:"Nantes"},
    {num:10,pos:"MID",name:"Gaël Kakuta",club:"RC Lens"},
    {num:11,pos:"MID",name:"Meschak Elia",club:"Young Boys"},
    {num:14,pos:"MID",name:"Noah Sadiki",club:"Anderlecht"},
    {num:9,pos:"FWD",name:"Yoane Wissa",club:"Brentford"},
    {num:13,pos:"FWD",name:"Simon Banza",club:"Sporting Braga"},
    {num:17,pos:"FWD",name:"Cédric Bakambu",club:"UD Almería"},
    {num:19,pos:"MID",name:"Ngal'ayel Mukau",club:"Troyes"},
    {num:22,pos:"FWD",name:"Fiston Mayele",club:"Panathinaikos"},
  ]},
  Uzbekistan:{coach:"Fabio Cannavaro",players:[
    {num:1,pos:"GK",name:"Utkir Yusupov",club:"Pakhtakor"},
    {num:12,pos:"GK",name:"Marat Goiipov",club:"Bunyodkor"},
    {num:23,pos:"GK",name:"Otabek Shukurov",club:"Neftchi Fergana"},
    {num:2,pos:"DEF",name:"Dostonbek Khamdamov",club:"Pakhtakor"},
    {num:3,pos:"DEF",name:"Mirzohid Halimov",club:"Pakhtakor"},
    {num:4,pos:"DEF",name:"Khojiakbar Alijonov",club:"Pakhtakor"},
    {num:5,pos:"DEF",name:"Avazbek Nazarov",club:"Kayserispor"},
    {num:13,pos:"DEF",name:"Azizbek Turgunboev",club:"Pakhtakor"},
    {num:15,pos:"DEF",name:"Akbar Sheraliyev",club:"AGMK"},
    {num:7,pos:"MID",name:"Jaloliddin Masharipov",club:"Bunyodkor"},
    {num:8,pos:"MID",name:"Otabek Shukurov",club:"Pakhtakor"},
    {num:10,pos:"MID",name:"Bobur Abdixoliqov",club:"Pakhtakor"},
    {num:14,pos:"MID",name:"Khurshid Muxtorov",club:"Pakhtakor"},
    {num:16,pos:"MID",name:"Murodjon Yokubov",club:"Neftchi Fergana"},
    {num:9,pos:"FWD",name:"Eldor Shomurodov",club:"Roma"},
    {num:11,pos:"FWD",name:"Jasur Yaxshiboev",club:"Pakhtakor"},
    {num:17,pos:"FWD",name:"Abbosbek Fayzullayev",club:"CSKA Moscow"},
    {num:19,pos:"FWD",name:"Akramjon Komilov",club:"Bunyodkor"},
    {num:22,pos:"FWD",name:"Ulugbek Askarov",club:"Pakhtakor"},
  ]},
  Colombia:{coach:"Néstor Lorenzo",players:[
    {num:1,pos:"GK",name:"David Ospina",club:"Al-Qadisiyah"},
    {num:12,pos:"GK",name:"Camilo Vargas",club:"Atlas"},
    {num:23,pos:"GK",name:"Álvaro Montero",club:"Millonarios"},
    {num:2,pos:"DEF",name:"Santiago Arias",club:"Boca Juniors"},
    {num:3,pos:"DEF",name:"Johan Mojica",club:"Olympiacos"},
    {num:4,pos:"DEF",name:"William Tesillo",club:"Club León"},
    {num:6,pos:"DEF",name:"Dávinson Sánchez",club:"Galatasaray"},
    {num:13,pos:"DEF",name:"Yerry Mina",club:"Real Valladolid"},
    {num:18,pos:"DEF",name:"Daniel Muñoz",club:"Crystal Palace"},
    {num:5,pos:"MID",name:"Wilmar Barrios",club:"Zenit St. Petersburg"},
    {num:8,pos:"MID",name:"Mateus Uribe",club:"Porto"},
    {num:10,pos:"MID",name:"James Rodríguez",club:"Rayo Vallecano"},
    {num:11,pos:"MID",name:"Juan Cuadrado",club:"Juventus"},
    {num:16,pos:"MID",name:"Richard Ríos",club:"Palmeiras"},
    {num:7,pos:"FWD",name:"Luis Díaz",club:"Liverpool"},
    {num:9,pos:"FWD",name:"Jhon Duran",club:"Aston Villa"},
    {num:15,pos:"FWD",name:"Cucho Hernández",club:"Columbus Crew"},
    {num:19,pos:"FWD",name:"Rafael Santos Borré",club:"Werder Bremen"},
    {num:9,pos:"FWD",name:"Radamel Falcao",club:"Rayo Vallecano"},
  ]},
  England:{coach:"Thomas Tuchel",players:[
    {num:1,pos:"GK",name:"Jordan Pickford",club:"Everton"},
    {num:13,pos:"GK",name:"Dean Henderson",club:"Crystal Palace"},
    {num:22,pos:"GK",name:"James Trafford",club:"Burnley"},
    {num:2,pos:"DEF",name:"Reece James",club:"Chelsea"},
    {num:5,pos:"DEF",name:"John Stones",club:"Man City"},
    {num:6,pos:"DEF",name:"Marc Guehi",club:"Crystal Palace"},
    {num:12,pos:"DEF",name:"Tino Livramento",club:"Newcastle"},
    {num:14,pos:"DEF",name:"Ezri Konsa",club:"Aston Villa"},
    {num:15,pos:"DEF",name:"Dan Burn",club:"Newcastle"},
    {num:4,pos:"MID",name:"Declan Rice",club:"Arsenal"},
    {num:8,pos:"MID",name:"Elliot Anderson",club:"Nottm Forest"},
    {num:10,pos:"MID",name:"Jude Bellingham",club:"Real Madrid"},
    {num:11,pos:"MID",name:"Morgan Rogers",club:"Aston Villa"},
    {num:19,pos:"MID",name:"Eberechi Eze",club:"Crystal Palace"},
    {num:7,pos:"FWD",name:"Bukayo Saka",club:"Arsenal"},
    {num:9,pos:"FWD",name:"Harry Kane",club:"Bayern Munich"},
    {num:11,pos:"FWD",name:"Marcus Rashford",club:"Barcelona"},
    {num:17,pos:"FWD",name:"Ollie Watkins",club:"Aston Villa"},
    {num:18,pos:"FWD",name:"Ivan Toney",club:"Al-Ahli"},
  ]},
  Croatia:{coach:"Zlatko Dalić",players:[
    {num:1,pos:"GK",name:"Dominik Livaković",club:"Fenerbahçe"},
    {num:12,pos:"GK",name:"Ivor Pandur",club:"Lugano"},
    {num:23,pos:"GK",name:"Dominik Kotarski",club:"Osijek"},
    {num:2,pos:"DEF",name:"Josip Stanišić",club:"Bayern Munich"},
    {num:3,pos:"DEF",name:"Joško Gvardiol",club:"Man City"},
    {num:4,pos:"DEF",name:"Martin Erlić",club:"RB Leipzig"},
    {num:5,pos:"DEF",name:"Marin Pongračić",club:"Borussia Dortmund"},
    {num:6,pos:"DEF",name:"Duje Ćaleta-Car",club:"Lyon"},
    {num:22,pos:"DEF",name:"Luka Vušković",club:"HSV"},
    {num:6,pos:"MID",name:"Kristijan Jakić",club:"Eintracht Frankfurt"},
    {num:8,pos:"MID",name:"Mateo Kovačić",club:"Man City"},
    {num:9,pos:"MID",name:"Mario Pašalić",club:"Atalanta"},
    {num:10,pos:"MID",name:"Luka Modrić",club:"Real Madrid"},
    {num:11,pos:"MID",name:"Martin Baturina",club:"Chelsea"},
    {num:4,pos:"FWD",name:"Ivan Perišić",club:"Hajduk Split"},
    {num:7,pos:"FWD",name:"Andrej Kramarić",club:"Hoffenheim"},
    {num:9,pos:"FWD",name:"Ante Budimir",club:"Osasuna"},
    {num:19,pos:"FWD",name:"Petar Musa",club:"Benfica"},
    {num:17,pos:"MID",name:"Nikola Vlašić",club:"Torino"},
  ]},
  Ghana:{coach:"Carlos Queiroz",players:[
    {num:1,pos:"GK",name:"Lawrence Ati-Zigi",club:"St Gallen"},
    {num:12,pos:"GK",name:"Joseph Wollacott",club:"Stoke City"},
    {num:23,pos:"GK",name:"Ibrahim Danlad",club:"Asante Kotoko"},
    {num:2,pos:"DEF",name:"Andy Yiadom",club:"Reading"},
    {num:3,pos:"DEF",name:"Alexander Djiku",club:"Strasbourg"},
    {num:4,pos:"DEF",name:"Gideon Mensah",club:"Bordeaux"},
    {num:5,pos:"DEF",name:"Daniel Amartey",club:"Leicester"},
    {num:6,pos:"DEF",name:"Joseph Aidoo",club:"Celta Vigo"},
    {num:13,pos:"DEF",name:"Baba Rahman",club:"Chelsea"},
    {num:7,pos:"MID",name:"Mubarak Wakaso",club:"Jiangsu Suning"},
    {num:8,pos:"MID",name:"Thomas Partey",club:"Arsenal"},
    {num:10,pos:"MID",name:"Mohammed Kudus",club:"West Ham"},
    {num:14,pos:"MID",name:"Daniel Kofi Kyereh",club:"SC Freiburg"},
    {num:16,pos:"MID",name:"Salis Abdul Samed",club:"Lens"},
    {num:9,pos:"FWD",name:"Inaki Williams",club:"Athletic Bilbao"},
    {num:11,pos:"FWD",name:"Antoine Semenyo",club:"Man City"},
    {num:17,pos:"FWD",name:"Kamaldeen Sulemana",club:"Southampton"},
    {num:19,pos:"FWD",name:"Osman Bukari",club:"Red Star Belgrade"},
    {num:22,pos:"FWD",name:"Jordan Ayew",club:"Leicester"},
  ]},
  Panama:{coach:"Thomas Christiansen",players:[
    {num:1,pos:"GK",name:"Luis Mejía",club:"Independiente"},
    {num:12,pos:"GK",name:"Giancarlo Galván",club:"Tauro"},
    {num:23,pos:"GK",name:"Alan Castaño",club:"Atlético Nacional"},
    {num:2,pos:"DEF",name:"Roderick Miller",club:"Atlético Nacional"},
    {num:3,pos:"DEF",name:"Fidel Escobar",club:"New England Revolution"},
    {num:4,pos:"DEF",name:"César Blackman",club:"Tauro"},
    {num:5,pos:"DEF",name:"Harold Cummings",club:"San Jose Earthquakes"},
    {num:6,pos:"DEF",name:"Andrés Andrade",club:"Miami FC"},
    {num:14,pos:"DEF",name:"Éric Davis",club:"Girona"},
    {num:7,pos:"MID",name:"Edgar Bárcenas",club:"Villarreal B"},
    {num:8,pos:"MID",name:"Anibal Godoy",club:"Nashville SC"},
    {num:10,pos:"MID",name:"César Yanis",club:"Vitória de Guimarães"},
    {num:16,pos:"MID",name:"Adalberto Carrasquilla",club:"Houston Dynamo"},
    {num:20,pos:"MID",name:"José Fajardo",club:"FC Dallas"},
    {num:9,pos:"FWD",name:"Rolando Blackburn",club:"Nashville SC"},
    {num:11,pos:"FWD",name:"Ismael Díaz",club:"Porto"},
    {num:17,pos:"FWD",name:"Freddie Hall",club:"Swindon Town"},
    {num:19,pos:"FWD",name:"Alberto Quintero",club:"Plaza Amador"},
    {num:22,pos:"FWD",name:"Jorman Aguilar",club:"Austin FC"},
  ]},
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
  const text = `⚽ ${fix.home} vs ${fix.away}\n📅 ${fix.dateStr} 2026 | ${bdTime(fix.etTime)} BD সময়\n📍 ${fix.venue.split(",")[0]}\n#FIFAWorldCup2026`;
  if (navigator.share) navigator.share({ title:"FIFA World Cup 2026", text });
  else navigator.clipboard.writeText(text).then(() => alert("ক্লিপবোর্ডে কপি হয়েছে!"));
}

function requestNotification(fix) {
  if (!("Notification" in window)) { alert("Notification সাপোর্ট নেই।"); return; }
  Notification.requestPermission().then(p => {
    if (p !== "granted") { alert("Permission দেওয়া হয়নি।"); return; }
    try {
      const ms = matchUTC(fix.dateStr, fix.etTime) - Date.now() - 600000;
      if (ms <= 0) { alert("ম্যাচ শুরু হয়ে গেছে!"); return; }
      setTimeout(() => new Notification("⚽ ১০ মিনিট পরে ম্যাচ!", { body:`${fix.home} vs ${fix.away} — ${bdTime(fix.etTime)} BD` }), ms);
      alert("✅ রিমাইন্ডার সেট!");
    } catch { alert("সময় নির্ধারণে সমস্যা।"); }
  });
}

function getTeamGroup(t) {
  for (const [g,ts] of Object.entries(GROUPS)) if (ts.includes(t)) return g;
  return "?";
}

// ── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const [dark, setDark] = useState(true);
  const [darkAnimating, setDarkAnimating] = useState(false);
  const [tab, setTab] = useState("fixtures");
  const [search, setSearch] = useState("");
  const [grpFilter, setGrpFilter] = useState("ALL");
  const [koRound, setKoRound] = useState(0);
  const [squadTeam, setSquadTeam] = useState(null);
  const [standGrp, setStandGrp] = useState("A");
  const [stadIdx, setStadIdx] = useState(null);
  const [results, setResults] = useState({});
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
  // Feature: Top Scorers
  const [scorers, setScorers] = useState([]);
  const [scorersLoading, setScorersLoading] = useState(false);
  const [scorersFetched, setScorersFetched] = useState(false);
  // Feature: Visitor Counter
  const [visitorCount, setVisitorCount] = useState(null);

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

  // Auto-fetch results from Anthropic API
  const fetchResults = useCallback(async () => {
    setAutoFetching(true);
    try {
      const now = new Date();

      // match শুরু হয়েছে এমন সব matches
      const startedMatches = ALL_GROUP_FIXTURES.filter(f => {
        try {
          const utc = matchUTC(f.dateStr, f.etTime);
          return (now.getTime() - utc) > 0;
        } catch { return false; }
      });

      if (startedMatches.length === 0) { setAutoFetching(false); return; }

      // Live match আছে কিনা (kickoff থেকে 115 min এর মধ্যে)
      const liveMatches = startedMatches.filter(f => {
        try {
          const utc = matchUTC(f.dateStr, f.etTime);
          const elapsed = now.getTime() - utc;
          return elapsed >= 0 && elapsed < 115 * 60 * 1000;
        } catch { return false; }
      });

      const hasLiveMatch = liveMatches.length > 0;
      const targetMatches = hasLiveMatch ? liveMatches : startedMatches.slice(-12);

      const matchList = targetMatches.map(f =>
        `ID:${f.id} | ${f.home} vs ${f.away} | ${f.dateStr} 2026`
      ).join("\n");

      const systemPrompt = hasLiveMatch
        ? `You are a LIVE FIFA World Cup 2026 score tracker. Search for CURRENT live scores RIGHT NOW and return ONLY valid JSON. Include live and final scores. Format: {"results": {"matchId": {"h": homeScore, "a": awayScore, "status": "LIVE" or "FT"}, ...}}. No markdown.`
        : `You are a FIFA World Cup 2026 score tracker. Search for final match results and return ONLY valid JSON. Format: {"results": {"matchId": {"h": homeScore, "a": awayScore}, ...}}. Use null for no result. No markdown.`;

      const userMsg = hasLiveMatch
        ? `Search for LIVE/current scores of these FIFA World Cup 2026 matches RIGHT NOW:\n${matchList}\n\nReturn ONLY JSON like: {"results": {"1": {"h": 2, "a": 1, "status": "LIVE"}}}`
        : `Search for final scores of these FIFA World Cup 2026 matches:\n${matchList}\n\nReturn ONLY JSON like: {"results": {"1": {"h": 2, "a": 1}, "2": {"h": 0, "a": 0}}}`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          system: systemPrompt,
          messages: [{ role: "user", content: userMsg }]
        })
      });
      const data = await response.json();
      const text = data.content?.map(i => i.type === "text" ? i.text : "").filter(Boolean).join("") || "";
      const clean = text.replace(/```json|```/g, "").trim();
      try {
        const parsed = JSON.parse(clean);
        if (parsed.results && typeof parsed.results === "object") {
          setResults(prev => {
            const updated = { ...prev };
            Object.entries(parsed.results).forEach(([id, val]) => {
              if (val && val.h !== null && val.a !== null && !isNaN(+val.h) && !isNaN(+val.a)) {
                updated[+id] = { h: String(val.h), a: String(val.a), status: val.status || "FT" };
              }
            });
            return updated;
          });
          setLastFetched(new Date());
        }
      } catch {}
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
      const hasLive = ALL_GROUP_FIXTURES.some(f => {
        try {
          const utc = matchUTC(f.dateStr, f.etTime);
          const elapsed = now - utc;
          return elapsed >= 0 && elapsed < 115 * 60 * 1000;
        } catch { return false; }
      });
      const delay = hasLive ? 30 * 1000 : 60 * 1000;
      timeoutId = setTimeout(async () => {
        await fetchResults();
        scheduleNext();
      }, delay);
    };
    scheduleNext();
    return () => clearTimeout(timeoutId);
  }, [fetchResults]);

  useEffect(() => {
    try { favTeam ? localStorage.setItem("wc26_fav",favTeam) : localStorage.removeItem("wc26_fav"); } catch {}
  }, [favTeam]);

  // Visitor counter — countapi.xyz (free, no backend needed)
  useEffect(() => {
    async function trackVisit() {
      try {
        const ns = (window.location.hostname || 'wc2026app').replace(/\./g,'_');
        const res = await fetch(`https://api.countapi.xyz/hit/${ns}/wc26_visitors`);
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data.value === 'number') setVisitorCount(data.value);
        }
      } catch {}
    }
    trackVisit();
  }, []);

  // (ticker uses pure CSS animation)

  function setResult(id, h, a) { setResults(p => ({...p,[id]:{h,a}})); }
  function toggleFav(team) { setFavTeam(p => p===team ? null : team); }

  function toggleDark() {
    setDarkAnimating(true);
    setTimeout(() => { setDark(d => !d); setDarkAnimating(false); }, 180);
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

  // Top Scorers - fetch via Anthropic API with web search
  const fetchScorers = useCallback(async () => {
    if (scorersLoading) return;
    setScorersLoading(true);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          system: `You are a FIFA World Cup 2026 stats tracker. Search for the current top scorers and return ONLY valid JSON. No markdown, no explanation. Return format: {"scorers": [{"rank": 1, "name": "Player Name", "team": "Country", "goals": 3, "assists": 1, "matches": 3}, ...], "updated": "date string"}. Include top 20 scorers minimum. If the tournament hasn't started or no goals yet, return {"scorers": [], "updated": "not started"}`,
          messages: [{ role: "user", content: "Search for FIFA World Cup 2026 top goal scorers list right now. Return JSON only." }]
        })
      });
      const data = await response.json();
      const text = data.content?.map(i => i.type === "text" ? i.text : "").filter(Boolean).join("") || "";
      const clean = text.replace(/```json|```/g, "").trim();
      try {
        const parsed = JSON.parse(clean);
        if (parsed.scorers && Array.isArray(parsed.scorers)) {
          setScorers(parsed.scorers);
          setScorersFetched(true);
        }
      } catch { setScorersFetched(true); }
    } catch (err) {
      console.error("Scorers fetch error:", err);
      setScorersFetched(true);
    }
    setScorersLoading(false);
  }, [scorersLoading]);

  // standings calc
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
    let list = ALL_GROUP_FIXTURES;
    if(grpFilter!=="ALL") list=list.filter(f=>f.grp===grpFilter);
    if(search.trim()) { const q=search.toLowerCase(); list=list.filter(f=>f.home.toLowerCase().includes(q)||f.away.toLowerCase().includes(q)); }
    if(favTeam) list=[...list.filter(f=>f.home===favTeam||f.away===favTeam),...list.filter(f=>f.home!==favTeam&&f.away!==favTeam)];
    return list;
  },[grpFilter,search,favTeam]);

  // Ticker: recent results + upcoming matches
  const tickerItems = useMemo(() => {
    const now = Date.now();
    const items = [];
    ALL_GROUP_FIXTURES.forEach(f => {
      const r = results[f.id];
      const hasScore = r && r.h !== "" && r.a !== "" && !isNaN(+r.h) && !isNaN(+r.a);
      const started = matchUTC(f.dateStr, f.etTime) < now;
      const over = matchUTC(f.dateStr, f.etTime) + 105*60000 < now;
      if (hasScore) {
        items.push(`${FLAGS[f.home]||"🏳"} ${f.home} ${r.h}–${r.a} ${f.away} ${FLAGS[f.away]||"🏳"} ${over?"FT":"🔴LIVE"}`);
      } else if (!started) {
        items.push(`⏰ ${FLAGS[f.home]||"🏳"} ${f.home} vs ${f.away} ${FLAGS[f.away]||"🏳"} · ${bdTime(f.etTime)} · ${f.dateStr}`);
      }
    });
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
    {k:"standings",l:"📊 Standings"},
    {k:"bracket",l:"🗂️ Bracket"},
    {k:"scorers",l:"⚽ Scorers"},
    {k:"stadiums",l:"🏟️ Stadiums"},
    {k:"squads",l:"👕 Squads"},
    {k:"journey", l:"🗺️ Journey"},
  ];

  // today's matches helper
  const todayMatches = useMemo(()=>{
    const now=Date.now(); const bd=new Date(now+6*3600000);
    const mn=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const today=mn[bd.getUTCMonth()]+" "+bd.getUTCDate();
    return ALL_GROUP_FIXTURES.filter(f=>f.dateStr===today);
  },[]);

  // Group fixtures by date for the fixture tab
  const fixturesByDate = useMemo(() => {
    const grouped = {};
    filteredFix.forEach(f => {
      if (!grouped[f.dateStr]) grouped[f.dateStr] = [];
      grouped[f.dateStr].push(f);
    });
    const mn = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return Object.entries(grouped).sort(([a],[b]) => {
      const [am,ad] = a.split(" "); const [bm,bd2] = b.split(" ");
      return (mn.indexOf(am)*31 + +ad) - (mn.indexOf(bm)*31 + +bd2);
    });
  }, [filteredFix]);

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
          table{font-size:11px!important;}
          th,td{padding:6px 4px!important;}
          .main-content{padding-bottom:90px!important;}
          .top-tabs{display:none!important;}
        }
        @media(min-width:601px){
          .bottom-nav{display:none!important;}
        }
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
        <div style={{background:T.hdr,borderBottom:`1px solid ${T.border}`,padding:"12px 14px 0",position:"sticky",top:0,zIndex:100,backdropFilter:"blur(12px)"}}>
          <div style={{maxWidth:1060,margin:"0 auto"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <div style={{width:40,height:40,background:`linear-gradient(135deg,${c},${dark?"#065f46":"#047857"})`,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>⚽</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:22,letterSpacing:3,color:c,lineHeight:1}}>FIFA WORLD CUP 2026</div>
                <div style={{fontSize:10,color:T.sub,letterSpacing:.5}}>USA · CANADA · MEXICO · JUN 11 – JUL 19 · BD সময় GMT+6</div>
              </div>
              <div className="hide-sm" style={{display:"flex",gap:14,alignItems:"center"}}>
                {[["48","Teams"],["12","Groups"],["104","Matches"]].map(([n,l])=>(
                  <div key={l} style={{textAlign:"center"}}>
                    <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:20,color:c,lineHeight:1}}>{n}</div>
                    <div style={{fontSize:9,color:T.sub,textTransform:"uppercase",letterSpacing:1}}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <div style={{padding:"5px 10px",background:T.acBg,border:`1px solid ${c}33`,borderRadius:8,textAlign:"center"}}>
                    <div style={{fontSize:8,color:T.sub,letterSpacing:1,textTransform:"uppercase",marginBottom:1}}>🇧🇩 BD সময়</div>
                    <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:14,color:c,letterSpacing:1,lineHeight:1}}>{bdClock}</div>
                  </div>
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
              {/* Today / Next - HERO BANNER */}
              {todayMatches.length>0 ? (
                <div style={{marginBottom:24,borderRadius:18,overflow:"hidden",border:`1px solid ${c}33`,boxShadow:`0 0 40px ${c}18`}}>
                  {/* Banner Header */}
                  <div style={{background:`linear-gradient(135deg,${dark?"#064e3b":"#047857"},${dark?"#065f46 60%,#000e05":"#059669 60%,#f0fdf4"})`,padding:"16px 20px",display:"flex",alignItems:"center",gap:10}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{width:9,height:9,borderRadius:"50%",background:"#ef4444",display:"inline-block",animation:"pulse 1s infinite",boxShadow:"0 0 8px #ef444488"}}/>
                      <span style={{fontFamily:"'Bebas Neue',cursive",fontSize:20,letterSpacing:3,color:"#fff"}}>আজকের ম্যাচ</span>
                    </div>
                    <span style={{marginLeft:4,padding:"2px 10px",background:"rgba(255,255,255,.15)",borderRadius:999,fontSize:11,fontWeight:700,color:"#fff",backdropFilter:"blur(4px)"}}>{todayMatches.length}টি ম্যাচ</span>
                    <div style={{marginLeft:"auto",fontSize:11,color:"rgba(255,255,255,.7)",fontWeight:500}}>
                      {new Date(Date.now()+6*3600000).toLocaleDateString("bn-BD",{weekday:"long",month:"long",day:"numeric"})} — BD সময়
                    </div>
                  </div>
                  {/* Match rows */}
                  <div style={{background:T.card,padding:"12px 16px",display:"flex",flexDirection:"column",gap:8}}>
                    {todayMatches.map((fix,idx)=>{
                      const fav=favTeam&&(fix.home===favTeam||fix.away===favTeam);
                      const r=results[fix.id];
                      const hasScore=r&&r.h!==""&&r.a!==""&&!isNaN(+r.h)&&!isNaN(+r.a);
                      const matchOver=matchUTC(fix.dateStr,fix.etTime)+105*60000<Date.now();
                      return (
                        <div key={fix.id} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",background:fav?"rgba(251,191,36,.06)":T.acBg,border:`1.5px solid ${fav?"rgba(251,191,36,.35)":c+"33"}`,borderRadius:12,animation:`slideUp .3s ease ${idx*0.07}s both`,position:"relative",overflow:"hidden"}}>
                          {fav && <div style={{position:"absolute",top:0,left:0,width:"100%",height:2,background:"linear-gradient(90deg,#fbbf24,transparent)"}}/>}
                          <div style={{display:"flex",alignItems:"center",gap:8,flex:1,justifyContent:"flex-end"}}>
                            <span style={{fontWeight:700,fontSize:14,color:fav&&fix.home===favTeam?"#fbbf24":T.text,textAlign:"right"}}>{fix.home}</span>
                            <span style={{fontSize:28,cursor:"pointer"}} onClick={()=>toggleFav(fix.home)}>{FLAGS[fix.home]||"🏳"}</span>
                          </div>
                          <div style={{textAlign:"center",minWidth:100,flexShrink:0}}>
                            {hasScore ? (
                              <div style={{padding:"6px 14px",background:"rgba(16,185,129,.15)",border:`1.5px solid ${c}55`,borderRadius:10}}>
                                <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:26,color:c,lineHeight:1}}>{r.h} – {r.a}</div>
                                <div style={{fontSize:9,color:matchOver?T.sub:"#ef4444",fontWeight:800,letterSpacing:1}}>{r.status==="LIVE"?"🔴 LIVE":r.status==="FT"?"FULL TIME":matchOver?"FULL TIME":"🔴 LIVE"}</div>
                              </div>
                            ) : (
                              <div>
                                <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:13,color:fav?"#fbbf24":c,lineHeight:1.2}}>{bdTime(fix.etTime)}</div>
                                <div style={{fontSize:9,color:T.sub,marginBottom:4}}>BD সময় · Grp {fix.grp}</div>
                                <Countdown dateStr={fix.dateStr} etTime={fix.etTime} accent={fav?"#fbbf24":c}/>
                              </div>
                            )}
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:8,flex:1}}>
                            <span style={{fontSize:28,cursor:"pointer"}} onClick={()=>toggleFav(fix.away)}>{FLAGS[fix.away]||"🏳"}</span>
                            <span style={{fontWeight:700,fontSize:14,color:fav&&fix.away===favTeam?"#fbbf24":T.text}}>{fix.away}</span>
                          </div>
                          <div style={{display:"flex",flexDirection:"column",gap:4,flexShrink:0}}>
                            <button onClick={()=>shareMatch(fix)} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,opacity:.6}}>📤</button>
                            <button onClick={()=>requestNotification(fix)} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,opacity:.6}}>🔔</button>
                            <button onClick={()=>fetchH2H(fix)} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,opacity:.6}} title="H2H">⚔️</button>                          </div>
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
                    <div style={{fontSize:11,color:T.sub,marginTop:2}}>{nextMatch.dateStr} 2026 · {bdTime(nextMatch.etTime)} · {nextMatch.venue.split(",")[0]}</div>
                  </div>
                  <Countdown dateStr={nextMatch.dateStr} etTime={nextMatch.etTime} accent={c}/>
                </div>
              )}

              {/* Search */}
              <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"flex-start"}}>
                <div style={{position:"relative",flex:1,minWidth:180}}>
                  <input type="text" value={search} onChange={e=>{setSearch(e.target.value);setGrpFilter("ALL");}}
                    placeholder="🔍 দলের নাম খুঁজুন... Brazil, Spain..."
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

              {/* Cards - Date grouped */}
              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                {fixturesByDate.map(([dateStr, fixes]) => {
                  const now = Date.now();
                  const bdNow = new Date(now + 6*3600000);
                  const mn = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
                  const todayStr = mn[bdNow.getUTCMonth()] + " " + bdNow.getUTCDate();
                  const isToday = dateStr === todayStr;
                  const allPast = fixes.every(f => { try { return matchUTC(f.dateStr, f.etTime) + 105*60000 < now; } catch { return false; } });
                  return (
                    <div key={dateStr}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                        <div style={{padding:"3px 10px",borderRadius:6,background:isToday?c:T.acBg,color:isToday?T.bg:c,fontFamily:"'Bebas Neue',cursive",fontSize:12,letterSpacing:1.5,flexShrink:0}}>
                          {isToday?"🔴 আজ":""}{dateStr} 2026
                        </div>
                        {allPast && <span style={{fontSize:9,color:T.sub}}>সম্পন্ন</span>}
                        <div style={{flex:1,height:1,background:T.border}}/>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:7}}>
                        {fixes.map(fix => {
                          const isFav = favTeam && (fix.home === favTeam || fix.away === favTeam);
                          const hl = search && (fix.home.toLowerCase().includes(search.toLowerCase()) || fix.away.toLowerCase().includes(search.toLowerCase()));
                          const r = results[fix.id];
                          const hasScore = r && r.h !== "" && r.a !== "" && !isNaN(+r.h) && !isNaN(+r.a);
                          const matchStarted = matchUTC(fix.dateStr, fix.etTime) < now;
                          const matchOver = matchUTC(fix.dateStr, fix.etTime) + 105*60000 < now;
                          return (
                            <div key={fix.id} className={`fc${isFav?" fav-card":""}`} style={{background:T.card,border:`1px solid ${isFav?"rgba(251,191,36,.4)":hl?c+"55":T.border}`,borderRadius:12,padding:"11px 13px",transition:"all .2s",boxShadow:T.sh}}>
                              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:7,flexWrap:"wrap"}}>
                                <div style={{width:22,height:22,background:T.acBg,borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Bebas Neue',cursive",fontSize:11,color:c,flexShrink:0}}>G{fix.grp}</div>
                                <span style={{fontSize:10,color:T.sub,marginLeft:"auto",textAlign:"right",flex:1}}>📍 {fix.venue.split(",")[0]}</span>
                                <button onClick={()=>shareMatch(fix)} title="শেয়ার" style={{background:"none",border:"none",cursor:"pointer",fontSize:12,opacity:.55,color:T.sub}}>📤</button>
                                <button onClick={()=>requestNotification(fix)} title="Reminder" style={{background:"none",border:"none",cursor:"pointer",fontSize:12,opacity:.55,color:T.sub}}>🔔</button>
                              </div>
                              <div className="fc-inner" style={{display:"flex",alignItems:"center",gap:8}}>
                                <div style={{display:"flex",alignItems:"center",gap:6,flex:1,justifyContent:"flex-end"}}>
                                  <span style={{fontSize:13,fontWeight:700,color:hasScore&&+r.h>+r.a?c:favTeam===fix.home?"#fbbf24":T.text,textAlign:"right"}}>{fix.home}</span>
                                  <span style={{fontSize:24,cursor:"pointer"}} onClick={()=>toggleFav(fix.home)} title="প্রিয় দল">{FLAGS[fix.home]||"🏳"}</span>
                                </div>
                                <div style={{padding:"5px 9px",background:hasScore?"rgba(16,185,129,.15)":isFav?"rgba(251,191,36,.07)":T.acBg,border:`1px solid ${hasScore?c+"66":isFav?"rgba(251,191,36,.2)":c+"33"}`,borderRadius:8,textAlign:"center",minWidth:82,flexShrink:0}}>
                                  {hasScore ? (
                                    <>
                                      <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:22,color:c,lineHeight:1}}>{r.h} – {r.a}</div>
                                      <div style={{fontSize:8,color:matchOver?T.sub:"#ef4444",fontWeight:700}}>{r.status==="LIVE"?"🔴 LIVE":r.status==="FT"?"FT":matchOver?"FT":"🔴 LIVE"}</div>
                                    </>
                                  ) : (
                                    <>
                                      <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:9,color:T.sub,letterSpacing:1}}>VS</div>
                                      <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:12,color:isFav?"#fbbf24":c,lineHeight:1.3}}>{bdTime(fix.etTime)}</div>
                                      <div style={{fontSize:8,color:T.dim}}>BD সময়</div>
                                    </>
                                  )}
                                </div>
                                <div style={{display:"flex",alignItems:"center",gap:6,flex:1}}>
                                  <span style={{fontSize:24,cursor:"pointer"}} onClick={()=>toggleFav(fix.away)} title="প্রিয় দল">{FLAGS[fix.away]||"🏳"}</span>
                                  <span style={{fontSize:13,fontWeight:700,color:hasScore&&+r.a>+r.h?c:favTeam===fix.away?"#fbbf24":T.text}}>{fix.away}</span>
                                </div>
                              </div>
                              {!hasScore && <Countdown dateStr={fix.dateStr} etTime={fix.etTime} accent={isFav?"#fbbf24":c}/>}
                              {/* H2H toggle button */}
                              <div style={{display:"flex",justifyContent:"flex-end",marginTop:6}}>
                                <button onClick={()=>fetchH2H(fix)}
                                  style={{background:"none",border:`1px solid ${h2hFixId===fix.id?c:T.border}`,borderRadius:6,padding:"3px 9px",cursor:"pointer",fontSize:10,color:h2hFixId===fix.id?c:T.sub,fontWeight:700,display:"flex",alignItems:"center",gap:4,transition:"all .2s"}}>
                                  ⚔️ H2H {h2hFixId===fix.id?"▲":"▼"}
                                </button>
                              </div>
                              {/* H2H Panel */}
                              {h2hFixId===fix.id && h2hData[fix.id] && (()=>{
                                const d = h2hData[fix.id];
                                const hTeam = d.home_team||fix.home;
                                const aTeam = d.away_team||fix.away;
                                const hasRealData = d.meetings > 0;
                                return (
                                <div style={{marginTop:8,padding:"12px 14px",background:T.acBg,border:`1px solid ${c}33`,borderRadius:10,animation:"fadeIn .2s ease"}}>
                                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
                                    <span style={{fontSize:14}}>⚔️</span>
                                    <span style={{fontFamily:"'Bebas Neue',cursive",fontSize:13,letterSpacing:2,color:c}}>HEAD TO HEAD</span>
                                    {d.wc_meetings>0 && <span className="pill" style={{background:"rgba(251,191,36,.15)",color:"#fbbf24"}}>🏆 WC: {d.wc_meetings}বার</span>}
                                  </div>
                                  {hasRealData ? (<>
                                    <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:6,marginBottom:10,alignItems:"center"}}>
                                      <div style={{textAlign:"center",padding:"10px 6px",background:T.card,border:`1px solid ${c}33`,borderRadius:10}}>
                                        <div style={{fontSize:10,color:T.sub,marginBottom:2}}>{FLAGS[hTeam]||"🏳"} {hTeam}</div>
                                        <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:28,color:c,lineHeight:1}}>{d.home_wins}</div>
                                        <div style={{fontSize:9,color:T.sub}}>জয়</div>
                                      </div>
                                      <div style={{textAlign:"center",padding:"0 4px"}}>
                                        <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:22,color:T.sub,lineHeight:1}}>{d.draws}</div>
                                        <div style={{fontSize:9,color:T.dim}}>ড্র</div>
                                        <div style={{fontSize:9,color:T.dim,marginTop:2,whiteSpace:"nowrap"}}>{d.meetings} ম্যাচ</div>
                                      </div>
                                      <div style={{textAlign:"center",padding:"10px 6px",background:T.card,border:`1px solid ${c}33`,borderRadius:10}}>
                                        <div style={{fontSize:10,color:T.sub,marginBottom:2}}>{FLAGS[aTeam]||"🏳"} {aTeam}</div>
                                        <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:28,color:"#f59e0b",lineHeight:1}}>{d.away_wins}</div>
                                        <div style={{fontSize:9,color:T.sub}}>জয়</div>
                                      </div>
                                    </div>
                                    <div style={{display:"flex",height:5,borderRadius:3,overflow:"hidden",marginBottom:10,gap:1}}>
                                      <div style={{flex:d.home_wins||0.01,background:c,transition:"flex .5s"}}/>
                                      <div style={{flex:d.draws||0.01,background:"#6b7280",transition:"flex .5s"}}/>
                                      <div style={{flex:d.away_wins||0.01,background:"#f59e0b",transition:"flex .5s"}}/>
                                    </div>
                                  </>) : (
                                    <div style={{padding:"6px 10px",background:"rgba(251,191,36,.07)",border:"1px solid rgba(251,191,36,.2)",borderRadius:7,fontSize:11,color:"#fbbf24",marginBottom:8}}>
                                      🆕 দুই দলের প্রথম সাক্ষাৎ
                                    </div>
                                  )}
                                  <div style={{fontSize:11,color:T.text,lineHeight:1.7,marginBottom:8,padding:"8px 10px",background:T.card,borderRadius:8,border:`1px solid ${T.border}`}}>{d.summary}</div>
                                  {d.last_match && d.last_match!=="তথ্য পাওয়া যায়নি" && (
                                    <div style={{fontSize:11,color:T.sub,marginBottom:6,display:"flex",alignItems:"flex-start",gap:6}}>
                                      <span style={{flexShrink:0,color:c}}>🕐</span>
                                      <span><span style={{fontWeight:700,color:T.text}}>শেষ ম্যাচ{d.last_year?` (${d.last_year})`:""}: </span>{d.last_match}</span>
                                    </div>
                                  )}
                                  {d.notable_fact && d.notable_fact.length>3 && (
                                    <div style={{fontSize:11,color:T.sub,padding:"6px 10px",background:"rgba(251,191,36,.06)",border:"1px solid rgba(251,191,36,.2)",borderRadius:7,display:"flex",gap:6}}>
                                      <span style={{flexShrink:0}}>💡</span><span>{d.notable_fact}</span>
                                    </div>
                                  )}
                                </div>
                                );
                              })()}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═══ STANDINGS ═══ */}
          {tab==="standings" && (
            <div className="fi">
              <div style={{fontSize:12,color:T.sub,marginBottom:14}}>ফলাফল auto-update হয় · ম্যাচ শেষ হলে qualified দল স্বয়ংক্রিয় নির্ধারিত হবে</div>
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
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,minWidth:400}}>
                        <thead>
                          <tr style={{borderBottom:`1px solid ${T.border}`}}>
                            {["#","দল","MP","W","D","L","GF","GA","GD","PTS"].map(h=>(
                              <th key={h} style={{padding:"7px 8px",textAlign:h==="দল"?"left":"center",fontSize:10,color:T.sub,fontWeight:700,letterSpacing:.5,textTransform:"uppercase"}}>{h}</th>
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
                              <td style={{padding:"9px 8px",textAlign:"center"}}>
                                <div style={{width:22,height:22,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:12,background:isDefinitelyQ&&i===0?"rgba(251,191,36,.2)":isDefinitelyQ&&i===1?T.acBg:"transparent",color:isDefinitelyQ&&i===0?"#fbbf24":isDefinitelyQ&&i===1?c:T.sub,border:isDefinitelyQ?`1px solid ${i===0?"rgba(251,191,36,.4)":c+"44"}`:"none"}}>{i+1}</div>
                              </td>
                              <td style={{padding:"9px 8px"}}>
                                <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
                                  <span style={{fontSize:17}}>{FLAGS[s.team]||"🏳"}</span>
                                  <span style={{fontWeight:600,fontSize:13,color:T.text}}>{s.team}</span>
                                  {isDefinitelyQ && i===0 && <span className="pill q-badge-yellow">🏆 1ম</span>}
                                  {isDefinitelyQ && i===1 && <span className="pill q-badge-green">✓ Qualified</span>}
                                  {isPossiblyQ && <span className="pill q-badge-yellow">~Q</span>}
                                  {isDefinitelyElim && <span className="pill q-badge-red">✗ বিদায়</span>}
                                </div>
                              </td>
                              {[s.mp,s.w,s.d,s.l,s.gf,s.ga,s.gd>0?"+"+s.gd:s.gd].map((v,vi)=>(
                                <td key={vi} style={{padding:"9px 8px",textAlign:"center",color:vi===6?(s.gd>0?c:s.gd<0?"#ef4444":T.sub):T.text,fontWeight:vi===6?700:400}}>{v}</td>
                              ))}
                              <td style={{padding:"9px 8px",textAlign:"center"}}>
                                <span style={{fontFamily:"'Bebas Neue',cursive",fontSize:20,color:isDefinitelyQ?c:T.text}}>{s.pts}</span>
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
                    <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:13,letterSpacing:2,color:c,marginBottom:8}}>GROUP {g} · ম্যাচ ফলাফল</div>
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {fixes.map(fix=>{
                        const r=results[fix.id]||{h:"",a:""};
                        const hasScore = r.h !== "" && r.a !== "" && !isNaN(+r.h) && !isNaN(+r.a);
                        const matchOver = matchUTC(fix.dateStr, fix.etTime) + 105*60000 < Date.now();
                        const matchStarted = matchUTC(fix.dateStr, fix.etTime) < Date.now();
                        return (
                          <div key={fix.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:T.card,border:`1px solid ${hasScore?c+"44":T.border}`,borderRadius:9,flexWrap:"wrap",boxShadow:T.sh}}>
                            <span style={{fontSize:15}}>{FLAGS[fix.home]||"🏳"}</span>
                            <span style={{fontSize:12,fontWeight:700,flex:1,minWidth:50,color:hasScore&&+r.h>+r.a?c:T.text}}>{fix.home}</span>
                            <div style={{padding:"4px 12px",background:hasScore?T.acBg:T.muted,border:`1px solid ${hasScore?c+"44":T.border}`,borderRadius:6,textAlign:"center",minWidth:70}}>
                              {hasScore
                                ? <span style={{fontFamily:"'Bebas Neue',cursive",fontSize:18,color:c}}>{r.h} – {r.a}</span>
                                : <span style={{fontFamily:"'Bebas Neue',cursive",fontSize:12,color:matchStarted?"#ef4444":T.sub}}>{matchStarted?"LIVE":"vs"}</span>
                              }
                            </div>
                            <span style={{fontSize:12,fontWeight:700,flex:1,minWidth:50,textAlign:"right",color:hasScore&&+r.a>+r.h?c:T.text}}>{fix.away}</span>
                            <span style={{fontSize:15}}>{FLAGS[fix.away]||"🏳"}</span>
                            <div style={{width:"100%",display:"flex",justifyContent:"space-between"}}>
                              <span style={{fontSize:9,color:T.sub}}>{fix.dateStr} · {bdTime(fix.etTime)} BD</span>
                              <span style={{fontSize:9,color:hasScore?c:matchStarted?"#ef4444":T.dim}}>{hasScore?(matchOver?"FT":"LIVE"):matchStarted?"চলছে":"আসছে"}</span>
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
          {tab==="journey" && <TournamentJourneyMap />}

          {/* ═══ BRACKET ═══ */}
          {tab==="bracket" && (()=>{
            try {
            // Build qualified teams from standings
            // Winner = rank 1, Runner-up = rank 2 of each group
            const getQualified = (grp, rank) => {
              const rows = calcStandings(grp);
              const fixes = ALL_GROUP_FIXTURES.filter(f=>f.grp===grp);
              const played = fixes.filter(f=>{const r=results[f.id];return r&&r.h!==""&&r.a!==""&&!isNaN(+r.h)&&!isNaN(+r.a);}).length;
              if(played===0) return null;
              return rows[rank] ? {team:rows[rank].team, flag:FLAGS[rows[rank].team]||"🏳", confirmed:played===6} : null;
            };
            // Slot labels matching FIFA WC26 R32 structure
            // W=Winner, R=Runner-up, B=Best 3rd (TBD)
            const slot = (grp, rank) => {
              const q = getQualified(grp, rank);
              if(!q) return {team: rank===0?`W Group ${grp}`:`2nd Group ${grp}`, flag:"❓", confirmed:false, tbd:true};
              return q;
            };
            // R32 pairings (simplified FIFA WC26 bracket)
            const r32 = [
              {m:1, a:slot("A",1), b:slot("B",1), date:"Jun 28", bd:"রাত ১টা+1"},
              {m:2, a:slot("C",0), b:slot("F",1), date:"Jun 29", bd:"রাত ১১টা"},
              {m:3, a:slot("E",0), b:{team:"Best 3rd",flag:"❓",confirmed:false,tbd:true}, date:"Jun 29", bd:"ভোর ২:৩০+1"},
              {m:4, a:slot("F",0), b:slot("C",1), date:"Jun 29", bd:"সকাল ৭টা+1"},
              {m:5, a:slot("E",1), b:slot("I",1), date:"Jun 30", bd:"রাত ১১টা"},
              {m:6, a:slot("I",0), b:{team:"Best 3rd",flag:"❓",confirmed:false,tbd:true}, date:"Jun 30", bd:"ভোর ৩টা+1"},
              {m:7, a:slot("A",0), b:{team:"Best 3rd",flag:"❓",confirmed:false,tbd:true}, date:"Jun 30", bd:"সকাল ৭টা+1"},
              {m:8, a:slot("L",0), b:{team:"Best 3rd",flag:"❓",confirmed:false,tbd:true}, date:"Jul 1", bd:"রাত ১০টা"},
              {m:9, a:slot("G",0), b:{team:"Best 3rd",flag:"❓",confirmed:false,tbd:true}, date:"Jul 1", bd:"ভোর ২টা+1"},
              {m:10,a:slot("D",0), b:{team:"Best 3rd",flag:"❓",confirmed:false,tbd:true}, date:"Jul 1", bd:"ভোর ৬টা+1"},
              {m:11,a:slot("H",0), b:slot("J",1), date:"Jul 2", bd:"রাত ১টা+1"},
              {m:12,a:slot("K",1), b:slot("L",1), date:"Jul 2", bd:"ভোর ৫টা+1"},
              {m:13,a:slot("B",0), b:{team:"Best 3rd",flag:"❓",confirmed:false,tbd:true}, date:"Jul 2", bd:"সকাল ৯টা+1"},
              {m:14,a:slot("D",1), b:slot("G",1), date:"Jul 3", bd:"রাত ১২টা"},
              {m:15,a:slot("J",0), b:slot("H",1), date:"Jul 3", bd:"ভোর ৪টা+1"},
              {m:16,a:slot("K",0), b:{team:"Best 3rd",flag:"❓",confirmed:false,tbd:true}, date:"Jul 3", bd:"সকাল ৭:৩০+1"},
            ];
            const r16 = [
              {m:1,a:{team:"W R32-1",flag:"❓",tbd:true},b:{team:"W R32-2",flag:"❓",tbd:true},date:"Jul 4",bd:"রাত ১১টা"},
              {m:2,a:{team:"W R32-3",flag:"❓",tbd:true},b:{team:"W R32-4",flag:"❓",tbd:true},date:"Jul 4",bd:"ভোর ৩টা+1"},
              {m:3,a:{team:"W R32-5",flag:"❓",tbd:true},b:{team:"W R32-6",flag:"❓",tbd:true},date:"Jul 5",bd:"ভোর ২টা+1"},
              {m:4,a:{team:"W R32-7",flag:"❓",tbd:true},b:{team:"W R32-8",flag:"❓",tbd:true},date:"Jul 5",bd:"ভোর ৬টা+1"},
              {m:5,a:{team:"W R32-9",flag:"❓",tbd:true},b:{team:"W R32-10",flag:"❓",tbd:true},date:"Jul 6",bd:"রাত ১টা+1"},
              {m:6,a:{team:"W R32-11",flag:"❓",tbd:true},b:{team:"W R32-12",flag:"❓",tbd:true},date:"Jul 6",bd:"ভোর ৬টা+1"},
              {m:7,a:{team:"W R32-13",flag:"❓",tbd:true},b:{team:"W R32-14",flag:"❓",tbd:true},date:"Jul 7",bd:"রাত ১০টা"},
              {m:8,a:{team:"W R32-15",flag:"❓",tbd:true},b:{team:"W R32-16",flag:"❓",tbd:true},date:"Jul 7",bd:"ভোর ২টা+1"},
            ];
            const qf = [
              {m:1,a:{team:"W R16-1",flag:"❓",tbd:true},b:{team:"W R16-2",flag:"❓",tbd:true},date:"Jul 9",bd:"ভোর ২টা+1"},
              {m:2,a:{team:"W R16-3",flag:"❓",tbd:true},b:{team:"W R16-4",flag:"❓",tbd:true},date:"Jul 10",bd:"রাত ১টা+1"},
              {m:3,a:{team:"W R16-5",flag:"❓",tbd:true},b:{team:"W R16-6",flag:"❓",tbd:true},date:"Jul 11",bd:"ভোর ৩টা+1"},
              {m:4,a:{team:"W R16-7",flag:"❓",tbd:true},b:{team:"W R16-8",flag:"❓",tbd:true},date:"Jul 11",bd:"সকাল ৭টা+1"},
            ];
            const sf = [
              {m:1,a:{team:"W QF-1",flag:"❓",tbd:true},b:{team:"W QF-2",flag:"❓",tbd:true},date:"Jul 14",bd:"রাত ১টা+1"},
              {m:2,a:{team:"W QF-3",flag:"❓",tbd:true},b:{team:"W QF-4",flag:"❓",tbd:true},date:"Jul 15",bd:"রাত ১টা+1"},
            ];
            const fin = [{m:1,a:{team:"W SF-1",flag:"❓",tbd:true},b:{team:"W SF-2",flag:"❓",tbd:true},date:"Jul 19",bd:"রাত ১টা+1"}];
            const third = [{m:1,a:{team:"L SF-1",flag:"❓",tbd:true},b:{team:"L SF-2",flag:"❓",tbd:true},date:"Jul 18",bd:"ভোর ৩টা+1"}];

            const MatchCard = ({match, color="#10b981", isFinal=false}) => {
              const isSelected = bracketSelected === `${match.m}-${color}`;
              return (
              <div className={`bracket-card${isSelected?" selected":""}`}
                onClick={()=>setBracketSelected(isSelected?null:`${match.m}-${color}`)}
                style={{background:T.card,border:`1px solid ${isFinal?"rgba(251,191,36,.3)":color+"33"}`,borderRadius:10,padding:"8px 10px",minWidth:0,transition:"all .25s",boxShadow:T.sh,cursor:"pointer"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                  <span style={{fontSize:9,fontFamily:"'Bebas Neue',cursive",color:T.sub,letterSpacing:1}}>M{match.m}</span>
                  <span style={{fontSize:9,color:T.sub,marginLeft:"auto"}}>{match.date} · {match.bd}</span>
                  <span style={{fontSize:9,color:isSelected?color:T.dim}}>{isSelected?"▲":"▼"}</span>
                </div>
                {[match.a, match.b].map((team,ti)=>(
                  <div key={ti} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 6px",background:team.tbd?T.muted:isFinal?"rgba(251,191,36,.05)":color+"0d",borderRadius:6,marginBottom:ti===0?4:0,border:`1px solid ${team.tbd?T.border:team.confirmed?color+"44":"rgba(251,191,36,.2)"}`}}>
                    <span style={{fontSize:14}}>{team.flag}</span>
                    <span style={{fontSize:11,fontWeight:team.tbd?400:700,color:team.tbd?T.dim:isFinal?"#fbbf24":team.confirmed?color:T.text,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {team.team}
                    </span>
                    {team.confirmed && <span style={{fontSize:9,padding:"1px 5px",background:color+"22",color:color,borderRadius:4,fontWeight:700}}>✓</span>}
                    {!team.tbd && !team.confirmed && <span style={{fontSize:8,color:T.sub}}>~</span>}
                  </div>
                ))}
                {isSelected && (
                  <div style={{marginTop:10,padding:"8px 10px",background:T.acBg,borderRadius:8,animation:"fadeIn .18s ease",border:`1px solid ${color}22`}}>
                    <div style={{fontSize:10,color:T.sub,marginBottom:6,fontWeight:700,letterSpacing:.5}}>📋 MATCH INFO</div>
                    {match.a.confirmed&&match.b.confirmed ? (
                      <div style={{fontSize:11,color:T.text}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                          <span>{match.a.flag} {match.a.team}</span><span style={{color:color,fontWeight:700}}>vs</span><span>{match.b.team} {match.b.flag}</span>
                        </div>
                        <div style={{fontSize:10,color:T.sub}}>📅 {match.date} · ⏰ {match.bd} BD</div>
                        <button onClick={e=>{e.stopPropagation();shareMatch({home:match.a.team,away:match.b.team,dateStr:match.date,etTime:"15:00",venue:"TBD"});}}
                          style={{marginTop:8,padding:"4px 10px",border:`1px solid ${color}44`,background:color+"18",color,borderRadius:6,cursor:"pointer",fontSize:10,fontWeight:700,width:"100%"}}>
                          📤 শেয়ার করুন
                        </button>
                      </div>
                    ) : (
                      <div style={{fontSize:11,color:T.sub}}>
                        <div style={{marginBottom:4}}>📅 {match.date} · ⏰ {match.bd} BD</div>
                        <div style={{color:T.dim,fontSize:10}}>দলগুলো গ্রুপ পর্ব শেষে নির্ধারিত হবে।</div>
                        <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
                          {[match.a,match.b].map((t,ti)=>t.team&&(
                            <span key={ti} style={{padding:"2px 8px",background:t.confirmed?color+"18":T.pill,color:t.confirmed?color:T.sub,borderRadius:6,fontSize:10,fontWeight:600}}>
                              {t.flag} {t.team}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              );
            };

            const RoundSection = ({title, date, icon, matches, color, isFinal=false}) => (
              <div style={{marginBottom:20}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,padding:"8px 12px",background:isFinal?"rgba(251,191,36,.1)":T.acBg,borderRadius:9,border:`1px solid ${isFinal?"rgba(251,191,36,.3)":color+"33"}`}}>
                  <span style={{fontSize:18}}>{icon}</span>
                  <div>
                    <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:16,letterSpacing:2,color:isFinal?"#fbbf24":color}}>{title}</div>
                    <div style={{fontSize:10,color:T.sub}}>{date} · {matches.length} ম্যাচ</div>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:8}}>
                  {matches.map((m,i)=><MatchCard key={i} match={m} color={isFinal?"#fbbf24":color} isFinal={isFinal}/>)}
                </div>
              </div>
            );

            const confirmedCount = Object.keys(GROUPS).filter(g=>{
              const fixes=ALL_GROUP_FIXTURES.filter(f=>f.grp===g);
              return fixes.every(f=>{const r=results[f.id];return r&&r.h!==""&&r.a!==""&&!isNaN(+r.h)&&!isNaN(+r.a);});
            }).length;

            return (
              <div className="fi">
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,padding:"10px 14px",background:T.acBg,borderRadius:10,border:`1px solid ${c}22`,flexWrap:"wrap"}}>
                  <span style={{fontSize:14}}>🗂️</span>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:T.text}}>Tournament Bracket — FIFA World Cup 2026</div>
                    <div style={{fontSize:10,color:T.sub}}>গ্রুপ পর্বের ফলাফল অনুযায়ী auto-update · {confirmedCount}/12 গ্রুপ সম্পন্ন · ক্লিক করলে বিস্তারিত দেখবেন</div>
                  </div>
                  <div style={{marginLeft:"auto",display:"flex",gap:8,fontSize:10,color:T.sub,flexWrap:"wrap"}}>
                    <span style={{padding:"2px 7px",background:c+"18",color:c,borderRadius:5,fontWeight:700}}>✓ নিশ্চিত</span>
                    <span style={{padding:"2px 7px",background:T.pill,color:T.sub,borderRadius:5}}>❓ TBD</span>
                  </div>
                </div>
                <RoundSection title="ROUND OF 32" date="Jun 28 – Jul 3" icon="⚽" matches={r32} color={c}/>
                <RoundSection title="ROUND OF 16" date="Jul 4 – 7" icon="⚔️" matches={r16} color="#3b82f6"/>
                <RoundSection title="QUARTER-FINALS" date="Jul 9 – 11" icon="🔥" matches={qf} color="#8b5cf6"/>
                <RoundSection title="SEMI-FINALS" date="Jul 14 – 15" icon="🌟" matches={sf} color="#f59e0b"/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:8}}>
                  <RoundSection title="3RD PLACE" date="Jul 18" icon="🥉" matches={third} color="#6b7280"/>
                  <RoundSection title="FINAL 🏆" date="Jul 19" icon="🏆" matches={fin} color="#fbbf24" isFinal={true}/>
                </div>
              </div>
            );
            } catch(e) {
              console.error("Bracket render error:", e);
              return <div style={{padding:20,color:"#ef4444",fontSize:13}}>Bracket লোড করতে সমস্যা হয়েছে। পুনরায় চেষ্টা করুন।</div>;
            }
          })()}

          {/* ═══ SCORERS ═══ */}
          {tab==="scorers" && (()=>{
            // Auto-fetch when tab opens
            if (!scorersFetched && !scorersLoading) fetchScorers();
            const posColors2 = {FWD:"#ef4444", MID:"#10b981", DEF:"#3b82f6", GK:"#f59e0b"};
            const medalColor = (r) => r===1?"#fbbf24":r===2?"#9ca3af":r===3?"#b45309":"";
            return (
              <div className="fi">
                {/* Header */}
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,padding:"12px 14px",background:T.acBg,borderRadius:12,border:`1px solid ${c}22`,flexWrap:"wrap"}}>
                  <span style={{fontSize:22}}>⚽</span>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:18,letterSpacing:2,color:c}}>TOP GOAL SCORERS</div>
                    <div style={{fontSize:10,color:T.sub}}>FIFA World Cup 2026 · গ্রুপ পর্ব · লাইভ আপডেট</div>
                  </div>
                  <button onClick={fetchScorers} disabled={scorersLoading}
                    style={{padding:"6px 14px",borderRadius:8,border:`1px solid ${c}44`,background:scorersLoading?T.muted:T.acBg,color:scorersLoading?T.sub:c,cursor:scorersLoading?"not-allowed":"pointer",fontSize:12,fontWeight:700,display:"flex",alignItems:"center",gap:6,transition:"all .2s"}}>
                    <span style={{display:"inline-block",animation:scorersLoading?"pulse 1s infinite":"none"}}>🔄</span>
                    {scorersLoading?"লোড হচ্ছে...":"রিফ্রেশ"}
                  </button>
                </div>

                {/* Loading state */}
                {scorersLoading && !scorers.length && (
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:14,padding:"40px 20px"}}>
                    <div style={{fontSize:40,animation:"pulse 1s infinite"}}>⚽</div>
                    <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:16,letterSpacing:2,color:c}}>TOP SCORERS লোড হচ্ছে...</div>
                    <div style={{fontSize:11,color:T.sub}}>ওয়েব থেকে সর্বশেষ তথ্য আনা হচ্ছে</div>
                    <div style={{display:"flex",gap:6}}>
                      {[0,1,2].map(i=>(
                        <div key={i} style={{width:8,height:8,borderRadius:"50%",background:c,animation:`pulse 1s infinite ${i*0.2}s`}}/>
                      ))}
                    </div>
                  </div>
                )}

                {/* No data yet */}
                {scorersFetched && !scorers.length && !scorersLoading && (
                  <div style={{textAlign:"center",padding:"40px 20px"}}>
                    <div style={{fontSize:48,marginBottom:12}}>🏆</div>
                    <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:16,letterSpacing:2,color:c,marginBottom:8}}>এখনো গোল হয়নি</div>
                    <div style={{fontSize:12,color:T.sub,marginBottom:16}}>টুর্নামেন্ট শুরু হলে এখানে গোলদাতাদের তালিকা দেখা যাবে।</div>
                    <div style={{fontSize:11,color:T.dim}}>FIFA World Cup 2026 শুরু: Jun 11, 2026</div>
                  </div>
                )}

                {/* Scorers list */}
                {scorers.length > 0 && (
                  <div>
                    {/* Top 3 podium */}
                    {scorers.length >= 3 && (
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:16}}>
                        {[scorers[1], scorers[0], scorers[2]].map((s, podIdx)=>{
                          const rank = podIdx===0?2:podIdx===1?1:3;
                          const actual = scorers[rank-1];
                          const podSize = rank===1?"120px":"100px";
                          return (
                            <div key={rank} style={{textAlign:"center",padding:"12px 8px",background:rank===1?`rgba(251,191,36,.1)`:T.card,border:`1px solid ${rank===1?"rgba(251,191,36,.4)":rank===2?"rgba(156,163,175,.3)":"rgba(180,83,9,.3)"}`,borderRadius:12,display:"flex",flexDirection:"column",alignItems:"center",gap:4,boxShadow:T.sh,marginTop:rank===1?0:"20px"}}>
                              <div style={{fontSize:rank===1?28:22}}>{rank===1?"🥇":rank===2?"🥈":"🥉"}</div>
                              <div style={{fontSize:rank===1?26:22}}>{FLAGS[actual?.team]||"🏳"}</div>
                              <div style={{fontWeight:800,fontSize:rank===1?13:11,color:rank===1?"#fbbf24":T.text,lineHeight:1.2,textAlign:"center"}}>{actual?.name}</div>
                              <div style={{fontSize:10,color:T.sub}}>{actual?.team}</div>
                              <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:rank===1?32:24,color:rank===1?"#fbbf24":c,lineHeight:1}}>{actual?.goals}</div>
                              <div style={{fontSize:9,color:T.sub,letterSpacing:1}}>GOALS</div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Full list */}
                    <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:13,letterSpacing:2,color:c,marginBottom:8}}>সম্পূর্ণ তালিকা</div>
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {scorers.map((s, idx)=>{
                        const rank = idx+1;
                        const isTop3 = rank <= 3;
                        return (
                          <div key={idx} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:isTop3?`rgba(251,191,36,.05)`:T.card,border:`1px solid ${isTop3?"rgba(251,191,36,.25)":T.border}`,borderRadius:10,boxShadow:T.sh,transition:"all .2s"}}>
                            {/* Rank */}
                            <div style={{width:26,height:26,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,background:isTop3?`rgba(251,191,36,.15)`:T.acBg,border:`1px solid ${isTop3?"rgba(251,191,36,.3)":T.border}`}}>
                              {rank<=3
                                ? <span style={{fontSize:14}}>{rank===1?"🥇":rank===2?"🥈":"🥉"}</span>
                                : <span style={{fontFamily:"'Bebas Neue',cursive",fontSize:13,color:T.sub}}>{rank}</span>
                              }
                            </div>
                            {/* Flag */}
                            <span style={{fontSize:20,flexShrink:0}}>{FLAGS[s.team]||"🏳"}</span>
                            {/* Name & team */}
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontWeight:700,fontSize:13,color:isTop3?"#fbbf24":T.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{s.name}</div>
                              <div style={{fontSize:10,color:T.sub}}>{s.team} · {s.matches||"-"} ম্যাচ</div>
                            </div>
                            {/* Assists */}
                            <div style={{textAlign:"center",flexShrink:0}}>
                              <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:16,color:T.sub,lineHeight:1}}>{s.assists||0}</div>
                              <div style={{fontSize:8,color:T.dim,letterSpacing:.5}}>AST</div>
                            </div>
                            {/* Goals */}
                            <div style={{textAlign:"center",minWidth:42,flexShrink:0}}>
                              <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:26,color:isTop3?"#fbbf24":c,lineHeight:1}}>{s.goals}</div>
                              <div style={{fontSize:8,color:T.sub,letterSpacing:.5}}>GOALS</div>
                            </div>
                            {/* Bar */}
                            <div style={{width:3,height:36,borderRadius:2,background:T.border,flexShrink:0,overflow:"hidden"}}>
                              <div style={{width:"100%",height:`${Math.min(100,(s.goals/(scorers[0]?.goals||1))*100)}%`,background:isTop3?"#fbbf24":c,borderRadius:2,transition:"height .5s"}}/>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Stats summary */}
                    <div style={{marginTop:16,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                      {[
                        {label:"মোট গোল", value: scorers.reduce((a,s)=>a+(+s.goals||0),0), icon:"⚽"},
                        {label:"সর্বোচ্চ", value: scorers[0]?.goals||0, icon:"🥇"},
                        {label:"গোলদাতা", value: scorers.length, icon:"👟"},
                      ].map((stat,i)=>(
                        <div key={i} style={{padding:"12px 10px",background:T.card,border:`1px solid ${T.border}`,borderRadius:10,textAlign:"center",boxShadow:T.sh}}>
                          <div style={{fontSize:20,marginBottom:4}}>{stat.icon}</div>
                          <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:22,color:c,lineHeight:1}}>{stat.value}</div>
                          <div style={{fontSize:9,color:T.sub,letterSpacing:.5}}>{stat.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
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
              <div style={{fontSize:12,color:T.sub,marginBottom:10}}>সব ৪৮ দলের স্কোয়াড। ফ্ল্যাগে ক্লিক করলে সেই দল প্রিয় দল হবে।</div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:18}}>
                {Object.keys(SQUADS).map(team=>(
                  <button key={team} onClick={()=>setSquadTeam(squadTeam===team?null:team)}
                    style={{display:"flex",alignItems:"center",gap:5,padding:"6px 10px",borderRadius:8,border:`1px solid ${squadTeam===team?c:favTeam===team?"rgba(251,191,36,.5)":T.border}`,background:squadTeam===team?T.acBg:favTeam===team?"rgba(251,191,36,.07)":T.card,color:squadTeam===team?c:favTeam===team?"#fbbf24":T.sub,cursor:"pointer",fontSize:12,fontWeight:600,transition:"all .2s",boxShadow:T.sh}}>
                    <span style={{fontSize:15}}>{FLAGS[team]||"🏳"}</span> {team}
                    {favTeam===team&&<span>⭐</span>}
                  </button>
                ))}
              </div>

              {!squadTeam&&(
                <div style={{textAlign:"center",padding:"50px 0",color:T.sub}}>
                  <div style={{fontSize:42,marginBottom:10}}>👕</div>
                  <div style={{fontSize:15,fontWeight:600,color:T.text}}>উপরে একটি দল বেছে নিন</div>
                  <div style={{fontSize:12,marginTop:6}}>৪৮টি দলের পূর্ণ স্কোয়াড দেখুন</div>
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
                        const home=fix.home===squadTeam;
                        return (
                          <div key={i} style={{display:"flex",alignItems:"center",gap:6,fontSize:12,padding:"5px 0",borderBottom:`1px solid ${T.border}`,flexWrap:"wrap"}}>
                            <span style={{color:T.sub,minWidth:44,fontSize:11}}>{fix.dateStr}</span>
                            <span style={{fontWeight:home?700:400,color:home?c:T.sub}}>{fix.home}</span>
                            <span style={{color:T.dim,fontSize:10}}>vs</span>
                            <span style={{fontWeight:!home?700:400,color:!home?c:T.sub}}>{fix.away}</span>
                            <span style={{marginLeft:"auto",fontFamily:"'Bebas Neue',cursive",fontSize:13,color:c}}>{bdTime(fix.etTime)}</span>
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

        {/* ── BOTTOM NAV via Portal — renders directly in document.body, immune to any ancestor overflow/opacity/transform/backdrop-filter ── */}
        {createPortal(
          <div className="bottom-nav" style={{position:"fixed",bottom:0,left:0,right:0,background:dark?"rgba(6,15,8,.97)":"rgba(248,250,252,.97)",borderTop:`1px solid ${T.border}`,display:"flex",alignItems:"stretch",zIndex:9999,boxShadow:`0 -4px 20px ${c}18`}}>
            {[
              {k:"fixtures",icon:"📅",label:"Fixtures"},
              {k:"standings",icon:"📊",label:"Standings"},
              {k:"bracket",icon:"🗂️",label:"Bracket"},
              {k:"scorers",icon:"⚽",label:"Scorers"},
              {k:"stadiums",icon:"🏟️",label:"Stadiums"},
              {k:"squads",icon:"👕",label:"Squads"},
            ].map(({k,icon,label})=>(
              <button key={k} className={`bottom-nav-btn${tab===k?" active":""}`} onClick={()=>setTab(k)}
                style={{color:tab===k?c:T.sub}}>
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
