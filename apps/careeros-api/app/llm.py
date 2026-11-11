"""A small client for a local OpenAI-compatible chat server (LiteLLM, Ollama /v1, LM Studio).

Nothing here talks to a cloud service unless you configure one and set CAREEROS_LLM_ALLOW_REMOTE.
Job text and skill levels travel to this server, so the host is checked before every request.
"""

from __future__ import annotations

import json
import re
from typing import Any, Protocol

import httpx

from .config import Settings


class LlmUnavailable(Exception):
    """The model server could not be used. The message is safe to show; it never contains URLs or keys."""


class LlmClient(Protocol):
    model: str

    def chat(self, messages: list[dict[str, str]], *, temperature: float = 0.4) -> str: ...


class HttpLlmClient:
    def __init__(self, settings: Settings, transport: httpx.BaseTransport | None = None) -> None:
        self._settings = settings
        self._transport = transport
        self.model = settings.llm_model

    def chat(self, messages: list[dict[str, str]], *, temperature: float = 0.4) -> str:
        s = self._settings
        if not s.llm_model:
            raise LlmUnavailable("No model is configured. Set CAREEROS_LLM_MODEL.")
        if not s.llm_host_is_local() and not s.llm_allow_remote:
            raise LlmUnavailable("The configured model server is not on this machine or private network. Set CAREEROS_LLM_ALLOW_REMOTE=true only if you accept sending job text and skill levels there.")
        headers = {"Content-Type": "application/json"}
        if s.llm_api_key:
            headers["Authorization"] = f"Bearer {s.llm_api_key.get_secret_value()}"
        payload = {"model": s.llm_model, "messages": messages, "temperature": temperature, "stream": False}
        try:
            with httpx.Client(transport=self._transport, timeout=s.llm_timeout_seconds, follow_redirects=False) as client:
                response = client.post(f"{s.llm_base_url}/chat/completions", headers=headers, json=payload)
        except httpx.TimeoutException as exc:
            raise LlmUnavailable("The model took too long to answer.") from exc
        except httpx.HTTPError as exc:
            raise LlmUnavailable("The model server could not be reached. Is it running?") from exc
        if response.status_code in (401, 403):
            raise LlmUnavailable("The model server rejected the request (check CAREEROS_LLM_API_KEY).")
        if response.status_code == 404:
            raise LlmUnavailable("The model server does not have that model or endpoint.")
        if response.status_code >= 400:
            raise LlmUnavailable(f"The model server returned an error ({response.status_code}).")
        try:
            content = response.json()["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError, TypeError) as exc:
            raise LlmUnavailable("The model server answered in an unexpected format.") from exc
        if not isinstance(content, str) or not content.strip():
            raise LlmUnavailable("The model returned an empty answer.")
        return content


_THINK = re.compile(r"<think>.*?</think>", re.S | re.I)
_FENCE = re.compile(r"```(?:json)?\s*(.*?)```", re.S | re.I)


def extract_json(raw: str) -> Any:
    """Parse JSON from a model reply, tolerating think blocks, code fences and surrounding prose."""
    text = _THINK.sub("", raw).strip()
    for candidate in (text, *( [m.group(1).strip()] if (m := _FENCE.search(text)) else [] )):
        try:
            return json.loads(candidate)
        except ValueError:
            pass
    start, end = text.find("{"), text.rfind("}")
    if start >= 0 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except ValueError:
            pass
    raise ValueError("no JSON found in the model reply")
