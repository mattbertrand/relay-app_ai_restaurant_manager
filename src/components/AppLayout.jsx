import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { getRestaurantId, getInitials, setActiveTimezone } from "@/lib/format";
import { base44 } from "@/api/base44Client";
import { Sun, Target, Inbox, CheckSquare, Settings, LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import UnsavedChangesGuard from "@/components/UnsavedChangesGuard";

const ICON_MAP = { Sun, Target, Inbox, CheckSquare, Settings };

const NAV_ITEMS = [
  { label: "Today", path: "/today", icon: "Sun" },
  { label: "Opportunities", path: "/opportunities", icon: "Target" },
  { label: "Inbox", path: "/inbox", icon: "Inbox" },
  { label: "Actions", path: "/actions", icon: "CheckSquare" },
  { label: "Settings", path: "/settings", icon: "Settings" },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Page content mounts only after the restaurant's timezone has loaded, so
  // every timestamp on screen is formatted with the configured zone from the
  // first render (never the browser's timezone).
  const [timezoneReady, setTimezoneReady] = useState(false);

  // Load the restaurant's configured timezone once — every displayed
  // timestamp (activity history, received times, opportunity dates) uses it.
  useEffect(() => {
    if (!user) { setTimezoneReady(false); return; }
    const rid = getRestaurantId(user);
    if (!rid) { setTimezoneReady(true); return; }
    let cancelled = false;
    setTimezoneReady(false);
    base44.entities.RestaurantKnowledge.filter({ restaurant_id: rid }, null, 1)
      .then((records) => {
        if (!cancelled) setActiveTimezone(records[0]?.timezone || "America/Los_Angeles");
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setTimezoneReady(true);
      });
    return () => { cancelled = true; };
  }, [user]);

  const handleLogout = () => {
    logout(false);
    navigate("/login");
  };

  const userInitials = getInitials(user?.full_name || user?.email);
  const userName = user?.full_name || (user?.email ? user.email.split("@")[0] : "User");

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-60 flex-col border-r border-border bg-card">
        <div className="px-6 py-6">
          <Link to="/today" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-heading font-bold text-sm">R</span>
            </div>
            <span className="font-heading text-xl font-semibold text-foreground">Relay</span>
          </Link>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = ICON_MAP[item.icon];
            const active = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold">
              {userInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{userName}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full justify-start mt-1 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Log out
          </Button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="md:hidden sticky top-0 z-30 bg-card border-b border-border px-4 h-14 flex items-center justify-between">
        <Link to="/today" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-heading font-bold text-xs">R</span>
          </div>
          <span className="font-heading text-lg font-semibold">Relay</span>
        </Link>
        <button onClick={() => setMobileOpen(true)} className="p-2 -mr-2">
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <div className="relative w-64 bg-card flex flex-col">
            <div className="flex items-center justify-between px-5 py-5 border-b border-border">
              <span className="font-heading text-lg font-semibold">Menu</span>
              <button onClick={() => setMobileOpen(false)} className="p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = ICON_MAP[item.icon];
                const active = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium",
                      active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="p-3 border-t border-border">
              <Button variant="ghost" size="sm" onClick={handleLogout} className="w-full justify-start text-muted-foreground">
                <LogOut className="w-4 h-4 mr-2" />
                Log out
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="md:pl-60">
        <main className="min-h-screen">
          {timezoneReady ? (
            <Outlet />
          ) : (
            <div className="flex items-center justify-center min-h-screen">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
            </div>
          )}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-border flex items-center justify-around px-2 py-1.5">
        {NAV_ITEMS.map((item) => {
          const Icon = ICON_MAP[item.icon];
          const active = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <UnsavedChangesGuard />
    </div>
  );
}