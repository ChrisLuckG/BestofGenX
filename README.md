# BestOfGenX Shop - Next.js

E-Commerce Shop mit Next.js, NextAuth und Printify-Integration.

## 🚀 Quick Start

```bash
# Dependencies installieren
npm install

# Development Server starten
npm run dev
```

Öffne [http://localhost:3000](http://localhost:3000)

## 📋 Setup

1. `.env.local` konfigurieren:
   - `NEXTAUTH_SECRET` generieren: `openssl rand -base64 32`
   - Printify API Key und Shop ID eintragen
   - Optional: Google OAuth konfigurieren

2. Development starten:
   ```bash
   npm run dev
   ```

## 🔐 NextAuth

- Google OAuth Login (optional)
- JWT Sessions
- Wie bei CheckMyGrow konfiguriert

## 📦 Features

- ✅ Next.js 14 App Router
- ✅ TypeScript
- ✅ Tailwind CSS
- ✅ NextAuth
- ✅ Printify Integration
- ✅ Warenkorb (Zustand)
- ✅ Vercel-ready

## 🚢 Deployment

```bash
# Build für Production
npm run build

# Production Server starten
npm start
```

Oder direkt auf Vercel deployen!
