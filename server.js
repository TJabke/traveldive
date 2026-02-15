require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Static files
app.use(express.static(path.join(__dirname, "public")));

// API Routes
app.use("/api/config", require("./routes/config"));
app.use("/api/tours", require("./routes/tours"));
app.use("/api/generate", require("./routes/generate"));
app.use("/api/places", require("./routes/places"));
app.use("/api/weather", require("./routes/weather"));
app.use("/api/tracking", require("./routes/tracking"));
app.use("/api/extract", require("./routes/extract"));

// Tour page route: /t/:slug → serve tour.html
app.get("/t/:slug", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "tour.html"));
});

// Fallback → dashboard
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`\n  🌊 TravelDive running on http://localhost:${PORT}\n`);
});
