const router = require("express").Router();
const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

const hasSupabaseEnv = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
const localTours = [];

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

function localAnalytics() {
  return localTours
    .slice()
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .map(t => ({
      tour_id: t.id,
      slug: t.slug,
      customer_name: t.customer_name,
      destination: t.destination,
      status: t.status || "draft",
      created_at: t.created_at,
      unique_views: 0,
      total_views: 0,
      cta_clicks: 0,
      last_hotel_viewed: null,
      transfer_choice: null
    }));
}

function localCreateTour(body = {}) {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    slug: slug(body.destination || "tour", body.customer_name || "kunde"),
    agent_name: body.agent_name || "Reiseberater",
    agent_company: body.agent_company || "",
    agent_email: body.agent_email || "",
    agent_phone: body.agent_phone || "",
    customer_name: body.customer_name,
    customer_email: body.customer_email || "",
    destination: body.destination,
    destination_country: body.destination_country || "",
    date_from: body.date_from || null,
    date_to: body.date_to || null,
    nights: body.nights || 7,
    departure_airport: body.departure_airport || "",
    meal_plan: body.meal_plan || "All-Inclusive",
    preferences: body.preferences || [],
    personal_note: body.personal_note || "",
    hotels: body.hotels || [],
    pois: body.pois || [],
    day_items: body.day_items || [],
    transfers: body.transfers || [],
    weather: body.weather || {},
    hero_video_url: body.hero_video_url || "",
    hero_title: body.hero_title || "",
    hero_subtitle: body.hero_subtitle || "",
    status: body.status || "draft",
    created_at: now,
    updated_at: now
  };
}

function normalizeSupabaseError(error) {
  const message = String(error?.message || "").toLowerCase();
  const details = String(error?.details || "").toLowerCase();
  const combined = `${message} ${details}`;
  return {
    isConnectionIssue:
      combined.includes("supabase") ||
      combined.includes("jwt") ||
      combined.includes("fetch") ||
      combined.includes("invalid") ||
      combined.includes("timeout") ||
      combined.includes("network") ||
      combined.includes("service key") ||
      combined.includes("auth")
  };
}

function canUseLocalFallback(error) {
  if (!hasSupabaseEnv) return true;
  return normalizeSupabaseError(error).isConnectionIssue;
}

function logAndFallback(res, error, action) {
  console.warn(`[tours] Supabase ${action} failed, using local fallback:`, error?.message || error);
  res.set("x-traveldive-fallback", "local");
}

// GET / – list all tours with analytics
router.get("/", async (req, res) => {
  if (!hasSupabaseEnv) {
    res.set("x-traveldive-fallback", "local");
    return res.json(localAnalytics());
  }

  try {
    const { data, error } = await db()
      .from("tour_analytics")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (e) {
    if (canUseLocalFallback(e)) {
      logAndFallback(res, e, "GET /api/tours");
      return res.json(localAnalytics());
    }
    res.status(500).json({ error: e.message });
  }
});

// GET /:slug – single tour
router.get("/:slug", async (req, res) => {
  if (!hasSupabaseEnv) {
    const data = localTours.find(t => t.slug === req.params.slug);
    if (!data) return res.status(404).json({ error: "Tour not found" });
    res.set("x-traveldive-fallback", "local");
    return res.json(data);
  }

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
    if (canUseLocalFallback(e)) {
      const data = localTours.find(t => t.slug === req.params.slug);
      if (!data) return res.status(404).json({ error: "Tour not found" });
      logAndFallback(res, e, "GET /api/tours/:slug");
      return res.json(data);
    }
    res.status(500).json({ error: e.message });
  }
});

// POST / – create tour
router.post("/", async (req, res) => {
  const tourData = localCreateTour(req.body || {});

  if (!hasSupabaseEnv) {
    localTours.push(tourData);
    res.set("x-traveldive-fallback", "local");
    return res.status(201).json(tourData);
  }

  try {
    const { data, error } = await db().from("tours").insert(tourData).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) {
    if (canUseLocalFallback(e)) {
      localTours.push(tourData);
      logAndFallback(res, e, "POST /api/tours");
      return res.status(201).json(tourData);
    }
    res.status(500).json({ error: e.message });
  }
});

// PUT /:slug – update
router.put("/:slug", async (req, res) => {
  const body = { ...req.body };
  delete body.id;
  delete body.slug;
  delete body.created_at;

  if (!hasSupabaseEnv) {
    const index = localTours.findIndex(t => t.slug === req.params.slug);
    if (index === -1) return res.status(404).json({ error: "Tour not found" });
    localTours[index] = { ...localTours[index], ...body, updated_at: new Date().toISOString() };
    res.set("x-traveldive-fallback", "local");
    return res.json(localTours[index]);
  }

  try {
    const { data, error } = await db()
      .from("tours").update(body).eq("slug", req.params.slug).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    if (canUseLocalFallback(e)) {
      const index = localTours.findIndex(t => t.slug === req.params.slug);
      if (index === -1) return res.status(404).json({ error: "Tour not found" });
      localTours[index] = { ...localTours[index], ...body, updated_at: new Date().toISOString() };
      logAndFallback(res, e, "PUT /api/tours/:slug");
      return res.json(localTours[index]);
    }
    res.status(500).json({ error: e.message });
  }
});

// DELETE /:slug
router.delete("/:slug", async (req, res) => {
  if (!hasSupabaseEnv) {
    const index = localTours.findIndex(t => t.slug === req.params.slug);
    if (index >= 0) localTours.splice(index, 1);
    res.set("x-traveldive-fallback", "local");
    return res.json({ deleted: index >= 0 });
  }

  try {
    const { error } = await db().from("tours").delete().eq("slug", req.params.slug);
    if (error) throw error;
    res.json({ deleted: true });
  } catch (e) {
    if (canUseLocalFallback(e)) {
      const index = localTours.findIndex(t => t.slug === req.params.slug);
      if (index >= 0) localTours.splice(index, 1);
      logAndFallback(res, e, "DELETE /api/tours/:slug");
      return res.json({ deleted: index >= 0 });
    }
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
