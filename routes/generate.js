const router = require("express").Router();
const Anthropic = require("@anthropic-ai/sdk");

router.post("/", async (req, res) => {
  try {
    const { hotel_name, location, destination, dates, nights, meal_plan, preferences } = req.body;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `Du bist ein erfahrener Reiseberater, der immersive Reise-Touren erstellt. Generiere Inhalte für folgendes Hotel/Reiseziel:

Hotel: ${hotel_name}
Ort: ${location}, ${destination}
Zeitraum: ${dates} (${nights} Nächte)
Verpflegung: ${meal_plan}
Kundenvorlieben: ${(preferences || []).join(", ")}

Erstelle folgendes als JSON (NUR JSON, keine Erklärungen, kein Markdown):

{
  "hotel_description": "2-3 Sätze Beschreibung des Hotels, elegant und einladend",
  "hotel_highlights": ["Highlight 1", "Highlight 2", "Highlight 3", "Highlight 4"],
  "pools": [
    {"name": "Poolname", "icon": "emoji", "description": "Beschreibung", "tags": ["Tag1", "Tag2"]}
  ],
  "restaurants": [
    {"name": "Restaurantname", "icon": "emoji", "description": "Beschreibung inkl. Küchenstil", "tags": ["Tag1", "Tag2"]}
  ],
  "room": {
    "type": "Zimmertyp",
    "size": "XX m²",
    "description": "Kurze Beschreibung",
    "features": [
      {"icon": "emoji", "title": "Feature", "detail": "Beschreibung"}
    ]
  },
  "pois": [
    {"name": "Name", "category": "Strand|Kultur|Gastronomie|Natur|Stadt|Sport", "description": "1-2 Sätze", "distance": "X Min. zu Fuß/mit dem Auto", "search_query": "Suchbegriff für Google Places"}
  ],
  "day_items": [
    {"time": "HH:MM", "title": "Titel", "description": "2-3 Sätze, persönlich und lebendig geschrieben"}
  ],
  "transfers": [
    {"name": "Transferart", "icon": "emoji", "duration": "ca. X Min.", "description": "Beschreibung", "price": "~XX €", "price_note": "pro Strecke/Person/Tag", "tags": ["Tag1", "Tag2"]}
  ],
  "weather": {
    "temp_day": "XX°",
    "temp_night": "XX°",
    "water_temp": "XX°",
    "sun_hours": "XXh",
    "rain_days": "X"
  },
  "reviews": [
    {"text": "Bewertungstext, realistisch", "author": "Vorname & Partner/Familie, Stadt", "date": "Monat Jahr"}
  ],
  "hero_title": "Kurzer emotionaler Titel mit Ortsname",
  "hero_subtitle": "1 Satz, der Vorfreude weckt"
}

WICHTIG:
- Generiere 3 Pools, 4-5 Restaurants, 6 Zimmer-Features
- Generiere 4-5 POIs passend zu den Vorlieben
- Generiere 7-8 Tagesplan-Einträge von 08:00 bis 21:30
- Generiere 3-4 Transferoptionen vom nächsten Flughafen
- Generiere 3 realistische Gästebewertungen
- Alle Texte auf Deutsch, lebendig und persönlich`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }]
    });

    const text = response.content.filter(b => b.type === "text").map(b => b.text).join("");
    const clean = text.replace(/```json\s?|```/g, "").trim();
    res.json(JSON.parse(clean));
  } catch (e) {
    console.error("Generate error:", e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
