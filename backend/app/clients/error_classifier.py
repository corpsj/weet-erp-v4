SUCCESS = "SUCCESS"
BROWSER_TIMEOUT = "BROWSER_TIMEOUT"
AUTH_FAILED = "AUTH_FAILED"
RATE_LIMITED = "RATE_LIMITED"
CONTENT_REJECTED = "CONTENT_REJECTED"
NETWORK_ERROR = "NETWORK_ERROR"
SKILL_ERROR = "SKILL_ERROR"
ACTION_BLOCK = "ACTION_BLOCK"
CHALLENGE_REQUIRED = "CHALLENGE_REQUIRED"
ACCOUNT_BANNED = "ACCOUNT_BANNED"

RetryConfig = dict[str, object]

RETRY_STRATEGY: dict[str, RetryConfig] = {
    SUCCESS: {"retry": False, "notify": False},
    BROWSER_TIMEOUT: {"retry": True, "max_retries": 2, "backoff": 30, "notify": False},
    AUTH_FAILED: {"retry": False, "notify": True, "notify_channel": "error"},
    RATE_LIMITED: {"retry": True, "max_retries": 3, "backoff": 3600, "notify": False},
    CONTENT_REJECTED: {"retry": False, "notify": True, "notify_channel": "error"},
    NETWORK_ERROR: {"retry": True, "max_retries": 3, "backoff": 60, "notify": False},
    SKILL_ERROR: {"retry": True, "max_retries": 1, "backoff": 10, "notify": True},
    ACTION_BLOCK: {
        "retry": True,
        "max_retries": 1,
        "backoff": 86400,
        "notify": True,
        "notify_channel": "error",
    },
    CHALLENGE_REQUIRED: {"retry": False, "notify": True, "notify_channel": "error"},
    ACCOUNT_BANNED: {"retry": False, "notify": True, "notify_channel": "error"},
}

_TIMEOUT_KEYWORDS = ("timeout", "timed out")
_AUTH_KEYWORDS = ("login failed", "auth failed", "incorrect password", "unauthorized")
_RATE_LIMIT_KEYWORDS = ("rate limit", "too many requests", "429")
_CONTENT_KEYWORDS = ("violates", "community guidelines", "policy", "rejected")
_NETWORK_KEYWORDS = ("connection refused", "network error", "unreachable")
_ACTION_BLOCK_KEYWORDS = (
    "action_block",
    "action blocked",
    "temporarily blocked",
    "try again later",
)
_CHALLENGE_KEYWORDS = (
    "challenge_required",
    "checkpoint_required",
    "verify your identity",
)
_BANNED_KEYWORDS = (
    "user has been banned",
    "account has been disabled",
    "account suspended",
)


def classify_response(success: bool, content: str) -> str:
    if success:
        return SUCCESS

    text = (content or "").lower()

    if any(keyword in text for keyword in _ACTION_BLOCK_KEYWORDS):
        return ACTION_BLOCK
    if any(keyword in text for keyword in _CHALLENGE_KEYWORDS):
        return CHALLENGE_REQUIRED
    if any(keyword in text for keyword in _BANNED_KEYWORDS):
        return ACCOUNT_BANNED
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
