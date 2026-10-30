"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/components/SessionContext";

// Hook ringan untuk timestamp upload DAT & LPP — dipanggil di Sidebar
// supaya terlihat di semua halaman tanpa user harus buka Reconciliation.
function useFreshness() {
  const [dat, setDat] = useState<string | null>(null);
  const [lpp, setLpp] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/freshness")
      .then(r => r.json())
      .then(j => { setDat(j.datLastUpload ?? null); setLpp(j.lppLastUpload ?? null); })
      .catch(() => {});
  }, []);

  return { dat, lpp };
}

function formatSidebarTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
    + " " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

type NavItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  children?: { id: string; label: string; href: string }[];
  adminOnly?: boolean;
};

const icons = {
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  upload: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  monitor: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
  classification: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16M4 10h16M4 14h10M4 18h6" />
    </svg>
  ),
  reconciliation: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 3L4 9l7 6" /><path d="M4 9h13a4 4 0 0 1 4 4v1" />
      <path d="M13 21l7-6-7-6" /><path d="M20 15H7a4 4 0 0 1-4-4v-1" />
    </svg>
  ),
  sj: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="13" y2="17" />
    </svg>
  ),
  reports: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  users: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  chevron: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  stock: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <rect x="7" y="12" width="3" height="6" />
      <rect x="12" y="8" width="3" height="10" />
      <rect x="17" y="5" width="3" height="13" />
    </svg>
  ),
  palette: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" /><circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" /><circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
    </svg>
  ),
};

const navItems: NavItem[] = [
  { id: "dashboard",      label: "Dashboard",      icon: icons.dashboard,      href: "/"           },
  { id: "upload",         label: "Upload Data",    icon: icons.upload,         href: "/upload"     },
  { id: "monitoring",     label: "Monitoring",     icon: icons.monitor,        href: "/monitoring" },
  { id: "stock-live",     label: "Live Stock",     icon: icons.stock,          href: "/stock/live" },
  { id: "reconciliation", label: "Reconciliation", icon: icons.reconciliation, href: "/reconciliation" },
  { id: "classification", label: "Classification", icon: icons.classification, href: "/review"     },
  {
    id: "sj",
    label: "Surat Jalan Manual",
    icon: icons.sj,
    children: [
      { id: "sj-buat",   label: "Buat Surat Jalan", href: "/sj/buat"    },
      { id: "sj-masuk",  label: "Penerimaan Barang", href: "/sj/masuk"  },
      { id: "sj-list",   label: "Daftar Surat Jalan", href: "/sj/list"    },
      { id: "sj-tujuan", label: "Master Tujuan",    href: "/sj/tujuan"  },
      { id: "sj-report", label: "Rekap Alokasi",    href: "/sj/report"  },
      { id: "sj-pendingan", label: "Pendingan Alokasi", href: "/sj/pendingan" },
      { id: "sj-template", label: "Template Item",  href: "/sj/templates" },
    ],
  },
  { id: "admin-users", label: "Manajemen User", icon: icons.users, href: "/admin/users", adminOnly: true },
  { id: "tema", label: "Warna Tampilan", icon: icons.palette, href: "/pengaturan/tema" },
];

function getActiveId(pathname: string): string {
  if (pathname.startsWith("/sj/buat"))     return "sj-buat";
  if (pathname.startsWith("/sj/masuk"))    return "sj-masuk";
  if (pathname.startsWith("/sj/list"))     return "sj-list";
  if (pathname.startsWith("/sj/tujuan"))   return "sj-tujuan";
  if (pathname.startsWith("/sj/report"))   return "sj-report";
  if (pathname.startsWith("/sj/pendingan")) return "sj-pendingan";
  if (pathname.startsWith("/admin/users")) return "admin-users";
  if (pathname.startsWith("/pengaturan/tema")) return "tema";
  if (pathname.startsWith("/sj/templates")) return "sj-template";
  if (pathname.startsWith("/sj"))          return "sj";
  if (pathname.startsWith("/stock/live"))   return "stock-live";
  if (pathname.startsWith("/stock"))        return "stock-live";
  if (pathname.startsWith("/upload"))      return "upload";
  if (pathname.startsWith("/monitoring"))  return "monitoring";
  if (pathname.startsWith("/reconciliation")) return "reconciliation";
  if (pathname.startsWith("/review"))      return "classification";
  if (pathname === "/" || pathname.startsWith("/dashboard")) return "dashboard";
  return "dashboard";
}

