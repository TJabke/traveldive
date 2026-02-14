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

// GET /api/places/search?query=...
router.get("/search", async (req, res) => {
  try {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    const q = req.query.query;
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&language=de&key=${key}`;
    const data = await fetchJSON(url);
    const results = (data.results || []).slice(0, 5).map(p => ({
      place_id: p.place_id, name: p.name, address: p.formatted_address,
      lat: p.geometry?.location?.lat, lng: p.geometry?.location?.lng,
      rating: p.rating, user_ratings_total: p.user_ratings_total,
      photo_ref: p.photos?.[0]?.photo_reference || null, types: p.types
    }));
    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/places/details?place_id=...
router.get("/details", async (req, res) => {
  try {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    const fields = "name,formatted_address,geometry,rating,reviews,photos,website,formatted_phone_number";
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${req.query.place_id}&fields=${fields}&language=de&key=${key}`;
    const data = await fetchJSON(url);
    const r = data.result || {};
    res.json({
      name: r.name, address: r.formatted_address,
      lat: r.geometry?.location?.lat, lng: r.geometry?.location?.lng,
      rating: r.rating, website: r.website, phone: r.formatted_phone_number,
      photo_refs: (r.photos || []).slice(0, 8).map(p => p.photo_reference),
      reviews: (r.reviews || []).slice(0, 5).map(rev => ({
        author: rev.author_name, rating: rev.rating, text: rev.text, time: rev.relative_time_description
      }))
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/places/photo?photo_ref=...&maxwidth=800
router.get("/photo", (req, res) => {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${req.query.maxwidth || 800}&photo_reference=${req.query.photo_ref}&key=${key}`;
  res.redirect(url);
});

module.exports = router;
