# ExpiryGuard

**Real problem:** yogurt, medicine, passports, gift cards, and “discard 90 days after opening” products expire quietly — you notice when it’s already waste.

**Solution:** a no-account tracker that sorts everything by urgency (expired / today / this week / later), supports “opened today + shelf life”, **camera label scan** (iPhone-friendly), and optional browser notifications.

## Features

- **Scan with camera** — point at the name + best-before / use-by line; on-device OCR (Tesseract) fills the form. Nothing is uploaded.
- Add items with printed expiry **or** opened-today + days remaining
- Categories: food, medicine, documents, home, other
- Urgency dashboard + filters
- Optional browser notifications within your warning window
- Data stays in `localStorage` (no signup)

## Live demo

https://stefandevelops.github.io/expiryguard/

## Run locally

```bash
npm install
npm run dev
```

Open http://127.0.0.1:43126

For a production-like static serve:

```bash
npm run build && npm start
```

## CV line

Built a browser-only expiry tracker with on-device OCR label scanning for iPhone, urgency ranking, and optional Notifications API nudges — no backend or accounts.
