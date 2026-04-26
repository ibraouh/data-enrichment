"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, FileUp, AlignLeft, UserRound, Pencil, Plus, Trash2, X } from "lucide-react";
import { deleteProject, getProjects, renameProject } from "@/lib/api";
import type { Project } from "@/lib/types";

const SOURCE_META: Record<string, { label: string; Icon: React.ElementType }> = {
  file:   { label: "File Upload",  Icon: FileUp },
  csv:    { label: "CSV Paste",    Icon: AlignLeft },
  single: { label: "Single Lead",  Icon: UserRound },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " · " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  );
}

interface Props {
  activeProjectId: string | null;
  refreshTrigger: number;
  onNew: () => void;
  onDelete: (projectId: string) => void;
  open?: boolean;
  onClose?: () => void;
}

export default function ProjectSidebar({ activeProjectId, refreshTrigger, onNew, onDelete, open = true, onClose }: Props) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    getProjects().then(setProjects).catch(() => {});
  }, [refreshTrigger]);

  function startEdit(p: Project, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingId(p.id);
    setEditValue(p.name);
  }

  async function commitEdit(id: string) {
    const trimmed = editValue.trim();
    if (!trimmed) { cancelEdit(); return; }
    await renameProject(id, trimmed).catch(() => {});
    setProjects((ps) => ps.map((p) => (p.id === id ? { ...p, name: trimmed } : p)));
    setEditingId(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValue("");
  }

  async function handleDelete(p: Project, e: React.MouseEvent) {
    e.stopPropagation();
    if (deletingId === p.id) {
      await deleteProject(p.id).catch(() => {});
      setProjects((ps) => ps.filter((x) => x.id !== p.id));
      setDeletingId(null);
      onDelete(p.id);
    } else {
      setDeletingId(p.id);
    }
  }

  function cancelDelete(e: React.MouseEvent) {
    e.stopPropagation();
    setDeletingId(null);
  }

  function handleProjectClick(p: Project) {
    router.push(`/projects/${p.id}`);
    onClose?.();
  }

  return (
    <>
      {/* Mobile backdrop — sits below the header */}
      {open && (
        <div
          className="fixed top-14 inset-x-0 bottom-0 bg-black/30 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed top-14 bottom-0 left-0 z-30 flex flex-col w-60 shrink-0 border-r border-border bg-card
        transition-transform duration-200 ease-in-out
        lg:relative lg:top-auto lg:bottom-auto lg:translate-x-0 lg:z-auto
        ${open ? "translate-x-0" : "-translate-x-full"}
      `}>
      <div className="px-3 py-3 border-b border-border flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Projects
        </p>
        <button
          onClick={onNew}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-3 h-3" />
          New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2 space-y-0.5">
        {projects.length === 0 && (
          <p className="px-4 py-8 text-xs text-muted-foreground text-center">
            No projects yet
          </p>
        )}

        {projects.map((p) => {
          const meta = SOURCE_META[p.source] ?? SOURCE_META.file;
          const isActive = p.id === activeProjectId;
          const isEditing = editingId === p.id;

          return (
            <div
              key={p.id}
              onClick={() => !isEditing && handleProjectClick(p)}
              className={`group mx-2 rounded-lg px-3 py-2.5 transition-colors ${
                isActive ? "bg-primary/15" : "hover:bg-muted/40 cursor-pointer"
              }`}
            >
              {isEditing ? (
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit(p.id);
                      if (e.key === "Escape") cancelEdit();
                    }}
                    className="flex-1 min-w-0 text-xs bg-muted border border-border rounded px-1.5 py-0.5 text-foreground outline-none focus:border-primary"
                  />
                  <button
                    onClick={() => commitEdit(p.id)}
                    className="shrink-0 text-primary hover:text-accent"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : deletingId === p.id ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-red-600 flex-1 leading-snug">Delete?</span>
                  <button
                    onClick={(e) => handleDelete(p, e)}
                    className="shrink-0 text-xs font-medium text-red-600 hover:text-red-700"
                  >
                    Yes
                  </button>
                  <button
                    onClick={cancelDelete}
                    className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
                  >
                    No
                  </button>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-1">
                  <p className="text-xs font-medium text-foreground leading-snug truncate flex-1">
                    {p.name}
                  </p>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => startEdit(p, e)}
                      className="shrink-0 mt-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(p, e)}
                      className="shrink-0 mt-0.5 text-muted-foreground hover:text-red-500"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-1.5 mt-1.5">
                <meta.Icon className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                <span className="text-[10px] text-muted-foreground/70">{meta.label}</span>
                <span className="text-[10px] text-muted-foreground/40">·</span>
                <span className="text-[10px] text-muted-foreground/60 truncate">
                  {formatDate(p.created_at)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
    </>
  );
}
