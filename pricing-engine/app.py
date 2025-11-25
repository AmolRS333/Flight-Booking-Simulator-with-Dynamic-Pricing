import asyncio
import contextlib
import os
import random
from datetime import datetime, timedelta
from typing import Dict, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator

from pricing_logic import calculate_dynamic_price, clamp, merge_metadata
from dotenv import load_dotenv

load_dotenv()

DEMAND_UPDATE_INTERVAL_SECONDS = int(os.getenv('DEMAND_UPDATE_INTERVAL_SECONDS', '120'))
CACHE_TTL_SECONDS = int(os.getenv('CACHE_TTL_SECONDS', '60'))

demand_state: Dict[str, Dict[str, float]] = {}
price_cache: Dict[str, Dict] = {}

app = FastAPI(
    title='Flight Pricing Engine',
    description='Dynamic pricing microservice for the flight booking simulator',
    version='1.0.0',
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
)


class PricingRequest(BaseModel):
    base_fare: float = Field(..., gt=0)
    seats_left: int = Field(..., ge=0)
    total_seats: int = Field(..., gt=0)
    hours_to_departure: int = Field(..., ge=0)
    demand_index: Optional[float] = Field(None, ge=0, le=1)
    flight_id: Optional[str] = None

    @validator('seats_left')
    def seats_not_exceed_total(cls, v, values):
        total = values.get('total_seats')
        if total is not None and v > total:
            raise ValueError('seats_left cannot exceed total_seats')
        return v


class PricingResponse(BaseModel):
    dynamic_price: float
    demand_index: float
    seats_left: int
    total_seats: int
    hours_to_departure: int
    from_cache: bool
    metadata: Dict[str, float]


class DemandResponse(BaseModel):
    flight_id: str
    demand_index: float
    updated_at: datetime


async def demand_simulation_loop():
    try:
        while True:
            await asyncio.sleep(DEMAND_UPDATE_INTERVAL_SECONDS)
            for flight_id in list(demand_state.keys()):
                current = demand_state[flight_id]['demand_index']
                delta = random.uniform(-0.1, 0.1)
                updated = clamp(current + delta)
                demand_state[flight_id]['demand_index'] = updated
                demand_state[flight_id]['updated_at'] = datetime.utcnow()
    except asyncio.CancelledError:
        pass


def get_demand_index(flight_id: Optional[str], fallback: Optional[float]) -> float:
    key = flight_id or 'global'
    if fallback is not None:
        demand_state[key] = {
            'demand_index': clamp(fallback),
            'updated_at': datetime.utcnow(),
        }
        return clamp(fallback)

    if key not in demand_state:
        demand_state[key] = {
            'demand_index': clamp(random.uniform(0.2, 0.8)),
            'updated_at': datetime.utcnow(),
        }

    return demand_state[key]['demand_index']


def get_cached_price(cache_key: str):
    cached = price_cache.get(cache_key)
    if not cached:
        return None
    if cached['expires_at'] < datetime.utcnow():
        price_cache.pop(cache_key, None)
        return None
    return cached


def set_cached_price(cache_key: str, payload: Dict):
    price_cache[cache_key] = {
        **payload,
        'expires_at': datetime.utcnow() + timedelta(seconds=CACHE_TTL_SECONDS),
    }


@app.on_event('startup')
async def startup_event():
    app.state.demand_task = asyncio.create_task(demand_simulation_loop())


@app.on_event('shutdown')
async def shutdown_event():
    demand_task: asyncio.Task = app.state.demand_task
    demand_task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await demand_task


@app.get('/health')
async def health():
    return {
        'status': 'ok',
        'service': 'pricing-engine',
        'timestamp': datetime.utcnow(),
    }


@app.post('/get_dynamic_price', response_model=PricingResponse)
async def get_dynamic_price(payload: PricingRequest):
    flight_id = payload.flight_id or 'global'
    cache_key = f"{flight_id}:{payload.seats_left}:{payload.total_seats}:{payload.hours_to_departure}"

    cached = get_cached_price(cache_key)
    if cached:
        return PricingResponse(**cached, from_cache=True)

    demand_index = get_demand_index(payload.flight_id, payload.demand_index)

    if payload.total_seats == 0:
        raise HTTPException(status_code=400, detail='total_seats must be greater than zero')

    dynamic_price = calculate_dynamic_price(
        payload.base_fare,
        payload.seats_left,
        payload.total_seats,
        payload.hours_to_departure,
        demand_index,
    )

    response_payload = {
        'dynamic_price': dynamic_price,
        'demand_index': demand_index,
        'seats_left': payload.seats_left,
        'total_seats': payload.total_seats,
        'hours_to_departure': payload.hours_to_departure,
        'metadata': merge_metadata(
            {'calculated_at': datetime.utcnow().isoformat()}, {}
        ),
    }

    set_cached_price(cache_key, response_payload)

    return PricingResponse(**response_payload, from_cache=False)


@app.get('/simulate_demand', response_model=Dict[str, DemandResponse])
async def simulate_demand():
    return {
        flight_id: DemandResponse(
            flight_id=flight_id,
            demand_index=state['demand_index'],
            updated_at=state['updated_at'],
        )
        for flight_id, state in demand_state.items()
    }