export default function Sidebar() {
  const pathname = usePathname();
  const activeId = getActiveId(pathname);
  const { isSuperAdmin, signOut } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const { dat: datUpload, lpp: lppUpload } = useFreshness();

  // Auto-expand kalau anak aktif
  useEffect(() => {
    const newExpanded: Record<string, boolean> = {};
    navItems.forEach((item) => {
      if (item.children?.some((c) => c.id === activeId)) {
        newExpanded[item.id] = true;
      }
    });
    setExpandedGroups((prev) => ({ ...prev, ...newExpanded }));
  }, [activeId]);

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <aside className={`glass relative z-10 flex flex-col h-screen border-r border-line transition-all duration-300 ease-in-out ${collapsed ? "w-[68px]" : "w-[230px]"}`}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-line">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-linear-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-md shadow-brand-500/25">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          </svg>
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-heading text-[14px] font-bold tracking-tight leading-none">SmartWMS</p>
            <p className="text-muted text-[12px] mt-1 leading-none">Warehouse GA</p>
          </div>
        )}
      </div>

      <button onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? "Lebarkan menu" : "Ciutkan menu"}
        className="absolute -right-3 top-[72px] w-6 h-6 rounded-full border border-line bg-surface shadow-sm flex items-center justify-center text-muted hover:text-heading hover:border-line-strong transition-all z-10">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          {collapsed ? <polyline points="9 18 15 12 9 6" /> : <polyline points="15 18 9 12 15 6" />}
        </svg>
      </button>

      <nav className="flex-1 px-2.5 py-4 space-y-0.5 overflow-y-auto">
        {!collapsed && <p className="text-[12px] text-muted font-medium px-3 pb-2">Menu utama</p>}
        {navItems
          .filter(item => !item.adminOnly || isSuperAdmin)
          .map(item => (
            <NavLinkOrGroup
              key={item.id}
              item={item}
              activeId={activeId}
              collapsed={collapsed}
              expanded={!!expandedGroups[item.id]}
              onToggle={() => toggleGroup(item.id)}
            />
          ))}
      </nav>

      {/* Freshness indicator — kapan DAT & LPP terakhir diupload */}
      {!collapsed && (
        <div className="mx-3 mb-2 rounded-xl border border-line bg-surface px-3 py-2.5 space-y-2">
          <div>
            <p className="text-[12px] font-medium text-muted">DAT terakhir</p>
            <p className="text-[12px] font-mono text-brand-700 mt-0.5 leading-tight">{formatSidebarTime(datUpload)}</p>
          </div>
          <div>
            <p className="text-[12px] font-medium text-muted">LPP terakhir</p>
            <p className="text-[12px] font-mono text-plum-700 mt-0.5 leading-tight">{formatSidebarTime(lppUpload)}</p>
          </div>
        </div>
      )}

      {/* Logout */}
      <div className={`p-3 border-t border-line ${collapsed ? "flex justify-center" : ""}`}>
        {collapsed ? (
          <button onClick={signOut} title="Logout" aria-label="Logout"
            className="w-9 h-9 rounded-xl border border-rose-500/25 bg-rose-500/[0.08] text-rose-400 hover:bg-rose-500/15 hover:border-rose-500/40 transition-all flex items-center justify-center">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        ) : (
          <button onClick={signOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-rose-500/25 bg-rose-500/[0.08] text-rose-400 hover:bg-rose-500/15 hover:border-rose-500/40 hover:text-rose-300 transition-all text-[13px] font-semibold">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Logout
          </button>
        )}
      </div>
    </aside>
  );
}

interface NavProps {
  item: NavItem;
  activeId: string;
  collapsed: boolean;
  expanded: boolean;
  onToggle: () => void;
}

function NavLinkOrGroup({ item, activeId, collapsed, expanded, onToggle }: NavProps) {
  const hasChildren = !!item.children?.length;

  // Group dengan dropdown
  if (hasChildren) {
    const isParentActive = item.children!.some((c) => c.id === activeId);

    if (collapsed) {
      // Saat collapsed, klik parent → buka link pertama anak
      return (
        <Link
          href={item.children![0].href}
          title={item.label}
          className={`w-full flex items-center justify-center px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 ${
            isParentActive
              ? "bg-brand-50 text-brand-700"
              : "text-muted hover:text-heading hover:bg-brand-50/60"
          }`}
        >
          {item.icon}
        </Link>
      );
    }

    return (
      <div>
        <button
          onClick={onToggle}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 group relative ${
            isParentActive
              ? "text-brand-700"
              : "text-muted hover:text-heading hover:bg-brand-50/60"
          }`}
        >
          <span className={`flex-shrink-0 transition-colors ${isParentActive ? "text-brand-700" : "text-muted group-hover:text-heading"}`}>
            {item.icon}
          </span>
          <span className="truncate flex-1 text-left">{item.label}</span>
          <span className={`text-faint transition-transform ${expanded ? "rotate-180" : ""}`}>
            {icons.chevron}
          </span>
        </button>

        {/* Sub-menu */}
        {expanded && (
          <div className="ml-3 mt-0.5 pl-4 border-l border-line space-y-0.5">
            {item.children!.map((child) => (
              <Link
                key={child.id}
                href={child.href}
                aria-current={activeId === child.id ? "page" : undefined}
                className={`flex items-center px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                  activeId === child.id
                    ? "bg-brand-50 text-brand-700 font-semibold"
                    : "text-muted hover:text-heading hover:bg-brand-50/60"
                }`}
              >
                {child.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Regular nav item
  const isActive = activeId === item.id;
  return (
    <Link
      href={item.href!}
      title={collapsed ? item.label : undefined}
      aria-current={isActive ? "page" : undefined}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 group relative ${
        isActive
          ? "bg-brand-50 text-brand-700 font-semibold"
          : "text-muted hover:text-heading hover:bg-brand-50/60"
      } ${collapsed ? "justify-center" : ""}`}
    >
      {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-brand-600 rounded-r-full" />}
      <span className={`flex-shrink-0 transition-colors ${isActive ? "text-brand-700" : "text-muted group-hover:text-heading"}`}>
        {item.icon}
      </span>
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}
