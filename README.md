# Plateforme de Formation - Travail en Ligne

Plateforme web pour la formation professionnelle avec :
- 📺 Affichage des vidéos de formation
- 📱 Authentification par code OTP (SMS)
- 👨‍💼 Interface d'administration (Mamy Hervé)
- 📞 Gestion des contacts responsables
- ☁️ Déploiement Cloudflare Workers
- 🗄️ Base de données Supabase

## Fonctionnalités

### Côté utilisateur
- Vérification par téléphone (code à usage unique 6 chiffres)
- Accès aux vidéos de formation après vérification
- Affichage des contacts des responsables
- Lecteur vidéo intégré

### Côté admin (Mamy Hervé)
- Connexion sécurisée (email + mot de passe)
- CRUD complet sur les vidéos (ajouter, modifier, supprimer)
- CRUD complet sur les contacts
- Gestion des statuts (actif/inactif)

## Contacts configurés
- 📞 0388517134
- 📞 0328218844
- 📧 mamyherver@gmail.com
- 📧 kohlernaomy@gmail.com
- 📧 freddafishera@gmail.com
- 📘 Facebook MP: https://web.facebook.com/profile.php?id=61588757650516
- 📘 Facebook Page: https://web.facebook.com/profile.php?id=61594269681261

## Stack technique
- **Frontend**: HTML/CSS/JS vanilla (Hono pour le serveur)
- **Backend**: Cloudflare Workers (Hono framework)
- **Database**: Supabase (PostgreSQL)
- **Auth**: JWT + OTP
- **Deploy**: Cloudflare Workers + GitHub Actions

## Configuration requise

Variables d'environnement (Cloudflare Workers) :
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
OTP_SECRET=your-base32-otp-secret
```

## Installation locale

```bash
npm install
npm run dev
```

## Déploiement

```bash
npm run deploy
```

## Structure du projet
```
formation-platform/
├── src/
│   ├── index.js          # Worker principal (API + Frontend)
│   └── frontend/
│       └── index.html    # Interface utilisateur
├── wrangler.toml         # Config Cloudflare
├── package.json
└── README.md
```

## API Endpoints

### Public
- `GET /api/videos` - Liste des vidéos actives
- `GET /api/videos/:id` - Détail d'une vidéo
- `GET /api/contacts` - Liste des contacts actifs
- `POST /api/auth/request-otp` - Demander un code OTP
- `POST /api/auth/verify-otp` - Vérifier le code OTP

### Admin (Bearer token requis)
- `POST /api/admin/login` - Connexion admin
- `GET /api/admin/videos` - Toutes les vidéos
- `POST /api/admin/videos` - Créer vidéo
- `PUT /api/admin/videos/:id` - Modifier vidéo
- `DELETE /api/admin/videos/:id` - Supprimer vidéo
- `GET /api/admin/contacts` - Tous les contacts
- `POST /api/admin/contacts` - Créer contact
- `PUT /api/admin/contacts/:id` - Modifier contact
- `DELETE /api/admin/contacts/:id` - Supprimer contact

---
Développé pour Mamy Hervé • Madagascar 🇲🇬