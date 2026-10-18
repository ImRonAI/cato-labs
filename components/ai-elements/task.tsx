"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  BracesIcon,
  CheckIcon,
  ChevronDownIcon,
  CircleIcon,
  FileArchiveIcon,
  FileCode2Icon,
  FileIcon,
  FileImageIcon,
  FileJsonIcon,
  FileTextIcon,
  FileTypeIcon,
  LoaderCircleIcon,
  PaletteIcon,
  XIcon,
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { createContext, useContext } from "react";

/* Status vocabulary from the reference task schema: pending → in_progress → completed (+ error). */
export type TaskStatus = "pending" | "in_progress" | "completed" | "error";

const statusLabel: Record<TaskStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Completed",
  error: "Error",
};

export const TaskStatusIcon = ({
  status,
  className,
}: {
  status: TaskStatus;
  className?: string;
}) => (
  <span
    aria-label={statusLabel[status]}
    className={cn(
      "relative inline-flex size-4 shrink-0 items-center justify-center rounded-full",
      status === "completed" && "bg-primary text-primary-foreground",
      status === "error" && "bg-destructive text-destructive-foreground",
      status === "pending" && "text-muted-foreground/60",
      status === "in_progress" && "text-primary",
      className
    )}
    data-task-status={status}
    role="img"
  >
    {status === "completed" && <CheckIcon className="size-2.5" strokeWidth={3} />}
    {status === "error" && <XIcon className="size-2.5" strokeWidth={3} />}
    {status === "pending" && <CircleIcon className="size-3.5" strokeDasharray="2.5 2.5" />}
    {status === "in_progress" && (
      <LoaderCircleIcon className="size-4 animate-spin motion-reduce:animate-none" />
    )}
  </span>
);

/* File icons by extension; the reference demo maps file types to brand icons. */
const fileIcons: { test: RegExp; icon: LucideIcon; color: string }[] = [
  { test: /\.html?$/i, icon: FileCode2Icon, color: "#e34f26" },
  { test: /\.(css|scss|less)$/i, icon: PaletteIcon, color: "#2e4bff" },
  { test: /\.(m?[jt]sx?|cjs)$/i, icon: BracesIcon, color: "#b58900" },
  { test: /\.json$/i, icon: FileJsonIcon, color: "#5b6172" },
  { test: /\.(md|mdx|txt|csv|log)$/i, icon: FileTextIcon, color: "#5b6172" },
  { test: /\.(png|jpe?g|gif|webp|svg|avif|ico)$/i, icon: FileImageIcon, color: "#0f9d75" },
  { test: /\.(zip|tar|gz|tgz|7z)$/i, icon: FileArchiveIcon, color: "#7c5cff" },
  { test: /\.(pdf|docx?|pptx?|xlsx?)$/i, icon: FileTypeIcon, color: "#b91c1c" },
];

export const fileIconFor = (filename: string) =>
  fileIcons.find((entry) => entry.test.test(filename)) ?? {
    icon: FileIcon,
    color: "var(--color-muted-foreground)",
  };

export type TaskItemFileProps = ComponentProps<"div"> & {
  /** When given, a matching file-type icon is rendered before the children. */
  filename?: string;
  icon?: ReactNode;
};

export const TaskItemFile = ({
  children,
  className,
  filename,
  icon,
  ...props
}: TaskItemFileProps) => {
  const auto = filename ? fileIconFor(filename) : undefined;
  return (
    <div
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md border bg-secondary px-1.5 py-0.5 align-middle text-foreground text-xs",
        className
      )}
      data-slot="task-item-file"
      {...props}
    >
      {icon ??
        (auto && (
          <auto.icon aria-hidden="true" className="size-3.5 shrink-0" style={{ color: auto.color }} />
        ))}
      {children ?? (filename && <span className="truncate">{filename}</span>)}
    </div>
  );
};

export type TaskItemProps = ComponentProps<"div"> & {
  status?: TaskStatus;
};

export const TaskItem = ({ children, className, status, ...props }: TaskItemProps) => (
  <div
    className={cn(
      "flex min-w-0 items-start gap-2 text-muted-foreground text-sm",
      status === "in_progress" && "text-foreground",
      status === "error" && "text-destructive",
      className
    )}
    data-slot="task-item"
    data-status={status}
    {...props}
  >
    {status && <TaskStatusIcon className="mt-0.5" status={status} />}
    <div className="min-w-0 flex-1">{children}</div>
  </div>
);

type TaskContextValue = { status?: TaskStatus };
const TaskContext = createContext<TaskContextValue>({});

export type TaskProps = ComponentProps<typeof Collapsible> & {
  status?: TaskStatus;
};

export const Task = ({
  defaultOpen = true,
  className,
  status,
  ...props
}: TaskProps) => (
  <TaskContext.Provider value={{ status }}>
    <Collapsible
      className={cn("group/task w-full", className)}
      data-slot="task"
      data-status={status}
      defaultOpen={defaultOpen}
      {...props}
    />
  </TaskContext.Provider>
);

export type TaskTriggerProps = ComponentProps<typeof CollapsibleTrigger> & {
  title: string;
  /** Overrides the status given to <Task />. */
  status?: TaskStatus;
  /** Shown when no status is known. */
  icon?: LucideIcon;
  /** Progress counter, e.g. 3 of 5 items completed. */
  progress?: { completed: number; total: number };
};

export const TaskTrigger = ({
  children,
  className,
  title,
  status: statusProp,
  icon: Icon,
  progress,
  ...props
}: TaskTriggerProps) => {
  const context = useContext(TaskContext);
  const status = statusProp ?? context.status;
  return (
    <CollapsibleTrigger asChild className={cn("group", className)} {...props}>
      {children ?? (
        <button
          className="flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-md text-left text-muted-foreground text-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
          data-slot="task-trigger"
          type="button"
        >
          {status ? (
            <TaskStatusIcon status={status} />
          ) : Icon ? (
            <Icon className="size-4 shrink-0" />
          ) : (
            <TaskStatusIcon status="pending" />
          )}
          <p className="min-w-0 flex-1 truncate text-foreground text-sm">{title}</p>
          {progress && progress.total > 0 && (
            <span
              aria-label={`${progress.completed} of ${progress.total} completed`}
              className="shrink-0 rounded-full bg-muted px-1.5 py-px font-mono text-[10px] text-muted-foreground tabular-nums"
            >
              {progress.completed}/{progress.total}
            </span>
          )}
          <ChevronDownIcon className="size-4 shrink-0 transition-transform duration-300 ease-out group-data-[state=open]:rotate-180" />
        </button>
      )}
    </CollapsibleTrigger>
  );
};

export type TaskContentProps = ComponentProps<typeof CollapsibleContent>;

export const TaskContent = ({
  children,
  className,
  ...props
}: TaskContentProps) => (
  <CollapsibleContent
    className={cn(
      "overflow-hidden text-popover-foreground outline-none data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down motion-reduce:animate-none",
      className
    )}
    data-slot="task-content"
    {...props}
  >
    <div className="mt-3 ml-2 space-y-2 border-muted border-l-2 pl-4">
      {children}
    </div>
  </CollapsibleContent>
);
