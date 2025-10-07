"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import axios from "axios";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  UserPlus,
  Edit,
  Trash2,
  ShieldCheck,
  Users,
  Trophy,
  Newspaper,
  ShoppingCart,
  Crown,
  Loader2,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { FullLoader, Loader } from "@/components/Loader";

// Backend interfaces
interface BackendUser {
  user_id: number;
  username: string;
  email: string;
  role: "admin" | "player";
  status: "active" | "suspended";
  roles: string[];
}

interface BackendRole {
  role_id: number;
  role_name: string;
  description: string;
}

// Frontend interfaces
interface AdminUser {
  id: string;
  username: string;
  email: string;
  roles: string[];
  permissions: string[];
  status: "active" | "suspended";
  lastLogin: string;
  createdAt: string;
  isPlayer: boolean;
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  color: string;
}

const availablePermissions = [
  {
    id: "shop_manage",
    name: "Shop Management",
    description: "Manage shop inventory, orders, and products",
  },
  {
    id: "news_manage",
    name: "News Management",
    description: "Create, edit, and publish news articles",
  },
  {
    id: "teams_manage",
    name: "Teams Management",
    description: "Manage teams, rosters, and team verification",
  },
  {
    id: "players_manage",
    name: "Players Management",
    description: "Manage player profiles and statistics",
  },
  {
    id: "leaderboards_manage",
    name: "Leaderboards Management",
    description: "Create and manage tournament leaderboards",
  },
  {
    id: "rankings_manage",
    name: "Rankings & Tiers Management",
    description: "Manage team rankings and tier systems",
  },
  {
    id: "events_manage",
    name: "Events Management",
    description: "Create and manage tournaments and scrims",
  },
  {
    id: "partner_manage",
    name: "Partner Management",
    description: "Manage partner relationships and verifications",
  },
  {
    id: "admin_manage",
    name: "Admin Management",
    description: "Manage other administrators and roles",
  },
  {
    id: "system_settings",
    name: "System Settings",
    description: "Access system-wide settings and configurations",
  },
];

