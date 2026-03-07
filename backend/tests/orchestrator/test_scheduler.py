from unittest.mock import MagicMock

from app.orchestrator.scheduler import WeetScheduler


def create_scheduler(dry_run: bool = False) -> WeetScheduler:
    runner = MagicMock()
    return WeetScheduler(runner=runner, dry_run=dry_run)


def test_setup_jobs_registers_jobs() -> None:
    scheduler = create_scheduler()

    scheduler.setup_jobs()

    assert len(scheduler.get_job_ids()) >= 11


def test_scheduler_has_daily_reset_job() -> None:
    scheduler = create_scheduler()

    scheduler.setup_jobs()

    assert "daily_reset" in scheduler.get_job_ids()


def test_scheduler_has_weekly_report_job() -> None:
    scheduler = create_scheduler()

    scheduler.setup_jobs()

    assert "weekly_report" in scheduler.get_job_ids()


def test_scheduler_has_monthly_analysis_job() -> None:
    scheduler = create_scheduler()

    scheduler.setup_jobs()

    assert "monthly_analysis" in scheduler.get_job_ids()


def test_dry_run_flag_stored() -> None:
    scheduler = create_scheduler(dry_run=True)

    assert scheduler.dry_run is True
