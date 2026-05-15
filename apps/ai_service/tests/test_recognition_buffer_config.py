from __future__ import annotations

import sys
import types


pydantic_settings_mod = types.ModuleType("pydantic_settings")


class _BaseSettings:
    def __init__(self) -> None:
        for cls in reversed(self.__class__.mro()):
            for key, value in getattr(cls, "__dict__", {}).items():
                if key.isupper():
                    setattr(self, key, value)


class _SettingsConfigDict(dict):
    pass


pydantic_settings_mod.BaseSettings = _BaseSettings
pydantic_settings_mod.SettingsConfigDict = _SettingsConfigDict
sys.modules.setdefault("pydantic_settings", pydantic_settings_mod)

from app.core.config import settings


def test_recognition_buffer_waits_for_five_initial_candidates() -> None:
    assert settings.RECOGNITION_BUFFER_EXPECTED_CANDIDATES == 5
