import { Users, CheckSquare, FileText, type LucideIcon } from "lucide-react";

// The life-OS module registry. The sidebar is generated from this list.
// Adding a new module = add an entry here + its route group under app/(app).
// `enabled: false` modules render as "coming soon" placeholders so the
// roadmap is visible in the UI.

export type ModuleDef = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  enabled: boolean;
  description: string;
};

export const MODULES: ModuleDef[] = [
  {
    key: "crm",
    label: "CRM",
    href: "/crm",
    icon: Users,
    enabled: true,
    description: "People, companies, and interactions",
  },
  {
    key: "tasks",
    label: "Tasks",
    href: "/tasks",
    icon: CheckSquare,
    enabled: true,
    description: "Task & project management",
  },
  {
    key: "notes",
    label: "Notes",
    href: "/notes",
    icon: FileText,
    enabled: true,
    description: "Notes by project & goal",
  },
];
