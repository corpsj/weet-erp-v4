from unittest.mock import MagicMock, patch
import pytest
from app.core.llm import LLMService


@pytest.fixture
def mock_ollama():
    with patch("app.core.llm.ollama.Client") as mock_client_class:
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        yield mock_client


def test_generate_returns_text(mock_ollama):
    mock_ollama.chat.return_value = MagicMock(
        message=MagicMock(content="이동식주택 장점 3가지")
    )
    svc = LLMService()
    result = svc.generate("이동식주택의 장점 3가지")
    assert "이동식주택" in result


def test_generate_uses_fast_model_by_default(mock_ollama):
    mock_ollama.chat.return_value = MagicMock(message=MagicMock(content="ok"))
    svc = LLMService()
    svc.generate("test")
    call_kwargs = mock_ollama.chat.call_args
    assert (
        call_kwargs.kwargs["model"] == "qwen3.5:9b"
        or call_kwargs.args[0] == "qwen3.5:9b"
        or "qwen3.5:9b" in str(call_kwargs)
    )


def test_generate_with_system_prompt(mock_ollama):
    mock_ollama.chat.return_value = MagicMock(message=MagicMock(content="analyzed"))
    svc = LLMService()
    result = svc.generate("test", system="You are a marketing expert")
    assert result == "analyzed"


def test_analyze_returns_dict(mock_ollama):
    mock_ollama.chat.return_value = MagicMock(
        message=MagicMock(content='{"urgency": "high", "sentiment": "positive"}')
    )
    svc = LLMService()
    result = svc.analyze("이동식주택 인기 급증", "market opportunity")
    assert isinstance(result, dict)


def test_ollama_offline_raises_connection_error(mock_ollama):
    mock_ollama.chat.side_effect = Exception("Connection refused")
    svc = LLMService()
    with pytest.raises(ConnectionError):
        svc.generate("test")


def test_classify_returns_valid_category(mock_ollama):
    mock_ollama.chat.return_value = MagicMock(message=MagicMock(content="lifestyle"))
    svc = LLMService()
    result = svc.classify(
        "전원생활 꿈꾸는 중", ["price_sensitive", "lifestyle", "practical", "design"]
    )
    assert result in ["price_sensitive", "lifestyle", "practical", "design"]
