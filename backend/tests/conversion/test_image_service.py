import pytest
from pathlib import Path
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
async def test_generate_marketing_image_generates_and_uploads(tmp_path: Path) -> None:
    svc = ImageService()
    svc._output_dir = str(tmp_path)

    mock_sb = MagicMock()
    table = mock_sb.table.return_value
    table.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[]
    )
    table.insert.return_value.execute.return_value = MagicMock()

    with (
        patch("app.db.session.get_supabase", return_value=mock_sb),
        patch.object(svc, "_generate_image_bytes", return_value=b"png-bytes"),
    ):
        result = await svc.generate_marketing_image(
            topic="모듈러주택 외관",
            persona="lifestyle",
        )

    assert result
    assert result.startswith("marketing/")
    assert mock_sb.storage.from_.called
    assert table.insert.called


@pytest.mark.asyncio
async def test_generate_marketing_image_gemini_failure_returns_none() -> None:
    svc = ImageService()

    mock_sb = MagicMock()
    mock_sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[]
    )

    with (
        patch("app.db.session.get_supabase", return_value=mock_sb),
        patch.object(svc, "_generate_image_bytes", return_value=None),
    ):
        result = await svc.generate_marketing_image(
            topic="모듈러주택 외관",
            persona="design",
        )

    assert result is None


@pytest.mark.asyncio
async def test_generate_marketing_image_upload_failure_returns_local_path(
    tmp_path: Path,
) -> None:
    svc = ImageService()
    svc._output_dir = str(tmp_path)
    mock_sb = MagicMock()
    mock_sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[]
    )
    mock_sb.storage.from_.return_value.upload.side_effect = Exception("upload failed")

    with (
        patch("app.db.session.get_supabase", return_value=mock_sb),
        patch.object(svc, "_generate_image_bytes", return_value=b"png-bytes"),
    ):
        result = await svc.generate_marketing_image(
            topic="모듈러주택 외관",
            persona="price_sensitive",
        )

    assert result
    assert str(result).endswith(".png")
    assert str(result).startswith(str(tmp_path))


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
            with patch.object(svc, "_generate_image_bytes", return_value=None):
                _ = await svc.generate_marketing_image(
                    topic="테스트 토픽", persona=persona
                )

        query.eq.assert_called_once_with("prompt", f"{prompt_prefix}, 테스트 토픽")


@pytest.mark.asyncio
async def test_default_prompt_for_unknown_persona() -> None:
    svc = ImageService()
    mock_sb = MagicMock()
    query = mock_sb.table.return_value.select.return_value
    query.eq.return_value.limit.return_value.execute.return_value = MagicMock(data=[])

    with patch("app.db.session.get_supabase", return_value=mock_sb):
        with patch.object(svc, "_generate_image_bytes", return_value=None):
            _ = await svc.generate_marketing_image(
                topic="테스트 토픽", persona="unknown"
            )

    query.eq.assert_called_once_with("prompt", f"{DEFAULT_IMAGE_PROMPT}, 테스트 토픽")
