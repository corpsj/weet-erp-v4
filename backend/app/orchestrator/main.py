import argparse
import asyncio
import logging
import sys

from app.core.notification_service import NotificationService
from app.orchestrator.runner import TaskRunner
from app.orchestrator.scheduler import WeetScheduler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


async def run_once(dry_run: bool = False):
    runner = TaskRunner(notifier=NotificationService(), dry_run=dry_run)
    task_names = [
        "daily_reset",
        "market_scan",
        "suggestion_run",
        "daily_report",
        "journey_check",
        "content_generate",
        "content_publish",
        "lead_hunt",
        "evening_followup",
    ]

    async def noop() -> None:
        return None

    for task_name in task_names:
        result = await runner.run(task_name, noop)
        status = "OK" if result.success else f"FAIL({result.error})"
        logger.info("[PIPELINE] %s: %s", task_name, status)

    logger.info("[PIPELINE] Full cycle complete.")
    return runner.get_log()


def main() -> None:
    parser = argparse.ArgumentParser(description="WEET Director Marketing Orchestrator")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run without external API calls",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run one cycle then exit",
    )
    args = parser.parse_args()

    if args.dry_run or args.once:
        asyncio.run(run_once(dry_run=args.dry_run))
        sys.exit(0)

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    runner = TaskRunner(notifier=NotificationService())
    scheduler = WeetScheduler(runner=runner)
    try:
        scheduler.start()
        logger.info("WEET Director scheduler started. Press Ctrl+C to stop.")
        loop.run_forever()
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()
        logger.info("WEET Director scheduler stopped.")
    finally:
        if loop.is_running():
            loop.stop()
        loop.close()


if __name__ == "__main__":
    main()
