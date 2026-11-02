import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  CubeIcon,
  DashboardSquare01Icon,
  HelpCircleIcon,
  Search01Icon,
  Settings02Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import type { Product } from "@/lib/api";
import { SourceIcon } from "./source-icon";

export function WorkspaceSidebar({
  path,
  product,
  sourceId,
  picker,
  loading,
  onSourceChange,
}: {
  path: string;
  product?: Product;
  sourceId?: string;
  picker: ReactNode;
  loading: boolean;
  onSourceChange: (id: string) => void;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  const sources = [{ id: "", name: "All sources", icon: null }, ...(product?.sources ?? [])];
  return (
    <Sidebar collapsible="icon" className="workspace-sidebar">
      <SidebarHeader className="workspace-brand-row">
        <Link
          to="/"
          aria-label="Piko overview"
          className="brand-link"
          onClick={() => setOpenMobile(false)}
        >
          <span className="brand">
            <img className="brand-mark" src="/favicon.svg?v=4" width="30" height="30" alt="" />
            <span className="brand-word">piko</span>
          </span>
        </Link>
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close navigation"
            onClick={() => setOpenMobile(false)}
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} aria-hidden="true" />
          </Button>
        )}
      </SidebarHeader>
      <div className="workspace-project" title={product?.name}>
        <span className="workspace-section-label">Project</span>
        {picker}
      </div>
      <SidebarContent>
        <SidebarGroup className="workspace-navigation">
          <SidebarGroupContent>
            <nav aria-label="Main navigation">
              <SidebarMenu>
                {(
                  [
                    ["/", "Overview", DashboardSquare01Icon],
                    ["/explore", "Explore", Search01Icon],
                    ["/settings", "Settings", Settings02Icon],
                  ] as const
                ).map(([to, label, icon]) => (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton
                      isActive={path === to}
                      tooltip={label}
                      render={<Link to={to} onClick={() => setOpenMobile(false)} />}
                    >
                      <HugeiconsIcon icon={icon} strokeWidth={2} aria-hidden="true" />
                      <span className="group-data-[collapsible=icon]:sr-only">{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="workspace-sources">
          <SidebarGroupLabel>Sources</SidebarGroupLabel>
          <SidebarGroupContent>
            <nav aria-label="Project sources">
              <SidebarMenu>
                {loading
                  ? [1, 2, 3].map((n) => (
                      <SidebarMenuItem key={n}>
                        <div className="workspace-source-placeholder">
                          <Skeleton className="size-4 shrink-0" />
                          <Skeleton className="h-3 w-24 group-data-[collapsible=icon]:hidden" />
                        </div>
                      </SidebarMenuItem>
                    ))
                  : sources.map((source) => (
                      <SidebarMenuItem key={source.id}>
                        <SidebarMenuButton
                          data-scope="source"
                          disabled={!product}
                          isActive={(sourceId ?? "") === source.id}
                          aria-pressed={(sourceId ?? "") === source.id}
                          aria-label={source.name}
                          tooltip={source.name}
                          title={source.name}
                          onClick={() => {
                            onSourceChange(source.id);
                            setOpenMobile(false);
                          }}
                        >
                          {source.id ? (
                            <SourceIcon name={source.name} icon={source.icon} />
                          ) : (
                            <HugeiconsIcon icon={CubeIcon} strokeWidth={2} aria-hidden="true" />
                          )}
                          <span className="min-w-0 flex-1 truncate group-data-[collapsible=icon]:sr-only">
                            {source.name}
                          </span>
                          {(sourceId ?? "") === source.id && (
                            <HugeiconsIcon
                              icon={Tick02Icon}
                              strokeWidth={2}
                              aria-hidden="true"
                              className="source-selected-mark"
                            />
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
              </SidebarMenu>
            </nav>
            {!loading && product && !product.sources.length && (
              <p className="workspace-source-empty">Connect your first source in Settings.</p>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="local-note workspace-retention">
          <span className="status-dot" />
          <span>
            {product ? `${product.retention_days}-day retention` : "Self-hosted analytics"}
          </span>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Documentation"
              render={
                <a
                  href="https://github.com/lilienblum/piko#readme"
                  target="_blank"
                  rel="noreferrer"
                />
              }
            >
              <HugeiconsIcon icon={HelpCircleIcon} strokeWidth={2} aria-hidden="true" />
              <span className="group-data-[collapsible=icon]:sr-only">Documentation</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
