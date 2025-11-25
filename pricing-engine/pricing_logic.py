from typing import Dict


def calculate_dynamic_price(
    base_fare: float,
    seats_left: int,
    total_seats: int,
    hours_to_departure: int,
    demand_index: float,
) -> float:
    seat_factor = (1 - (seats_left / total_seats)) * 0.5
    time_factor = max(0, (1 - (hours_to_departure / 240))) * 0.3
    demand_factor = demand_index * 0.2
    return round(base_fare * (1 + seat_factor + time_factor + demand_factor), 2)


def clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    return max(min(value, maximum), minimum)


def merge_metadata(base: Dict, extra: Dict) -> Dict:
    merged = base.copy()
    merged.update(extra)
    return merged


