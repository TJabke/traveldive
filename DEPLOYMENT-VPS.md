# TravelDive – VPS Deployment (Hostinger)

Schritt-für-Schritt-Anleitung zum Deployen auf deinem Hostinger VPS.

---

## Was du brauchst

- SSH-Zugang zu deinem Hostinger VPS
- Eine Domain oder Subdomain (z.B. `app.traveldive.de`)
- Deine API-Keys (Google, Anthropic, Supabase)

---

## Schritt 1: Supabase-Datenbank einrichten

1. Öffne [supabase.com](https://supabase.com) → dein Projekt
2. Gehe zu **SQL Editor** → **New query**
3. Kopiere den Inhalt von `setup-supabase.sql` hinein
4. Klick **Run** → warte auf "Success"

---

## Schritt 2: Per SSH auf den VPS verbinden

```bash
ssh root@deine-vps-ip
# oder
ssh dein-user@deine-vps-ip
```

---

## Schritt 3: Node.js installieren (falls nicht vorhanden)

```bash
# Prüfe ob Node.js installiert ist
node --version

# Falls nicht: Installiere Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Prüfen
node --version   # sollte v20.x.x zeigen
npm --version    # sollte 10.x.x zeigen
```

---

## Schritt 4: Projekt auf den Server bringen

### Option A: Datei hochladen (einfacher)

Auf deinem lokalen Rechner:
```bash
# ZIP auf den Server kopieren
scp traveldive-vps.zip root@deine-vps-ip:/root/
```

Auf dem Server:
```bash
cd /root
unzip traveldive-vps.zip
cd traveldive-vps
```

### Option B: Git (professioneller)

Wenn du das Projekt in einem Git-Repo hast:
```bash
cd /root
git clone https://github.com/dein-user/traveldive.git
cd traveldive
```

---

## Schritt 5: Environment-Variablen einrichten

```bash
# .env Datei erstellen
cp .env.example .env
nano .env
```

Trage deine echten Keys ein:
```
GOOGLE_MAPS_API_KEY=AIzaSy...
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
PORT=3000
NODE_ENV=production
```

Speichern: `Ctrl+O`, Enter, `Ctrl+X`

---

## Schritt 6: Dependencies installieren & testen

```bash
npm install

# Testlauf
node server.js
# Sollte zeigen: 🌊 TravelDive running on http://localhost:3000

# Ctrl+C zum Stoppen
```

---

## Schritt 7: PM2 installieren (hält den Server am Laufen)

PM2 startet den Server automatisch neu bei Crashes und nach Server-Neustarts.

```bash
sudo npm install -g pm2

# App starten
pm2 start server.js --name traveldive

# Prüfen ob es läuft
pm2 status

# Auto-Start nach Server-Reboot
pm2 startup
pm2 save
```

**Nützliche PM2-Befehle:**
```bash
pm2 logs traveldive      # Logs anschauen
pm2 restart traveldive   # Neustart
pm2 stop traveldive      # Stoppen
pm2 monit                # Live-Monitor
```

---

## Schritt 8: Nginx als Reverse Proxy (HTTPS + Domain)

Nginx leitet Traffic von Port 80/443 an deine App auf Port 3000 weiter.

```bash
# Nginx installieren
sudo apt-get install -y nginx

# Konfiguration erstellen
sudo nano /etc/nginx/sites-available/traveldive
```

Inhalt einfügen (ersetze `deine-domain.de`):
```nginx
server {
    listen 80;
    server_name deine-domain.de www.deine-domain.de;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Speichern und aktivieren:
```bash
sudo ln -s /etc/nginx/sites-available/traveldive /etc/nginx/sites-enabled/
sudo nginx -t          # Config testen
sudo systemctl restart nginx
```

---

## Schritt 9: SSL-Zertifikat (HTTPS) mit Let's Encrypt

```bash
# Certbot installieren
sudo apt-get install -y certbot python3-certbot-nginx

# Zertifikat holen (ersetzt automatisch die Nginx-Config)
sudo certbot --nginx -d deine-domain.de -d www.deine-domain.de

# Automatische Verlängerung testen
sudo certbot renew --dry-run
```

---

## Schritt 10: Google API Key Domain beschränken

1. Google Cloud Console → APIs & Dienste → Anmeldedaten
2. Deinen API Key anklicken
3. HTTP-Verweis-URLs hinzufügen:
   - `https://deine-domain.de/*`
   - `https://www.deine-domain.de/*`
4. Speichern

---

## Fertig! Testen

1. Öffne `https://deine-domain.de` → Dashboard
2. Erstelle eine neue Tour
3. Öffne den Kunden-Link → `https://deine-domain.de/t/slug-der-tour`

---

## Updates deployen

Wenn du Änderungen machst:

```bash
# Dateien auf Server kopieren/pullen
scp -r ./public root@deine-vps-ip:/root/traveldive-vps/

# Auf dem Server
cd /root/traveldive-vps
pm2 restart traveldive
```

---

## Fehlerbehebung

**"Cannot GET /t/..."**
→ Server läuft nicht. Prüfe: `pm2 status` und `pm2 logs traveldive`

**502 Bad Gateway**
→ Nginx kann Port 3000 nicht erreichen. Prüfe: `pm2 status`, eventuell `pm2 restart traveldive`

**Keine Bilder**
→ Google API Key prüfen: Domain in den Referrer-Beschränkungen hinzugefügt?

**KI-Generierung fehlgeschlagen**
→ `pm2 logs traveldive` → Anthropic API Key korrekt? Spending Limit erreicht?

**Supabase-Fehler**
→ SQL-Schema ausgeführt? SUPABASE_SERVICE_KEY (nicht ANON_KEY) in .env?
