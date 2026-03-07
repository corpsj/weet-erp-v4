import pytest
from unittest.mock import MagicMock, patch

from app.conversion.image_service import (
    DEFAULT_IMAGE_PROMPT,
    ImageService,
    PERSONA_IMAGE_PROMPTS,
)


@pytest.mark.asyncio
async def test_generate_marketing_image_cached() -> None:
    svc = ImageService()
    mock_sb = MagicMock()
    mock_sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[{"id": "1", "storage_path": "images/path-1.png"}]
    )

    with patch("app.db.session.get_supabase", return_value=mock_sb):
        result = await svc.generate_marketing_image(
            topic="모듈러주택 외관",
            persona="price_sensitive",
        )

    assert result == "images/path-1.png"


@pytest.mark.asyncio
async def test_generate_marketing_image_no_cache() -> None:
    svc = ImageService()
    mock_sb = MagicMock()
    mock_sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[]
    )

    with patch("app.db.session.get_supabase", return_value=mock_sb):
        result = await svc.generate_marketing_image(
            topic="모듈러주택 외관",
            persona="lifestyle",
        )

    assert result is None


@pytest.mark.asyncio
async def test_generate_marketing_image_db_error() -> None:
    svc = ImageService()

    with patch("app.db.session.get_supabase", side_effect=Exception("db down")):
        result = await svc.generate_marketing_image(
            topic="모듈러주택 외관",
            persona="design",
        )

    assert result is None


@pytest.mark.asyncio
async def test_persona_prompt_mapping() -> None:
    for persona, prompt_prefix in PERSONA_IMAGE_PROMPTS.items():
        svc = ImageService()
        mock_sb = MagicMock()
        query = mock_sb.table.return_value.select.return_value
        query.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[]
        )

        with patch("app.db.session.get_supabase", return_value=mock_sb):
            _ = await svc.generate_marketing_image(topic="테스트 토픽", persona=persona)

        query.eq.assert_called_once_with("prompt", f"{prompt_prefix}, 테스트 토픽")


@pytest.mark.asyncio
async def test_default_prompt_for_unknown_persona() -> None:
    svc = ImageService()
    mock_sb = MagicMock()
    query = mock_sb.table.return_value.select.return_value
    query.eq.return_value.limit.return_value.execute.return_value = MagicMock(data=[])

    with patch("app.db.session.get_supabase", return_value=mock_sb):
        _ = await svc.generate_marketing_image(topic="테스트 토픽", persona="unknown")

    query.eq.assert_called_once_with("prompt", f"{DEFAULT_IMAGE_PROMPT}, 테스트 토픽")
