from collections import deque
import time
from typing import NamedTuple


class RateLimitResult(NamedTuple):
    allowed: bool
    retry_after: int = 0


class InMemoryRateLimiter:
    """Bounded, single-worker sliding window rate limiter for demo policy.

    Tracks 60-second windows for total requests (default 120/min) and
    mutations (default 30/min) per client identity. Bounded to max_keys.
    """

    def __init__(
        self,
        max_requests_per_min: int = 120,
        max_mutations_per_min: int = 30,
        max_keys: int = 5000,
    ) -> None:
        self.max_requests_per_min = max_requests_per_min
        self.max_mutations_per_min = max_mutations_per_min
        self.max_keys = max_keys
        # Key -> deque of timestamps
        self._requests: dict[str, deque[float]] = {}
        self._mutations: dict[str, deque[float]] = {}

    def _purge_old(self, queue: deque[float], cutoff: float) -> None:
        while queue and queue[0] < cutoff:
            queue.popleft()

    def check_and_record(
        self,
        client_key: str,
        is_mutation: bool = False,
        now: float | None = None,
    ) -> RateLimitResult:
        current_time = time.monotonic() if now is None else now
        cutoff = current_time - 60.0

        # Memory bound check
        if len(self._requests) > self.max_keys:
            self._cleanup_all(cutoff)

        req_queue = self._requests.setdefault(client_key, deque())
        self._purge_old(req_queue, cutoff)

        if len(req_queue) >= self.max_requests_per_min:
            oldest = req_queue[0]
            retry_after = max(1, int(60.0 - (current_time - oldest)))
            return RateLimitResult(allowed=False, retry_after=retry_after)

        if is_mutation:
            mut_queue = self._mutations.setdefault(client_key, deque())
            self._purge_old(mut_queue, cutoff)
            if len(mut_queue) >= self.max_mutations_per_min:
                oldest = mut_queue[0]
                retry_after = max(1, int(60.0 - (current_time - oldest)))
                return RateLimitResult(allowed=False, retry_after=retry_after)
            mut_queue.append(current_time)

        req_queue.append(current_time)
        return RateLimitResult(allowed=True, retry_after=0)

    def _cleanup_all(self, cutoff: float) -> None:
        empty_keys = []
        for k, q in self._requests.items():
            self._purge_old(q, cutoff)
            if not q:
                empty_keys.append(k)
        for k in empty_keys:
            self._requests.pop(k, None)

        empty_mut_keys = []
        for k, q in self._mutations.items():
            self._purge_old(q, cutoff)
            if not q:
                empty_mut_keys.append(k)
        for k in empty_mut_keys:
            self._mutations.pop(k, None)

    def reset(self) -> None:
        self._requests.clear()
        self._mutations.clear()
