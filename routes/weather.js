const router = require("express").Router();
const https = require("https");

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, r => {
      let d = "";
      r.on("data", c => d += c);
      r.on("end", () => { try { resolve(JSON.parse(d)); } catch { reject(new Error("Invalid JSON")); } });
    }).on("error", reject);
  });
}

const MONTHS = ["","Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

// GET /api/weather?lat=...&lng=...&month=6
router.get("/", async (req, res) => {
  try {
    const { lat, lng } = req.query;
    const month = parseInt(req.query.month) || 6;
    if (!lat || !lng) return res.status(400).json({ error: "lat and lng required" });

    const year = new Date().getFullYear();
    const startDate = `${year - 5}-${String(month).padStart(2, "0")}-01`;
    const endDate = `${year - 1}-${String(month).padStart(2, "0")}-28`;
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,sunshine_duration&timezone=auto`;

    const data = await fetchJSON(url);
    if (!data.daily) return res.json({ error: "No data", fallback: true });

    const daily = data.daily;
    let maxT = [], minT = [], precip = 0, sunH = [], count = 0;
    for (let i = 0; i < daily.time.length; i++) {
      if (new Date(daily.time[i]).getMonth() + 1 === month) {
        if (daily.temperature_2m_max[i] != null) maxT.push(daily.temperature_2m_max[i]);
        if (daily.temperature_2m_min[i] != null) minT.push(daily.temperature_2m_min[i]);
        if (daily.precipitation_sum[i] > 1) precip++;
        if (daily.sunshine_duration[i] != null) sunH.push(daily.sunshine_duration[i] / 3600);
        count++;
      }
    }
    const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
    res.json({
      temp_day: avg(maxT), temp_night: avg(minT), sun_hours: avg(sunH),
      rain_days: Math.round(precip / 5), month_name: MONTHS[month]
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
