from fastapi import APIRouter, Depends, Query, Path, Body, Request, status, HTTPException
from typing import Optional

from backend.app.routers.super_admin_auth import get_current_super_admin
from backend.app.schemas.super_admin_roles import (
    PermissionsCatalogResponse,
    RoleListResponse,
    RoleDetailResponse,
    CreateRoleRequest,
    UpdateRoleRequest,
    RoleActionResponse,
    AssignRoleRequest,
    AdminPermissionsResponse
)
from backend.app.services.super_admin_roles_service import super_admin_roles_service

roles_router = APIRouter()
admin_roles_router = APIRouter()


# ==============================================================================
# 1. Permissions Catalog
# ==============================================================================
@roles_router.get(
    "/permissions",
    response_model=PermissionsCatalogResponse,
    status_code=status.HTTP_200_OK,
    summary="Get granular permissions catalog",
    description="Returns all 32 granular permissions grouped across 10 functional modules."
)
async def get_permissions_catalog(current_super_admin: dict = Depends(get_current_super_admin)):
    return super_admin_roles_service.get_permissions_catalog()


# ==============================================================================
# 2. Roles Directory & CRUD
# ==============================================================================
@roles_router.get(
    "/roles",
    response_model=RoleListResponse,
    status_code=status.HTTP_200_OK,
    summary="List administrative roles",
    description="Returns all system and custom roles with assigned administrator counts and sample permissions."
)
async def list_roles(
    search: Optional[str] = Query(None, description="Search term for role name or description"),
    filter_type: Optional[str] = Query(None, description="Filter: system, custom, or all"),
    current_super_admin: dict = Depends(get_current_super_admin)
):
    return super_admin_roles_service.list_roles(search=search, filter_type=filter_type)


@roles_router.post(
    "/roles",
    response_model=RoleDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create custom administrative role",
    description="Creates a new custom role with specified granular permissions. Validates name uniqueness."
)
async def create_role(
    payload: CreateRoleRequest,
    current_super_admin: dict = Depends(get_current_super_admin)
):
    actor = current_super_admin.get("email", "Super Admin")
    return super_admin_roles_service.create_role(payload=payload, actor_email=actor)


@roles_router.get(
    "/roles/{role_id}",
    response_model=RoleDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get single role details",
    description="Returns complete role metadata, assigned permissions list, and roster of assigned administrators."
)
async def get_role(
    role_id: str = Path(..., description="Role ID or slug"),
    current_super_admin: dict = Depends(get_current_super_admin)
):
    return super_admin_roles_service.get_role(role_id)


@roles_router.put(
    "/roles/{role_id}",
    response_model=RoleDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Update role and permissions",
    description="Updates role name, description, and permissions. Propagates permission changes immediately to all assigned administrators."
)
async def update_role(
    role_id: str = Path(..., description="Role ID or slug"),
    payload: UpdateRoleRequest = Body(...),
    current_super_admin: dict = Depends(get_current_super_admin)
):
    actor = current_super_admin.get("email", "Super Admin")
    return super_admin_roles_service.update_role(role_id=role_id, payload=payload, actor_email=actor)


@roles_router.delete(
    "/roles/{role_id}",
    response_model=RoleActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete custom role",
    description="Deletes a custom role. System roles and roles with active assigned administrators cannot be deleted."
)
async def delete_role(
    role_id: str = Path(..., description="Role ID or slug"),
    current_super_admin: dict = Depends(get_current_super_admin)
):
    actor = current_super_admin.get("email", "Super Admin")
    return super_admin_roles_service.delete_role(role_id=role_id, actor_email=actor)


# ==============================================================================
# 3. Role Assignment & Admin Permission Inspection
# ==============================================================================
@admin_roles_router.post(
    "/{admin_id}/assign-role",
    response_model=AdminPermissionsResponse,
    status_code=status.HTTP_200_OK,
    summary="Assign role to administrator",
    description="Assigns a specified role to an administrator and invalidates active session tokens so updated permissions take immediate effect."
)
async def assign_role_to_admin(
    admin_id: str = Path(..., description="Administrator ID or email"),
    payload: AssignRoleRequest = Body(...),
    current_super_admin: dict = Depends(get_current_super_admin)
):
    actor = current_super_admin.get("email", "Super Admin")
    return super_admin_roles_service.assign_role_to_admin(
        admin_id=admin_id,
        role_id_or_slug=payload.role_id,
        actor_email=actor
    )


@admin_roles_router.delete(
    "/{admin_id}/remove-role",
    response_model=AdminPermissionsResponse,
    status_code=status.HTTP_200_OK,
    summary="Reset administrator role to default",
    description="Removes custom role assignment and resets administrator to standard 'admin' role."
)
async def remove_role_from_admin(
    admin_id: str = Path(..., description="Administrator ID or email"),
    current_super_admin: dict = Depends(get_current_super_admin)
):
    actor = current_super_admin.get("email", "Super Admin")
    return super_admin_roles_service.remove_role_from_admin(
        admin_id=admin_id,
        actor_email=actor
    )


@admin_roles_router.get(
    "/{admin_id}/permissions",
    response_model=AdminPermissionsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get administrator effective permissions",
    description="Returns assigned role and effective list of granular permissions for the specified administrator."
)
async def get_admin_permissions(
    admin_id: str = Path(..., description="Administrator ID or email"),
    current_super_admin: dict = Depends(get_current_super_admin)
):
    return super_admin_roles_service.get_admin_permissions(admin_id)
