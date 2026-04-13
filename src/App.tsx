import { Canvas } from "@react-three/fiber";
import { animate, stagger } from "animejs";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { AnchorHTMLAttributes, FormEvent, MouseEvent, ReactNode } from "react";
import "./App.css";
import Scene from "./Scene";

gsap.registerPlugin(ScrollTrigger);

type PageId =
  | "home"
  | "partners"
  | "events"
  | "mini-projects"
  | "ground-station"
  | "payload-development"
  | "adcs"
  | "newsletter"
  | "post"
  | "admin";

type RouteInfo = {
  page: PageId;
  postSlug: string | null;
};

type MissionScene = {
  id: string;
  eyebrow: string;
  title: string;
  copy: string[];
  align: "left" | "center" | "right";
};

type ArchiveSection = {
  id: "about" | "mission" | "team" | "blogs";
  eyebrow: string;
  title: string;
  intro: string;
  points: string[];
  facts: string[];
  cards: {
    eyebrow: string;
    title: string;
    summary: string;
    tone: "rust" | "gold" | "teal" | "slate";
  }[];
};

type JourneyMedia = {
  id: string;
  src: string;
  alt: string;
  start: number;
  end: number;
};

type GalleryItem = {
  title: string;
  caption: string;
  src: string;
};

type MiniProject = {
  page: "ground-station" | "payload-development" | "adcs";
  eyebrow: string;
  title: string;
  summary: string;
  bullets: string[];
  intro: string;
  systems: string[];
  deliverables: string[];
  timeline: string[];
};

type CmsPost = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  publishedAt: string;
  isPublished?: boolean;
  status?: "draft" | "published";
  seoTitle?: string;
  seoDescription?: string;
  coverImage?: string;
  attachmentPath?: string;
  attachmentThumbnailPath?: string;
};

type CmsPostDetail = CmsPost & {
  content: string;
  attachmentMime?: string;
  updatedAt?: string;
};

type AuthResponse = {
  token: string;
  expiresAt?: string;
  user?: { username?: string; role?: string };
};

type PaginatedPostsResponse = {
  items?: CmsPost[];
  pagination?: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
  };
};

const missionScenes: MissionScene[] = [
  {
    id: "boot",
    eyebrow: "Scene 01",
    title: "BITS Goa Presents",
    copy: ["The signal wakes in silence before the mission begins."],
    align: "center",
  },
  {
    id: "title",
    eyebrow: "Scene 02",
    title: "Project Antara",
    copy: ["Student-built CubeSat mission", "Scroll to continue the flight path."],
    align: "center",
  },
  {
    id: "orbit",
    eyebrow: "Scene 03",
    title: "Low Earth Orbit",
    copy: [
      "Earth rises beneath the spacecraft.",
      "Radiation is not uniform. Some regions are dangerous.",
    ],
    align: "left",
  },
  {
    id: "anomaly",
    eyebrow: "Scene 04",
    title: "The South Atlantic Anomaly",
    copy: ["A region of intensified radiation revealed in heat and particles."],
    align: "right",
  },
  {
    id: "entry",
    eyebrow: "Scene 05",
    title: "Project Antara Enters the Anomaly",
    copy: ["Measuring high-energy trapped protons along the mission arc."],
    align: "left",
  },
  {
    id: "payload",
    eyebrow: "Scene 06",
    title: "Payload Visualization",
    copy: ["Detector. Electronics. Shielding.", "A compact stack designed for radiation insight."],
    align: "right",
  },
  {
    id: "systems",
    eyebrow: "Scene 07",
    title: "Systems Architecture",
    copy: ["ADCS, payload, and ground station operate as one coordinated loop."],
    align: "center",
  },
  {
    id: "data",
    eyebrow: "Scene 08",
    title: "Radiation Data For Future Missions",
    copy: ["Flux curves, energy distribution, and spatial variation flow out of orbit."],
    align: "left",
  },
  {
    id: "students",
    eyebrow: "Scene 09",
    title: "Built By Students",
    copy: ["BITS Goa turns curiosity into space-ready instrumentation."],
    align: "right",
  },
  {
    id: "finale",
    eyebrow: "Scene 10",
    title: "Launching The Next Generation Of Space Missions",
    copy: ["Project Antara closes on the stars and opens toward the mission."],
    align: "center",
  },
];

const archiveSections: ArchiveSection[] = [
  {
    id: "about",
    eyebrow: "Project Overview",
    title: "A student mission with research intent and engineering discipline.",
    intro:
      "Antara is being shaped as a serious student-built space systems effort: one part radiation science, one part spacecraft engineering, and one part team-building platform for the next generation of mission designers.",
    points: [
      "Focused on radiation behavior in Low Earth Orbit, with special attention to the South Atlantic Anomaly.",
      "Built to connect payload science, spacecraft systems, and mission operations in one integrated learning program.",
      "Designed to communicate like a real mission archive rather than a college club microsite.",
    ],
    facts: ["Student-led", "CubeSat mission", "BITS Goa"],
    cards: [
      {
        eyebrow: "Why It Matters",
        title: "A mission that explains itself clearly.",
        summary:
          "The site should communicate the mission to sponsors, students, and technically curious visitors without losing seriousness.",
        tone: "rust",
      },
      {
        eyebrow: "Positioning",
        title: "Part research platform, part talent engine.",
        summary:
          "Antara can present itself as both a scientific effort and a training ground for future spacecraft engineers.",
        tone: "gold",
      },
    ],
  },
  {
    id: "mission",
    eyebrow: "Flight Archive",
    title: "Scientific objectives, architecture, and mission value in one place.",
    intro:
      "This section is designed for the material that decision-makers and technically curious visitors want after the cinematic hook: why the mission matters, how the payload works, and what the data unlocks.",
    points: [
      "Clear mission objective framing around trapped proton measurement and spatial radiation variation.",
      "Expandable room for architecture diagrams, orbital assumptions, payload stack explanations, and operations flow.",
      "A stronger bridge between the emotional landing page and the factual information a serious mission site needs.",
    ],
    facts: ["LEO radiation", "SAA focus", "Payload data"],
    cards: [
      {
        eyebrow: "Objective",
        title: "Measure radiation behavior where it becomes operationally important.",
        summary:
          "The mission centers on understanding trapped proton behavior and where it intensifies across orbital regions.",
        tone: "teal",
      },
      {
        eyebrow: "Output",
        title: "Turn orbital measurements into mission-ready insight.",
        summary: "The payload story should end in interpretable data products, not just hardware imagery.",
        tone: "slate",
      },
    ],
  },
  {
    id: "team",
    eyebrow: "People Behind Antara",
    title: "Students building payloads, systems, storytelling, and mission confidence.",
    intro:
      "The team section now has space for subsystem leads, contributors, faculty mentors, and operations roles so the project feels credible and alive. You can replace this seed content with real names and responsibilities as they lock in.",
    points: [
      "Payload and scientific instrumentation members focused on detector design, shielding, and data quality.",
      "ADCS, power, structures, and onboard systems contributors turning mission requirements into a viable CubeSat platform.",
      "Ground station, outreach, and media collaborators translating technical work into public mission storytelling.",
    ],
    facts: ["Subsystem leads", "Faculty mentors", "Operations roles"],
    cards: [
      {
        eyebrow: "Subsystems",
        title: "Engineering ownership should be visible.",
        summary:
          "Give each subsystem a clear place so the team reads like a functioning mission organization.",
        tone: "gold",
      },
      {
        eyebrow: "Culture",
        title: "People, not placeholders.",
        summary:
          "A stronger team section comes from showing roles, focus areas, and contribution, not generic profile tiles.",
        tone: "rust",
      },
    ],
  },
  {
    id: "blogs",
    eyebrow: "Mission Log",
    title: "A place for updates, build diaries, tests, and launch-season momentum.",
    intro:
      "Instead of generic cards, the blog area is set up like a mission log. It can hold progress notes, subsystem milestones, payload test reports, interviews, and launch prep updates without breaking the overall visual language.",
    points: [
      "Weekly build logs documenting prototypes, reviews, and design pivots.",
      "Technical explainers for payload physics, radiation mapping, and systems architecture.",
      "Public updates that make the mission legible to sponsors, students, and future team members.",
    ],
    facts: ["Mission log", "Tech explainers", "Public updates"],
    cards: [
      {
        eyebrow: "Editorial",
        title: "Write like a mission log, not a marketing feed.",
        summary:
          "Posts can cover tests, reviews, fabrication, subsystem milestones, and outreach in a more durable format.",
        tone: "slate",
      },
      {
        eyebrow: "Cadence",
        title: "Let the project feel active.",
        summary:
          "Even short updates help the site feel like a working spacecraft program rather than a static portfolio.",
        tone: "teal",
      },
    ],
  },
];

