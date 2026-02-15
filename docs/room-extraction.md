# Room Type & Amenities Extraction

Dieses Modul extrahiert **Zimmertypen und Zimmerausstattung** von Hotel-Seiten.

## API

`POST /api/extract/rooms`

### Request

```json
{
  "url": "https://example-hotel.com/rooms"
}
```

### Response

```json
{
  "source_url": "https://example-hotel.com/rooms",
  "scraped_at": "2026-01-01T12:00:00.000Z",
  "rooms": [
    {
      "room_name": "Deluxe Ocean View",
      "description": "Großzügiges Zimmer mit Balkon",
      "occupancy": 2,
      "beds": "1 King Bed",
      "amenities": ["Wi-Fi", "Air Conditioning", "Balcony"],
      "amenities_normalized": ["wifi", "air_conditioning", "balcony"]
    }
  ]
}
```

## Extraction Strategy

1. **Structured Data First**
   - JSON-LD (`application/ld+json`) wird zuerst geparst.
   - Unterstützte Typen: `HotelRoom`, `Room`, `Accommodation`.
   - Felder: `name`, `description`, `bed`, `occupancy`, `amenityFeature`.

2. **JSON Endpoint Detection**
   - In HTML werden room-relevante Endpoint-Kandidaten erkannt (`rooms`, `accommodations`, `units`, `amenities`).
   - Diese JSON-Endpoints werden bevorzugt ausgewertet, wenn JSON-LD keine Räume liefert.

3. **HTML Fallback**
   - Semantischer Fallback über Headings (`h1`–`h4`) plus Textinhalte.
   - Extraktion von Zimmername, Belegung, Bettenhinweis und Amenities.

## Normalization

Amenities werden in Rohform (`amenities`) und normiert (`amenities_normalized`) zurückgegeben.
Beispiele:
- WLAN / Wi-Fi -> `wifi`
- Klimaanlage / Air Conditioning -> `air_conditioning`
- Balkon / Balcony -> `balcony`

## Integration

Im Dashboard unter **Zimmerkategorie für Kundenseite** kann optional eine Hotel-URL eingetragen werden.
Der Button **„Zimmer extrahieren“** füllt automatisch die Zimmerkategorien pro Hotel (ohne Preis/Verfügbarkeit).
