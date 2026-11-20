from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


# ==============================================================================
# Permission Definition Schemas
# ==============================================================================
class PermissionItem(BaseModel):
    id: str = Field(..., description="Unique permission key e.g. questions:create")
    name: str = Field(..., description="Human-readable title e.g. Create Questions")
    description: str = Field(..., description="Detailed description of authorized operation")
    category: str = Field(..., description="Module group e.g. Question Bank")
    category_id: str = Field(..., description="Module identifier e.g. questions")
    is_sensitive: bool = Field(False, description="Whether this is a high-privilege/destructive action")


class PermissionCategoryGroup(BaseModel):
    category_id: str
    category_name: str
    description: str
    permissions: List[PermissionItem]


class PermissionsCatalogResponse(BaseModel):
    status: str = "success"
    total_permissions: int
    total_categories: int
    categories: List[PermissionCategoryGroup]


# ==============================================================================
# Role Schemas
# ==============================================================================
class RoleListItem(BaseModel):
    id: str
    name: str
    slug: str
    description: str
    is_system: bool = False
    is_deletable: bool = True
    permissions_count: int
    assigned_admins_count: int
    sample_permissions: List[str] = []
    created_at: str
    updated_at: Optional[str] = None


class RoleDetailResponse(BaseModel):
    status: str = "success"
    id: str
    name: str
    slug: str
    description: str
    is_system: bool = False
    is_deletable: bool = True
    permissions: List[str]
    assigned_admins: List[Dict[str, Any]] = []
    created_at: str
    updated_at: Optional[str] = None


class RoleListResponse(BaseModel):
    status: str = "success"
    total_roles: int
    system_roles_count: int
    custom_roles_count: int
    total_assigned_admins: int
    roles: List[RoleListItem]


class CreateRoleRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=60, description="Display name of the role")
    description: str = Field(..., min_length=5, max_length=255, description="Clear description of role purpose")
    permissions: List[str] = Field(..., min_length=1, description="List of granular permission keys")


class UpdateRoleRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=60)
    description: Optional[str] = Field(None, min_length=5, max_length=255)
    permissions: Optional[List[str]] = Field(None, min_length=1)


class AssignRoleRequest(BaseModel):
    role_id: str = Field(..., description="Role ID or slug to assign to the admin")


class AdminPermissionsResponse(BaseModel):
    status: str = "success"
    admin_id: str
    email: str
    name: str
    role_slug: str
    role_name: str
    permissions: List[str]


class RoleActionResponse(BaseModel):
    status: str = "success"
    message: str
    role_id: Optional[str] = None
    affected_admins_count: Optional[int] = 0
