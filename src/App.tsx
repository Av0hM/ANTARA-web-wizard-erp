import { animate, stagger } from "animejs";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AnchorHTMLAttributes,
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent,
  ReactNode,
} from "react";
import { Document, Page } from "react-pdf";
import antarLogo from "./assets/ANTARA_logo_badge-modified.png";
import { VideoScrubber } from "./components/VideoScrubber";
import "./App.css";

gsap.registerPlugin(ScrollTrigger);

// Configure pdf.js worker
if (typeof window !== 'undefined') {
  import('pdfjs-dist').then((pdfjsLib) => {
    if (pdfjsLib.GlobalWorkerOptions) {
      import('pdfjs-dist/build/pdf.worker.min.mjs').then((module) => {
        pdfjsLib.GlobalWorkerOptions.workerSrc = module.default;
      }).catch(() => {
        // Fallback to CDN
        pdfjsLib.GlobalWorkerOptions.workerSrc = 
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';
      });
    }
  });
}

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
  points: string[];
  cards: {
    eyebrow: string;
    title: string;
    summary: string;
    tone: "rust" | "gold" | "teal" | "slate";
  }[];
  images?: ViewerImage[];
};

type ViewerImage = {
  title: string;
  caption: string;
  src: string;
  alt: string;
  details: string[];
};

type GalleryAlbum = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  coverImage?: string;
  attachmentPath?: string;
  attachmentThumbnailPath?: string;
  galleryImages?: {
    id: string;
    src: string;
    thumbnailSrc?: string;
    caption: string;
    alt: string;
    order: number;
  }[];
  publishedAt: string;
  isPublished: boolean;
  status?: "draft" | "published";
  createdAt: string;
  updatedAt: string;
};

type GalleryAlbumResponse = {
  items?: GalleryAlbum[];
  pagination?: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
  };
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

type NewsletterIssue = {
  month: string;
  title: string;
  summary: string;
  pdfUrl: string;
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
    eyebrow: "From BITS Pilani, Goa",
    title: "Project Antara",
    copy: ["Under-Grad students. One satellite. It all starts here."],
    align: "center",
  },
  {
    id: "title",
    eyebrow: "What We're Building",
    title: "The Mission",
    copy: ["A student-built CubeSat designed to study radiation in Low Earth Orbit."],
    align: "right",
  },
  {
    id: "anomaly",
    eyebrow: "The Target",
    title: "The South Atlantic Anomaly",
    copy: ["A region where Earth's magnetic field dips and trapped radiation surges close to the surface. It's one of the most challenging zones any spacecraft can cross."],
    align: "left",
  },
  // {
  //   id: "orbit",
  //   eyebrow: "Where We're Heading",
  //   title: "Low Earth Orbit",
  //   copy: [
  //     "400 to 600 kilometers up, the environment offers zero margin for error.",
  //     "Space weather is highly unpredictable, and radiation levels are far from uniform.",
  //   ],
  //   align: "right",
  // }
  // ,
  {
    id: "entry",
    eyebrow: "Our Focus",
    title: "Antara Navigates the Anomaly",
    copy: ["We're building a payload to measure high-energy trapped protons, pass by pass, orbit by orbit."],
    align: "left",
  },
  { 
    id: "payload",
    eyebrow: "The Hardware",
    title: "What We're Flying",
    copy: ["A compact detector stack. Shielding. Electronics custom built and tested.", "Built to brave the environment it's bound to survive."],
    align: "right",
  },
  // {
  //   id: "systems",
  //   eyebrow: "How It Comes Together",
  //   title: "One Coordinated System",
  //   copy: ["The payload, ADCS, and ground station operating in unison to conquer the unique challenges of orbital flight."],
  //   align: "center",
  // },
  {
    id: "data",
    eyebrow: "What We'll Learn",
    title: "Radiation Data That Doesn't Exist Yet",
    copy: ["Capturing raw, unmapped spatial variations and energy distributions to unlock new insights into the SAA radiation zone."],
    align: "left",
  },
  {
    id: "students",
    eyebrow: "Who We Are",
    title: "From Code to Orbit",
    copy: ["Under-Grad students, each accountable for the work that makes this mission real."],
    align: "right",
  },
  // {
  //   id: "finale",
  //   eyebrow: "The Beginning",
  //   title: "The Blueprint for next-gen Aerospace",
  //   copy: ["Antara proves that when students commit to the work, they can deliver groundbreaking orbital science."],
  //   align: "center",
  // },
];
const missionTimeline: {
  id: string;
  label: string;
  sub: string;
  status: "done" | "current" | "upcoming";
}[] = [
  { id: "concept",   label: "Mission Concept",             sub: "Team formed, scope defined",         status: "done"     },
  { id: "pdr",       label: "Preliminary Design Review",   sub: "System architecture locked",         status: "current"  },
  { id: "cdr",       label: "Critical Design Review",      sub: "Subsystem designs finalised",        status: "upcoming" },
  { id: "build",     label: "Build & Integration",         sub: "Hardware fabrication and testing",   status: "upcoming" },
  { id: "lrr",       label: "Launch Readiness Review",     sub: "Final qualification",                status: "upcoming" },
  { id: "launch",    label: "Launch",                      sub: "To Low Earth Orbit",                 status: "upcoming" },
];

const archiveSections: ArchiveSection[] = [
  {
    id: "about",
    eyebrow: "The Operational Core",
    title: "A student mission built with research intent and engineering discipline.",
    points: [
      "Focused on radiation measurement in LEO, with special attention to the South Atlantic Anomaly, one of the most operationally significant regions for spacecraft.",
      "Designed to connect payload science, spacecraft systems, and ground operations into one integrated engineering program that students own end to end.",
      "Developing an orbital research platform built from day one to be legible, verifiable, and genuinely useful to the broader aerospace ecosystem.",
    ],
    cards: [
      {
        eyebrow: "Scientific Contribution",
        title: "Real science demands real hardware.",
        summary:
          "By generating unprecedented datasets on SAA trapped proton behavior, our student-built detector transitions this project from an educational exercise into active aerospace research.",
        tone: "rust",
      },
      {
        eyebrow: "What Makes This Different",
        title: "Dual-Impact Engineering.",
        summary:
          "We are a research platform and a training ground in one, preparing the next generation of aerospace leaders by giving them complete ownership of a live orbital mission.",
        tone: "gold",
      },
    ],
  },
  {
    id: "mission",
    eyebrow: "Flight Archive",
    title: "The science, the systems, and why this mission is worth flying.",
    points: [
      "The core objective: measure trapped proton flux and energy distribution as Antara passes through the South Atlantic Anomaly across multiple orbital segments.",
      "The spacecraft brings together a custom payload stack, an attitude determination and control system, and a ground station, all designed to work as one.",
      "The data output isn't raw telemetry. It's calibrated, interpreted, and built to be useful to mission designers beyond the team that collected it.",
    ],
    cards: [
      {
        eyebrow: "Scientific Objective",
        title: "Measure radiation where it becomes operationally dangerous.",
        summary:
          "The South Atlantic Anomaly is where trapped particles come closest to Earth's surface. Understanding its structure, pass by pass, is the mission.",
        tone: "teal",
      },
      {
        eyebrow: "What We Deliver",
        title: "Measurements that become something someone can use.",
        summary:
          "Antara's payload story ends in data products, flux curves, energy distributions, spatial maps, not just hardware photos and block diagrams.",
        tone: "slate",
      },
    ],
  },
  {
    id: "team",
    eyebrow: "The Team",
    title: "Under-Grad students building a satellite, one subsystem at a time.",
    points: [
      "Payload and instrumentation members focused on detector design, shielding trade-offs, electronics integration, and data quality from the first measurement to the last.",
      "ADCS, power, structures, and onboard systems contributors who are turning mission requirements into a spacecraft that can actually survive orbit.",
      "Ground station, outreach, and communications contributors who make sure the mission is legible, to the public, to sponsors, and to the students who will join after us.",
    ],
    cards: [
      {
        eyebrow: "Ownership",
        title: "True Accountabilty.",
        summary:
          "Not just contributing, owning. The team is structured so that engineering decisions have clear authors and can be reviewed, defended, and improved.",
        tone: "gold",
      },
      {
        eyebrow: "Culture",
        title: "We're not performing a space mission. We're building one.",
        summary:
          "The difference shows in the details, in the test reports, the design reviews, the late nights debugging something that has to work before launch.",
        tone: "rust",
      },
    ],
  },
  {
    id: "blogs",
    eyebrow: "Mission Log",
    title: "Progress notes, build updates, and the occasional hard lesson.",
    points: [
      "Weekly and biweekly build logs covering prototypes, design reviews, fabrication runs, and subsystem milestones as they happen.",
      "Technical explainers for anyone who wants to understand the payload physics, the orbital mechanics, or the systems architecture without having to dig through a thesis.",
      "Public updates that keep sponsors, collaborators, and prospective team members close to the actual state of the mission, not a polished version of it.",
    ],
    cards: [
      {
        eyebrow: "Editorial Standard",
        title: "Real-time Technical Documentation.",
        summary:
          "Space is hard, and engineering is messy. This is our unfiltered record of fabrication, failures, and milestones as we build a mission that matters",
        tone: "slate",
      },
      {
        eyebrow: "Cadence",
        title: "A live mission should feel like one.",
        summary:
          "Even short updates matter. They show that people are working, that things are moving, and that the satellite is closer to orbit than it was last month.",
        tone: "teal",
      },
    ],
  },
];
       