export function Settings() {
  const { token } = useAuth();

  const [suspendPending, startSuspendTransition] = useTransition();
  const [editPending, startEditTransition] = useTransition();

  // State management
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [backendRoles, setBackendRoles] = useState<BackendRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    username: "",
    email: "",
    roles: [] as string[],
    permissions: [] as string[],
  });

  // Helper function to get role color based on role name
  const getRoleColorFromName = (roleName: string): string => {
    const colorMap: { [key: string]: string } = {
      head_admin: "bg-red-100 text-red-800",
      "Head Admin": "bg-red-100 text-red-800",
      "Shop Admin": "bg-green-100 text-green-800",
      "News Admin": "bg-blue-100 text-blue-800",
      "Teams Admin": "bg-purple-100 text-purple-800",
      "Events Admin": "bg-yellow-100 text-yellow-800",
      "Partner Admin": "bg-indigo-100 text-indigo-800",
    };
    return colorMap[roleName] || "bg-gray-100 text-gray-800";
  };

  // Helper function to get permissions based on role name
  const getPermissionsFromRoleName = (roleName: string): string[] => {
    const permissionMap: { [key: string]: string[] } = {
      head_admin: availablePermissions.map((p) => p.id),
      "Head Admin": availablePermissions.map((p) => p.id),
      "Shop Admin": ["shop_manage"],
      "News Admin": ["news_manage"],
      "Teams Admin": ["teams_manage", "players_manage"],
      "Events Admin": [
        "events_manage",
        "leaderboards_manage",
        "rankings_manage",
      ],
      "Partner Admin": ["partner_manage"],
    };
    return permissionMap[roleName] || [];
  };

  // Convert backend roles to frontend Role format
  const getDisplayRoles = (): Role[] => {
    return backendRoles.map((backendRole) => ({
      id: backendRole.role_id.toString(),
      name: backendRole.role_name,
      description:
        backendRole.description ||
        `Manages ${backendRole.role_name.toLowerCase()} operations`,
      permissions: getPermissionsFromRoleName(backendRole.role_name),
      color: getRoleColorFromName(backendRole.role_name),
    }));
  };

  // Transform backend user data to frontend format
  const transformBackendUser = (backendUser: BackendUser): AdminUser => {
    let roles =
      backendUser.roles && backendUser.roles.length > 0
        ? backendUser.roles
        : backendUser.role === "admin"
        ? ["Head Admin"]
        : [];

    const permissions = calculatePermissionsFromRoles(roles);

    return {
      id: backendUser.user_id.toString(),
      username: backendUser.username || `User${backendUser.user_id}`,
      email: backendUser.email,
      roles: roles,
      permissions: permissions,
      status: backendUser.status,
      lastLogin: "Unknown",
      createdAt: "Unknown",
      isPlayer: backendUser.role === "player",
    };
  };

  // Fetch roles from backend
  const fetchRoles = async () => {
    try {
      setRolesLoading(true);
      const response = await axios.get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-all-roles/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data && response.data.roles) {
        setBackendRoles(response.data.roles);
      }
    } catch (error) {
      console.error("Error fetching roles:", error);
      toast.error("Failed to fetch roles from server.");
    } finally {
      setRolesLoading(false);
    }
  };

  // Fetch users from backend
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-all-user-and-user-roles/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data && response.data.users) {
        const transformedUsers = response.data.users.map(transformBackendUser);
        setAdminUsers(transformedUsers);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to fetch users from server.");
    } finally {
      setLoading(false);
    }
  };

  // Initialize data on component mount
  useEffect(() => {
    const initializeData = async () => {
      await Promise.all([fetchUsers(), fetchRoles()]);
    };
    initializeData();
  }, []);

  // Helper function to convert role names to numeric role IDs using backend data
  const getRoleIds = (roleNames: string[]): number[] => {
    return roleNames
      .map((roleName) => {
        const backendRole = backendRoles.find((r) => r.role_name === roleName);
        return backendRole ? backendRole.role_id : null;
      })
      .filter((id): id is number => id !== null);
  };

  // Calculate permissions from roles
  const calculatePermissionsFromRoles = (roles: string[]): string[] => {
    const allPermissions = new Set<string>();
    roles.forEach((roleName) => {
      const permissions = getPermissionsFromRoleName(roleName);
      permissions.forEach((permission) => allPermissions.add(permission));
    });
    return Array.from(allPermissions);
  };

  // Filter users
  const filteredUsers = useMemo(() => {
    return adminUsers.filter(
      (user) =>
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.roles.some((role) =>
          role.toLowerCase().includes(searchTerm.toLowerCase())
        )
    );
  }, [adminUsers, searchTerm]);

  // Separate admin users for the admin-specific view
  const adminOnlyUsers = useMemo(() => {
    return filteredUsers.filter(
      (user) => !user.isPlayer || user.roles.length > 0
    );
  }, [filteredUsers]);

  const handleRoleChange = (
    roleName: string,
    checked: boolean,
    isNewUser = false
  ) => {
    if (isNewUser) {
      const updatedRoles = checked
        ? [...newUser.roles, roleName]
        : newUser.roles.filter((role) => role !== roleName);

      const updatedPermissions = calculatePermissionsFromRoles(updatedRoles);

      setNewUser({
        ...newUser,
        roles: updatedRoles,
        permissions: updatedPermissions,
      });
    } else if (selectedUser) {
      const updatedRoles = checked
        ? [...selectedUser.roles, roleName]
        : selectedUser.roles.filter((role) => role !== roleName);

      const updatedPermissions = calculatePermissionsFromRoles(updatedRoles);

      setSelectedUser({
        ...selectedUser,
        roles: updatedRoles,
        permissions: updatedPermissions,
      });
    }
  };

  // Updated handleAddUser function
  const handleAddUser = async () => {
    if (!newUser.username || !newUser.email || newUser.roles.length === 0) {
      toast.error(
        "Please fill in all required fields and select at least one role."
      );
      return;
    }

    try {
      const roleIds = getRoleIds(newUser.roles);

      if (roleIds.length === 0) {
        toast.error("Invalid roles selected. Please check role configuration.");
        return;
      }

      const response = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/create-admin-user/`,
        {
          username: newUser.username,
          email: newUser.email,
          role_ids: roleIds,
          role: "admin",
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success || response.status === 200) {
        await fetchUsers();
        setNewUser({ username: "", email: "", roles: [], permissions: [] });
        setIsAddUserOpen(false);
        toast.success(
          `Admin user ${newUser.username} has been created with ${newUser.roles.length} role(s).`
        );
      }
    } catch (error: any) {
      console.error("Error creating user:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to create admin user.";
      toast.error(errorMessage);
    }
  };

  // Updated handleEditUser function that works for all users
  const handleEditUser = async () => {
    startEditTransition(async () => {
      if (!selectedUser) return;

      try {
        const roleIds = getRoleIds(selectedUser.roles);

        const requestBody = {
          username: selectedUser.username,
          email: selectedUser.email,
          role_ids: roleIds,
        };

        console.log("Sending request body:", requestBody);

        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/assign-roles-to-user/`,
          requestBody,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (response.data.success || response.status === 200) {
          await fetchUsers();
          setIsEditUserOpen(false);
          setSelectedUser(null);

          const message =
            roleIds.length > 0
              ? `User roles updated successfully. Assigned ${roleIds.length} role(s).`
              : `Successfully removed all admin roles from ${selectedUser.username}. User is now a regular player.`;

          toast.success(message);
        } else {
          toast.error(response.data.message || "Failed to update user roles");
        }
      } catch (error: any) {
        console.error("Error updating user roles:", error);

        if (error.response) {
          const errorMessage =
            error.response.data?.message ||
            error.response.data?.error ||
            `Server error: ${error.response.status}`;
          toast.error(errorMessage);
        } else if (error.request) {
          toast.error("Network error: Unable to reach server");
        } else {
          toast.error("Failed to update user roles");
        }
      }
    });
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const response = await axios.delete(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/delete-user/${userId}/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        await fetchUsers();
        toast.success("User has been removed.");
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Failed to delete user.");
    }
  };

  const handleSuspendUser = async (userId: string) => {
    startSuspendTransition(async () => {
      const user = adminUsers.find((u) => u.id === userId);
      if (!user) return;

      const isSuspending = user.status === "active";
      const endpoint = isSuspending ? "suspend-user" : "activate-user";
      const action = isSuspending ? "suspended" : "activated";

      try {
        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/${endpoint}/`,
          {
            user_id: userId,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.data.success || response.status === 200) {
          await fetchUsers();
          toast.success(`User has been ${action}.`);
        } else {
          toast.error(
            response.data.message || `Failed to ${action.slice(0, -1)} user`
          );
        }
      } catch (error: any) {
        console.error(`Error ${action.slice(0, -1)}ing user:`, error);
        toast.error(
          error.response?.data?.message ||
            `Failed to ${action.slice(0, -1)} user.`
        );
      }
    });
  };

  const getRoleColor = (roleName: string) => {
    return getRoleColorFromName(roleName);
  };

  const getPermissionName = (permissionId: string) => {
    const permission = availablePermissions.find((p) => p.id === permissionId);
    return permission?.name || permissionId;
  };

  if (loading) return <FullLoader />;
  return (
    <div className="space-y-6">
      {suspendPending && <FullLoader />}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Settings</h1>
          <p className="text-muted-foreground">
            Manage administrator roles and permissions ({adminUsers.length}{" "}
            total users, {adminOnlyUsers.length} admins)
          </p>
        </div>
        <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Add Admin
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[700px]">
            <DialogHeader>
              <DialogTitle>Add New Admin</DialogTitle>
              <DialogDescription>
                Create a new administrator account with specific roles and
                permissions. You can assign multiple roles.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="username" className="text-right">
                  Username
                </Label>
                <Input
                  id="username"
                  value={newUser.username}
                  onChange={(e) =>
                    setNewUser({ ...newUser, username: e.target.value })
                  }
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) =>
                    setNewUser({ ...newUser, email: e.target.value })
                  }
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-right pt-2">Roles</Label>
                <div className="col-span-3 space-y-3">
                  {rolesLoading ? (
                    <div className="flex items-center space-x-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">
                        Loading roles...
                      </span>
                    </div>
                  ) : (
                    getDisplayRoles().map((role) => (
                      <div key={role.id} className="flex items-start space-x-3">
                        <Checkbox
                          id={`new-role-${role.id}`}
                          checked={newUser.roles.includes(role.name)}
                          onCheckedChange={(checked) =>
                            handleRoleChange(
                              role.name,
                              checked as boolean,
                              true
                            )
                          }
                        />
                        <div className="grid gap-1.5 leading-none">
                          <Label
                            htmlFor={`new-role-${role.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {role.name}
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            {role.description}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              {newUser.permissions.length > 0 && (
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label className="text-right pt-2">Permissions</Label>
                  <div className="col-span-3 space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Based on selected roles ({newUser.roles.length} role(s)):
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {newUser.permissions.map((permissionId) => (
                        <Badge
                          key={permissionId}
                          variant="secondary"
                          className="text-xs"
                        >
                          {getPermissionName(permissionId)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" onClick={handleAddUser}>
                Create Admin
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="admins" className="space-y-4">
        <TabsList>
          <TabsTrigger value="admins">Admin Users</TabsTrigger>
          <TabsTrigger value="all-users">All Users</TabsTrigger>
          <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="admins" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Administrator Management</CardTitle>
              <CardDescription>
                Manage administrator accounts, roles, and access permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2 mb-4">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search admins..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adminOnlyUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.username}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge
                          variant={user.isPlayer ? "secondary" : "default"}
                        >
                          {user.isPlayer ? "Player" : "Admin"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.roles.length > 0 ? (
                            user.roles.map((role) => (
                              <Badge key={role} className={getRoleColor(role)}>
                                {role}
                              </Badge>
                            ))
                          ) : (
                            <Badge variant="outline">No roles assigned</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            user.status === "active" ? "default" : "destructive"
                          }
                        >
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Dialog
                            open={
                              isEditUserOpen && selectedUser?.id === user.id
                            }
                            onOpenChange={setIsEditUserOpen}
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedUser(user)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[700px]">
                              <DialogHeader>
                                <DialogTitle>Edit User</DialogTitle>
                                <DialogDescription>
                                  Update user roles and permissions. Remove all
                                  roles to convert admin to regular player.
                                </DialogDescription>
                              </DialogHeader>
                              {selectedUser && (
                                <div className="grid gap-4 py-4">
                                  <div className="grid grid-cols-4 items-center gap-4">
                                    <Label className="text-right">
                                      Username
                                    </Label>
                                    <Input
                                      value={selectedUser.username}
                                      onChange={(e) =>
                                        setSelectedUser({
                                          ...selectedUser,
                                          username: e.target.value,
                                        })
                                      }
                                      className="col-span-3"
                                    />
                                  </div>
                                  <div className="grid grid-cols-4 items-center gap-4">
                                    <Label className="text-right">Email</Label>
                                    <Input
                                      value={selectedUser.email}
                                      onChange={(e) =>
                                        setSelectedUser({
                                          ...selectedUser,
                                          email: e.target.value,
                                        })
                                      }
                                      className="col-span-3"
                                    />
                                  </div>
                                  <div className="grid grid-cols-4 items-start gap-4">
                                    <Label className="text-right pt-2">
                                      Roles
                                    </Label>
                                    <div className="col-span-3 space-y-3">
                                      {rolesLoading ? (
                                        <div className="flex items-center space-x-2">
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                          <span className="text-sm text-muted-foreground">
                                            Loading roles...
                                          </span>
                                        </div>
                                      ) : (
                                        getDisplayRoles().map((role) => (
                                          <div
                                            key={role.id}
                                            className="flex items-start space-x-3"
                                          >
                                            <Checkbox
                                              id={`edit-role-${role.id}`}
                                              checked={selectedUser.roles.includes(
                                                role.name
                                              )}
                                              onCheckedChange={(checked) =>
                                                handleRoleChange(
                                                  role.name,
                                                  checked as boolean
                                                )
                                              }
                                            />
                                            <div className="grid gap-1.5 leading-none">
                                              <Label
                                                htmlFor={`edit-role-${role.id}`}
                                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                              >
                                                {role.name}
                                              </Label>
                                              <p className="text-xs text-muted-foreground">
                                                {role.description}
                                              </p>
                                            </div>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-4 items-start gap-4">
                                    <Label className="text-right pt-2">
                                      Permissions
                                    </Label>
                                    <div className="col-span-3 space-y-2">
                                      <p className="text-sm text-muted-foreground">
                                        Based on selected roles (
                                        {selectedUser.roles.length} role(s)):
                                      </p>
                                      <div className="flex flex-wrap gap-1">
                                        {selectedUser.permissions.map(
                                          (permissionId) => (
                                            <Badge
                                              key={permissionId}
                                              variant="secondary"
                                              className="text-xs"
                                            >
                                              {getPermissionName(permissionId)}
                                            </Badge>
                                          )
                                        )}
                                        {selectedUser.permissions.length ===
                                          0 && (
                                          <Badge
                                            variant="outline"
                                            className="text-xs"
                                          >
                                            No permissions (Regular Player)
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                              <DialogFooter>
                                <Button
                                  disabled={editPending}
                                  onClick={handleEditUser}
                                >
                                  {editPending ? <Loader /> : "Update User"}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSuspendUser(user.id)}
                            disabled={suspendPending}
                          >
                            {user.status === "active" ? "Suspend" : "Activate"}
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete User</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete{" "}
                                  {user.username}? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteUser(user.id)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all-users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Users</CardTitle>
              <CardDescription>
                View and manage all users in the system (admins and players)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2 mb-4">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search all users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.username}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            user.isPlayer && user.roles.length === 0
                              ? "secondary"
                              : "default"
                          }
                        >
                          {user.isPlayer && user.roles.length === 0
                            ? "Player"
                            : "Admin"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.roles.length > 0 ? (
                            user.roles.map((role) => (
                              <Badge key={role} className={getRoleColor(role)}>
                                {role}
                              </Badge>
                            ))
                          ) : (
                            <Badge variant="outline">No admin roles</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            user.status === "active" ? "default" : "destructive"
                          }
                        >
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Dialog
                            open={
                              isEditUserOpen && selectedUser?.id === user.id
                            }
                            onOpenChange={setIsEditUserOpen}
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedUser(user)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[700px]">
                              <DialogHeader>
                                <DialogTitle>
                                  Edit User - {selectedUser?.username}
                                </DialogTitle>
                                <DialogDescription>
                                  Update user roles and permissions.
                                  {selectedUser?.isPlayer
                                    ? " Assign admin roles to grant administrative access, or remove all roles to keep as regular player."
                                    : " Remove all roles to convert admin to regular player."}
                                </DialogDescription>
                              </DialogHeader>
                              {selectedUser && (
                                <div className="grid gap-4 py-4">
                                  <div className="grid grid-cols-4 items-center gap-4">
                                    <Label className="text-right">
                                      Username
                                    </Label>
                                    <Input
                                      value={selectedUser.username}
                                      onChange={(e) =>
                                        setSelectedUser({
                                          ...selectedUser,
                                          username: e.target.value,
                                        })
                                      }
                                      className="col-span-3"
                                    />
                                  </div>
                                  <div className="grid grid-cols-4 items-center gap-4">
                                    <Label className="text-right">Email</Label>
                                    <Input
                                      value={selectedUser.email}
                                      onChange={(e) =>
                                        setSelectedUser({
                                          ...selectedUser,
                                          email: e.target.value,
                                        })
                                      }
                                      className="col-span-3"
                                    />
                                  </div>
                                  <div className="grid grid-cols-4 items-center gap-4">
                                    <Label className="text-right">
                                      Current Type
                                    </Label>
                                    <div className="col-span-3">
                                      <Badge
                                        variant={
                                          selectedUser.isPlayer &&
                                          selectedUser.roles.length === 0
                                            ? "secondary"
                                            : "default"
                                        }
                                      >
                                        {selectedUser.isPlayer &&
                                        selectedUser.roles.length === 0
                                          ? "Regular Player"
                                          : "Administrator"}
                                      </Badge>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-4 items-start gap-4">
                                    <Label className="text-right pt-2">
                                      Admin Roles
                                    </Label>
                                    <div className="col-span-3 space-y-3">
                                      {rolesLoading ? (
                                        <div className="flex items-center space-x-2">
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                          <span className="text-sm text-muted-foreground">
                                            Loading roles...
                                          </span>
                                        </div>
                                      ) : (
                                        <>
                                          <p className="text-xs text-muted-foreground mb-3">
                                            Select admin roles to assign to this
                                            user. Leave all unchecked to
                                            keep/make them a regular player.
                                          </p>
                                          {getDisplayRoles().map((role) => (
                                            <div
                                              key={role.id}
                                              className="flex items-start space-x-3"
                                            >
                                              <Checkbox
                                                id={`edit-role-${role.id}`}
                                                checked={selectedUser.roles.includes(
                                                  role.name
                                                )}
                                                onCheckedChange={(checked) =>
                                                  handleRoleChange(
                                                    role.name,
                                                    checked as boolean
                                                  )
                                                }
                                              />
                                              <div className="grid gap-1.5 leading-none">
                                                <Label
                                                  htmlFor={`edit-role-${role.id}`}
                                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                                >
                                                  {role.name}
                                                </Label>
                                                <p className="text-xs text-muted-foreground">
                                                  {role.description}
                                                </p>
                                              </div>
                                            </div>
                                          ))}
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-4 items-start gap-4">
                                    <Label className="text-right pt-2">
                                      Permissions Preview
                                    </Label>
                                    <div className="col-span-3 space-y-2">
                                      <p className="text-sm text-muted-foreground">
                                        Based on selected roles (
                                        {selectedUser.roles.length} role(s)):
                                      </p>
                                      <div className="flex flex-wrap gap-1">
                                        {selectedUser.permissions.length > 0 ? (
                                          selectedUser.permissions.map(
                                            (permissionId) => (
                                              <Badge
                                                key={permissionId}
                                                variant="secondary"
                                                className="text-xs"
                                              >
                                                {getPermissionName(
                                                  permissionId
                                                )}
                                              </Badge>
                                            )
                                          )
                                        ) : (
                                          <Badge
                                            variant="outline"
                                            className="text-xs"
                                          >
                                            No admin permissions (Regular
                                            Player)
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                              <DialogFooter>
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setIsEditUserOpen(false);
                                    setSelectedUser(null);
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  disabled={editPending}
                                  onClick={handleEditUser}
                                >
                                  {editPending ? <Loader /> : "Update User"}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSuspendUser(user.id)}
                            disabled={suspendPending}
                          >
                            {user.status === "active" ? "Suspend" : "Activate"}
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete User</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete{" "}
                                  {user.username}? This action cannot be undone
                                  and will remove all their data.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteUser(user.id)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          {rolesLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading roles...</span>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {getDisplayRoles().map((role) => (
                <Card key={role.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {role.name.toLowerCase().includes("head") && (
                        <Crown className="h-5 w-5" />
                      )}
                      {role.name.toLowerCase().includes("shop") && (
                        <ShoppingCart className="h-5 w-5" />
                      )}
                      {role.name.toLowerCase().includes("news") && (
                        <Newspaper className="h-5 w-5" />
                      )}
                      {role.name.toLowerCase().includes("team") && (
                        <Users className="h-5 w-5" />
                      )}
                      {role.name.toLowerCase().includes("event") && (
                        <Trophy className="h-5 w-5" />
                      )}
                      {role.name.toLowerCase().includes("partner") && (
                        <ShieldCheck className="h-5 w-5" />
                      )}
                      {role.name}
                    </CardTitle>
                    <CardDescription>{role.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        Permissions:
                      </Label>
                      <div className="flex flex-wrap gap-1">
                        {role.permissions.length > 0 ? (
                          role.permissions.map((permissionId) => (
                            <Badge
                              key={permissionId}
                              variant="outline"
                              className="text-xs"
                            >
                              {getPermissionName(permissionId)}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            No specific permissions
                          </Badge>
                        )}
                      </div>
                      <div className="mt-3 pt-3 border-t">
                        <Label className="text-sm font-medium text-muted-foreground">
                          Users with this role:
                        </Label>
                        <div className="mt-1">
                          {adminUsers.filter((user) =>
                            user.roles.includes(role.name)
                          ).length > 0 ? (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {adminUsers
                                .filter((user) =>
                                  user.roles.includes(role.name)
                                )
                                .slice(0, 3)
                                .map((user) => (
                                  <Badge
                                    key={user.id}
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {user.username}
                                  </Badge>
                                ))}
                              {adminUsers.filter((user) =>
                                user.roles.includes(role.name)
                              ).length > 3 && (
                                <Badge variant="secondary" className="text-xs">
                                  +
                                  {adminUsers.filter((user) =>
                                    user.roles.includes(role.name)
                                  ).length - 3}{" "}
                                  more
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground mt-1">
                              No users assigned
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
