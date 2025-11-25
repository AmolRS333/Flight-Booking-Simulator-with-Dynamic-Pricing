# Flight Booking Simulator

A local-first airline reservation sandbox that showcases dynamic pricing powered by a FastAPI microservice, a Mongo-backed Express API, and a React + Tailwind UI. The simulator lets you search flights, watch fares react to demand, lock seats, confirm bookings with generated PNRs, and download PDF receipts.

## Project Structure

```
flight-booking-simulator/
├── backend/          # Express + MongoDB API (flights, bookings, airport data)
├── pricing-engine/   # FastAPI dynamic pricing microservice
├── frontend/         # React + Tailwind single-page app
└── README.md         # You are here
```

## Prerequisites

- Node.js 18+ and npm
- Python 3.10+
- MongoDB Community Server running locally (`mongodb://127.0.0.1:27017`)

## 1. Backend (Node.js + Express)

```bash
cd backend
npm install
```

Create `backend/.env` with the following defaults (adjust as needed):

```
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/flight_booking_simulator
JWT_SECRET=supersecretkey
PRICING_SERVICE_URL=http://127.0.0.1:8000
SEAT_HOLD_TTL_MINUTES=2
PRICING_CACHE_TTL_SECONDS=60
```

Seed mock airlines, airports, and flights:

```bash
npm run seed
```

Run the API:

```bash
npm run dev
```

The server exposes:

- `GET /health` – service heartbeat
- `GET /api/flights/search` – flight search with pagination and dynamic fares
- `GET /api/flights/:id` – single flight with refreshed pricing
- `POST /api/flights/:id/hold` – lock seats for 2 minutes (JWT protected)
- `DELETE /api/flights/holds/:holdId` – release a seat hold (JWT protected)
- `POST /api/bookings` – confirm booking with hold consumption & PNR (JWT protected)
- `GET /api/bookings/:pnr` – booking lookup (JWT protected)
- `DELETE /api/bookings/:pnr` – cancel booking & restore seats (JWT protected)
- `GET /api/bookings/user/:userId` – dashboard bookings (JWT protected)
- `POST /api/auth/mock-login` – obtain a demo JWT

Example – search flights (`GET /api/flights/search?from=JFK&to=LAX&date=2025-12-01`):

```
{
  "total": 1,
  "page": 1,
  "pageSize": 10,
  "results": [
    {
      "id": "674054634c7c5d6377c8b181",
      "flight_number": "SB101",
      "airline": {
        "airline_code": "SB",
        "airline_name": "Springboard Airways"
      },
      "departure_airport": {
        "airport_code": "JFK",
        "city": "New York"
      },
      "arrival_airport": {
        "airport_code": "LAX",
        "city": "Los Angeles"
      },
      "departure_time": "2025-12-01T14:00:00.000Z",
      "arrival_time": "2025-12-01T20:00:00.000Z",
      "base_fare": 320,
      "available_seats": 180,
      "total_seats": 180,
      "pricing": {
        "dynamic_price": 327.68,
        "demand_index": 0.42,
        "seats_left": 180,
        "hours_to_departure": 482,
        "fromCache": false
      }
    }
  ]
}
```

Example – booking confirmation (`POST /api/bookings`):

```
Request Body:
{
  "flight_id": "674054634c7c5d6377c8b181",
  "hold_id": "674054a8e0b6b251f26c1e1d",
  "user_id": "demo-user-001",
  "passengers": [
    { "name": "Ada Lovelace", "age": 32, "gender": "F" },
    { "name": "Grace Hopper", "age": 35, "gender": "F" }
  ]
}

Response:
{
  "message": "Booking confirmed",
  "booking": {
    "pnr": "QJD942",
    "flight": "674054634c7c5d6377c8b181",
    "user_id": "demo-user-001",
    "passengers": [...],
    "total_fare": 655.36,
    "price_snapshot": {
      "base_fare": 320,
      "dynamic_price": 327.68,
      "demand_index": 0.42
    },
    "status": "CONFIRMED"
  }
}
```

Seat holds are backed by Mongo transactions and auto-cleaned every minute to release expired locks.

## 2. Pricing Engine (Python + FastAPI)

```bash
cd pricing-engine
python -m venv venv
source venv/bin/activate           # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

Endpoints:

- `POST /get_dynamic_price` – calculates fare using seat, time, and demand factors
- `GET /simulate_demand` – returns the current simulated demand per flight key
- `GET /health` – service heartbeat

Example request to `/get_dynamic_price`:

```
{
  "flight_id": "674054634c7c5d6377c8b181",
  "base_fare": 320,
  "seats_left": 178,
  "total_seats": 180,
  "hours_to_departure": 480
}
```

Example response:

```
{
  "dynamic_price": 333.89,
  "demand_index": 0.58,
  "seats_left": 178,
  "total_seats": 180,
  "hours_to_departure": 480,
  "from_cache": false,
  "metadata": {
    "calculated_at": "2025-11-13T21:00:12.348019"
  }
}
```

The service keeps an in-memory demand index that drifts every 120 seconds and caches calculated fares for 60 seconds to reduce repeated work.

## 3. Frontend (React + Tailwind)

```bash
cd frontend
npm install
npm start
```

The app runs on `http://localhost:3000` and expects the backend at `http://localhost:5000` and the pricing engine at `http://127.0.0.1:8000`. Override via:

```
REACT_APP_API_URL=http://localhost:5000
REACT_APP_PRICING_SERVICE_URL=http://127.0.0.1:8000
```

### Key Screens

- **Home/Search** – airport autocomplete, passenger count, hero overview
- **Results** – paginated flights with live dynamic fares, demand heat bars, real-time refresh and demand chart
- **Booking** – seat availability bar, automatic seat hold, passenger capture
- **Confirmation** – PNR summary with PDF receipt (jsPDF + autotable)
- **Dashboard** – list of bookings with cancellation & receipt links

Authentication uses the mock JWT endpoint; simply open the “Demo Login” page and submit the generated user to obtain a bearer token.

## Suggested Test Flow

1. Start MongoDB locally.
2. Launch the pricing engine (`uvicorn app:app --reload --port 8000`).
3. Run the Express backend (`npm run dev` in `backend/`).
4. Seed data once (`npm run seed` in `backend/`).
5. Start the React app (`npm start` in `frontend/`).
6. Use the Demo Login, search JFK → LAX, select a flight, fill passengers, confirm booking, and download the PDF receipt.
7. Visit the dashboard to cancel the booking and confirm seats are restored in subsequent searches.

## Additional Notes

- Aviation data is pre-seeded but you can swap in AviationStack responses inside `backend/data/*.json` and re-run the seed script.
- Seat locking uses Mongo transactions with periodic cleanup to prevent stale holds.
- Dynamic pricing calls are cached per flight/seat/timing combination and fall back to the base fare if the Python service is unreachable.
- All services are designed for local development; no deployment configuration is included per the requirements.

## Scripts Reference

- `backend/npm run seed` – re-populate airlines, airports, and flights
- `backend/npm run dev` – start Express with nodemon
- `frontend/npm start` – start React dev server
- `pricing-engine/uvicorn app:app --reload --port 8000` – run pricing service

Enjoy experimenting with demand-driven airfare! 🎟️✈️


