SUCCESS = "SUCCESS"
BROWSER_TIMEOUT = "BROWSER_TIMEOUT"
AUTH_FAILED = "AUTH_FAILED"
RATE_LIMITED = "RATE_LIMITED"
CONTENT_REJECTED = "CONTENT_REJECTED"
NETWORK_ERROR = "NETWORK_ERROR"
SKILL_ERROR = "SKILL_ERROR"

RetryConfig = dict[str, object]

RETRY_STRATEGY: dict[str, RetryConfig] = {
    SUCCESS: {"retry": False, "notify": False},
    BROWSER_TIMEOUT: {"retry": True, "max_retries": 2, "backoff": 30, "notify": False},
    AUTH_FAILED: {"retry": False, "notify": True, "notify_channel": "error"},
    RATE_LIMITED: {"retry": True, "max_retries": 3, "backoff": 3600, "notify": False},
    CONTENT_REJECTED: {"retry": False, "notify": True, "notify_channel": "error"},
    NETWORK_ERROR: {"retry": True, "max_retries": 3, "backoff": 60, "notify": False},
    SKILL_ERROR: {"retry": True, "max_retries": 1, "backoff": 10, "notify": True},
}

_TIMEOUT_KEYWORDS = ("timeout", "timed out")
_AUTH_KEYWORDS = ("login failed", "auth failed", "incorrect password", "unauthorized")
_RATE_LIMIT_KEYWORDS = ("rate limit", "too many requests", "429")
_CONTENT_KEYWORDS = ("violates", "community guidelines", "policy", "rejected")
_NETWORK_KEYWORDS = ("connection refused", "network error", "unreachable")


def classify_response(success: bool, content: str) -> str:
    if success:
        return SUCCESS

    text = (content or "").lower()

    if any(keyword in text for keyword in _TIMEOUT_KEYWORDS):
        return BROWSER_TIMEOUT
    if any(keyword in text for keyword in _AUTH_KEYWORDS):
        return AUTH_FAILED
    if any(keyword in text for keyword in _RATE_LIMIT_KEYWORDS):
        return RATE_LIMITED
    if any(keyword in text for keyword in _CONTENT_KEYWORDS):
        return CONTENT_REJECTED
    if any(keyword in text for keyword in _NETWORK_KEYWORDS):
        return NETWORK_ERROR

    return SKILL_ERROR


def get_retry_strategy(error_type: str) -> RetryConfig:
    return RETRY_STRATEGY.get(error_type, RETRY_STRATEGY[SKILL_ERROR])


__all__ = ["classify_response", "get_retry_strategy", "RETRY_STRATEGY"]
