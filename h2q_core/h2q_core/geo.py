"""Geofence math. No Frappe import — safe to unit test.

Ring points are [latitude, longitude].
GeoJSON Polygon rings are [longitude, latitude] and are converted on parse.
"""

from __future__ import annotations

import json
from typing import Any


def parse_ring(raw: Any) -> list[list[float]] | None:
	"""Return a ring of [lat, lng], or None when empty or unusable."""
	data = raw
	if isinstance(raw, str):
		text = raw.strip()
		if not text:
			return None
		try:
			data = json.loads(text)
		except json.JSONDecodeError:
			return None

	if isinstance(data, dict):
		if data.get("type") == "Polygon":
			coords = data.get("coordinates") or []
			ring = coords[0] if coords else []
			return _as_ring(ring, order="lnglat")
		if data.get("ring") is not None:
			return _as_ring(data.get("ring"), order="latlng")
		return None

	if isinstance(data, list):
		return _as_ring(data, order="latlng")
	return None


def point_in_ring(lat: float, lng: float, ring: list[list[float]]) -> bool:
	"""Ray cast. Vertices and boundary points count as inside."""
	if len(ring) < 3:
		return False
	if _on_boundary(lat, lng, ring):
		return True

	inside = False
	j = len(ring) - 1
	for i in range(len(ring)):
		lat_i, lng_i = ring[i]
		lat_j, lng_j = ring[j]
		intersects = (lng_i > lng) != (lng_j > lng)
		if intersects:
			lat_at = (lat_j - lat_i) * (lng - lng_i) / (lng_j - lng_i) + lat_i
			if lat < lat_at:
				inside = not inside
		j = i
	return inside


def evaluate_geofence(policy: str | None, lat: Any, lng: Any, raw_fence: Any) -> dict[str, Any]:
	"""
	policy: Off | Warn | Block (anything else behaves as Off).

	A project with no polygon is always ok, so existing sites keep working.
	"""
	mode = policy or "Off"
	if mode not in ("Warn", "Block"):
		return {"action": "ok", "outside": 0, "reason": "off", "message": ""}

	ring = parse_ring(raw_fence)
	if not ring:
		return {"action": "ok", "outside": 0, "reason": "no_fence", "message": ""}

	if lat in (None, "") or lng in (None, ""):
		message = "Công trường đã có vùng GPS nhưng phiếu chưa có toạ độ."
		if mode == "Block":
			return {"action": "block", "outside": 1, "reason": "missing_gps", "message": message}
		return {"action": "warn", "outside": 1, "reason": "missing_gps", "message": message}

	try:
		lat_f = float(lat)
		lng_f = float(lng)
	except (TypeError, ValueError):
		message = "Toạ độ GPS không đọc được."
		if mode == "Block":
			return {"action": "block", "outside": 1, "reason": "bad_gps", "message": message}
		return {"action": "warn", "outside": 1, "reason": "bad_gps", "message": message}

	if point_in_ring(lat_f, lng_f, ring):
		return {"action": "ok", "outside": 0, "reason": "inside", "message": ""}

	message = "Vị trí gửi phiếu nằm ngoài vùng công trường."
	if mode == "Block":
		return {"action": "block", "outside": 1, "reason": "outside", "message": message}
	return {"action": "warn", "outside": 1, "reason": "outside", "message": message}


def _as_ring(points: Any, *, order: str) -> list[list[float]] | None:
	if not isinstance(points, list):
		return None
	ring: list[list[float]] = []
	for point in points:
		pair = _pair(point, order=order)
		if pair is None:
			return None
		if ring and pair == ring[-1]:
			continue
		ring.append(pair)
	if len(ring) >= 2 and ring[0] == ring[-1]:
		ring = ring[:-1]
	if len(ring) < 3:
		return None
	return ring


def _pair(point: Any, *, order: str) -> list[float] | None:
	lat = lng = None
	if isinstance(point, dict):
		lat = point.get("lat", point.get("latitude"))
		lng = point.get("lng", point.get("lon", point.get("longitude")))
	elif isinstance(point, (list, tuple)) and len(point) >= 2:
		if order == "lnglat":
			lng, lat = point[0], point[1]
		else:
			lat, lng = point[0], point[1]
	if lat is None or lng is None:
		return None
	try:
		return [float(lat), float(lng)]
	except (TypeError, ValueError):
		return None


def _on_boundary(lat: float, lng: float, ring: list[list[float]]) -> bool:
	n = len(ring)
	for i in range(n):
		lat_a, lng_a = ring[i]
		lat_b, lng_b = ring[(i + 1) % n]
		if abs(_cross(lat, lng, lat_a, lng_a, lat_b, lng_b)) > 1e-12:
			continue
		if (
			min(lat_a, lat_b) - 1e-12 <= lat <= max(lat_a, lat_b) + 1e-12
			and min(lng_a, lng_b) - 1e-12 <= lng <= max(lng_a, lng_b) + 1e-12
		):
			return True
	return False


def _cross(lat: float, lng: float, lat_a: float, lng_a: float, lat_b: float, lng_b: float) -> float:
	return (lng - lng_a) * (lat_b - lat_a) - (lat - lat_a) * (lng_b - lng_a)
