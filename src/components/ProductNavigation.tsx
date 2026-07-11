import { useEffect, useRef, useState, type ReactNode } from "react";

export type ProductDestination =
  | "home"
  | "explore"
  | "play"
  | "studio"
  | "history"
  | "backups"
  | "settings"
  | "help"
  | "admin";

interface ProductNavigationProps {
  active: ProductDestination;
  currentStoryTitle?: string;
  pendingSuggestions?: number;
  isAdmin?: boolean;
  onNavigate: (destination: ProductDestination) => void;
}

const RAIL_COLLAPSED_KEY = "story-mode-ai-navigation-collapsed";

type IconName = ProductDestination | "more";

function NavIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    home: <><path d="M3 10.8 12 3l9 7.8" /><path d="M5.5 9.5V21h13V9.5" /><path d="M9.5 21v-7h5v7" /></>,
    explore: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8 4.8-2.2Z" /></>,
    play: <><circle cx="12" cy="12" r="9" /><path d="m10 8 6 4-6 4V8Z" /></>,
    studio: <><path d="m4 20 4.4-1 10.8-10.8a2.1 2.1 0 0 0-3-3L5.4 16 4 20Z" /><path d="m14.8 6.6 3 3" /></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></>,
    backups: <><path d="M4 7h16v13H4z" /><path d="M7 4h10l2 3H5l2-3Z" /><path d="M9 12h6" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.8 9a2.3 2.3 0 1 1 3.6 1.9c-.9.6-1.4 1-1.4 2.1" /><path d="M12 17h.01" /></>,
    admin: <><path d="M12 3 4.5 6v5.2c0 4.5 3.1 8.1 7.5 9.8 4.4-1.7 7.5-5.3 7.5-9.8V6L12 3Z" /><path d="m9 12 2 2 4-4" /></>,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  };

  return (
    <svg className="product-nav-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

function NavButton({
  destination,
  label,
  active,
  badge,
  onClick,
  disabled,
}: {
  destination: ProductDestination;
  label: string;
  active: boolean;
  badge?: number;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`product-nav-item${active ? " active" : ""}`}
      aria-label={badge != null && badge > 0 ? `${label}, ${badge} pending suggestions` : label}
      aria-current={active ? "page" : undefined}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      <NavIcon name={destination} />
      <span className="product-nav-label">{label}</span>
      {badge != null && badge > 0 && <span className="nav-badge">{badge > 99 ? "99+" : badge}</span>}
    </button>
  );
}