const miniProjects: MiniProject[] = [
  {
    page: "ground-station",
    eyebrow: "Mini-Project 01",
    title: "Ground Station",
    summary:
      "Build the communications and operations layer that lets the mission speak back to Earth. Tracking, signal flow, telemetry handling, and the interfaces that a student team can actually operate.",
    intro:
      "The ground station track is about building the infrastructure that connects Antara to the team on the ground. Tracking, telemetry, and the operational discipline to use both.",
    bullets: [
      "Antenna selection and tracking workflow design",
      "Telemetry visualisation and downlink architecture",
      "Student operations planning and mission rehearsal",
    ],
    systems: [
      "Tracking workflow and antenna planning",
      "Telemetry visualisation and downlink architecture",
      "Student operations planning and mission rehearsal",
    ],
    deliverables: [
      "A pass-planning dashboard prototype a student operator can actually use",
      "A structured telemetry display workflow with documented assumptions",
      "A ground-ops checklist built for the Antara team, not a generic one",
    ],
    timeline: [
      "Research and ground station architecture mapping",
      "Prototype telemetry and tracking visualisations",
      "Operations validation and workflow testing with the full team",
    ],
  },
  {
    page: "payload-development",
    eyebrow: "Mini-Project 02",
    title: "Payload Development",
    summary:
      "Design the detector stack, make shielding decisions, integrate the electronics, and build the pipeline that turns raw measurements into usable science.",
    intro:
      "The payload is where Antara's science lives. This track is about understanding the detector, making real shielding decisions, and building the data pipeline from the first measurement to the final product.",
    bullets: [
      "Detector and shielding trade studies grounded in the mission environment",
      "Electronics packaging and interface design",
      "Calibration workflows and data interpretation pipelines",
    ],
    systems: [
      "Detector stack architecture and component selection",
      "Shielding analysis and electronics packaging",
      "Data handling, calibration, and quality workflow",
    ],
    deliverables: [
      "Payload packaging concept drawings with dimensions and interface notes",
      "Detector and shielding trade study documentation",
      "A draft pipeline for translating raw measurements into interpretable plots",
    ],
    timeline: [
      "Detector concept and requirements definition",
      "Electronics and shielding packaging iteration",
      "Data readout, calibration, and interpretation review",
    ],
  },
  {
    page: "adcs",
    eyebrow: "Mini-Project 03",
    title: "Attitude Control and Determination",
    summary:
      "Understand how a spacecraft knows where it's pointing and how it gets there. Sensors, actuators, control logic, and the simulation environment to validate all of it.",
    intro:
      "The ADCS track is about understanding how a spacecraft knows where it's pointing and how it corrects itself when it doesn't. Sensors, actuators, control logic, and the simulation environment to test all of it before anything flies.",
    bullets: [
      "Sensor and actuator architecture for a CubeSat in LEO",
      "Pointing logic and onboard control concepts",
      "Simulation-driven systems validation",
    ],
    systems: [
      "Sensing and state estimation, knowing where you are before you try to move",
      "Actuator selection and control logic",
      "Simulation and validation environment for orientation testing",
    ],
    deliverables: [
      "An ADCS architecture map with sensor and actuator selections justified",
      "Initial control-loop concept documentation",
      "A simulation outline for orientation and disturbance testing",
    ],
    timeline: [
      "Requirements review and disturbance environment study",
      "Sensor-actuator trade exploration and selection",
      "Control loop validation and systems-level review",
    ],
  },
];

const monthlyIssues: NewsletterIssue[] = [
  {
    month: "June 2026",
    title: "What is Antara?",
    summary:
      "The first issue. Where the mission came from, what we're building, and who is building it, written for anyone who's just heard of us.",
    pdfUrl: "/newsletter.pdf",
  },
  {
    month: "July 2026",
    title: "Structures, Integration, and the Timeline Ahead",
    summary:
      "Integration status, subsystem ownership, milestone planning, and what it actually takes to get a student satellite ready for launch review.",
    pdfUrl: "/newsletter.pdf",
  },
];

const homeNavItems: {
  label: string;
  section: string;
  href: string;
}[] = [
  { label: "About", section: "about", href: "/#about" },
  { label: "Mission", section: "mission", href: "/#mission" },
  { label: "Partners", section: "partners", href: "/partners" },
  { label: "Mini-Projects", section: "mini-projects", href: "/mini-projects" },
  { label: "Team", section: "team", href: "/#team" },
  { label: "Contact", section: "contact", href: "/#footer" },
];

const sideMenuItems: { label: string; page: PageId; href: string }[] = [
  { label: "Gallery", page: "home", href: "/#gallery" },
  { label: "Logs", page: "home", href: "/#blogs" },
  { label: "Newsletter", page: "newsletter", href: "/newsletter" },
];

const ADMIN_TOKEN_KEY = "antara-admin-token";

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

const sceneVisibility = (progress: number, index: number, total: number) => {
  const start = index / total;
  const end = (index + 1) / total;
  const local = clamp((progress - start) / (end - start));
  const centered = 1 - Math.abs(local * 2 - 1);
  return 0.92 + centered * 0.08;
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
    .replace(
      /```([\s\S]*?)```/g,
      (_match, code) => `<pre><code>${code.trim()}</code></pre>`,
    )
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
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noreferrer">$1</a>',
    );

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

const createPlaceholderImage = (
  title: string,
  caption: string,
  accent = "#b56f38",
) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" role="img" aria-label="${escapeHtml(
      title,
    )}">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#11161d" />
          <stop offset="100%" stop-color="#1a2230" />
        </linearGradient>
        <linearGradient id="accent" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.95" />
          <stop offset="100%" stop-color="#f2e7d3" stop-opacity="0.25" />
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#bg)" />
      <rect x="52" y="52" width="1096" height="696" rx="28" fill="none" stroke="url(#accent)" stroke-width="3" />
      <circle cx="280" cy="266" r="132" fill="${accent}" fill-opacity="0.14" />
      <circle cx="874" cy="498" r="178" fill="${accent}" fill-opacity="0.11" />
      <path d="M124 556 C 274 478, 362 420, 534 428 S 870 560, 1072 384" fill="none" stroke="url(#accent)" stroke-width="10" stroke-linecap="round" />
      <text x="88" y="150" fill="#f4efe6" font-family="Arial, sans-serif" font-size="40" letter-spacing="6">${escapeHtml(
        title,
      )}</text>
      <text x="88" y="210" fill="#d8d1c5" font-family="Arial, sans-serif" font-size="22" letter-spacing="2">${escapeHtml(
        caption,
      )}</text>
      <text x="88" y="702" fill="#aeb8c6" font-family="Arial, sans-serif" font-size="18" letter-spacing="4">TEAM IMAGE PLACEHOLDER</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const teamArchiveImages: ViewerImage[] = [
  {
    title: "Subsystem Owner",
    caption: "Placeholder portrait for a team lead or subsystem owner.",
    src: createPlaceholderImage("Subsystem Owner", "Placeholder portrait"),
    alt: "Team image placeholder for subsystem owner",
    details: [
      "Replace this placeholder with a real team image when the roster is ready.",
      "The viewer supports full-screen navigation, zoom, rotation, and downloads.",
    ],
  },
  {
    title: "Payload Bench",
    caption: "Placeholder image for integration and hardware work.",
    src: createPlaceholderImage("Payload Bench", "Integration bench", "#8d7d66"),
    alt: "Team image placeholder for payload bench",
    details: [
      "Use this slot for a hardware or integration photo from the mission build.",
      "All team placeholders use the same viewer as the gallery assets.",
    ],
  },
  {
    title: "Systems Review",
    caption: "Placeholder image for reviews, diagrams, and whiteboard sessions.",
    src: createPlaceholderImage("Systems Review", "Design review", "#667d78"),
    alt: "Team image placeholder for systems review",
    details: [
      "This can become a design review, team photo, or subsystem workshop image.",
      "The viewer includes arrows for moving between all team images.",
    ],
  },
  {
    title: "Mission Crew",
    caption: "Placeholder image for the broader Antara crew.",
    src: createPlaceholderImage("Mission Crew", "Mission crew", "#c08c49"),
    alt: "Team image placeholder for mission crew",
    details: [
      "Swap in real portraits or event images when they are available.",
      "The image viewer exposes the same controls for every collection.",
    ],
  },
];