const journeyMedia: JourneyMedia[] = [
  {
    id: "horizon",
    src: "https://www.nasa.gov/wp-content/uploads/2023/03/194991main_s120e006867_hires_full.jpg?w=1041",
    alt: "Earth horizon with ISS structures. Image credit: NASA.",
    start: 0.12,
    end: 0.38,
  },
  {
    id: "arrays",
    src: "https://www.nasa.gov/wp-content/uploads/2023/03/iss065e049854-1.jpg?w=1041",
    alt: "ISS solar arrays over Earth's horizon. Image credit: NASA.",
    start: 0.34,
    end: 0.62,
  },
  {
    id: "map",
    src: "https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/image/earth-%28a%29/Earth%20%28A%29.jpg",
    alt: "Topographic Earth map. Credit: USGS and NASA/JPL.",
    start: 0.56,
    end: 0.9,
  },
];

const galleryItems: GalleryItem[] = [
  {
    title: "Orbital Horizon",
    caption: "A visual reference for the kind of cinematic framing Antara is aiming for in orbit.",
    src: "https://www.nasa.gov/wp-content/uploads/2023/03/194991main_s120e006867_hires_full.jpg?w=1041",
  },
  {
    title: "Solar Array Geometry",
    caption: "A strong systems-led visual language for spacecraft surfaces, structure, and mission scale.",
    src: "https://www.nasa.gov/wp-content/uploads/2023/03/iss065e049854-1.jpg?w=1041",
  },
  {
    title: "Earth Observation Texture",
    caption: "A reference for mapping, overlays, and science-forward planetary surfaces in the mission story.",
    src: "https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/image/earth-%28a%29/Earth%20%28A%29.jpg",
  },
];

const miniProjects: MiniProject[] = [
  {
    page: "ground-station",
    eyebrow: "Mini-Project 01",
    title: "Ground-Station",
    summary:
      "Build out the communications and operational layer that lets the mission speak back to Earth through tracking, signal flow, and data handling.",
    intro:
      "The ground-station track focuses on the infrastructure, workflows, and operations interface that connect the spacecraft to the team on the ground.",
    bullets: [
      "Antenna and tracking workflow studies",
      "Telemetry visualization and downlink architecture",
      "Ground-side testing and student operations planning",
    ],
    systems: ["Tracking workflow and antenna planning", "Packet handling, telemetry parsing, and operator UI", "Mission rehearsals and pass scheduling"],
    deliverables: ["A pass-planning dashboard prototype", "A structured telemetry display workflow", "A documented ground-ops checklist for student operators"],
    timeline: ["Research and station architecture mapping", "Prototype telemetry and tracking visualizations", "Operations validation and workflow testing"],
  },
  {
    page: "payload-development",
    eyebrow: "Mini-Project 02",
    title: "Payload Development",
    summary:
      "Focus on the detector stack, shielding decisions, electronics integration, and how payload measurements become usable science products.",
    intro:
      "The payload development track is where the science becomes tangible through detector packaging, electronics, shielding, and data quality.",
    bullets: [
      "Detector and shielding trade studies",
      "Electronics packaging and interfaces",
      "Radiation data interpretation pipelines",
    ],
    systems: ["Detector stack architecture", "Shielding and electronics packaging", "Data handling and calibration workflow"],
    deliverables: ["Payload packaging concept drawings", "Detector and shielding trade study notes", "A draft pipeline for translating measurements into usable plots"],
    timeline: ["Detector concept and requirements framing", "Electronics and shielding packaging iteration", "Data-readout and interpretation pass"],
  },
  {
    page: "adcs",
    eyebrow: "Mini-Project 03",
    title: "Attitude Control and Determination System",
    summary:
      "Explore how the spacecraft understands and manages orientation, stabilizes operations, and supports mission pointing and control logic.",
    intro:
      "The ADCS track looks at how the spacecraft senses orientation, responds to control logic, and supports stable mission operations.",
    bullets: [
      "Sensor and actuator architecture exploration",
      "Pointing logic and onboard control concepts",
      "Simulation-driven systems validation",
    ],
    systems: ["Sensing and state estimation concepts", "Actuator selection and control logic", "Simulation and validation environment"],
    deliverables: ["An ADCS architecture map", "Initial control-loop concept documentation", "A simulation outline for orientation testing"],
    timeline: ["Requirements and disturbance study", "Sensor-actuator trade exploration", "Control validation and systems review"],
  },
];

const monthlyIssues = [
  {
    month: "April 2026",
    title: "Mission Identity, Ground Segment, and Payload Planning",
    summary:
      "A kickoff issue covering the current Antara narrative direction, subsystem framing, and upcoming technical priorities.",
  },
  {
    month: "May 2026",
    title: "Structures, Mission Timeline, and Integration Readiness",
    summary:
      "An upcoming issue for integration status, events, subsystem ownership, and milestone planning.",
  },
];

const homeNavItems = [
  { label: "Journey", href: "/#boot" },
  { label: "About", href: "/#about" },
  { label: "Mission", href: "/#mission" },
  { label: "Team", href: "/#team" },
  { label: "Blogs", href: "/#blogs" },
  { label: "Gallery", href: "/#gallery" },
  { label: "Contact", href: "/#footer" },
];

const sideMenuItems = [
  { label: "Partners", page: "partners" as const, href: "/partners" },
  { label: "Events", page: "events" as const, href: "/events" },
  { label: "Mini-Projects", page: "mini-projects" as const, href: "/mini-projects" },
  { label: "Newsletter", page: "newsletter" as const, href: "/newsletter" },
];

const ADMIN_TOKEN_KEY = "antara-admin-token";

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const sceneVisibility = (progress: number, index: number, total: number) => {
  const start = index / total;
  const end = (index + 1) / total;
  const local = clamp((progress - start) / (end - start));

  return clamp(Math.sin(local * Math.PI));
};

