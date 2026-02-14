const router = require("express").Router();

router.get("/", (req, res) => {
  res.json({
    googleMapsKey: process.env.GOOGLE_MAPS_API_KEY,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY
  });
});

module.exports = router;
