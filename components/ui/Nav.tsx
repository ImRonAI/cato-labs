'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Logo from './Logo';
import { site } from '@/lib/content';
import {
  capabilityChildren,
  type CapabilityChildSlug,
} from '@/lib/content/capabilities';
import {
  agentChildren,
  type AgentChildSlug,
} from '@/lib/content/agentsChildren';
import { capabilitiesPage } from '@/lib/content';
import { industries, industriesIndex } from '@/lib/content/industries';
import { regions, regionsIndex } from '@/lib/content/regions';
import { workIndex } from '@/lib/content/work';
import { veilBus } from '@/components/webgl/scroll-store';
import { setScrollLocked } from '@/components/webgl/ScrollDirector';

/* ---------------------------------------------------------- */
/*  Menu architecture — assembled from the content decks       */
/* ---------------------------------------------------------- */

type MenuId = 'capabilities' | 'work' | 'industries' | 'regions';

interface DropLink {
  href: string;
  label: string;
  index?: string;
  note?: string;
}

interface DropGroup {
  label: string;
  links: DropLink[];
  /** rendered as an indented sub-group (hairline left rail) */
  sub?: boolean;
}

interface MenuDef {
  id: MenuId;
  label: string;
  href: string;
  cols: 1 | 2;
  groups: DropGroup[];
  /** show the "All {label} →" foot link (skipped for Work, which lists it) */
  showAll: boolean;
  /** editorial aside, drawn from the section's index copy */
  feature: { eyebrow: string; titleLines: readonly string[] };
}

interface TopItem {
  label: string;
  href: string;
  menu?: MenuDef;
}

const capabilityOrder: CapabilityChildSlug[] = [
  'strategy-transformation',
  'ai-agent-systems',
  'digital-products',
  'brand-creative',
  'growth-distribution',
  'operations-automation',
];

const agentOrder: AgentChildSlug[] = [
  'voice-ai',
  'generative-ui',
  'customer-experience',
  'knowledge-architecture',
];

const coachellaSlugs = ['palm-springs', 'palm-desert', 'indio'];

const MENUS: MenuDef[] = [
  {
    id: 'capabilities',
    label: 'Capabilities',
    href: '/capabilities',
    cols: 2,
    showAll: true,
    feature: { eyebrow: capabilitiesPage.hero.eyebrow, titleLines: capabilitiesPage.hero.titleLines },
    groups: [
      {
        label: 'Capabilities',
        links: capabilityOrder.map((slug, i) => ({
          href: `/capabilities/${slug}`,
          label: capabilityChildren[slug].crumbLabel,
          index: `0${i + 1}`,
        })),
      },
      {
        label: 'Agent systems',
        sub: true,
        links: agentOrder.map((slug) => ({
          href: `/capabilities/ai-agent-systems/${slug}`,
          label: agentChildren[slug].crumbLabel,
        })),
      },
    ],
  },
  {
    id: 'work',
    label: 'Work',
    href: '/work',
    cols: 1,
    showAll: false,
    feature: { eyebrow: workIndex.eyebrow, titleLines: workIndex.titleLines },
    groups: [
      {
        label: 'Work',
        links: [
          { href: '/work', label: 'Selected work' },
          { href: '/work/resting-art', label: 'Resting Art', note: 'case study' },
        ],
      },
    ],
  },
  {
    id: 'industries',
    label: 'Industries',
    href: '/industries',
    cols: 2,
    showAll: true,
    feature: { eyebrow: industriesIndex.eyebrow, titleLines: industriesIndex.titleLines },
    groups: [
      {
        label: 'Industries',
        links: industries.map((ind) => ({
          href: `/industries/${ind.slug}`,
          label: ind.crumbLabel,
        })),
      },
    ],
  },
  {
    id: 'regions',
    label: 'Regions',
    href: '/regions',
    cols: 2,
    showAll: true,
    feature: { eyebrow: regionsIndex.eyebrow, titleLines: regionsIndex.titleLines },
    groups: [
      {
        label: 'Coachella Valley',
        links: regions
          .filter((r) => coachellaSlugs.includes(r.slug))
          .map((r) => ({ href: `/regions/${r.slug}`, label: r.crumbLabel })),
      },
      {
        label: 'Beyond the valley',
        links: regions
          .filter((r) => !coachellaSlugs.includes(r.slug))
          .map((r) => ({ href: `/regions/${r.slug}`, label: r.crumbLabel })),
      },
    ],
  },
];

const TOP_LEVEL: TopItem[] = [
  { label: 'Capabilities', href: '/capabilities', menu: MENUS[0] },
  { label: 'Work', href: '/work', menu: MENUS[1] },
  { label: 'Industries', href: '/industries', menu: MENUS[2] },
  { label: 'Regions', href: '/regions', menu: MENUS[3] },
  { label: 'Approach', href: '/approach' },
  { label: 'Contact', href: '/contact' },
];

const MOBILE_ITEMS: TopItem[] = [{ label: 'Home', href: '/' }, ...TOP_LEVEL];

