const router = require("express").Router();

router.get("/", (req, res) => {
  res.json({
    googleMapsKey: process.env.GOOGLE_MAPS_BROWSER_KEY || process.env.GOOGLE_MAPS_API_KEY,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    supabaseConfigured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY),
    supabaseServiceConfigured: !!process.env.SUPABASE_SERVICE_KEY
  });
});

module.exports = router;
