"""Redis stream helpers."""

from __future__ import annotations

import json
from typing import Any, Optional

from redis import Redis
from redis.exceptions import ResponseError


class RedisStreamClient:
    def __init__(
        self,
        host: str,
        port: int,
        input_stream: str,
        output_stream: str,
        consumer_group: str,
        consumer_name: str,
    ) -> None:
        self._client = Redis(host=host, port=port, decode_responses=True)
        self._input_stream = input_stream
        self._output_stream = output_stream
        self._consumer_group = consumer_group
        self._consumer_name = consumer_name

    def ensure_group(self) -> None:
        try:
            self._client.xgroup_create(
                name=self._input_stream,
                groupname=self._consumer_group,
                id="0",
                mkstream=True,
            )
        except ResponseError as exc:
            if "BUSYGROUP" not in str(exc):
                raise

    def read(self, block_ms: int) -> Optional[tuple[str, dict[str, Any]]]:
        response = self._client.xreadgroup(
            groupname=self._consumer_group,
            consumername=self._consumer_name,
            streams={self._input_stream: ">"},
            count=1,
            block=block_ms,
        )
        if not response:
            return None

        _, messages = response[0]
        message_id, fields = messages[0]
        payload = json.loads(fields["data"])
        return message_id, payload

    def publish_result(self, payload: dict[str, Any]) -> str:
        return self._client.xadd(
            self._output_stream,
            fields={"data": json.dumps(payload)},
        )

    def acknowledge(self, message_id: str) -> None:
        self._client.xack(self._input_stream, self._consumer_group, message_id)
