const router = require("express").Router();
const { createClient } = require("@supabase/supabase-js");

function db() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

function slug(destination, name) {
  const base = `${destination}-${name}`
    .toLowerCase()
    .replace(/[äöüß]/g, m => ({ ä: "ae", ö: "oe", ü: "ue", ß: "ss" })[m] || m)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base}-${Date.now().toString(36).slice(-4)}`;
}

// GET / – list all tours with analytics
router.get("/", async (req, res) => {
  try {
    const { data, error } = await db()
      .from("tour_analytics")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /:slug – single tour
router.get("/:slug", async (req, res) => {
  try {
    const { data, error } = await db()
      .from("tours")
      .select("*")
      .eq("slug", req.params.slug)
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Tour not found" });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST / – create tour
router.post("/", async (req, res) => {
  try {
    const b = req.body;
    const tourData = {
      slug: slug(b.destination || "tour", b.customer_name || "kunde"),
      agent_name: b.agent_name || "Reiseberater",
      agent_company: b.agent_company || "",
      agent_email: b.agent_email || "",
      agent_phone: b.agent_phone || "",
      customer_name: b.customer_name,
      customer_email: b.customer_email || "",
      destination: b.destination,
      destination_country: b.destination_country || "",
      date_from: b.date_from || null,
      date_to: b.date_to || null,
      nights: b.nights || 7,
      departure_airport: b.departure_airport || "",
      meal_plan: b.meal_plan || "All-Inclusive",
      preferences: b.preferences || [],
      personal_note: b.personal_note || "",
      hotels: b.hotels || [],
      pois: b.pois || [],
      day_items: b.day_items || [],
      transfers: b.transfers || [],
      weather: b.weather || {},
      hero_video_url: b.hero_video_url || "",
      hero_title: b.hero_title || "",
      hero_subtitle: b.hero_subtitle || "",
      status: "draft"
    };
    const { data, error } = await db().from("tours").insert(tourData).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /:slug – update
router.put("/:slug", async (req, res) => {
  try {
    const body = { ...req.body };
    delete body.id; delete body.slug; delete body.created_at;
    const { data, error } = await db()
      .from("tours").update(body).eq("slug", req.params.slug).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /:slug
router.delete("/:slug", async (req, res) => {
  try {
    const { error } = await db().from("tours").delete().eq("slug", req.params.slug);
    if (error) throw error;
    res.json({ deleted: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
