const router = require("express").Router();
const https = require("https");

function fetchAPI(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOpts = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: options.method || "GET",
      headers: options.headers || {}
    };
    const req = https.request(reqOpts, r => {
      let d = "";
      r.on("data", c => d += c);
      r.on("end", () => { try { resolve(JSON.parse(d)); } catch { reject(new Error("Invalid JSON: " + d.substring(0, 200))); } });
    });
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// GET /api/places/search?query=...
router.get("/search", async (req, res) => {
  try {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    const q = req.query.query;

    const data = await fetchAPI("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.photos"
      },
      body: JSON.stringify({ textQuery: q, languageCode: "de", maxResultCount: 5 })
    });

    const results = (data.places || []).map(p => ({
      place_id: p.id,
      name: p.displayName?.text || "",
      address: p.formattedAddress || "",
      lat: p.location?.latitude,
      lng: p.location?.longitude,
      rating: p.rating,
      user_ratings_total: p.userRatingCount,
      // New API uses photo "name" instead of "photo_reference"
      photo_ref: p.photos?.[0]?.name || null,
      types: []
    }));
    res.json({ results });
  } catch (e) {
    console.error("Places search error:", e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/places/details?place_id=...
router.get("/details", async (req, res) => {
  try {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    const placeId = req.query.place_id;

    const data = await fetchAPI(`https://places.googleapis.com/v1/places/${placeId}`, {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "id,displayName,formattedAddress,location,rating,reviews,photos,websiteUri,nationalPhoneNumber"
      }
    });

    res.json({
      name: data.displayName?.text || "",
      address: data.formattedAddress || "",
      lat: data.location?.latitude,
      lng: data.location?.longitude,
      rating: data.rating,
      website: data.websiteUri,
      phone: data.nationalPhoneNumber,
      // Return photo names (new API format)
      photo_refs: (data.photos || []).slice(0, 8).map(p => p.name),
      reviews: (data.reviews || []).slice(0, 5).map(rev => ({
        author: rev.authorAttribution?.displayName || "",
        rating: rev.rating,
        text: rev.text?.text || "",
        time: rev.relativePublishTimeDescription || ""
      }))
    });
  } catch (e) {
    console.error("Place details error:", e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/places/photo?photo_ref=places/xxx/photos/yyy&maxwidth=800
router.get("/photo", (req, res) => {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  const photoName = req.query.photo_ref;
  const maxWidth = req.query.maxwidth || 800;

  if (!photoName) return res.status(400).json({ error: "photo_ref required" });

  // New API: photo media endpoint
  const url = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&key=${key}`;
  res.redirect(url);
});

module.exports = router;
