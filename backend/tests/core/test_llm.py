from unittest.mock import MagicMock, patch
import pytest
from app.core.llm import LLMService


@pytest.fixture
def mock_openai():
    with patch("app.core.llm.OpenAI") as mock_client_class:
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        yield mock_client


def _chat_response(content: str) -> MagicMock:
    choice = MagicMock()
    choice.message.content = content
    resp = MagicMock()
    resp.choices = [choice]
    return resp


def test_generate_returns_text(mock_openai):
    mock_openai.chat.completions.create.return_value = _chat_response(
        "이동식주택 장점 3가지"
    )
    svc = LLMService()
    result = svc.generate("이동식주택의 장점 3가지")
    assert "이동식주택" in result


def test_generate_uses_single_model(mock_openai):
    mock_openai.chat.completions.create.return_value = _chat_response("ok")
    svc = LLMService()
    svc.generate("test")
    call_kwargs = mock_openai.chat.completions.create.call_args
    assert "huihui-qwen3.5-35b-a3b-abliterated-mlx" in str(call_kwargs)


def test_generate_with_system_prompt(mock_openai):
    mock_openai.chat.completions.create.return_value = _chat_response("analyzed")
    svc = LLMService()
    result = svc.generate("test", system="You are a marketing expert")
    assert result == "analyzed"


def test_analyze_returns_dict(mock_openai):
    mock_openai.chat.completions.create.return_value = _chat_response(
        '{"urgency": "high", "sentiment": "positive"}'
    )
    svc = LLMService()
    result = svc.analyze("이동식주택 인기 급증", "market opportunity")
    assert isinstance(result, dict)


def test_lmstudio_offline_raises_connection_error(mock_openai):
    mock_openai.chat.completions.create.side_effect = Exception("Connection refused")
    svc = LLMService()
    with pytest.raises(ConnectionError):
        svc.generate("test")


def test_classify_returns_valid_category(mock_openai):
    mock_openai.chat.completions.create.return_value = _chat_response("lifestyle")
    svc = LLMService()
    result = svc.classify(
        "전원생활 꿈꾸는 중", ["price_sensitive", "lifestyle", "practical", "design"]
    )
    assert result in ["price_sensitive", "lifestyle", "practical", "design"]
