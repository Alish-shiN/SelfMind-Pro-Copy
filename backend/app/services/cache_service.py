import hashlib
import importlib
import importlib.util
import json
from collections.abc import Callable
from typing import Any, TypeVar

from fastapi.encoders import jsonable_encoder
from pydantic import TypeAdapter

from app.core.config import settings

T = TypeVar("T")
_MISSING = object()

CACHE_PREFIX = "selfmind:v1"


class CacheTTL:
    DASHBOARD = 90
    MOOD_ANALYTICS = 300
    GOALS = 300
    STATIC = 3600
    QUIZ = 300
    ARCHIVE_SEARCH = 180
    COMMUNITY_FEED = 60
    PROFILE = 180
    ADMIN = 180


class CacheNamespace:
    DASHBOARD = "dashboard"
    ANALYTICS = "analytics"
    MOOD = "mood"
    JOURNAL = "journal"
    ARCHIVE = "archive"
    INSIGHTS = "insights"
    GOALS = "goals"
    QUIZ = "quiz"
    COMMUNITY = "community"
    PROFILE = "profile"
    PRIVACY = "privacy"
    PERSONALIZATION = "personalization"
    ADMIN = "admin"


class RedisCache:
    def __init__(self) -> None:
        self._client: Any | None = None
        self._disabled = False

    def _get_client(self) -> Any | None:
        if self._disabled or not settings.REDIS_URL:
            return None
        if self._client is not None:
            return self._client
        if importlib.util.find_spec("redis") is None:
            self._disabled = True
            return None

        redis_module = importlib.import_module("redis")
        try:
            client = redis_module.Redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=1,
                socket_timeout=1,
            )
            client.ping()
        except Exception:
            self._disabled = True
            return None

        self._client = client
        return self._client

    def build_key(self, namespace: str, *parts: Any) -> str:
        safe_parts = [self._normalize_part(part) for part in parts]
        return ":".join([CACHE_PREFIX, namespace, *safe_parts])

    def build_user_key(self, namespace: str, user_id: int, *parts: Any) -> str:
        return self.build_key(namespace, f"user:{user_id}", *parts)

    def get(self, key: str) -> Any | None:
        value = self._get_cached(key)
        return None if value is _MISSING else value

    def _get_cached(self, key: str) -> Any:
        client = self._get_client()
        if client is None:
            return _MISSING
        try:
            value = client.get(key)
            if value is None:
                return _MISSING
            payload = json.loads(value)
            if (
                isinstance(payload, dict)
                and payload.get("__selfmind_cache_payload__") is True
            ):
                return payload.get("value")
            return payload
        except Exception:
            return _MISSING

    def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        client = self._get_client()
        if client is None:
            return
        try:
            payload = {
                "__selfmind_cache_payload__": True,
                "value": jsonable_encoder(value),
            }
            client.setex(key, ttl_seconds, json.dumps(payload))
        except Exception:
            return

    def delete(self, *keys: str) -> None:
        client = self._get_client()
        if client is None or not keys:
            return
        try:
            client.delete(*keys)
        except Exception:
            return

    def delete_by_pattern(self, pattern: str) -> None:
        client = self._get_client()
        if client is None:
            return
        try:
            for key in client.scan_iter(match=pattern, count=100):
                client.delete(key)
        except Exception:
            return

    def get_or_set(
        self,
        key: str,
        ttl_seconds: int,
        loader: Callable[[], T],
        response_model: Any | None = None,
    ) -> T:
        cached = self._get_cached(key)
        if cached is not _MISSING:
            return cached
        value = loader()
        if response_model is not None:
            adapter = TypeAdapter(response_model)
            value = adapter.dump_python(
                adapter.validate_python(value, from_attributes=True), mode="json"
            )
        self.set(key, value, ttl_seconds)
        return value

    def invalidate_user(self, user_id: int, *namespaces: str) -> None:
        for namespace in namespaces:
            self.delete_by_pattern(self.build_key(namespace, f"user:{user_id}", "*"))

    def invalidate_namespace(self, namespace: str) -> None:
        self.delete_by_pattern(self.build_key(namespace, "*"))

    def _normalize_part(self, part: Any) -> str:
        if part == "*":
            return "*"
        if (
            isinstance(part, str)
            and part
            and all(ch.isalnum() or ch in "-_.:" for ch in part)
        ):
            return part
        encoded = json.dumps(
            jsonable_encoder(part), sort_keys=True, separators=(",", ":")
        )
        if len(encoded) <= 80 and all(ch.isalnum() or ch in "-_.:" for ch in encoded):
            return encoded
        return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


cache = RedisCache()


def cache_get_or_set(
    key: str,
    ttl_seconds: int,
    loader: Callable[[], T],
    response_model: Any | None = None,
) -> T:
    return cache.get_or_set(key, ttl_seconds, loader, response_model=response_model)


def user_cache_key(namespace: str, user_id: int, *parts: Any) -> str:
    return cache.build_user_key(namespace, user_id, *parts)


def cache_key(namespace: str, *parts: Any) -> str:
    return cache.build_key(namespace, *parts)


def invalidate_user_cache(user_id: int, *namespaces: str) -> None:
    cache.invalidate_user(user_id, *namespaces)


def invalidate_namespace(namespace: str) -> None:
    cache.invalidate_namespace(namespace)
