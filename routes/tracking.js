const router = require("express").Router();
const { createClient } = require("@supabase/supabase-js");

function db() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

// POST / – single event
router.post("/", async (req, res) => {
  try {
    const { tour_id, event_type, data, session_id } = req.body;
    const { error } = await db().from("tour_events").insert({ tour_id, event_type, data: data || {}, session_id });
    if (error) throw error;
    res.status(201).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /batch – multiple events
router.post("/batch", async (req, res) => {
  try {
    const events = (req.body.events || []).map(e => ({
      tour_id: e.tour_id, event_type: e.event_type, data: e.data || {}, session_id: e.session_id
    }));
    if (events.length > 0) {
      const { error } = await db().from("tour_events").insert(events);
      if (error) throw error;
    }
    res.status(201).json({ ok: true, count: events.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /:tourId – analytics
router.get("/:tourId", async (req, res) => {
  try {
    const { data: events, error } = await db()
      .from("tour_events").select("*").eq("tour_id", req.params.tourId)
      .order("created_at", { ascending: false }).limit(500);
    if (error) throw error;

    const sessions = new Set(events.map(e => e.session_id).filter(Boolean));
    const pageViews = events.filter(e => e.event_type === "page_view").length;
    const ctaClicks = events.filter(e => e.event_type === "cta_click").length;

    const sectionTimes = {};
    events.filter(e => e.event_type === "section_time").forEach(e => {
      const sec = e.data?.section;
      if (sec) sectionTimes[sec] = (sectionTimes[sec] || 0) + (e.data?.seconds || 0);
    });

    const hotelViews = {};
    events.filter(e => e.event_type === "hotel_select").forEach(e => {
      const h = e.data?.hotel_name;
      if (h) hotelViews[h] = (hotelViews[h] || 0) + 1;
    });

    const transferEvent = events.find(e => e.event_type === "transfer_select");

    res.json({
      unique_sessions: sessions.size,
      total_page_views: pageViews,
      cta_clicks: ctaClicks,
      conversion_rate: sessions.size > 0 ? ((ctaClicks / sessions.size) * 100).toFixed(1) : 0,
      section_times: sectionTimes,
      hotel_views: hotelViews,
      transfer_choice: transferEvent?.data?.transfer_name || null,
      recent_activity: events.slice(0, 10).map(e => ({ type: e.event_type, data: e.data, time: e.created_at }))
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
