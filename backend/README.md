# BoodschappenBaas Backend Prototype

Express + MongoDB API for:
- Lists beheren (CRUD + items toevoegen/bewerken/verwijderen)
- Lijsten delen via share token
- Volgorde sorteren op basis van winkelvoorkeur
- Aanbiedingen ophalen voor producten op de lijst

## Starten

1. Kopieer `.env.example` naar `.env`
2. Zorg dat MongoDB draait
3. Installeer dependencies en start de server:

```bash
cd backend
npm install
npm run dev
```

API base URL: `http://localhost:3001/api`

## Belangrijkste endpoints

- `GET /api/health`
- `GET/POST /api/lists`
- `GET/PUT/DELETE /api/lists/:id`
- `POST /api/lists/:id/items`
- `PUT/DELETE /api/lists/:id/items/:itemId`
- `POST /api/lists/:id/share`
- `GET /api/shared/:token`
- `POST /api/lists/:id/sort`
- `GET /api/lists/:id/offers`
- `GET/POST /api/products`
- `GET/POST /api/offers`