export function ProductNavigation({
  active,
  currentStoryTitle,
  pendingSuggestions = 0,
  isAdmin = false,
  onNavigate,
}: ProductNavigationProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(RAIL_COLLAPSED_KEY) === "true";
    } catch {
      return false;
    }
  });
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(RAIL_COLLAPSED_KEY, String(railCollapsed));
    } catch {
      // Navigation still works when browser storage is unavailable.
    }
  }, [railCollapsed]);

  useEffect(() => {
    if (!moreOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setMoreOpen(false);
      requestAnimationFrame(() => moreButtonRef.current?.focus());
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [moreOpen]);

  function go(destination: ProductDestination) {
    setMoreOpen(false);
    onNavigate(destination);
  }

  const hasStory = Boolean(currentStoryTitle);

  return (
    <>
      <aside id="product-navigation-rail" className={`product-rail${railCollapsed ? " is-collapsed" : ""}`}>
        <button type="button" className="product-brand" onClick={() => go("home")} aria-label="Story Mode AI home" title="Story Mode AI">
          <span className="product-brand-mark" aria-hidden="true">S</span>
          <span>
            <strong>Story Mode AI</strong>
            <small>Stories that remember</small>
          </span>
        </button>

        <nav className="product-rail-nav" aria-label="Primary navigation">
          <div className="product-nav-group">
            <NavButton destination="home" label="Home" active={active === "home"} onClick={() => go("home")} />
            <NavButton destination="explore" label="Explore" active={active === "explore"} onClick={() => go("explore")} />
          </div>

          <div className="product-nav-group product-story-nav" aria-label="Current story">
            <div className="product-story-label">
              <span>Current story</span>
              <strong title={currentStoryTitle}>{currentStoryTitle || "Open a story to begin"}</strong>
            </div>
            <NavButton destination="play" label="Play" active={active === "play"} onClick={() => go("play")} disabled={!hasStory} />
            <NavButton destination="studio" label="Story Studio" active={active === "studio"} badge={pendingSuggestions} onClick={() => go("studio")} disabled={!hasStory} />
          </div>

          <div className="product-nav-spacer" />

          {hasStory && (
            <div className="product-nav-group">
              <span className="product-nav-group-label">Story tools</span>
              <NavButton destination="history" label="History" active={active === "history"} onClick={() => go("history")} />
              <NavButton destination="backups" label="Backups & Transfer" active={active === "backups"} onClick={() => go("backups")} />
            </div>
          )}

          <div className="product-nav-group product-utility-nav">
            <NavButton destination="settings" label="Settings" active={active === "settings"} onClick={() => go("settings")} />
            <NavButton destination="help" label="Help" active={active === "help"} onClick={() => go("help")} />
            {isAdmin && <NavButton destination="admin" label="Admin Console" active={active === "admin"} onClick={() => go("admin")} />}
          </div>
        </nav>
        <button
          type="button"
          className="product-rail-toggle"
          aria-label={railCollapsed ? "Expand navigation" : "Collapse navigation"}
          aria-controls="product-navigation-rail"
          aria-expanded={!railCollapsed}
          title={railCollapsed ? "Expand navigation" : "Collapse navigation"}
          onClick={() => setRailCollapsed((collapsed) => !collapsed)}
        >
          <span className="product-rail-toggle-icon" aria-hidden="true">{railCollapsed ? "›" : "‹"}</span>
          <span className="product-nav-label">{railCollapsed ? "Expand" : "Collapse"}</span>
        </button>
      </aside>

      <nav className="mobile-bottom-nav" aria-label="Mobile primary navigation">
        <NavButton destination="home" label="Home" active={active === "home"} onClick={() => go("home")} />
        <NavButton destination="explore" label="Explore" active={active === "explore"} onClick={() => go("explore")} />
        <NavButton destination="play" label="Play" active={active === "play"} onClick={() => go("play")} disabled={!hasStory} />
        <NavButton destination="studio" label="Studio" active={active === "studio"} badge={pendingSuggestions} onClick={() => go("studio")} disabled={!hasStory} />
        <button
          ref={moreButtonRef}
          type="button"
          className={`product-nav-item${moreOpen ? " active" : ""}`}
          aria-expanded={moreOpen}
          aria-controls="mobile-more-navigation"
          onClick={() => setMoreOpen((open) => !open)}
        >
          <NavIcon name="more" />
          <span className="product-nav-label">More</span>
        </button>
      </nav>

      {moreOpen && (
        <>
          <button type="button" className="mobile-more-backdrop" aria-label="Close more navigation" onClick={() => setMoreOpen(false)} />
          <section id="mobile-more-navigation" className="mobile-more-sheet" aria-label="More navigation">
            <header>
              <div>
                <p className="eyebrow">More</p>
                <h2>{currentStoryTitle || "Story Mode AI"}</h2>
              </div>
              <button type="button" onClick={() => setMoreOpen(false)}>Close</button>
            </header>
            {hasStory && (
              <div className="mobile-more-group">
                <h3>Current story</h3>
                <NavButton destination="history" label="History" active={active === "history"} onClick={() => go("history")} />
                <NavButton destination="backups" label="Backups & Transfer" active={active === "backups"} onClick={() => go("backups")} />
              </div>
            )}
            <div className="mobile-more-group">
              <h3>App</h3>
              <NavButton destination="settings" label="Settings" active={active === "settings"} onClick={() => go("settings")} />
              <NavButton destination="help" label="Help" active={active === "help"} onClick={() => go("help")} />
              {isAdmin && <NavButton destination="admin" label="Admin Console" active={active === "admin"} onClick={() => go("admin")} />}
            </div>
          </section>
        </>
      )}
    </>
  );
}