/** Wait this long after the veil starts covering before pushing the route. */
const VEIL_LEAD_MS = 420;

/**
 * Nav — fixed chrome for the whole site.
 * Internal links trigger the light-veil before navigation so scene cuts
 * happen under cover of light. Desktop: a scroll-aware glass bar that
 * tucks away while reading down and returns on the way up, with a hairline
 * reading-progress rule and editorial mega panels. Mobile: a full-screen
 * overlay with a staggered reveal and collapsible child groups.
 */
export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState<MenuId | null>(null);
  const [expanded, setExpanded] = useState<MenuId | null>(null);
  const closeTimer = useRef<number | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const parentRefs = useRef<Partial<Record<MenuId, HTMLAnchorElement | null>>>({});

  /* scroll awareness: glass on, hide on read-down, progress hairline.
     Progress is written straight to a CSS var (no re-render per tick). */
  useEffect(() => {
    let lastY = window.scrollY;
    let raf = 0;
    const update = () => {
      raf = 0;
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      headerRef.current?.style.setProperty(
        '--nav-progress',
        max > 0 ? Math.min(1, Math.max(0, y / max)).toFixed(4) : '0',
      );
      setScrolled(y > 40);
      if (y < 160) setHidden(false);
      else if (y > lastY + 8) setHidden(true);
      else if (y < lastY - 8) setHidden(false);
      if (Math.abs(y - lastY) > 8 || y < 160) lastY = y;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    setOpen(false);
    setMenuOpen(null);
    setHidden(false);
  }, [pathname]);

  /* mobile overlay: freeze the page behind it, Escape closes */
  useEffect(() => {
    setScrollLocked(open);
    if (!open) {
      setExpanded(null);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(
    () => () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
      setScrollLocked(false);
    },
    [],
  );

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const openMenu = (id: MenuId) => {
    clearCloseTimer();
    setMenuOpen(id);
  };

  /** 150ms intent delay so the pointer can cross the gap without closing. */
  const scheduleClose = () => {
    clearCloseTimer();
    closeTimer.current = window.setTimeout(() => setMenuOpen(null), 150);
  };

  const closeMenu = () => {
    clearCloseTimer();
    setMenuOpen(null);
  };

  const onItemBlur = (e: React.FocusEvent<HTMLLIElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      scheduleClose();
    }
  };

  const onItemKeyDown =
    (id: MenuId) => (e: React.KeyboardEvent<HTMLLIElement>) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeMenu();
        parentRefs.current[id]?.focus();
      }
    };

  const go =
    (href: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
      setMenuOpen(null);
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      if (href === pathname) {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (href.includes('#')) return; // let anchors behave natively
      e.preventDefault();
      veilBus.cover();
      window.setTimeout(() => router.push(href), VEIL_LEAD_MS);
    };

  const isChildActive = (href: string) =>
    pathname !== href && pathname.startsWith(`${href}/`);

  const headerCls = [
    'nav',
    scrolled ? 'is-scrolled' : '',
    hidden && !menuOpen && !open ? 'is-hidden' : '',
    menuOpen ? 'has-panel' : '',
    open ? 'is-menu-open' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <header ref={headerRef} className={headerCls}>
        <div className="container-x nav-inner">
          <Link href="/" className="nav-brand" onClick={go('/')} aria-label="Cato Labs — home">
            <Logo size={30} />
            <span>Cato&nbsp;.Labs</span>
          </Link>

          <nav aria-label="Primary">
            <ul className="nav-links">
              {TOP_LEVEL.map((item) => (
                <li
                  key={item.href}
                  className={item.menu ? 'nav-item--menu' : undefined}
                  onMouseEnter={item.menu ? () => openMenu(item.menu!.id) : undefined}
                  onMouseLeave={item.menu ? scheduleClose : undefined}
                  onFocus={item.menu ? () => openMenu(item.menu!.id) : undefined}
                  onBlur={item.menu ? onItemBlur : undefined}
                  onKeyDown={item.menu ? onItemKeyDown(item.menu.id) : undefined}
                >
                  <Link
                    href={item.href}
                    onClick={go(item.href)}
                    ref={
                      item.menu
                        ? (el) => {
                            parentRefs.current[item.menu!.id] = el;
                          }
                        : undefined
                    }
                    aria-haspopup={item.menu ? 'true' : undefined}
                    aria-expanded={item.menu ? menuOpen === item.menu.id : undefined}
                    aria-current={pathname === item.href ? 'page' : undefined}
                    className={isChildActive(item.href) ? 'is-active' : undefined}
                  >
                    {item.label}
                  </Link>

                  {item.menu && (
                    <div
                      className={`nav-panel nav-panel--${item.menu.cols} ${
                        menuOpen === item.menu.id ? 'is-open' : ''
                      }`}
                      role="group"
                      aria-label={`${item.menu.label} submenu`}
                    >
                      <div className="container-x nav-panel__inner">
                        <div className="nav-panel__feature" aria-hidden="true">
                          <p className="micro-label nav-panel__label">{item.menu.feature.eyebrow}</p>
                          <p className="nav-panel__title">
                            {item.menu.feature.titleLines.map((l, li) => (
                              <span key={l} style={{ '--i': li } as React.CSSProperties}>
                                <span>{l}</span>
                              </span>
                            ))}
                          </p>
                        </div>
                        <div className="nav-panel__groups">
                          {(() => {
                            let n = 0;
                            return item.menu.groups.map((group) => (
                              <div
                                key={group.label}
                                className={`nav-panel__group ${group.sub ? 'nav-panel__group--sub' : ''}`}
                              >
                                <p className="micro-label micro-label--ink nav-panel__label">
                                  {group.label}
                                </p>
                                <ul className="nav-panel__list">
                                  {group.links.map((link) => (
                                    <li
                                      key={link.href}
                                      style={{ '--i': n++ } as React.CSSProperties}
                                    >
                                      <Link
                                        href={link.href}
                                        onClick={go(link.href)}
                                        aria-current={pathname === link.href ? 'page' : undefined}
                                      >
                                        {link.index && (
                                          <span className="index-no">{link.index}</span>
                                        )}
                                        <span className="nav-panel__text">{link.label}</span>
                                        {link.note && (
                                          <span className="nav-panel__note">{link.note}</span>
                                        )}
                                      </Link>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ));
                          })()}
                        </div>
                        {item.menu.showAll && (
                          <Link
                            className="nav-panel__all"
                            href={item.menu.href}
                            onClick={go(item.menu.href)}
                          >
                            All {item.menu.label.toLowerCase()}
                            <span aria-hidden="true">&nbsp;→</span>
                          </Link>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          <Link href="/contact" className="nav-cta" onClick={go('/contact')}>
            <span className="nav-cta__roll">
              <span data-text="Build with Cato Labs">Build with Cato Labs</span>
            </span>
          </Link>

          <button
            className="nav-burger"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="nav-overlay"
            onClick={() => setOpen((v) => !v)}
          >
            <span style={open ? { transform: 'translateY(3.25px) rotate(45deg)' } : undefined} />
            <span style={open ? { transform: 'translateY(-3.25px) rotate(-45deg)' } : undefined} />
          </button>
        </div>
        <span className="nav-progress" aria-hidden="true" />
      </header>

      {/* soft focus layer behind an open mega panel */}
      <div
        className={`nav-dim ${menuOpen ? 'is-on' : ''}`}
        aria-hidden="true"
        onMouseEnter={closeMenu}
      />

      <div
        id="nav-overlay"
        className={`nav-overlay ${open ? 'is-open' : ''}`}
        aria-hidden={!open}
        inert={!open}
      >
        <div className="nav-overlay__scroll" data-lenis-prevent>
          {MOBILE_ITEMS.map((item, i) => {
            const isOpen = !!item.menu && expanded === item.menu.id;
            const panelId = item.menu ? `nav-overlay-${item.menu.id}` : undefined;
            return (
              <div
                key={item.href}
                className="nav-overlay__item"
                style={{ '--i': i } as React.CSSProperties}
              >
                <div className="nav-overlay__row">
                  <Link
                    href={item.href}
                    onClick={go(item.href)}
                    aria-current={pathname === item.href ? 'page' : undefined}
                  >
                    <span className="index-no">{String(i + 1).padStart(2, '0')}</span>
                    <span className="nav-overlay__label">{item.label}</span>
                  </Link>
                  {item.menu && (
                    <button
                      type="button"
                      className={`nav-overlay__toggle ${isOpen ? 'is-open' : ''}`}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      aria-label={`${isOpen ? 'Hide' : 'Show'} ${item.label} pages`}
                      onClick={() => setExpanded(isOpen ? null : item.menu!.id)}
                    >
                      <span aria-hidden="true" />
                    </button>
                  )}
                </div>
                {item.menu && (
                  <div
                    id={panelId}
                    className={`nav-overlay__children ${isOpen ? 'is-open' : ''}`}
                    inert={!isOpen}
                  >
                    <div className="nav-overlay__children-inner">
                      {item.menu.groups.map((group) => (
                        <div key={group.label} className="nav-overlay__group">
                          {item.menu!.groups.length > 1 && (
                            <p className="micro-label micro-label--ink">{group.label}</p>
                          )}
                          {group.links.map((link) => (
                            <Link
                              key={link.href}
                              href={link.href}
                              onClick={go(link.href)}
                              aria-current={pathname === link.href ? 'page' : undefined}
                            >
                              {link.label}
                            </Link>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div className="nav-overlay__foot" style={{ '--i': MOBILE_ITEMS.length } as React.CSSProperties}>
            <a className="nav-overlay__mail" href={`mailto:${site.email}`}>
              {site.email}
            </a>
            <p className="text-dim nav-overlay__tagline">{site.tagline}</p>
          </div>
        </div>
      </div>
    </>
  );
}
