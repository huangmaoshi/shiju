"""Provider 工厂

对应 TypeScript 版 crawler/src/providers/factory.ts
"""
from typing import Callable, Dict, List, Optional

from .base_provider import BaseProvider
from .github_dataset_provider import GithubDatasetProvider
from .guwenwen_provider import GuwenwenProvider
from .mingyan_provider import MingyanProvider
from .wikiquote_provider import WikiquoteProvider

registry: Dict[str, Callable[[], BaseProvider]] = {}

registry["guwenwen"] = GuwenwenProvider
registry["mingyan"] = MingyanProvider
registry["github_dataset"] = GithubDatasetProvider
registry["wikiquote"] = WikiquoteProvider


def get_provider(code: str) -> Optional[BaseProvider]:
    """对应 TS getProvider"""
    factory = registry.get(code)
    if not factory:
        return None
    return factory()


def list_providers() -> List[str]:
    """对应 TS listProviders"""
    return list(registry.keys())


def get_all_providers() -> List[BaseProvider]:
    """对应 TS getAllProviders"""
    return [factory() for factory in registry.values()]


def register_provider(code: str, factory: Callable[[], BaseProvider]) -> None:
    """对应 TS registerProvider"""
    registry[code] = factory
