"""Dedicated Mistral Workflows worker entrypoint for Cato Labs durable workflows."""

from __future__ import annotations

import asyncio

import mistralai.workflows as workflows

from workflows_pkg import ALL_CATO_WORKFLOWS


async def main() -> None:
    await workflows.run_worker(workflows=ALL_CATO_WORKFLOWS)


if __name__ == "__main__":
    asyncio.run(main())
