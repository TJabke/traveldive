const router = require("express").Router();
const { extractRoomsFromHotelPage } = require("../lib/room-extractor");

router.post("/rooms", async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Bitte eine gültige URL übergeben." });
    }

    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return res.status(400).json({ error: "Nur http/https URLs sind erlaubt." });
    }

    const result = await extractRoomsFromHotelPage(parsed.toString());
    res.json(result);
  } catch (e) {
    console.error("Room extraction error:", e);
    res.status(500).json({ error: e.message || "Room extraction failed" });
  }
});

module.exports = router;
