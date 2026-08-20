"""API 路由包

管理类路由挂载说明：
- admin 路由拆为两个 router：auth_router（POST /api/v1/admin/auth，无需管理员权限）
  与 admin_router（其余全部端点，依赖 require_admin），挂载时两个都要 include。
- 其余模块导出各自 router。
"""
from . import ai_routes, admin_routes, original_text_routes, stats_routes
from .ai_routes import router as ai_router
from .admin_routes import admin_router, auth_router as admin_auth_router
from .original_text_routes import router as original_text_router
from .stats_routes import router as stats_router

__all__ = [
    "ai_router",
    "ai_routes",
    "admin_router",
    "admin_auth_router",
    "admin_routes",
    "original_text_router",
    "original_text_routes",
    "stats_router",
    "stats_routes",
]
