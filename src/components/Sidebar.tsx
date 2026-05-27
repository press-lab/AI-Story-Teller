export interface NavItem<T extends string> {
  id: T;
  label: string;
  emphasis?: "primary";
}

export interface NavGroup<T extends string> {
  label?: string;
  items: NavItem<T>[];
}

interface SidebarProps<T extends string> {
  groups: NavGroup<T>[];
  activeItem: T;
  onChange: (id: T) => void;
}

export function Sidebar<T extends string>({ groups, activeItem, onChange }: SidebarProps<T>) {
  return (
    <nav className="sidebar" aria-label="Navigation">
      {groups.map((group, i) => (
        <div key={i} className="nav-group">
          {group.label && <span className="nav-group-label">{group.label}</span>}
          {group.items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item${item.emphasis === "primary" ? " primary" : ""}${item.id === activeItem ? " active" : ""}`}
              onClick={() => onChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}