const teamArchiveSection = archiveSections.find((section) => section.id === "team");
if (teamArchiveSection) {
  teamArchiveSection.images = teamArchiveImages;
}

type LenisLike = {
  scrollTo: (
    target: number | string | HTMLElement,
    options?: {
      offset?: number;
      duration?: number;
      immediate?: boolean;
      lock?: boolean;
    },
  ) => void;
};

const getLenis = () =>
  (window as Window & { __antaraLenis?: LenisLike }).__antaraLenis;

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

  target.scrollIntoView({
    behavior: immediate ? "auto" : "smooth",
    block: "start",
  });
  return true;
};

function SmartLink({
  href = "",
  onClick,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
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
      window.history.pushState(
        {},
        "",
        href.startsWith("#") ? `/${hash}` : href,
      );
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

function SiteHeader({
  progress,
  menuOpen,
  onToggleMenu,
  navBehavior,
  activeSection = "",
}: {
  progress: number;
  menuOpen: boolean;
  onToggleMenu: () => void;
  navBehavior: "scroll" | "always";
  activeSection?: string;
}) {
  const [showFloatingNav, setShowFloatingNav] = useState(
    navBehavior === "always",
  );
  const [miniProjectsMenuOpen, setMiniProjectsMenuOpen] = useState(false);
  const previousYRef = useRef(0);
  const currentPath =
    typeof window !== "undefined"
      ? window.location.pathname.replace(/\/+$/, "") || "/"
      : "/";
  const isMiniProjectsRoute = [
    "/mini-projects",
    "/ground-station",
    "/payload-development",
    "/adcs",
  ].includes(currentPath);
  const miniProjectsActive = miniProjectsMenuOpen || isMiniProjectsRoute;
  const sceneIndex =
    navBehavior === "scroll" ? Math.min(Math.floor(progress * 10), 9) : 0;
  const sceneLabel =
    navBehavior === "scroll" && progress >= 1
      ? "Archive"
      : `Scene ${sceneIndex + 1} / 10`;

  useEffect(() => {
    if (!miniProjectsMenuOpen) {
      return;
    }

    const handleDocumentClick = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".mission-hud__dropdown")) {
        return;
      }
      setMiniProjectsMenuOpen(false);
    };

    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, [miniProjectsMenuOpen]);

  useEffect(() => {
    if (navBehavior === "always") {
      return;
    }

    const onScroll = () => {
      const currentY = window.scrollY;
      const previousY = previousYRef.current;
      const nearTop = currentY < 30;
      const scrollingDown = currentY > previousY;

      if (nearTop) {
        setShowFloatingNav(true);
      } else {
        setShowFloatingNav(!scrollingDown);
      }

      previousYRef.current = currentY;
    };

    previousYRef.current = window.scrollY;
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [navBehavior]);

  return (
    <>
      <header className="mission-hud-panel" aria-label="Site controls">
        <button
          type="button"
          className="mission-hud__menu-toggle"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          aria-controls="side-menu-panel"
          onClick={onToggleMenu}
        >
          <svg
            className="mission-hud__menu-icon"
            viewBox="0 0 18 14"
            aria-hidden="true"
          >
            <line x1="0.75" y1="1" x2="17.25" y2="1" />
            <line x1="0.75" y1="7" x2="17.25" y2="7" />
            <line x1="0.75" y1="13" x2="17.25" y2="13" />
          </svg>
        </button>
        <SmartLink
          className="mission-hud__brand mission-hud__brand-link"
          href="/"
        >
          <span>Project Antara</span>
        </SmartLink>
        <div className="mission-hud__progress">
          <div className="mission-hud__meter" aria-hidden="true">
            <span style={{ transform: `scaleX(${Math.max(progress, 0.02)})` }} />
          </div>
          {navBehavior === "scroll" ? (
            <div className="mission-hud__scene-counter" aria-hidden="true">
              {sceneLabel}
            </div>
          ) : null}
        </div>
      </header>

      <nav
        className={`mission-hud-nav-float${showFloatingNav ? " is-visible" : ""}`}
        aria-label="Primary"
      >
        {homeNavItems
          .filter((item) => item.label !== "Journey")
          .map((item) => {
          if (item.label !== "Mini-Projects") {
            return (
              <SmartLink
                key={item.label}
                className={`mission-hud__link${item.section === activeSection ? " is-active" : ""}`}
                href={item.href}
              >
                {item.label}
              </SmartLink>
            );
          }

          return (
            <div key={item.label} className="mission-hud__dropdown">
              <button
                type="button"
                className={`mission-hud__dropdown-toggle${miniProjectsActive ? " is-active" : ""}`}
                aria-expanded={miniProjectsMenuOpen}
                onClick={(event) => {
                  event.preventDefault();
                  setMiniProjectsMenuOpen((value) => !value);
                }}
              >
                {item.label}
              </button>
              <div
                className={`mission-hud__dropdown-menu${miniProjectsMenuOpen ? " is-open" : ""}`}
              >
                <SmartLink
                  className="mission-hud__dropdown-link"
                  href={item.href}
                  onClick={() => setMiniProjectsMenuOpen(false)}
                >
                  Overview
                </SmartLink>
                {miniProjects.map((project) => (
                  <SmartLink
                    key={project.page}
                    className="mission-hud__dropdown-link"
                    href={`/${project.page}`}
                    onClick={() => setMiniProjectsMenuOpen(false)}
                  >
                    {project.title}
                  </SmartLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>
    </>
  );
}
function SideMenu({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const currentPath =
    typeof window !== "undefined"
      ? window.location.pathname.replace(/\/+$/, "") || "/"
      : "/";
  const currentHash = typeof window !== "undefined" ? window.location.hash : "";
  const menuRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: Event) => {
      const target = event.target as Node | null;
      if (!target || menuRef.current?.contains(target)) {
        return;
      }

      onClose();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [open, onClose]);

  const isSidebarActive = (item: { label: string; href: string }) => {
    if (item.label === "Gallery") {
      return currentPath === "/" && currentHash === "#gallery";
    }

    if (item.label === "Logs") {
      return currentPath === "/" && currentHash === "#blogs";
    }

    if (item.label === "Newsletter") {
      return currentPath === "/newsletter";
    }

    return false;
  };

  return (
    <>
      <aside
        ref={menuRef}
        className={`side-menu${open ? " is-open" : ""}`}
        id="side-menu-panel"
        aria-label="Site pages"
      >
        <p className="side-menu__eyebrow">Site</p>
        <div className="side-menu__list">
          {sideMenuItems.map((item) => {
            const active = isSidebarActive(item);
            return (
              <SmartLink
                key={item.label}
                className={`side-menu__link${active ? " is-active" : ""}`}
                href={item.href}
                onClick={onClose}
              >
                {item.label}
              </SmartLink>
            );
          })}
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
        <h4>A student-built CubeSat mission from BITS Goa.</h4>
        <p>
          Under-Grad students. One satellite. One very specific region of
          space we're trying to understand. Antara is a radiation science
          mission built by the people it's training.
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
        <a href="mailto:project.antara.25@gmail.com">
          project.antara.25@gmail.com
        </a>
        <a href="https://www.linkedin.com/company/project-antara">
          LinkedIn: project-antara
        </a>
        <a href="https://www.instagram.com/antara_bpgc">
          Instagram: antara_bpgc
        </a>
        <span>BITS Pilani, K K Birla Goa Campus</span>
        <span>Zuarinagar, Goa 403726</span>
      </div>

      <div className="site-footer__column">
        <p className="site-footer__heading">What Antara Is</p>
        <span>A CubeSat radiation science mission</span>
        <span>Student-built at BITS Goa</span>
        <span>Focused on the South Atlantic Anomaly</span>
        <span>23 members, actively building</span>
      </div>
    </footer>
  );
}

function ImageViewer({
  title,
  items,
  initialIndex,
  onClose,
}: {
  title: string;
  items: ViewerImage[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setCurrentIndex((value) => (value - 1 + items.length) % items.length);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setCurrentIndex((value) => (value + 1) % items.length);
        return;
      }
      if (event.key === "=" || event.key === "+") {
        event.preventDefault();
        setZoom((value) => Math.min(value + 0.2, 3));
        return;
      }
      if (event.key === "-") {
        event.preventDefault();
        setZoom((value) => Math.max(value - 0.2, 0.6));
        return;
      }
      if (event.key === "0") {
        event.preventDefault();
        setZoom(1);
        setRotation(0);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [items.length, onClose]);

  const current = items[currentIndex];
  if (!current) {
    return null;
  }

  const goTo = (direction: number) => {
    setCurrentIndex(
      (value) => (value + direction + items.length) % items.length,
    );
  };

  return (
    <section className="image-viewer" role="dialog" aria-modal="true">
      <button
        type="button"
        className="image-viewer__backdrop"
        aria-label="Close viewer"
        onClick={onClose}
      />
      <div className="image-viewer__shell">
        <div className="image-viewer__stage">
          <button
            type="button"
            className="image-viewer__tab image-viewer__tab--left"
            aria-label="Previous image"
            onClick={() => goTo(-1)}
          >
            ‹
          </button>
          <figure className="image-viewer__figure">
            <img
              src={current.src}
              alt={current.alt}
              className="image-viewer__image"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
              }}
            />
          </figure>
          <button
            type="button"
            className="image-viewer__tab image-viewer__tab--right"
            aria-label="Next image"
            onClick={() => goTo(1)}
          >
            ›
          </button>
        </div>

        <div className="image-viewer__panel">
          <div className="image-viewer__panel-head">
            <div>
              <p className="panel-eyebrow">{title}</p>
              <h3>{current.title}</h3>
              <p className="content-copy">{current.caption}</p>
            </div>
            <button
              type="button"
              className="image-viewer__close"
              onClick={onClose}
            >
              Close
            </button>
          </div>

          <div className="image-viewer__toolbar" aria-label="Image controls">
            <div className="image-viewer__toolbar-group">
              <button type="button" onClick={() => setZoom((value) => Math.max(0.6, value - 0.2))}>
                −
              </button>
              <span className="image-viewer__toolbar-separator" aria-hidden="true" />
              <button type="button" onClick={() => setZoom((value) => Math.min(3, value + 0.2))}>
                +
              </button>
            </div>
            <div className="image-viewer__toolbar-group image-viewer__toolbar-group--spaced">
              <button type="button" onClick={() => setZoom(1)}>
                Reset
              </button>
            </div>
            <div className="image-viewer__toolbar-group image-viewer__toolbar-group--spaced">
              <button type="button" onClick={() => setRotation((value) => value - 90)}>
                ↺
              </button>
              <button type="button" onClick={() => setRotation((value) => value + 90)}>
                ↻
              </button>
            </div>
            <div className="image-viewer__toolbar-group image-viewer__toolbar-group--spaced">
              <a href={current.src} download target="_blank" rel="noreferrer">
                ↓ Download
              </a>
            </div>
          </div>

          <div className="image-viewer__details">
            {current.details.map((line) => (
              <p key={line} className="content-copy">
                {line}
              </p>
            ))}
          </div>

          <div className="image-viewer__thumbs" aria-label="Image navigation">
            {items.map((item, index) => (
              <button
                key={item.title}
                type="button"
                className={`image-viewer__thumb${index === currentIndex ? " is-active" : ""}`}
                onClick={() => setCurrentIndex(index)}
              >
                <img src={item.src} alt="" />
                <span>{index + 1}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function DocumentReader({
  title,
  pdfUrl,
  onClose,
  pageLabel,
}: {
  title: string;
  pdfUrl: string;
  onClose: () => void;
  pageLabel?: string;
}) {
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const onDocumentLoadSuccess = ({ numPages: pageCount }: { numPages: number }) => {
    setNumPages(pageCount);
    setPdfError(null);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && (numPages === null || newPage <= numPages)) {
      setPage(newPage);
    }
  };

  return (
    <section className="document-reader" role="dialog" aria-modal="true">
      <button
        type="button"
        className="document-reader__backdrop"
        aria-label="Close document reader"
        onClick={onClose}
      />
      <div className="document-reader__shell">
        <div className="document-reader__head">
          <div>
            <p className="panel-eyebrow">Newsletter Archive</p>
            <h3>{title}</h3>
            <p className="content-copy">
              {pageLabel || "Read the full PDF in the embedded document viewer."}
            </p>
          </div>
          <button
            type="button"
            className="document-reader__close"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="document-reader__toolbar" aria-label="Document controls">
          <button type="button" onClick={() => handlePageChange(page - 1)} disabled={page <= 1}>
            Previous Page
          </button>
          <button type="button" onClick={() => handlePageChange(page + 1)} disabled={numPages !== null && page >= numPages}>
            Next Page
          </button>
          <button type="button" onClick={() => setPage(1)}>
            Reset
          </button>
          <a href={pdfUrl} target="_blank" rel="noreferrer">
            Open PDF
          </a>
          <a href={pdfUrl} download>
            Download
          </a>
          <span>Page {page}{numPages ? ` / ${numPages}` : ''}</span>
        </div>
        <div className="document-reader__frame">
          {pdfError ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'white',
              padding: '2rem',
              textAlign: 'center',
            }}>
              <p>{pdfError}</p>
              <a href={pdfUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--color-accent)', marginTop: '1rem', display: 'inline-block' }}>
                Open PDF directly
              </a>
            </div>
          ) : (
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={(error) => {
                console.error('[DocumentReader] PDF load error:', error);
                setPdfError('Failed to load PDF. Please try opening it directly.');
              }}
              loading={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-tertiary)' }}>Loading PDF...</div>}
              error={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'white', padding: '2rem', textAlign: 'center' }}>Failed to load PDF</div>}
            >
              <Page
                pageNumber={page}
                width={800}
                renderTextLayer={true}
                renderAnnotationLayer={true}
              />
            </Document>
          )}
        </div>
      </div>
    </section>
  );
}

function MissionTimeline() {
  const nodes = missionTimeline;
  const currentIndex = nodes.findIndex((n) => n.status === "current");
  const doneCount = nodes.filter((n) => n.status === "done").length;
  const progressPct =
    currentIndex >= 0
      ? (currentIndex / (nodes.length - 1)) * 100
      : (doneCount / nodes.length) * 100;

  return (
    <section className="antara-timeline">
      <div className="antara-timeline__inner">
        <p className="antara-timeline__eyebrow">Mission Progress</p>
        <h2 className="antara-timeline__heading">Where we are</h2>
        <div className="antara-timeline__wrap">
          <div className="antara-timeline__track">
            <div
              className="antara-timeline__fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="antara-timeline__nodes">
            {nodes.map((node) => (
              <div
                key={node.id}
                className={`antara-timeline__node antara-timeline__node--${node.status}`}
              >
                <div className="antara-timeline__dot">
                  {node.status === "done" && (
                    <svg viewBox="0 0 12 12" fill="none" className="antara-timeline__check" aria-hidden="true">
                      <path
                        d="M2 6l3 3 5-5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                  {node.status === "current" && (
                    <span className="antara-timeline__pulse" />
                  )}
                </div>
                <div className="antara-timeline__label">
                  <span className="antara-timeline__name">{node.label}</span>
                  <span className="antara-timeline__sub">{node.sub}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function HomePage({
  posts,
  postsResolved,
}: {
  posts: CmsPost[];
  postsResolved: boolean;
}) {
  const [progress, setProgress] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const [postsLoading, setPostsLoading] = useState(true);
  const [scrollHintHidden, setScrollHintHidden] = useState(false);
  const [viewerState, setViewerState] = useState<{
    title: string;
    items: ViewerImage[];
    index: number;
  } | null>(null);
  const [galleryAlbums, setGalleryAlbums] = useState<GalleryAlbum[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(true);

  const loadGalleryAlbums = async () => {
    try {
      const response = await fetch("/api/posts?category=gallery&includeDrafts=false&limit=50");
      if (!response.ok) {
        throw new Error("Failed to load gallery albums.");
      }
      const data = (await response.json()) as GalleryAlbumResponse;
      const albums = (data.items ?? []).map((album) => ({
        ...album,
        galleryImages: album.galleryImages ?? [],
        coverImage: album.coverImage ?? album.attachmentThumbnailPath ?? album.attachmentPath ?? "",
      }));
      setGalleryAlbums(albums);
    } catch (error) {
      console.error("Failed to load gallery:", error);
    } finally {
      setGalleryLoading(false);
    }
  };

  useEffect(() => {
    loadGalleryAlbums();
  }, []);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const liveBlogPosts = posts
    .filter((post) => post.category === "blog")
    .slice(0, 6);
  useEffect(() => {
    const handleScroll = () => {
      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight;
      const next = maxScroll <= 0 ? 0 : window.scrollY / maxScroll;
      const clampedProgress = clamp(next);

      if (scrollFrameRef.current !== null) {
        return;
      }

      scrollFrameRef.current = window.requestAnimationFrame(() => {
        setProgress(clampedProgress);
        scrollFrameRef.current = null;
      });
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!postsResolved) {
      return;
    }
    setPostsLoading(false);
  }, [postsResolved]);

  useEffect(() => {
    setScrollHintHidden(progress > 0.1);
  }, [progress]);

  useEffect(() => {
    const targets = ["about", "mission", "team", "blogs", "gallery"]
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => Boolean(element));

    if (targets.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection((entry.target as HTMLElement).id);
          }
        });
      },
      { threshold: 0.3 },
    );

    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const scope = shellRef.current;
    if (
      !scope ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
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
      scope.querySelectorAll<HTMLElement>(
        ".mission-cta, .project-card__link, .partners-download-btn",
      ),
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
      <VideoScrubber
        src="/journey.mp4"
        endTrigger="#about"
        scrub={1.5}
        poster="/journey-poster.webp"
      />
      <SiteHeader
        progress={progress}
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((value) => !value)}
        navBehavior="scroll"
        activeSection={activeSection}
      />
      <div
        className={`scroll-hint${scrollHintHidden ? " is-hidden" : ""}`}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" className="scroll-hint__icon" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
      <SideMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />

      <main className="mission-scroll">
        {missionScenes.map((scene, index) => {
          const intensity = sceneVisibility(
            progress,
            index,
            missionScenes.length,
          );

          return (
            <section className="mission-panel" key={scene.id} id={scene.id}>
              <div className={`mission-copy mission-copy--${scene.align}`}>
                <div
                  className="mission-copy__inner"
                  style={{
                    opacity: intensity,
                    transform: `translate3d(0, ${(1 - intensity) * 18}px, 0) scale(${0.99 + (intensity - 0.92) * 0.05})`,
                  }}
                >
                  {scene.id === "boot" ? (
                    <div className="mission-copy__brand">
                      <div className="mission-copy__logo-shell">
                        <img
                          src={antarLogo}
                          alt="Project Antara"
                          className="mission-copy__logo"
                        />
                      </div>
                      <div className="mission-copy__brand-copy">
                        <p className="mission-copy__eyebrow">{scene.eyebrow}</p>
                        <h1>{scene.title}</h1>
                        {scene.copy.map((line) => (
                          <p key={line} className="mission-copy__text">
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="mission-copy__eyebrow">{scene.eyebrow}</p>
                      <h1>{scene.title}</h1>
                      {scene.copy.map((line) => (
                        <p key={line} className="mission-copy__text">
                          {line}
                        </p>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </section>
          );
         
         })}

<MissionTimeline /> 

        <section className="info-hub" id="about">
          <div className="info-hub__intro">
            <p className="mission-copy__eyebrow">Mission Archive</p>
            <h2>There's a lot behind the mission. This is where it lives.</h2>
            <p>
              The scroll pulls you in. But the real story is in the details,
              the science, the systems, the people, and the progress.
              Everything below is the actual mission, documented as it happens.
            </p>
          </div>
        </section>

        <section className="archive-grid" aria-label="Project archive sections">
          {archiveSections.map((section) => (
            <section
              key={section.id}
              className="archive-section"
              id={section.id}
            >
              <div className="archive-section__main">
                <p className="mission-copy__eyebrow">{section.eyebrow}</p>
                <h3>{section.title}</h3>
                {section.images &&
                section.images.some(
                  (image) => !image.src.startsWith("data:image/svg+xml"),
                ) ? (
                  <div className="archive-section__images">
                    {section.images.map((image, index) => (
                      <button
                        type="button"
                        key={image.title}
                        className="archive-section__image"
                        onClick={() =>
                          setViewerState({
                            title: section.title,
                            items: section.images ?? [],
                            index,
                          })
                        }
                      >
                        <img src={image.src} alt={image.alt} />
                        <span>{image.title}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="archive-section__cards">
                  {section.cards.map((card) => (
                    <article
                      key={card.title}
                      className={`archive-section__card archive-section__card--${card.tone}`}
                    >
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
                    <span
                      className="info-hub__detail-mark"
                      aria-hidden="true"
                    />
                    <p>{point}</p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </section>

        <section className="gallery-section" id="blogs">
          <div className="database-feed">
            <div className="database-feed__intro">
              <p className="mission-copy__eyebrow">Team Blogs</p>
              <h2>What we're working on, written as it happens.</h2>
            </div>
            <div className="database-feed__grid">
              {postsLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <article key={`blog-skeleton-${index}`} className="database-feed__card database-feed__card--skeleton">
                    <div
                      className="database-feed__skeleton-line"
                      style={{ width: "40%", height: 12, marginBottom: 12 }}
                    />
                    <div
                      className="database-feed__skeleton-line"
                      style={{ width: "80%", height: 20, marginBottom: 12 }}
                    />
                    <div
                      className="database-feed__skeleton-line"
                      style={{ width: "100%", height: 12, marginBottom: 8 }}
                    />
                    <div
                      className="database-feed__skeleton-line"
                      style={{ width: "70%", height: 12 }}
                    />
                  </article>
                ))
              ) : liveBlogPosts.length > 0 ? (
                liveBlogPosts.map((post) => (
                  <article key={post.id} className="database-feed__card">
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "0.25rem",
                      }}
                    >
                      <span>
                        {new Date(post.publishedAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          padding: "3px 8px",
                          borderRadius: "4px",
                          marginLeft: "8px",
                          background:
                            post.category === "newsletter"
                              ? "var(--color-background-success)"
                              : "var(--color-background-info)",
                          color:
                            post.category === "newsletter"
                              ? "var(--color-text-success)"
                              : "var(--color-text-info)",
                        }}
                      >
                        {post.category.replace(/-/g, " ")}
                      </span>
                    </div>
                    <h3>
                      <SmartLink
                        className="database-feed__card-link"
                        href={`/posts/${post.slug}`}
                      >
                        {post.title}
                      </SmartLink>
                    </h3>
                    <span>
                      {post.excerpt ||
                        "No excerpt yet. Upload and publish your content from the API."}
                    </span>
                    {post.attachmentPath ? (
                      <a
                        href={post.attachmentPath}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open Attachment
                      </a>
                    ) : null}
                  </article>
                ))
              ) : (
                <article className="database-feed__card">
                  <p>Database</p>
                  <h3>The first log entry is coming.</h3>
                  <span>
                    We're building. The documentation follows. Check back soon,
                    or subscribe to the newsletter to hear when we post.
                  </span>
                </article>
              )}
            </div>
          </div>
          <div className="gallery-section__intro" id="gallery">
            <p className="mission-copy__eyebrow">Gallery</p>
            <h2>The mission, in images.</h2>
          </div>
          <div className="gallery-grid">
            {galleryLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="gallery-card database-feed__card--skeleton">
                  <div className="database-feed__skeleton-line" style={{ height: "200px" }} />
                  <div className="gallery-card__body">
                    <div className="database-feed__skeleton-line" style={{ width: "60%", height: "1rem" }} />
                    <div className="database-feed__skeleton-line" style={{ width: "80%", height: "0.875rem", marginTop: "0.5rem" }} />
                  </div>
                </div>
              ))
            ) : galleryAlbums.length > 0 ? (
              galleryAlbums.map((album) => {
                const albumImages: ViewerImage[] = [
                  ...(album.attachmentPath ? [{
                    title: album.title,
                    caption: album.excerpt || "Album cover",
                    src: album.attachmentPath,
                    alt: album.title,
                    details: album.galleryImages?.map((img) => img.caption) ?? [],
                  }] : []),
                  ...(album.galleryImages?.map((img, idx) => ({
                    title: `${album.title} - Image ${idx + 1}`,
                    caption: img.caption,
                    src: img.src,
                    alt: img.alt,
                    details: [],
                  })) ?? []),
                ];
                const coverSrc = album.coverImage || album.attachmentThumbnailPath || album.attachmentPath || "";
                return (
                  <button
                    type="button"
                    key={album.slug}
                    className="gallery-card gallery-card__open"
                    onClick={() => albumImages.length > 0 && setViewerState({
                      title: album.title,
                      items: albumImages,
                      index: 0,
                    })}
                  >
                    <div
                      className="gallery-card__media"
                      style={{ backgroundImage: coverSrc ? `url("${coverSrc}")` : "none" }}
                    />
                    <div className="gallery-card__body">
                      <p>{album.title}</p>
                      <span>{album.excerpt || `${albumImages.length} image${albumImages.length !== 1 ? "s" : ""}`}</span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="gallery-card" style={{ gridColumn: "1 / -1", textAlign: "center", padding: "3rem" }}>
                <p className="mission-copy__eyebrow">Gallery</p>
                <h3>No albums yet.</h3>
                <p className="content-copy">Create gallery albums from the Admin dashboard.</p>
              </div>
            )}
          </div>
        </section>

        {viewerState ? (
          <ImageViewer
            title={viewerState.title}
            items={viewerState.items}
            initialIndex={viewerState.index}
            onClose={() => setViewerState(null)}
          />
        ) : null}

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
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const scope = pageRef.current;
    if (
      !scope ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".page-hero",
        { autoAlpha: 0, y: 34 },
        { autoAlpha: 1, y: 0, duration: 0.95, ease: "power2.out" },
      );

      gsap.utils
        .toArray<HTMLElement>(
          ".content-panel, .timeline-item, .project-card, .detail-panel, .issue-card, .admin-post-item",
        )
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
      <SiteHeader
        progress={0.24}
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((value) => !value)}
        navBehavior="always"
        activeSection=""
      />
      <SideMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />
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
      title="Help us get Antara to orbit."
      intro="Building a satellite as a student team is possible. It's also genuinely hard. The right partners, whether through funding, hardware, mentorship, or visibility, make the difference between a mission that launches and one that doesn't."
    >
      <section className="page-section">
        <div className="two-column-grid">
          <article className="content-panel">
            <p className="panel-eyebrow">Where support makes a real difference</p>
            <h2>Three ways to back a student space mission.</h2>
            <ul className="content-list">
              <li>
                Payload hardware, detector components, shielding materials, and
                fabrication resources for the spacecraft itself.
              </li>
              <li>
                Ground-station infrastructure, communications equipment, and
                testing tools that let us operate the mission from campus.
              </li>
              <li>
                Student travel, conference attendance, outreach events, and
                mission reviews that connect Antara to the broader space
                community.
              </li>
            </ul>
          </article>
          <article className="content-panel content-panel--accent">
            <p className="panel-eyebrow">Ready to talk?</p>
            <h2>Reach out with what you have in mind.</h2>
            <p className="content-copy">
              If you're interested in supporting Antara as a funder, a technical
              collaborator, or a community partner, we'd like to hear from you.
              Let us know how you would like to contribute to the mission.
            </p>
            <div className="contact-stack">
              <a href="mailto:project.antara.25@gmail.com?subject=Antara%20Partnership%20Inquiry">
                Mail at: project.antara.25@gmail.com
              </a>
            </div>
            <a
              href="/src/assets/sponsorship-fyer.pdf"
              download="Antara-Sponsorship-Flyer.pdf"
              className="partners-download-btn"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M8 2v8m0 0L5 7m3 3 3-3M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Download sponsorship flyer
            </a>
          </article>
        </div>

        <div className="two-column-grid" style={{ marginTop: "1.25rem" }}>
          <article className="content-panel">
            <p className="panel-eyebrow">How partnerships work</p>
            <h2>Support that maps to the mission.</h2>
            <ul className="content-list">
              <li>Technical partners who review subsystem designs, attend test sessions, and help us avoid the expensive mistakes.</li>
              <li>Sponsors who cover hardware, fabrication, and travel costs that make the mission physically possible.</li>
              <li>Community partners who share Antara's story with students who might join, and institutions who might collaborate.</li>
            </ul>
          </article>
          <article className="content-panel content-panel--accent">
            <p className="panel-eyebrow">How we work with partners</p>
            <h2>Specific support produces specific outcomes.</h2>
            <p className="content-copy">
              The most effective partnerships we have seen attach to a real
              milestone, a test, a review, a launch window, rather than the
              mission in general. That gives partners something concrete to
              point to, and gives us something real to deliver.
            </p>
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
      detail:
        "Antara goes public. The mission framing, subsystem architecture, and team structure are documented and shared for the first time.",
    },
    {
      phase: "May 2026",
      title: "Subsystem Reviews and Team Orientation",
      detail:
        "Internal reviews for mission architecture, interface definitions, and subsystem ownership. Every lead walks in with a scope; everyone walks out with a plan.",
    },
    {
      phase: "June 2026",
      title: "Payload and Ground Segment Workshops",
      detail:
        "Hands-on sessions for new contributors joining the payload development and ground station tracks. Build first, document second.",
    },
    {
      phase: "July 2026",
      title: "Partner Showcase and Technical Update",
      detail:
        "A sponsor-facing session presenting mission direction, mini-project progress, and the next set of milestones. Open to institutions and organisations interested in supporting Antara.",
    },
  ];

  return (
    <StandardPage
      page="events"
      eyebrow="Events"
      title="Where the mission has been, and where it's going."
      intro="This is the public record of Antara's timeline, reviews, workshops, partner sessions, and the milestones that mark progress from concept to launch."
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
        <div className="two-column-grid" style={{ marginTop: "1.25rem" }}>
          <article className="content-panel content-panel--accent">
            <p className="panel-eyebrow">What we try to do every month</p>
            <h2>Reviews that produce something. Sessions that leave an artifact.</h2>
            <ul className="content-list">
              <li>Subsystem reviews with concrete action items and a named owner for each one.</li>
              <li>Build and test sessions that end with something tangible, a prototype, a test result, a documented trade-off.</li>
              <li>Public updates that give sponsors and collaborators an honest picture of where the mission actually is.</li>
            </ul>
          </article>
          <article className="content-panel">
            <p className="panel-eyebrow">What happens next</p>
            <h2>Events are checkpoints, not conclusions.</h2>
            <p className="content-copy">
              The goal of every Antara event is a clearer owner, a tighter plan,
              or a better prototype. The site is where those outcomes get
              recorded, not just the date on the calendar.
            </p>
          </article>
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
      title="Three focused build tracks. Real engineering problems. Student-owned."
      intro="The mini-projects extend Antara's mission into bounded, manageable tracks that a small group of students can own completely. They feed into the main spacecraft and they're real work, not exercises."
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
              <SmartLink
                className="project-card__link"
                href={`/${project.page}`}
              >
                Open Project Page
              </SmartLink>
            </article>
          ))}
        </div>
        <div className="two-column-grid" style={{ marginTop: "1.25rem" }}>
          <article className="content-panel">
            <p className="panel-eyebrow">Why mini-projects exist</p>
            <h2>The on-ramp for serious contributors.</h2>
            <p className="content-copy">
              Mini-projects give newer members a bounded problem to solve that
              still connects to the real mission. The work is scoped. The output
              is reviewable. And the best ideas make it into the spacecraft.
            </p>
          </article>
          <article className="content-panel content-panel--accent">
            <p className="panel-eyebrow">Expected output</p>
            <h2>Every track should leave a trail.</h2>
            <ul className="content-list">
              <li>A diagram, prototype, or workflow that a reviewer can actually assess.</li>
              <li>A documented set of assumptions and trade-offs, not just conclusions.</li>
              <li>A clearer next step that the subsystem lead can act on.</li>
            </ul>
          </article>
        </div>
      </section>
    </StandardPage>
  );
}

function MiniProjectDetailPage({ project }: { project: MiniProject }) {
  return (
    <StandardPage
      page={project.page}
      eyebrow={project.eyebrow}
      title={project.title}
      intro={project.intro}
    >
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
  const [documentState, setDocumentState] = useState<{
    title: string;
    pdfUrl: string;
    pageLabel?: string;
  } | null>(null);
  const liveNewsletterPosts = posts
    .filter((post) => post.category === "newsletter")
    .slice(0, 6);

  const openIssue = (issue: NewsletterIssue | CmsPost) => {
    const pdfUrl =
      "pdfUrl" in issue ? issue.pdfUrl : issue.attachmentPath || "/newsletter.pdf";
    setDocumentState({
      title: issue.title,
      pdfUrl,
      pageLabel: "Use the controls to move through the newsletter PDF.",
    });
  };

  const handleIssueKeyDown =
    (issue: NewsletterIssue | CmsPost) => (event: ReactKeyboardEvent<HTMLElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openIssue(issue);
      }
    };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = email.trim().toLowerCase();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);

    if (!valid) {
      setStatus("Please enter a valid email address.");
      return;
    }

    fetch("https://formspree.io/f/xojblvpo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ email: trimmed }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Formspree submission failed.");
        }
        setEmail("");
        setStatus("You're on the list. We'll be in touch.");
      })
      .catch(() => {
        setStatus(
          "Something went wrong. Email us directly at project.antara.25@gmail.com",
        );
      });
  };

  return (
    <StandardPage
      page="newsletter"
      eyebrow="Newsletter"
      title="Monthly updates from the mission, written plainly."
      intro="No spin. No press release language. Just an honest account of where Antara is, what we built last month, and what we're working on next. Once a month, directly to you."
    >
      <section className="page-section">
        <div className="two-column-grid">
          <article className="content-panel content-panel--accent">
            <p className="panel-eyebrow">Subscribe</p>
            <h2>Get the monthly mission brief.</h2>
            <form className="newsletter-form" onSubmit={handleSubmit}>
              <input
                type="email"
                placeholder="Your email address"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-label="Email address"
              />
              <button type="submit">Sign Up</button>
            </form>
            <p className="content-copy">
              {status || "No cost, no noise. One email a month."}
            </p>
          </article>
          <article className="content-panel">
            <p className="panel-eyebrow">Archive</p>
            <h2>Past issues and upcoming editions.</h2>
            <div className="issue-grid">
              {liveNewsletterPosts.length > 0
                ? liveNewsletterPosts.map((post) => (
                    <article
                      key={post.id}
                      className="issue-card issue-card--interactive"
                      role="button"
                      tabIndex={0}
                      onClick={() => openIssue(post)}
                      onKeyDown={handleIssueKeyDown(post)}
                    >
                      <p>{new Date(post.publishedAt).toLocaleDateString()}</p>
                      <h3>{post.title}</h3>
                      <span>
                        {post.excerpt ||
                          "Newsletter entry from the CMS database."}
                      </span>
                      <span className="issue-card__link">
                        Read PDF
                      </span>
                    </article>
                  ))
                : monthlyIssues.map((issue) => (
                    <article
                      key={issue.title}
                      className="issue-card issue-card--interactive"
                      role="button"
                      tabIndex={0}
                      onClick={() => openIssue(issue)}
                      onKeyDown={handleIssueKeyDown(issue)}
                    >
                      <p>{issue.month}</p>
                      <h3>{issue.title}</h3>
                      <span>{issue.summary}</span>
                      <span className="issue-card__link">
                        Read PDF
                      </span>
                    </article>
                  ))}
            </div>
          </article>
        </div>
        <div className="two-column-grid" style={{ marginTop: "1.25rem" }}>
          <article className="content-panel">
            <p className="panel-eyebrow">What to expect</p>
            <h2>Written like the mission brief it is.</h2>
            <p className="content-copy">
              Short, specific, honest. Each issue covers what happened, what it
              means, and what's next. It ages well because it's tied to real
              milestones, not a content calendar.
            </p>
          </article>
          <article className="content-panel content-panel--accent">
            <p className="panel-eyebrow">Typical content</p>
            <h2>A newsletter issue can hold a lot.</h2>
            <ul className="content-list">
              <li>Subsystem milestones, build notes, and test results, the work as it happens.</li>
              <li>Event announcements and sponsor updates that give supporters a reason to stay close.</li>
              <li>PDF archives for readers who want the full issue, not just the highlights.</li>
            </ul>
          </article>
        </div>
        {documentState ? (
          <DocumentReader
            title={documentState.title}
            pdfUrl={documentState.pdfUrl}
            pageLabel={documentState.pageLabel}
            onClose={() => setDocumentState(null)}
          />
        ) : null}
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
        title="Loading this entry..."
        intro="One moment while we pull the post from the archive."
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
        title="This entry isn't here."
        intro="It may be unpublished, moved, or not yet written. Head back to the mission log to find what you're looking for."
      >
        <section className="page-section">
          <article className="content-panel content-panel--accent">
            <p className="content-copy">
              {error || `No post found for slug: ${slug ?? "unknown"}.`}
            </p>
            <SmartLink className="project-card__link" href="/#blogs">
              Back to Mission Log
            </SmartLink>
          </article>
        </section>
      </StandardPage>
    );
  }

  const categoryLabel = post.category
    ? post.category.replace(/-/g, " ")
    : "post";
  const renderedContent = markdownToHtml(post.content || "");

  return (
    <StandardPage
      page="post"
      eyebrow={categoryLabel}
      title={post.title}
      intro={post.excerpt || "Mission post from Project Antara."}
    >
      <section className="page-section">
        <div className="post-layout">
          <article className="content-panel">
            <p className="panel-eyebrow">
              Published {new Date(post.publishedAt).toLocaleDateString()}
            </p>
            {post.coverImage ? (
              <img
                className="post-cover"
                src={post.coverImage}
                alt={post.title}
                loading="lazy"
              />
            ) : null}
            {renderedContent ? (
              <div
                className="post-content post-content--markdown"
                dangerouslySetInnerHTML={{ __html: renderedContent }}
              />
            ) : (
              <div className="post-content">
                <p>No content has been added to this post yet.</p>
              </div>
            )}
          </article>
          <aside className="content-panel content-panel--accent">
            <p className="panel-eyebrow">Mission Log</p>
            <h2>More from Antara</h2>
            <p className="content-copy">
              Head back to the mission log for more entries, build updates,
              technical explainers, and progress notes from across the team.
            </p>
            <SmartLink className="project-card__link" href="/#blogs">
              Open Mission Log
            </SmartLink>
            {post.attachmentPath ? (
              <a
                className="project-card__link post-attachment-link"
                href={post.attachmentPath}
                target="_blank"
                rel="noreferrer"
              >
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
  const [statusFilter, setStatusFilter] = useState<
    "all" | "published" | "draft"
  >("all");
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
  const markdownPreview = useMemo(
    () => markdownToHtml(form.content),
    [form.content],
  );

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
      setPostsError(
        error instanceof Error ? error.message : "Failed to load admin posts.",
      );
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
      const response = await fetch(
        `/api/posts/${encodeURIComponent(slug)}?includeDraft=true`,
        {
          headers: authHeaders,
        },
      );
      if (!response.ok) {
        throw new Error("Failed to load post details.");
      }
      const data = (await response.json()) as {
        item?: CmsPostDetail & { isPublished?: boolean; status?: string };
      };
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
        status:
          post.status === "draft" || post.isPublished === false
            ? "draft"
            : "published",
        publishedAt: post.publishedAt
          ? new Date(post.publishedAt).toISOString().slice(0, 16)
          : "",
        seoTitle: post.seoTitle ?? "",
        seoDescription: post.seoDescription ?? "",
        coverImage: post.coverImage ?? "",
      });
      setAuthStatus(`Editing ${post.slug}`);
    } catch (error) {
      setAuthStatus(
        error instanceof Error ? error.message : "Failed to open post.",
      );
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
    const nextStatus =
      post.status === "draft" || post.isPublished === false
        ? "published"
        : "draft";
    try {
      const response = await fetch(
        `/api/posts/${encodeURIComponent(post.slug)}`,
        {
          method: "PUT",
          headers: authHeaders,
          body: (() => {
            const formData = new FormData();
            formData.set("status", nextStatus);
            return formData;
          })(),
        },
      );
      if (!response.ok) {
        throw new Error("Status update failed.");
      }
      setAuthStatus(`Set ${post.slug} to ${nextStatus}.`);
      loadAdminPosts();
    } catch (error) {
      setAuthStatus(
        error instanceof Error ? error.message : "Status update failed.",
      );
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
      const data = (await response.json()) as {
        backupPath?: string;
        postCount?: number;
      };
      setBackupStatus(
        `Backup completed (${data.postCount ?? 0} posts). ${data.backupPath ?? ""}`.trim(),
      );
    } catch (error) {
      setBackupStatus(
        error instanceof Error ? error.message : "Backup trigger failed.",
      );
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
      const endpoint = editing
        ? `/api/posts/${encodeURIComponent(editingSlug)}`
        : "/api/posts";
      const method = editing ? "PUT" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: authHeaders,
        body: payload,
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(errorBody.error || "Save failed.");
      }

      const data = (await response.json()) as { slug?: string };
      setAuthStatus(
        editing
          ? `Updated ${data.slug ?? editingSlug}`
          : `Created ${data.slug ?? "post"}`,
      );
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
      title="Antara Content Dashboard"
      intro="Manage mission posts, newsletter entries, and published content. Authenticated access only."
    >
      {!token ? (
        <section className="page-section">
          <div className="two-column-grid">
            <article className="content-panel content-panel--accent">
              <p className="panel-eyebrow">Restricted Access</p>
              <h2>Sign in to continue.</h2>
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
              <p className="content-copy">
                {authStatus || "Only authenticated team members can manage content."}
              </p>
            </article>
            <article className="content-panel">
              <p className="panel-eyebrow">What you can do here</p>
              <h2>Full content management.</h2>
              <ul className="content-list">
                <li>Create posts in draft or published state, with categories and scheduling.</li>
                <li>Edit content, SEO fields, cover images, and file attachments.</li>
                <li>Toggle publish status, delete outdated entries, and run database backups.</li>
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
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as "all" | "published" | "draft",
                  )
                }
              >
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
            <button
              type="button"
              className="admin-toolbar__logout"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
          {backupStatus ? (
            <p className="content-copy admin-backup-status">{backupStatus}</p>
          ) : null}

          <div className="admin-grid">
            <article className="content-panel">
              <p className="panel-eyebrow">
                {editingSlug ? "Edit Post" : "Create Post"}
              </p>
              <h2>{editingSlug ? `Editing ${editingSlug}` : "New Post"}</h2>
              <form className="admin-post-form" onSubmit={handleSave}>
                <input
                  type="text"
                  placeholder="Title *"
                  value={form.title}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, title: event.target.value }))
                  }
                  required
                />
                <input
                  type="text"
                  placeholder="Slug (lowercase-hyphen-format)"
                  value={form.slug}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      slug: event.target.value.toLowerCase(),
                    }))
                  }
                />
                <input
                  type="text"
                  placeholder="Category"
                  value={form.category}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      category: event.target.value,
                    }))
                  }
                />
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, status: event.target.value }))
                  }
                >
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </select>
                <input
                  type="datetime-local"
                  value={form.publishedAt}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      publishedAt: event.target.value,
                    }))
                  }
                />
                <textarea
                  placeholder="Excerpt"
                  value={form.excerpt}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      excerpt: event.target.value,
                    }))
                  }
                />
                <textarea
                  placeholder="Content"
                  value={form.content}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      content: event.target.value,
                    }))
                  }
                  rows={10}
                />
                <input
                  type="text"
                  placeholder="SEO Title"
                  value={form.seoTitle}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      seoTitle: event.target.value,
                    }))
                  }
                />
                <textarea
                  placeholder="SEO Description"
                  value={form.seoDescription}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      seoDescription: event.target.value,
                    }))
                  }
                />
                <input
                  type="url"
                  placeholder="Cover Image URL"
                  value={form.coverImage}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      coverImage: event.target.value,
                    }))
                  }
                />
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.pdf"
                  onChange={(event) =>
                    setAttachmentFile(event.target.files?.[0] ?? null)
                  }
                />
                <div className="admin-post-form__actions">
                  <button type="submit">
                    {editingSlug ? "Save Changes" : "Create Post"}
                  </button>
                  <button type="button" onClick={resetForm}>
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPreview((value) => !value)}
                  >
                    {showPreview ? "Hide Preview" : "Show Preview"}
                  </button>
                </div>
              </form>
              {showPreview ? (
                <div className="admin-markdown-preview">
                  <p className="panel-eyebrow">Markdown Preview</p>
                  {markdownPreview ? (
                    <div
                      className="post-content post-content--markdown"
                      dangerouslySetInnerHTML={{ __html: markdownPreview }}
                    />
                  ) : (
                    <p className="content-copy">
                      Write content to see a markdown preview.
                    </p>
                  )}
                </div>
              ) : null}
            </article>

            <article className="content-panel content-panel--accent">
              <p className="panel-eyebrow">Posts</p>
              <h2>Manage existing content</h2>
              <p className="content-copy">
                {authStatus ||
                  "Select any post to edit or change publish status."}
              </p>
              {loadingPosts ? (
                <p className="content-copy">Loading posts...</p>
              ) : null}
              {postsError ? <p className="content-copy">{postsError}</p> : null}
              <div className="admin-post-list">
                {posts.length > 0 ? (
                  posts.map((post) => (
                    <article key={post.id} className="admin-post-item">
                      <div>
                        <p>{new Date(post.publishedAt).toLocaleDateString()}</p>
                        <h3>{post.title}</h3>
                        <span>
                          {post.status ||
                            (post.isPublished ? "published" : "draft")}
                        </span>
                      </div>
                      <div className="admin-post-item__actions">
                        <button
                          type="button"
                          onClick={() => handleEdit(post.slug)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusToggle(post)}
                        >
                          Toggle Status
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(post.slug)}
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="content-copy">
                    No posts found for this filter.
                  </p>
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
  const [postsResolved, setPostsResolved] = useState(false);
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

        if (
          nextRoute.page === "home" &&
          isSectionHash &&
          scrollToHashTarget(hash)
        ) {
          return;
        }

        const lenis = getLenis();
        if (lenis) {
          lenis.scrollTo(0, { immediate: true });
          return;
        }

        window.scrollTo({ top: 0, behavior: "smooth" });
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
    if (
      page === "home" &&
      window.location.hash &&
      !window.location.hash.startsWith("#/")
    ) {
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
          setPostsError(
            error instanceof Error ? error.message : "Failed to load posts",
          );
        }
      } finally {
        if (active) {
          setPostsResolved(true);
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
        const response = await fetch(
          `/api/posts/${encodeURIComponent(postSlug)}`,
        );
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
          setPostDetailError(
            error instanceof Error ? error.message : "Failed to load post.",
          );
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
    const metaByPage: Record<
      Exclude<PageId, "post">,
      { title: string; description: string }
    > = {
      home: {
        title: "Project Antara - Student-Built CubeSat Mission, BITS Goa",
        description:
          "Project Antara is a BITS Goa student-built CubeSat studying radiation in Low Earth Orbit, with a focus on the South Atlantic Anomaly. Under-Grad students. One satellite.",
      },
      partners: {
        title: "Partners - Project Antara",
        description:
          "Support Project Antara through sponsorship, hardware, technical collaboration, or mentorship. Help a student satellite reach orbit.",
      },
      events: {
        title: "Events - Project Antara",
        description:
          "The public timeline of Antara milestones, subsystem reviews, workshops, partner sessions, and launch preparation.",
      },
      "mini-projects": {
        title: "Mini-Projects - Project Antara",
        description:
          "Three student-owned engineering tracks, Ground Station, Payload Development, and ADCS, that feed directly into the Antara spacecraft.",
      },
      "ground-station": {
        title: "Ground Station Mini-Project - Project Antara",
        description:
          "Build the communications and operations layer that connects Antara to the team on the ground. Tracking, telemetry, and student-run mission ops.",
      },
      "payload-development": {
        title: "Payload Development Mini-Project - Project Antara",
        description:
          "Design the detector stack, make shielding decisions, and build the pipeline from raw measurements to usable science data.",
      },
      adcs: {
        title: "Attitude Control and Determination - Project Antara",
        description:
          "Sensors, actuators, control logic, and simulation for a CubeSat that knows where it's pointing and can correct itself when it doesn't.",
      },
      newsletter: {
        title: "Newsletter - Project Antara",
        description:
          "Monthly mission updates from the team. Honest progress notes, subsystem milestones, and the occasional hard lesson.",
      },
      admin: {
        title: "Admin Dashboard - Project Antara",
        description:
          "Authenticated content management dashboard for the Antara mission team.",
      },
    };

    const upsertMeta = (name: string, content: string, property = false) => {
      const selector = property
        ? `meta[property="${name}"]`
        : `meta[name="${name}"]`;
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
      const selector = property
        ? `meta[property="${name}"]`
        : `meta[name="${name}"]`;
      const tag = document.head.querySelector(selector);
      if (tag) {
        tag.remove();
      }
    };

    const upsertCanonical = (href: string) => {
      let canonical = document.head.querySelector(
        'link[rel="canonical"]',
      ) as HTMLLinkElement | null;
      if (!canonical) {
        canonical = document.createElement("link");
        canonical.setAttribute("rel", "canonical");
        document.head.appendChild(canonical);
      }
      canonical.setAttribute("href", href);
    };

    const upsertJsonLd = (payload: Record<string, unknown>) => {
      let script = document.head.querySelector(
        "#antara-jsonld",
      ) as HTMLScriptElement | null;
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
      const fallbackTitle = postSlug
        ? `${postSlug.replace(/-/g, " ")} - Project Antara`
        : "Mission Log - Project Antara";
      const postTitle =
        postDetail?.seoTitle || postDetail?.title || fallbackTitle;
      const postDescription =
        postDetail?.seoDescription ||
        postDetail?.excerpt ||
        "Mission post from Project Antara.";
      const postUrlPath = postSlug
        ? `/posts/${encodeURIComponent(postSlug)}`
        : "/posts";
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
    upsertMeta(
      "og:url",
      new URL(
        window.location.pathname || "/",
        window.location.origin,
      ).toString(),
      true,
    );
    upsertCanonical(
      new URL(
        window.location.pathname || "/",
        window.location.origin,
      ).toString(),
    );
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
        return (
          <PostPage
            slug={postSlug}
            post={postDetail}
            loading={postDetailLoading}
            error={postDetailError}
          />
        );
      default:
        return <HomePage posts={posts} postsResolved={postsResolved} />;
    }
  }, [page, postSlug, posts, postsResolved, postDetail, postDetailError, postDetailLoading]);

  if (postsError && page === "home") {
    console.warn("CMS posts unavailable:", postsError);
  }

  return pageNode;
}
