import {
  LayoutDashboard,
  Building2,
  Users,
  BookOpen,
  History,
  Download,
  LogOut,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { deleteAllUsers } from "@/lib/firestore";
import { useState } from "react";

const mainNav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Firms", url: "/firms", icon: Building2 },
  { title: "Clients", url: "/clients", icon: Users },
  { title: "Ledger", url: "/ledger", icon: BookOpen },
];

const adminNav = [
  { title: "Audit Log", url: "/audit", icon: History },
  { title: "Backup", url: "/backup", icon: Download },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { role, profile, signOut } = useAuth();
  const [deletingUsers, setDeletingUsers] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const handleDeleteAllUsers = async () => {
    if (!window.confirm("Are you sure you want to delete ALL users? This cannot be undone.")) return;
    setDeletingUsers(true);
    try {
      const count = await deleteAllUsers();
      toast({ title: `Deleted ${count} users`, variant: "success" });
    } catch (err) {
      toast({ title: "Failed to delete users", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    }
    setDeletingUsers(false);
  };

  return (
    <Sidebar collapsible="icon" className="gradient-sidebar border-r-0">
      <SidebarContent>
        {!collapsed && (
          <div className="px-4 py-5 border-b border-white/10">
            <h2 className="font-bold text-base text-white tracking-tight">Jain Leisure</h2>
            <p className="text-xs text-white/60 truncate mt-0.5">{profile?.full_name} ({role})</p>
          </div>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} end className="hover:bg-accent/50" activeClassName="bg-accent text-primary font-medium">
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {role === "admin" && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNav.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <NavLink to={item.url} end className="hover:bg-accent/50" activeClassName="bg-accent text-primary font-medium">
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                <SidebarMenuItem>
                  <Button variant="destructive" size="sm" onClick={handleDeleteAllUsers} disabled={deletingUsers} className="w-full mt-2">
                    Delete All Users
                  </Button>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-2">
        <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start">
          <LogOut className="mr-2 h-4 w-4" />
          {!collapsed && "Sign Out"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