const segmentVisibility = (progress: number, start: number, end: number) => {
  const local = clamp((progress - start) / (end - start));
  return clamp(Math.sin(local * Math.PI));
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const markdownToHtml = (markdown: string) => {
  const source = escapeHtml(String(markdown ?? "")).replace(/\r\n/g, "\n");
  let html = source
    .replace(/```([\s\S]*?)```/g, (_match, code) => `<pre><code>${code.trim()}</code></pre>`)
    .replace(/^######\s+(.*)$/gm, "<h6>$1</h6>")
    .replace(/^#####\s+(.*)$/gm, "<h5>$1</h5>")
    .replace(/^####\s+(.*)$/gm, "<h4>$1</h4>")
    .replace(/^###\s+(.*)$/gm, "<h3>$1</h3>")
    .replace(/^##\s+(.*)$/gm, "<h2>$1</h2>")
    .replace(/^#\s+(.*)$/gm, "<h1>$1</h1>")
    .replace(/^>\s+(.*)$/gm, "<blockquote>$1</blockquote>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');

  html = html.replace(/(?:^|\n)((?:-\s+.*(?:\n|$))+)/g, (_match, listBlock) => {
    const items = listBlock
      .trim()
      .split("\n")
      .map((line: string) => line.replace(/^-\s+/, "").trim())
      .filter(Boolean)
      .map((item: string) => `<li>${item}</li>`)
      .join("");
    return `\n<ul>${items}</ul>\n`;
  });

  const blocks = html
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      if (/^<(h[1-6]|ul|ol|pre|blockquote|hr)/.test(block)) {
        return block;
      }
      return `<p>${block.replace(/\n/g, "<br/>")}</p>`;
    });

  return blocks.join("\n");
};

type LenisLike = {
  scrollTo: (
    target: number | string | HTMLElement,
    options?: { offset?: number; duration?: number; immediate?: boolean; lock?: boolean },
  ) => void;
};

const getLenis = () => (window as Window & { __antaraLenis?: LenisLike }).__antaraLenis;

const isHomePath = () => {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  return path === "/";
};

const scrollToHashTarget = (hash: string, immediate = false) => {
  const targetId = decodeURIComponent(hash.replace(/^#/, "").trim());
  if (!targetId || targetId.startsWith("/")) {
    return false;
  }

  const target = document.getElementById(targetId);
  if (!target) {
    return false;
  }

  const lenis = getLenis();
  if (lenis) {
    lenis.scrollTo(target, {
      offset: targetId === "boot" ? 0 : -72,
      duration: immediate ? 0 : 1.15,
      immediate,
    });
    return true;
  }

  target.scrollIntoView({ behavior: immediate ? "auto" : "smooth", block: "start" });
  return true;
};

function SmartLink({ href = "", onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || !href) {
      return;
    }

    if (
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      href.startsWith("http://") ||
      href.startsWith("https://")
    ) {
      return;
    }

    const hashIndex = href.indexOf("#");
    if (hashIndex === -1) {
      return;
    }

    const hash = href.slice(hashIndex);
    const isHomeHash = href.startsWith("/#") || href.startsWith("#");
    if (isHomeHash && isHomePath()) {
      event.preventDefault();
      window.history.pushState({}, "", href.startsWith("#") ? `/${hash}` : href);
      scrollToHashTarget(hash);
    }
  };

  return <a href={href} onClick={handleClick} {...props} />;
}

const getRouteFromLocation = (): RouteInfo => {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (path.startsWith("/posts/")) {
    const slug = decodeURIComponent(path.replace(/^\/posts\//, "").trim());
    if (slug) {
      return { page: "post", postSlug: slug };
    }
  }

  const pathPage = path.startsWith("/") ? path.slice(1) : path;
  if (
    pathPage === "partners" ||
    pathPage === "events" ||
    pathPage === "mini-projects" ||
    pathPage === "ground-station" ||
    pathPage === "payload-development" ||
    pathPage === "adcs" ||
    pathPage === "newsletter" ||
    pathPage === "admin"
  ) {
    return { page: pathPage, postSlug: null };
  }

  const hash = window.location.hash;
  if (!hash.startsWith("#/")) {
    return { page: "home", postSlug: null };
  }

  const page = hash.slice(2) as PageId;
  if (
    page === "partners" ||
    page === "events" ||
    page === "mini-projects" ||
    page === "ground-station" ||
    page === "payload-development" ||
    page === "adcs" ||
    page === "newsletter" ||
    page === "admin"
  ) {
    return { page, postSlug: null };
  }

  return { page: "home", postSlug: null };
};

function SiteHeader({ progress }: { progress: number }) {
  return (
    <header className="mission-hud" aria-label="Site navigation">
      <SmartLink className="mission-hud__brand mission-hud__brand-link" href="/">
        <div className="brand-main">
          <img src="src\assets\logo.jpg" alt="Antara logo" />
          <span>Project Antara</span>
        </div>
</SmartLink>
      <nav className="mission-hud__nav" aria-label="Primary">
        {homeNavItems.map((item) => (
          <SmartLink key={item.label} className="mission-hud__link" href={item.href}>
            {item.label}
          </SmartLink>
        ))}
      </nav>
      <div className="mission-hud__meter" aria-hidden="true">
        <span style={{ transform: `scaleX(${Math.max(progress, 0.02)})` }} />
      </div>
    </header>
  );
}

function SideMenu({ page }: { page: PageId }) {
  const [open, setOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const miniProjectsActive =
    page === "mini-projects" || page === "ground-station" || page === "payload-development" || page === "adcs";
  const submenuOpen = miniProjectsActive || projectsOpen;

  return (
    <>
      <button
        type="button"
        className="side-menu-toggle"
        aria-expanded={open}
        aria-controls="side-menu-panel"
        onClick={() => setOpen((value) => !value)}
      >
        Menu
      </button>
      <aside className={`side-menu${open ? " is-open" : ""}`} id="side-menu-panel" aria-label="Site pages">
        <p className="side-menu__eyebrow">Site</p>
        <div className="side-menu__list">
          {sideMenuItems.slice(0, 2).map((item) => {
            const active = item.page === page;
            return (
              <SmartLink key={item.label} className={`side-menu__link${active ? " is-active" : ""}`} href={item.href}>
                {item.label}
              </SmartLink>
            );
          })}
          <div className="side-menu__group">
            <button
              type="button"
              className={`side-menu__link side-menu__group-toggle${
                miniProjectsActive ? " is-active" : ""
              }`}
              aria-expanded={submenuOpen}
              onClick={() => setProjectsOpen((value) => !value)}
            >
              Mini-Projects
            </button>
            <div className={`side-menu__submenu${submenuOpen ? " is-open" : ""}`}>
              <SmartLink className={`side-menu__sublink${page === "mini-projects" ? " is-active" : ""}`} href="/mini-projects">
                Overview
              </SmartLink>
              {miniProjects.map((project) => (
                <SmartLink
                  key={project.page}
                  className={`side-menu__sublink${page === project.page ? " is-active" : ""}`}
                  href={`/${project.page}`}
                >
                  {project.title}
                </SmartLink>
              ))}
            </div>
          </div>
          <SmartLink className={`side-menu__link${page === "newsletter" ? " is-active" : ""}`} href="/newsletter">
            Newsletter
          </SmartLink>
        </div>
      </aside>
    </>
  );
}

function Footer() {
  return (
    <footer className="site-footer" id="footer">
      <div className="site-footer__brand">
        <p className="mission-copy__eyebrow">Project Antara</p>
        <h4>Student-built CubeSat mission from BITS Goa.</h4>
        <p>
          Antara is framed as a research-forward radiation mission experience, combining scientific
          storytelling, system design, and public-facing communication.
        </p>
      </div>

      <div className="site-footer__column">
        <p className="site-footer__heading">Explore</p>
        <SmartLink href="/#mission">Mission</SmartLink>
        <SmartLink href="/#gallery">Gallery</SmartLink>
        <SmartLink href="/partners">Partners</SmartLink>
        <SmartLink href="/newsletter">Newsletter</SmartLink>
        <SmartLink href="/admin">Admin</SmartLink>
      </div>

      <div className="site-footer__column">
        <p className="site-footer__heading">Contact Us</p>
        <a href="mailto:antara@bits-goa.ac.in">antara@bits-goa.ac.in</a>
        <a href="tel:+919999999999">+91 99999 99999</a>
        <span>BITS Pilani, K K Birla Goa Campus</span>
        <span>Zuarinagar, Goa 403726</span>
      </div>

      <div className="site-footer__column">
        <p className="site-footer__heading">Summary</p>
        <span>Radiation mission narrative</span>
        <span>CubeSat systems storytelling</span>
        <span>Student team and mission log</span>
        <span>Research-first visual identity</span>
      </div>
    </footer>
  );
}

function HomePage({ posts }: { posts: CmsPost[] }) {
  const [progress, setProgress] = useState(0);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const liveBlogPosts = posts.filter((post) => post.category === "blog").slice(0, 6);

  useEffect(() => {
    const handleScroll = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const next = maxScroll <= 0 ? 0 : window.scrollY / maxScroll;
      setProgress(clamp(next));
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  useEffect(() => {
    const scope = shellRef.current;
    if (!scope || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".mission-copy__inner",
        { autoAlpha: 0, y: 64 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 1.1,
          ease: "power3.out",
          stagger: 0.07,
        },
      );

      gsap.utils.toArray<HTMLElement>(".journey-media__layer").forEach((layer, index) => {
        gsap.to(layer, {
          yPercent: -6 - index * 3,
          scale: 1.12 + index * 0.03,
          ease: "none",
          scrollTrigger: {
            trigger: ".mission-scroll",
            start: "top top",
            end: "bottom bottom",
            scrub: 1.05,
          },
        });
      });

      gsap.utils
        .toArray<HTMLElement>(
          ".info-hub__intro, .archive-section, .database-feed__card, .gallery-card, .site-footer__brand, .site-footer__column",
        )
        .forEach((target, index) => {
          gsap.fromTo(
            target,
            { autoAlpha: 0, y: 34 },
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.88,
              delay: Math.min(index * 0.03, 0.25),
              ease: "power2.out",
              scrollTrigger: {
                trigger: target,
                start: "top 88%",
                toggleActions: "play none none reverse",
              },
            },
          );
        });
    }, scope);

    const premiumTargets = Array.from(
      scope.querySelectorAll<HTMLElement>(".mission-cta, .project-card__link, .side-menu-toggle, .mission-hud__link"),
    );

    const uiPulse =
      premiumTargets.length > 0
        ? animate(premiumTargets, {
            translateY: [0, -2],
            duration: 2300,
            easing: "easeInOutSine",
            direction: "alternate",
            delay: stagger(70),
            loop: true,
          })
        : null;

    ScrollTrigger.refresh();

    return () => {
      uiPulse?.pause();
      ctx.revert();
    };
  }, []);

  return (
    <div className="mission-shell" ref={shellRef}>
      <div className="journey-media" aria-hidden="true">
        {journeyMedia.map((media) => {
          const opacity = segmentVisibility(progress, media.start, media.end);

          return (
            <div
              key={media.id}
              className="journey-media__layer"
              style={{
                opacity: opacity * 0.8,
                backgroundImage: `linear-gradient(180deg, rgba(2, 4, 11, 0.82), rgba(2, 4, 11, 0.35) 36%, rgba(2, 4, 11, 0.88)), url("${media.src}")`,
              }}
              title={media.alt}
            />
          );
        })}
      </div>

      <div className="scene-canvas">
        <Canvas camera={{ position: [0, 0, 9], fov: 42 }} dpr={[1, 1.35]} gl={{ antialias: true, powerPreference: "high-performance" }}>
          <Suspense fallback={null}>
            <Scene progress={progress} />
          </Suspense>
        </Canvas>
      </div>

      <SiteHeader progress={progress} />
      <SideMenu page="home" />

      <main className="mission-scroll">
        {missionScenes.map((scene, index) => {
          const intensity = sceneVisibility(progress, index, missionScenes.length);

          return (
            <section className="mission-panel" key={scene.id} id={scene.id}>
              <div className={`mission-copy mission-copy--${scene.align}`}>
                <div
                  className="mission-copy__inner"
                  style={{
                    opacity: 0.2 + intensity * 0.8,
                    transform: `translate3d(0, ${40 - intensity * 40}px, 0) scale(${0.96 + intensity * 0.04})`,
                  }}
                >
                  <p className="mission-copy__eyebrow">{scene.eyebrow}</p>
                  <h1>{scene.title}</h1>
                  {scene.copy.map((line) => (
                    <p key={line} className="mission-copy__text">
                      {line}
                    </p>
                  ))}
                  {scene.id === "finale" ? (
                    <SmartLink className="mission-cta" href="/#about">
                      Explore the Mission
                    </SmartLink>
                  ) : null}
                </div>
              </div>
            </section>
          );
        })}

        <section className="info-hub" id="about">
          <div className="info-hub__intro">
            <p className="mission-copy__eyebrow">Mission Archive</p>
            <h2>Antara needs both spectacle and substance.</h2>
            <p>
              The scroll experience pulls people into orbit. The archive below gives them somewhere to stay,
              read, and understand the actual mission.
            </p>
          </div>
        </section>

        <section className="archive-grid" aria-label="Project archive sections">
          {archiveSections.map((section) => (
            <section key={section.id} className="archive-section" id={section.id}>
              <div className="archive-section__main">
                <p className="mission-copy__eyebrow">{section.eyebrow}</p>
                <h3>{section.title}</h3>
                <p className="archive-section__lead">{section.intro}</p>
                <div className="archive-section__facts">
                  {section.facts.map((fact) => (
                    <span key={fact}>{fact}</span>
                  ))}
                </div>
                <div className="archive-section__cards">
                  {section.cards.map((card) => (
                    <article key={card.title} className={`archive-section__card archive-section__card--${card.tone}`}>
                      <p>{card.eyebrow}</p>
                      <h4>{card.title}</h4>
                      <span>{card.summary}</span>
                    </article>
                  ))}
                </div>
              </div>
              <div className="archive-section__rail">
                {section.points.map((point) => (
                  <article key={point} className="archive-section__point">
                    <span className="info-hub__detail-mark" aria-hidden="true" />
                    <p>{point}</p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </section>

        <section className="gallery-section" id="gallery">
          <div className="database-feed">
            <div className="database-feed__intro">
              <p className="mission-copy__eyebrow">Live Posts</p>
              <h2>Dynamic content pulled from your Node + database layer.</h2>
            </div>
            <div className="database-feed__grid">
              {liveBlogPosts.length > 0 ? (
                liveBlogPosts.map((post) => (
                  <article key={post.id} className="database-feed__card">
                    <p>{new Date(post.publishedAt).toLocaleDateString()}</p>
                    <h3>
                      <SmartLink className="database-feed__card-link" href={`/posts/${post.slug}`}>
                        {post.title}
                      </SmartLink>
                    </h3>
                    <span>{post.excerpt || "No excerpt yet. Upload and publish your content from the API."}</span>
                    {post.attachmentPath ? (
                      <a href={post.attachmentPath} target="_blank" rel="noreferrer">
                        Open Attachment
                      </a>
                    ) : null}
                  </article>
                ))
              ) : (
                <article className="database-feed__card">
                  <p>Database</p>
                  <h3>No live blog posts yet.</h3>
                  <span>Upload your first post via `POST /api/posts`, and it will appear here automatically.</span>
                </article>
              )}
            </div>
          </div>
          <div className="gallery-section__intro">
            <p className="mission-copy__eyebrow">Gallery</p>
            <h2>Visual references, mission mood, and systems-first imagery.</h2>
          </div>
          <div className="gallery-grid">
            {galleryItems.map((item) => (
              <article key={item.title} className="gallery-card">
                <div className="gallery-card__media" style={{ backgroundImage: `url("${item.src}")` }} />
                <div className="gallery-card__body">
                  <p>{item.title}</p>
                  <span>{item.caption}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <Footer />
      </main>
    </div>
  );
}

function StandardPage({
  page,
  title,
  eyebrow,
  intro,
  children,
}: {
  page: PageId;
  title: string;
  eyebrow: string;
  intro: string;
  children: ReactNode;
}) {
  const pageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const scope = pageRef.current;
    if (!scope || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(".page-hero", { autoAlpha: 0, y: 34 }, { autoAlpha: 1, y: 0, duration: 0.95, ease: "power2.out" });

      gsap.utils
        .toArray<HTMLElement>(".content-panel, .timeline-item, .project-card, .detail-panel, .issue-card, .admin-post-item")
        .forEach((target, index) => {
          gsap.fromTo(
            target,
            { autoAlpha: 0, y: 22 },
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.74,
              delay: Math.min(index * 0.025, 0.2),
              ease: "power2.out",
              scrollTrigger: {
                trigger: target,
                start: "top 90%",
                toggleActions: "play none none reverse",
              },
            },
          );
        });
    }, scope);

    ScrollTrigger.refresh();
    return () => {
      ctx.revert();
    };
  }, [page]);

  return (
    <div className="subpage-shell" ref={pageRef}>
      <SiteHeader progress={0.24} />
      <SideMenu page={page} />
      <main className="subpage-main">
        <section className="page-hero">
          <p className="mission-copy__eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="page-hero__intro">{intro}</p>
        </section>
        {children}
        <Footer />
      </main>
    </div>
  );
}

function PartnersPage() {
  return (
    <StandardPage
      page="partners"
      eyebrow="Partners"
      title="Support the mission and help Antara grow into a credible student space program."
      intro="This page is designed for institutions, sponsors, technical partners, and alumni who want to support Antara through funding, mentorship, infrastructure, or visibility."
    >
      <section className="page-section">
        <div className="two-column-grid">
          <article className="content-panel">
            <p className="panel-eyebrow">Partnership Tracks</p>
            <h2>Where support can make a real difference.</h2>
            <ul className="content-list">
              <li>Payload prototyping, detector hardware, and shielding development.</li>
              <li>Ground-station support, communications infrastructure, and testing tools.</li>
              <li>Student travel, outreach events, fabrication resources, and mission reviews.</li>
            </ul>
          </article>
          <article className="content-panel content-panel--accent">
            <p className="panel-eyebrow">Get In Touch</p>
            <h2>Funding, collaboration, or technical support.</h2>
            <p className="content-copy">
              If you are interested in backing Antara, reach out with your organization, area of interest,
              and what kind of support you have in mind.
            </p>
            <div className="contact-stack">
              <a href="mailto:antara@bits-goa.ac.in?subject=Antara%20Partnership%20Inquiry">antara@bits-goa.ac.in</a>
              <a href="tel:+919999999999">+91 99999 99999</a>
              <span>BITS Pilani, K K Birla Goa Campus, Goa</span>
            </div>
          </article>
        </div>
      </section>
    </StandardPage>
  );
}

function EventsPage() {
  const timeline = [
    {
      phase: "April 2026",
      title: "Mission Narrative and Website Launch",
      detail: "Public-facing mission framing, media system, and section architecture go live.",
    },
    {
      phase: "May 2026",
      title: "Subsystem Orientation and Team Reviews",
      detail: "Internal reviews for mission architecture, subsystem scope, and project ownership.",
    },
    {
      phase: "June 2026",
      title: "Payload and Ground Segment Workshops",
      detail: "Hands-on mini-project and payload development sessions for new contributors.",
    },
    {
      phase: "July 2026",
      title: "Partner Outreach and Technical Showcase",
      detail: "A sponsor-facing update presenting mission direction, mini-project progress, and next milestones.",
    },
  ];

  return (
    <StandardPage
      page="events"
      eyebrow="Events"
      title="A public timeline for mission activity, reviews, and milestones."
      intro="The events page tracks what Antara is doing over time, from internal reviews to workshops and sponsor-facing presentations."
    >
      <section className="page-section">
        <div className="timeline">
          {timeline.map((item) => (
            <article key={item.title} className="timeline-item">
              <p>{item.phase}</p>
              <h2>{item.title}</h2>
              <span>{item.detail}</span>
            </article>
          ))}
        </div>
      </section>
    </StandardPage>
  );
}

function MiniProjectsPage() {
  return (
    <StandardPage
      page="mini-projects"
      eyebrow="Mini-Projects"
      title="Three focused build tracks expanding the Antara ecosystem."
      intro="This page extends the main mission language into smaller engineering efforts that students can own, prototype, and grow into serious subsystems."
    >
      <section className="page-section">
        <div className="project-grid">
          {miniProjects.map((project) => (
            <article key={project.title} className="project-card">
              <p className="panel-eyebrow">{project.eyebrow}</p>
              <h2>{project.title}</h2>
              <span className="content-copy">{project.summary}</span>
              <ul className="content-list">
                {project.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
              <SmartLink className="project-card__link" href={`/${project.page}`}>
                Open Project Page
              </SmartLink>
            </article>
          ))}
        </div>
      </section>
    </StandardPage>
  );
}

function MiniProjectDetailPage({ project }: { project: MiniProject }) {
  return (
    <StandardPage page={project.page} eyebrow={project.eyebrow} title={project.title} intro={project.intro}>
      <section className="page-section">
        <div className="two-column-grid">
          <article className="content-panel">
            <p className="panel-eyebrow">Overview</p>
            <h2>{project.title}</h2>
            <p className="content-copy">{project.summary}</p>
          </article>
          <article className="content-panel content-panel--accent">
            <p className="panel-eyebrow">Focus Areas</p>
            <h2>Current direction and build scope.</h2>
            <ul className="content-list">
              {project.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
            <SmartLink className="project-card__link" href="/mini-projects">
              Back to Mini-Projects
            </SmartLink>
          </article>
        </div>
        <div className="detail-grid">
          <article className="detail-panel">
            <p className="panel-eyebrow">Systems</p>
            <h3>Core workstreams inside this track.</h3>
            <ul className="content-list">
              {project.systems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article className="detail-panel">
            <p className="panel-eyebrow">Deliverables</p>
            <h3>What this project should produce.</h3>
            <ul className="content-list">
              {project.deliverables.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article className="detail-panel">
            <p className="panel-eyebrow">Timeline</p>
            <h3>Suggested build rhythm.</h3>
            <ul className="content-list">
              {project.timeline.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </div>
      </section>
    </StandardPage>
  );
}

function NewsletterPage({ posts }: { posts: CmsPost[] }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [subscriberCount, setSubscriberCount] = useState(() => {
    const saved = JSON.parse(window.localStorage.getItem("antara-newsletter-subscribers") ?? "[]") as string[];
    return saved.length;
  });
  const liveNewsletterPosts = posts.filter((post) => post.category === "newsletter").slice(0, 6);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = email.trim().toLowerCase();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);

    if (!valid) {
      setStatus("Please enter a valid email address.");
      return;
    }

    const saved = JSON.parse(window.localStorage.getItem("antara-newsletter-subscribers") ?? "[]") as string[];
    const next = Array.from(new Set([...saved, trimmed]));
    window.localStorage.setItem("antara-newsletter-subscribers", JSON.stringify(next));
    setSubscriberCount(next.length);
    setEmail("");
    setStatus("You are on the Antara newsletter list for this prototype.");
  };

  return (
    <StandardPage
      page="newsletter"
      eyebrow="Newsletter"
      title="Monthly mission updates, directly to interested supporters and students."
      intro="This page collects subscriber emails and acts as the public home for monthly Antara newsletter issues."
    >
      <section className="page-section">
        <div className="two-column-grid">
          <article className="content-panel content-panel--accent">
            <p className="panel-eyebrow">Subscribe</p>
            <h2>Join the monthly update list.</h2>
            <form className="newsletter-form" onSubmit={handleSubmit}>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-label="Email address"
              />
              <button type="submit">Sign Up</button>
            </form>
            <p className="content-copy">{status || `${subscriberCount} subscribers saved in this local prototype.`}</p>
          </article>
          <article className="content-panel">
            <p className="panel-eyebrow">Monthly Issues</p>
            <h2>Published updates and upcoming notes.</h2>
            <div className="issue-grid">
              {liveNewsletterPosts.length > 0
                ? liveNewsletterPosts.map((post) => (
                    <article key={post.id} className="issue-card">
                      <p>{new Date(post.publishedAt).toLocaleDateString()}</p>
                      <h3>
                        <SmartLink className="issue-card__link" href={`/posts/${post.slug}`}>
                          {post.title}
                        </SmartLink>
                      </h3>
                      <span>{post.excerpt || "Newsletter entry from the CMS database."}</span>
                    </article>
                  ))
                : monthlyIssues.map((issue) => (
                    <article key={issue.title} className="issue-card">
                      <p>{issue.month}</p>
                      <h3>{issue.title}</h3>
                      <span>{issue.summary}</span>
                    </article>
                  ))}
            </div>
          </article>
        </div>
      </section>
    </StandardPage>
  );
}

function PostPage({
  slug,
  post,
  loading,
  error,
}: {
  slug: string | null;
  post: CmsPostDetail | null;
  loading: boolean;
  error: string;
}) {
  if (loading) {
    return (
      <StandardPage
        page="post"
        eyebrow="Mission Post"
        title="Loading mission post..."
        intro="Fetching article content from the Antara CMS."
      >
        <section className="page-section">
          <article className="content-panel">
            <p className="content-copy">Please wait while we load this post.</p>
          </article>
        </section>
      </StandardPage>
    );
  }

  if (error || !post) {
    return (
      <StandardPage
        page="post"
        eyebrow="Mission Post"
        title="Post not found"
        intro="This mission post may be unpublished, moved, or unavailable."
      >
        <section className="page-section">
          <article className="content-panel content-panel--accent">
            <p className="content-copy">{error || `No post found for slug: ${slug ?? "unknown"}.`}</p>
            <SmartLink className="project-card__link" href="/#blogs">
              Back to Mission Log
            </SmartLink>
          </article>
        </section>
      </StandardPage>
    );
  }

  const categoryLabel = post.category ? post.category.replace(/-/g, " ") : "post";
  const renderedContent = markdownToHtml(post.content || "");

  return (
    <StandardPage page="post" eyebrow={categoryLabel} title={post.title} intro={post.excerpt || "Mission post entry from the Antara CMS."}>
      <section className="page-section">
        <div className="post-layout">
          <article className="content-panel">
            <p className="panel-eyebrow">Published {new Date(post.publishedAt).toLocaleDateString()}</p>
            {post.coverImage ? <img className="post-cover" src={post.coverImage} alt={post.title} loading="lazy" /> : null}
            {renderedContent ? (
              <div className="post-content post-content--markdown" dangerouslySetInnerHTML={{ __html: renderedContent }} />
            ) : (
              <div className="post-content">
                <p>No content has been added to this post yet.</p>
              </div>
            )}
          </article>
          <aside className="content-panel content-panel--accent">
            <p className="panel-eyebrow">Mission Log</p>
            <h2>Explore More Entries</h2>
            <p className="content-copy">
              Continue through the main mission page for more logs, gallery items, and project updates.
            </p>
            <SmartLink className="project-card__link" href="/#blogs">
              Open Mission Log
            </SmartLink>
            {post.attachmentPath ? (
              <a className="project-card__link post-attachment-link" href={post.attachmentPath} target="_blank" rel="noreferrer">
                Open Attachment
              </a>
            ) : null}
          </aside>
        </div>
      </section>
    </StandardPage>
  );
}

function AdminPage() {
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [authStatus, setAuthStatus] = useState("");
  const [backupStatus, setBackupStatus] = useState("");
  const [posts, setPosts] = useState<CmsPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [postsError, setPostsError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [editingSlug, setEditingSlug] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [form, setForm] = useState({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    category: "blog",
    status: "published",
    publishedAt: "",
    seoTitle: "",
    seoDescription: "",
    coverImage: "",
  });

  const authHeaders = useMemo<Record<string, string>>(() => {
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }, [token]);
  const markdownPreview = useMemo(() => markdownToHtml(form.content), [form.content]);

  const resetForm = () => {
    setEditingSlug("");
    setAttachmentFile(null);
    setForm({
      title: "",
      slug: "",
      excerpt: "",
      content: "",
      category: "blog",
      status: "published",
      publishedAt: "",
      seoTitle: "",
      seoDescription: "",
      coverImage: "",
    });
  };

  const loadAdminPosts = async () => {
    if (!token) {
      return;
    }
    setLoadingPosts(true);
    setPostsError("");

    try {
      const query = new URLSearchParams({
        includeDrafts: "true",
        page: "1",
        limit: "100",
      });
      if (search.trim()) {
        query.set("search", search.trim());
      }
      if (statusFilter !== "all") {
        query.set("status", statusFilter);
      }
      const response = await fetch(`/api/posts?${query.toString()}`, {
        headers: authHeaders,
      });
      if (!response.ok) {
        if (response.status === 401) {
          window.localStorage.removeItem(ADMIN_TOKEN_KEY);
          setToken("");
          throw new Error("Session expired. Please login again.");
        }
        throw new Error("Failed to load admin posts.");
      }

      const data = (await response.json()) as PaginatedPostsResponse;
      setPosts(data.items ?? []);
    } catch (error) {
      setPostsError(error instanceof Error ? error.message : "Failed to load admin posts.");
    } finally {
      setLoadingPosts(false);
    }
  };

  useEffect(() => {
    const savedToken = window.localStorage.getItem(ADMIN_TOKEN_KEY) ?? "";
    if (savedToken) {
      setToken(savedToken);
    }
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }
    loadAdminPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, search, statusFilter]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthStatus("Signing in...");

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      if (!response.ok) {
        throw new Error("Invalid credentials.");
      }

      const data = (await response.json()) as AuthResponse;
      window.localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
      setToken(data.token);
      setPassword("");
      setAuthStatus("Authenticated. Admin session active.");
    } catch (error) {
      setAuthStatus(error instanceof Error ? error.message : "Login failed.");
    }
  };

  const handleLogout = () => {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    setToken("");
    setPosts([]);
    resetForm();
    setAuthStatus("Logged out.");
  };

  const handleEdit = async (slug: string) => {
    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(slug)}?includeDraft=true`, {
        headers: authHeaders,
      });
      if (!response.ok) {
        throw new Error("Failed to load post details.");
      }
      const data = (await response.json()) as { item?: CmsPostDetail & { isPublished?: boolean; status?: string } };
      const post = data.item;
      if (!post) {
        throw new Error("Post not found.");
      }
      setEditingSlug(slug);
      setAttachmentFile(null);
      setForm({
        title: post.title ?? "",
        slug: post.slug ?? "",
        excerpt: post.excerpt ?? "",
        content: post.content ?? "",
        category: post.category ?? "blog",
        status: post.status === "draft" || post.isPublished === false ? "draft" : "published",
        publishedAt: post.publishedAt ? new Date(post.publishedAt).toISOString().slice(0, 16) : "",
        seoTitle: post.seoTitle ?? "",
        seoDescription: post.seoDescription ?? "",
        coverImage: post.coverImage ?? "",
      });
      setAuthStatus(`Editing ${post.slug}`);
    } catch (error) {
      setAuthStatus(error instanceof Error ? error.message : "Failed to open post.");
    }
  };

  const handleDelete = async (slug: string) => {
    const confirmed = window.confirm(`Delete post "${slug}"?`);
    if (!confirmed) {
      return;
    }
    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(slug)}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      if (!response.ok) {
        throw new Error("Delete failed.");
      }
      if (editingSlug === slug) {
        resetForm();
      }
      setAuthStatus(`Deleted ${slug}`);
      loadAdminPosts();
    } catch (error) {
      setAuthStatus(error instanceof Error ? error.message : "Delete failed.");
    }
  };

  const handleStatusToggle = async (post: CmsPost) => {
    const nextStatus = post.status === "draft" || post.isPublished === false ? "published" : "draft";
    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(post.slug)}`, {
        method: "PUT",
        headers: authHeaders,
        body: (() => {
          const formData = new FormData();
          formData.set("status", nextStatus);
          return formData;
        })(),
      });
      if (!response.ok) {
        throw new Error("Status update failed.");
      }
      setAuthStatus(`Set ${post.slug} to ${nextStatus}.`);
      loadAdminPosts();
    } catch (error) {
      setAuthStatus(error instanceof Error ? error.message : "Status update failed.");
    }
  };

  const handleRunBackup = async () => {
    setBackupStatus("Running backup...");
    try {
      const response = await fetch("/api/admin/backups/run", {
        method: "POST",
        headers: authHeaders,
      });
      if (!response.ok) {
        throw new Error("Backup trigger failed.");
      }
      const data = (await response.json()) as { backupPath?: string; postCount?: number };
      setBackupStatus(`Backup completed (${data.postCount ?? 0} posts). ${data.backupPath ?? ""}`.trim());
    } catch (error) {
      setBackupStatus(error instanceof Error ? error.message : "Backup trigger failed.");
    }
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      setAuthStatus("Please login first.");
      return;
    }

    const payload = new FormData();
    payload.set("title", form.title);
    if (form.slug.trim()) {
      payload.set("slug", form.slug.trim());
    }
    payload.set("excerpt", form.excerpt);
    payload.set("content", form.content);
    payload.set("category", form.category);
    payload.set("status", form.status);
    payload.set("seoTitle", form.seoTitle);
    payload.set("seoDescription", form.seoDescription);
    payload.set("coverImage", form.coverImage);
    if (form.publishedAt) {
      payload.set("publishedAt", new Date(form.publishedAt).toISOString());
    }
    if (attachmentFile) {
      payload.set("attachment", attachmentFile);
    }

    try {
      const editing = Boolean(editingSlug);
      const endpoint = editing ? `/api/posts/${encodeURIComponent(editingSlug)}` : "/api/posts";
      const method = editing ? "PUT" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: authHeaders,
        body: payload,
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(errorBody.error || "Save failed.");
      }

      const data = (await response.json()) as { slug?: string };
      setAuthStatus(editing ? `Updated ${data.slug ?? editingSlug}` : `Created ${data.slug ?? "post"}`);
      resetForm();
      loadAdminPosts();
    } catch (error) {
      setAuthStatus(error instanceof Error ? error.message : "Save failed.");
    }
  };

  return (
    <StandardPage
      page="admin"
      eyebrow="Admin"
      title="Antara CMS Admin Dashboard"
      intro="Login to create, edit, publish, unpublish, and delete posts without manual API calls."
    >
      {!token ? (
        <section className="page-section">
          <div className="two-column-grid">
            <article className="content-panel content-panel--accent">
              <p className="panel-eyebrow">Admin Login</p>
              <h2>Restricted access</h2>
              <form className="admin-form" onSubmit={handleLogin}>
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                />
                <button type="submit">Login</button>
              </form>
              <p className="content-copy">{authStatus || "Only authenticated users can manage content."}</p>
            </article>
            <article className="content-panel">
              <p className="panel-eyebrow">Capabilities</p>
              <h2>Admin operations</h2>
              <ul className="content-list">
                <li>Create posts with draft/published states.</li>
                <li>Edit content, SEO fields, and optional attachments.</li>
                <li>Delete outdated posts and toggle publish status quickly.</li>
              </ul>
            </article>
          </div>
        </section>
      ) : (
        <section className="page-section">
          <div className="admin-toolbar">
            <div className="admin-toolbar__filters">
              <input
                type="search"
                placeholder="Search posts..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | "published" | "draft")}>
                <option value="all">All</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
              <button type="button" onClick={loadAdminPosts}>
                Refresh
              </button>
              <button type="button" onClick={handleRunBackup}>
                Run Backup
              </button>
            </div>
            <button type="button" className="admin-toolbar__logout" onClick={handleLogout}>
              Logout
            </button>
          </div>
          {backupStatus ? <p className="content-copy admin-backup-status">{backupStatus}</p> : null}

          <div className="admin-grid">
            <article className="content-panel">
              <p className="panel-eyebrow">{editingSlug ? "Edit Post" : "Create Post"}</p>
              <h2>{editingSlug ? `Editing ${editingSlug}` : "New Post"}</h2>
              <form className="admin-post-form" onSubmit={handleSave}>
                <input
                  type="text"
                  placeholder="Title *"
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  required
                />
                <input
                  type="text"
                  placeholder="Slug (lowercase-hyphen-format)"
                  value={form.slug}
                  onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value.toLowerCase() }))}
                />
                <input
                  type="text"
                  placeholder="Category"
                  value={form.category}
                  onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                />
                <select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}>
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </select>
                <input
                  type="datetime-local"
                  value={form.publishedAt}
                  onChange={(event) => setForm((prev) => ({ ...prev, publishedAt: event.target.value }))}
                />
                <textarea
                  placeholder="Excerpt"
                  value={form.excerpt}
                  onChange={(event) => setForm((prev) => ({ ...prev, excerpt: event.target.value }))}
                />
                <textarea
                  placeholder="Content"
                  value={form.content}
                  onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
                  rows={10}
                />
                <input
                  type="text"
                  placeholder="SEO Title"
                  value={form.seoTitle}
                  onChange={(event) => setForm((prev) => ({ ...prev, seoTitle: event.target.value }))}
                />
                <textarea
                  placeholder="SEO Description"
                  value={form.seoDescription}
                  onChange={(event) => setForm((prev) => ({ ...prev, seoDescription: event.target.value }))}
                />
                <input
                  type="url"
                  placeholder="Cover Image URL"
                  value={form.coverImage}
                  onChange={(event) => setForm((prev) => ({ ...prev, coverImage: event.target.value }))}
                />
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.pdf"
                  onChange={(event) => setAttachmentFile(event.target.files?.[0] ?? null)}
                />
                <div className="admin-post-form__actions">
                  <button type="submit">{editingSlug ? "Save Changes" : "Create Post"}</button>
                  <button type="button" onClick={resetForm}>
                    Clear
                  </button>
                  <button type="button" onClick={() => setShowPreview((value) => !value)}>
                    {showPreview ? "Hide Preview" : "Show Preview"}
                  </button>
                </div>
              </form>
              {showPreview ? (
                <div className="admin-markdown-preview">
                  <p className="panel-eyebrow">Markdown Preview</p>
                  {markdownPreview ? (
                    <div className="post-content post-content--markdown" dangerouslySetInnerHTML={{ __html: markdownPreview }} />
                  ) : (
                    <p className="content-copy">Write content to see a markdown preview.</p>
                  )}
                </div>
              ) : null}
            </article>

            <article className="content-panel content-panel--accent">
              <p className="panel-eyebrow">Posts</p>
              <h2>Manage existing content</h2>
              <p className="content-copy">{authStatus || "Select any post to edit or change publish status."}</p>
              {loadingPosts ? <p className="content-copy">Loading posts...</p> : null}
              {postsError ? <p className="content-copy">{postsError}</p> : null}
              <div className="admin-post-list">
                {posts.length > 0 ? (
                  posts.map((post) => (
                    <article key={post.id} className="admin-post-item">
                      <div>
                        <p>{new Date(post.publishedAt).toLocaleDateString()}</p>
                        <h3>{post.title}</h3>
                        <span>{post.status || (post.isPublished ? "published" : "draft")}</span>
                      </div>
                      <div className="admin-post-item__actions">
                        <button type="button" onClick={() => handleEdit(post.slug)}>
                          Edit
                        </button>
                        <button type="button" onClick={() => handleStatusToggle(post)}>
                          Toggle Status
                        </button>
                        <button type="button" onClick={() => handleDelete(post.slug)}>
                          Delete
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="content-copy">No posts found for this filter.</p>
                )}
              </div>
            </article>
          </div>
        </section>
      )}
    </StandardPage>
  );
}

export default function App() {
  const [route, setRoute] = useState<RouteInfo>(() => getRouteFromLocation());
  const [posts, setPosts] = useState<CmsPost[]>([]);
  const [postsError, setPostsError] = useState("");
  const [postDetail, setPostDetail] = useState<CmsPostDetail | null>(null);
  const [postDetailError, setPostDetailError] = useState("");
  const [postDetailLoading, setPostDetailLoading] = useState(false);
  const { page, postSlug } = route;

  useEffect(() => {
    const onLocationChange = () => {
      const nextRoute = getRouteFromLocation();
      setRoute(nextRoute);

      requestAnimationFrame(() => {
        const hash = window.location.hash;
        const isSectionHash = hash && !hash.startsWith("#/");

        if (nextRoute.page === "home" && isSectionHash && scrollToHashTarget(hash)) {
          return;
        }

        const lenis = getLenis();
        if (lenis) {
          lenis.scrollTo(0, { immediate: true });
          return;
        }

        window.scrollTo({ top: 0, behavior: "auto" });
      });
    };

    window.addEventListener("hashchange", onLocationChange);
    window.addEventListener("popstate", onLocationChange);
    return () => {
      window.removeEventListener("hashchange", onLocationChange);
      window.removeEventListener("popstate", onLocationChange);
    };
  }, []);

  useEffect(() => {
    if (page === "home" && window.location.hash && !window.location.hash.startsWith("#/")) {
      requestAnimationFrame(() => {
        scrollToHashTarget(window.location.hash);
      });
    }
  }, [page]);

  useEffect(() => {
    let active = true;

    const loadPosts = async () => {
      try {
        const response = await fetch("/api/posts?page=1&limit=60");
        if (!response.ok) {
          throw new Error("Failed to load posts");
        }
        const data = (await response.json()) as PaginatedPostsResponse;
        if (active) {
          setPosts(data.items ?? []);
          setPostsError("");
        }
      } catch (error) {
        if (active) {
          setPostsError(error instanceof Error ? error.message : "Failed to load posts");
        }
      }
    };

    loadPosts();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (page !== "post" || !postSlug) {
      setPostDetail(null);
      setPostDetailError("");
      setPostDetailLoading(false);
      return;
    }

    let active = true;
    setPostDetailLoading(true);
    setPostDetailError("");

    const loadPostDetail = async () => {
      try {
        const response = await fetch(`/api/posts/${encodeURIComponent(postSlug)}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Post not found.");
          }
          throw new Error("Failed to load post.");
        }

        const data = (await response.json()) as { item?: CmsPostDetail };
        if (active) {
          setPostDetail(data.item ?? null);
        }
      } catch (error) {
        if (active) {
          setPostDetail(null);
          setPostDetailError(error instanceof Error ? error.message : "Failed to load post.");
        }
      } finally {
        if (active) {
          setPostDetailLoading(false);
        }
      }
    };

    loadPostDetail();
    return () => {
      active = false;
    };
  }, [page, postSlug]);

  useEffect(() => {
    const metaByPage: Record<Exclude<PageId, "post">, { title: string; description: string }> = {
      home: {
        title: "Project Antara | Student-Built CubeSat Mission",
        description: "Project Antara is a BITS Goa student-built CubeSat mission focused on radiation studies, systems engineering, and mission storytelling.",
      },
      partners: {
        title: "Partners | Project Antara",
        description: "Support Project Antara through sponsorship, technical collaboration, and mission partnership opportunities.",
      },
      events: {
        title: "Events | Project Antara",
        description: "Track Antara events, reviews, workshops, and mission timeline milestones.",
      },
      "mini-projects": {
        title: "Mini-Projects | Project Antara",
        description: "Explore Antara mini-project tracks across Ground Station, Payload Development, and ADCS.",
      },
      "ground-station": {
        title: "Ground Station Mini-Project | Project Antara",
        description: "Ground Station mini-project scope, systems, deliverables, and implementation timeline.",
      },
      "payload-development": {
        title: "Payload Development Mini-Project | Project Antara",
        description: "Payload Development mini-project details, architecture focus, and deliverables.",
      },
      adcs: {
        title: "ADCS Mini-Project | Project Antara",
        description: "Attitude Control and Determination System mini-project details and roadmap.",
      },
      newsletter: {
        title: "Newsletter | Project Antara",
        description: "Subscribe to Project Antara monthly updates and mission progress newsletters.",
      },
      admin: {
        title: "Admin Dashboard | Project Antara",
        description: "Authenticated Project Antara CMS dashboard for creating and managing mission posts.",
      },
    };

    const upsertMeta = (name: string, content: string, property = false) => {
      const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
      let tag = document.head.querySelector(selector) as HTMLMetaElement | null;
      if (!tag) {
        tag = document.createElement("meta");
        if (property) {
          tag.setAttribute("property", name);
        } else {
          tag.setAttribute("name", name);
        }
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", content);
    };

    const removeMeta = (name: string, property = false) => {
      const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
      const tag = document.head.querySelector(selector);
      if (tag) {
        tag.remove();
      }
    };

    const upsertCanonical = (href: string) => {
      let canonical = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (!canonical) {
        canonical = document.createElement("link");
        canonical.setAttribute("rel", "canonical");
        document.head.appendChild(canonical);
      }
      canonical.setAttribute("href", href);
    };

    const upsertJsonLd = (payload: Record<string, unknown>) => {
      let script = document.head.querySelector("#antara-jsonld") as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.id = "antara-jsonld";
        script.type = "application/ld+json";
        document.head.appendChild(script);
      }
      script.text = JSON.stringify(payload);
    };

    const removeJsonLd = () => {
      const script = document.head.querySelector("#antara-jsonld");
      if (script) {
        script.remove();
      }
    };

    if (page === "post") {
      const fallbackTitle = postSlug ? `${postSlug.replace(/-/g, " ")} | Project Antara` : "Mission Post | Project Antara";
      const postTitle = postDetail?.seoTitle || postDetail?.title || fallbackTitle;
      const postDescription = postDetail?.seoDescription || postDetail?.excerpt || "Mission post from Project Antara.";
      const postUrlPath = postSlug ? `/posts/${encodeURIComponent(postSlug)}` : "/posts";
      const postUrl = new URL(postUrlPath, window.location.origin).toString();

      document.title = postTitle;
      upsertMeta("description", postDescription);
      upsertMeta("og:title", postTitle, true);
      upsertMeta("og:description", postDescription, true);
      upsertMeta("og:type", "article", true);
      upsertMeta("og:url", postUrl, true);
      upsertCanonical(postUrl);

      if (postDetail?.coverImage) {
        upsertMeta("og:image", postDetail.coverImage, true);
      } else {
        removeMeta("og:image", true);
      }

      if (postDetail?.publishedAt) {
        upsertMeta("article:published_time", postDetail.publishedAt, true);
      } else {
        removeMeta("article:published_time", true);
      }

      if (postDetail) {
        upsertJsonLd({
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: postDetail.title,
          description: postDescription,
          datePublished: postDetail.publishedAt,
          dateModified: postDetail.updatedAt || postDetail.publishedAt,
          mainEntityOfPage: postUrl,
          url: postUrl,
          image: postDetail.coverImage || undefined,
          publisher: {
            "@type": "Organization",
            name: "Project Antara",
          },
        });
      } else {
        removeJsonLd();
      }
      return;
    }

    removeMeta("og:image", true);
    removeMeta("article:published_time", true);
    removeJsonLd();

    const pageMeta = metaByPage[page];
    document.title = pageMeta.title;
    upsertMeta("description", pageMeta.description);
    upsertMeta("og:title", pageMeta.title, true);
    upsertMeta("og:description", pageMeta.description, true);
    upsertMeta("og:type", "website", true);
    upsertMeta("og:url", new URL(window.location.pathname || "/", window.location.origin).toString(), true);
    upsertCanonical(new URL(window.location.pathname || "/", window.location.origin).toString());
  }, [page, postSlug, postDetail]);

  const pageNode = useMemo(() => {
    switch (page) {
      case "partners":
        return <PartnersPage />;
      case "events":
        return <EventsPage />;
      case "mini-projects":
        return <MiniProjectsPage />;
      case "ground-station":
        return <MiniProjectDetailPage project={miniProjects[0]} />;
      case "payload-development":
        return <MiniProjectDetailPage project={miniProjects[1]} />;
      case "adcs":
        return <MiniProjectDetailPage project={miniProjects[2]} />;
      case "newsletter":
        return <NewsletterPage posts={posts} />;
      case "admin":
        return <AdminPage />;
      case "post":
        return <PostPage slug={postSlug} post={postDetail} loading={postDetailLoading} error={postDetailError} />;
      default:
        return <HomePage posts={posts} />;
    }
  }, [page, postSlug, posts, postDetail, postDetailError, postDetailLoading]);

  if (postsError && page === "home") {
    console.warn("CMS posts unavailable:", postsError);
  }

  return pageNode;
}
