import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { IslandBoundary } from "./IslandBoundary";
import type { CareerRoadmapConfig, RoadmapItem } from "./portfolio-types";
import { getPortfolioConfig } from "./portfolio-types";
import { ProgressBar } from "./ProgressBar";
import { RoadmapAttributes } from "./RoadmapAttributes";
import {
  courseProgress,
  estimateCourseEndDate,
  estimatedCompletion,
  formatRoadmapDate,
  itemProgress,
  milestoneProgress,
  parseRoadmapDate,
  roadmapStageKind,
  statusClass,
  statusLabel
} from "./roadmap-utils";

interface MetaProps { label: string; value?: string; }
function RoadmapMeta({ label, value }: MetaProps) {
  return <span className="roadmap-meta-item"><strong>{label}</strong><span>{value || "TBC"}</span></span>;
}

function courseCurrency(course: RoadmapItem, roadmap: CareerRoadmapConfig): string {
  return course.currency || roadmap.educationCurrency || "AUD";
}

function formatMoney(value: number | undefined, currency: string): string {
  if (!Number.isFinite(value)) return "TBC";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value));
}

function countedEducationCost(course: RoadmapItem): number {
  return typeof course.amountPaid === "number" ? Math.max(0, course.amountPaid) : Math.max(0, Number(course.fullPrice || 0));
}

function StageArt({ kind }: { kind: string }) {
  return <div className={`roadmap-stage-art ${kind}`} aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <span key={index} />)}</div>;
}

function StatusChip({ item, label }: { item: RoadmapItem; label: string }) {
  const className = `roadmap-chip ${statusClass(item)}${item.url ? " is-linked" : ""}`;
  const content = <><b>{label}</b><small>{statusLabel(item)}</small></>;
  return item.url
    ? <a className={className} href={item.url} target="_blank" rel="noopener noreferrer" title={`${label}: ${statusLabel(item)}`}>{content}</a>
    : <span className={className} title={`${label}: ${statusLabel(item)}`}>{content}</span>;
}

interface CourseDetailProps {
  course: RoadmapItem;
  roadmap: CareerRoadmapConfig;
  onClose: () => void;
}

function CourseDetail({ course, roadmap, onClose }: CourseDetailProps) {
  const [preview, setPreview] = useState(false);
  const calendar = roadmap.studyCalendar || {};
  const progress = courseProgress(course, calendar);
  const start = parseRoadmapDate(course.startDate);
  const end = estimateCourseEndDate(course, calendar);
  const linkLabel = course.courseUrlLabel || "View course details";
  const currency = courseCurrency(course, roadmap);
  const countedCost = countedEducationCost(course);
  const autoNote = start && !course.endDate && course.useStudyCalendar !== false
    ? "Auto estimate pauses for configured school breaks and weekday public holidays."
    : "";

  return (
    <article className={`roadmap-course-detail-shell${preview ? " is-previewing" : ""}`}>
      {!preview ? (
        <div className="roadmap-course-detail-layout">
          <div className="roadmap-course-detail-header">
            <span className="roadmap-course-category">{course.category || "Course"}</span>
            <h4>{course.title || "Course"}</h4>
            <p>{course.description || "Course details pending."}</p>
          </div>
          <div className="roadmap-course-detail-panel">
            <span className={`roadmap-status ${statusClass(course)}`}>{statusLabel(course)}</span>
            <ProgressBar value={progress} label={`${course.title || "Course"} progress`} />
            <div className="roadmap-course-meta">
              <RoadmapMeta label="Duration" value={course.duration} />
              <RoadmapMeta label="Start" value={formatRoadmapDate(start)} />
              <RoadmapMeta label={course.endDate ? "Finish" : "Auto finish"} value={formatRoadmapDate(end)} />
              <RoadmapMeta label="Qualification" value={course.qualification} />
              <RoadmapMeta label="Full price" value={formatMoney(course.fullPrice, currency)} />
              <RoadmapMeta label={course.amountPaid === null || course.amountPaid === undefined ? "Counted cost" : "Amount paid"} value={formatMoney(countedCost, currency)} />
            </div>
            {course.priceNote && <p className="roadmap-price-note">{course.priceNote}</p>}
            {autoNote && <p className="roadmap-calendar-note">{autoNote}</p>}
            <div className="roadmap-course-links">
              {course.courseUrl
                ? <a className="button roadmap-course-url-button" href={course.courseUrl} target="_blank" rel="noopener noreferrer">{linkLabel}</a>
                : <button className="button roadmap-course-url-button roadmap-course-url-missing" type="button" disabled title="Add courseUrl to this course in portfolio.config.js.">{linkLabel}</button>}
              {!course.hideCertificate && <button className="button primary roadmap-qualification-button" type="button" onClick={() => setPreview(true)}>{course.certificateImageUrl ? "View qualification" : "Pending certificate"}</button>}
              <button className="button roadmap-card-reset" type="button" onClick={onClose}>Back to card</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="roadmap-qualification-preview is-react-preview" onContextMenu={(event) => event.preventDefault()}>
          {course.certificateImageUrl
            ? <img src={course.certificateImageUrl} alt={`${course.qualification || course.title || "Qualification"} certificate preview`} draggable={false} />
            : <div className="roadmap-qualification-placeholder"><span className="roadmap-card-label">Certificate</span><strong>Pending certificate</strong></div>}
          <div className="roadmap-qualification-actions">
            {course.courseUrl && <a className="button roadmap-course-url-button" href={course.courseUrl} target="_blank" rel="noopener noreferrer">{linkLabel}</a>}
            <button className="button roadmap-card-reset" type="button" onClick={() => setPreview(false)}>Back to details</button>
          </div>
          <span className="roadmap-qualification-watermark">View only</span>
        </div>
      )}
    </article>
  );
}

function CareerRoadmap() {
  const roadmap = getPortfolioConfig().careerRoadmap || {};
  const courses = roadmap.courses || [];
  const milestones = roadmap.milestones || [];
  const calendar = roadmap.studyCalendar || {};
  const coursesById = useMemo(() => new Map(courses.map((course) => [course.id || "", course])), [courses]);
  const scores = useMemo(() => milestones.map((milestone) => milestoneProgress(milestone, coursesById, calendar)), [calendar, coursesById, milestones]);
  const requiredScores = scores.filter((_, index) => !milestones[index]?.optional);
  const overall = requiredScores.length ? requiredScores.reduce((sum, value) => sum + value, 0) / requiredScores.length : 0;
  const completedCourses = courses.filter((course) => itemProgress(course) >= 100).length;
  const educationCurrency = roadmap.educationCurrency || "AUD";
  const educationTotal = courses.reduce((sum, course) => sum + countedEducationCost(course), 0);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [activeStage, setActiveStage] = useState(0);
  const stageGridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (milestones.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setActiveStage((value) => (value + 1) % milestones.length), 8500);
    return () => window.clearInterval(timer);
  }, [milestones.length]);

  useEffect(() => {
    const grid = stageGridRef.current;
    const card = grid?.children.item(activeStage) as HTMLElement | null;
    if (!grid || !card) return;
    grid.scrollTo({ left: card.offsetLeft - grid.offsetLeft, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [activeStage]);

  const selectedCourse = courses.find((course) => course.id === selectedCourseId) || null;

  return (
    <>
      <div className="roadmap-heading">
        <div className="roadmap-heading-copy">
          <p className="kicker">Career Roadmap</p>
          <h2 className="roadmap-title" id="career-roadmap-title">{roadmap.goal || "Career goal"}</h2>
          <p className="roadmap-summary">{roadmap.summary || "A staged plan for the next chapter."}</p>
        </div>
        <article className="roadmap-goal-card">
          <div className="roadmap-goal-top">
            <div className="roadmap-goal-emblem"><span>Mission</span><strong>{roadmap.goalBadge || "OBJ"}</strong></div>
            <div className="roadmap-goal-copy"><span className="roadmap-card-label">End goal</span><strong>{roadmap.target || "Long-term target TBC"}</strong></div>
          </div>
          <p className="roadmap-goal-statement">{roadmap.goalStatement || "Built one standard at a time."}</p>
          <RoadmapAttributes roadmap={roadmap} />
          <ProgressBar value={overall} label="Career roadmap progress" />
          <span className="roadmap-percent">{Math.round(overall)}% mapped</span>
        </article>
      </div>

      <div className="roadmap-stats">
        <RoadmapMeta label="Estimated completion:" value={estimatedCompletion(roadmap)} />
        <RoadmapMeta label="Courses tracked:" value={String(courses.length)} />
        <RoadmapMeta label="Courses complete:" value={String(completedCourses)} />
        <RoadmapMeta label="Last updated:" value={formatRoadmapDate(roadmap.lastUpdated)} />
        <RoadmapMeta label="Education total:" value={formatMoney(educationTotal, educationCurrency)} />
      </div>

      <div className="roadmap-stage-carousel">
        <div ref={stageGridRef} className="roadmap-stage-grid" role="region" aria-label="Career roadmap stages">
          {milestones.map((milestone, index) => {
            const kind = roadmapStageKind(milestone, index);
            const score = scores[index] || 0;
            const chipLimit = milestone.optional ? 8 : 4;
            const items = [
              ...(milestone.courseIds || []).map((id) => coursesById.get(id)).filter((item): item is RoadmapItem => Boolean(item)),
              ...(milestone.checklist || [])
            ].slice(0, chipLimit);
            return (
              <article key={milestone.label || milestone.title || index} className={`roadmap-stage ${kind}`}>
                <StageArt kind={kind} />
                <span className="roadmap-step">{milestone.label || `Step ${index + 1}`}</span>
                <h3>{milestone.title || "Roadmap step"}</h3>
                <p>{milestone.summary}</p>
                {milestone.optional && <span className="roadmap-optional-note">Independent progress - excluded from the main goal</span>}
                <ProgressBar value={score} label={`${milestone.title || "Roadmap step"} progress`} />
                <span className="roadmap-stage-percent">{Math.round(score)}% {milestone.optional ? "optional progress" : "complete"}</span>
                {items.length > 0 && <div className="roadmap-stage-chips">{items.map((item) => <StatusChip key={item.id || item.label || item.title} item={item} label={item.title || item.label || "Roadmap item"} />)}</div>}
              </article>
            );
          })}
        </div>
        <div className="roadmap-stage-dots" role="group" aria-label="Select roadmap stage">
          {milestones.map((milestone, index) => <button key={milestone.label || index} className={`roadmap-stage-dot${activeStage === index ? " is-active" : ""}`} type="button" aria-label={`Show ${milestone.title || `stage ${index + 1}`}`} aria-current={activeStage === index} onClick={() => setActiveStage(index)} />)}
        </div>
      </div>

      <div className="roadmap-subheading"><span className="roadmap-card-label">Courses and evidence</span><h3>Clickable qualification tracker</h3></div>
      {selectedCourse && <div className="roadmap-course-detail-dock is-visible is-open"><CourseDetail key={selectedCourse.id} course={selectedCourse} roadmap={roadmap} onClose={() => setSelectedCourseId(null)} /></div>}
      <div className="roadmap-course-grid">
        {courses.filter((course) => course.id !== selectedCourseId).map((course) => (
          <article key={course.id || course.title} className="roadmap-course-card">
            <button className="roadmap-course-front-button" type="button" onClick={() => setSelectedCourseId(course.id || course.title || "") }>
              <span><span className="roadmap-course-category">{course.category || "Course"}</span><strong>{course.title || "Course"}</strong><span>{course.provider || "Provider TBC"}</span><span className="roadmap-course-price">Full price {formatMoney(course.fullPrice, courseCurrency(course, roadmap))}</span></span>
              <span className={`roadmap-status ${statusClass(course)}`}>{statusLabel(course)}</span>
            </button>
          </article>
        ))}
      </div>

      <article className="roadmap-readiness-card">
        <span className="roadmap-card-label">Fitness baseline</span>
        <h3>Minimum Special Forces pre-fitness targets</h3>
        <div className="roadmap-readiness-grid">{(roadmap.readinessStandards || []).map((item) => <span key={item.label}><strong>{item.value}</strong><small>{item.label}</small></span>)}</div>
      </article>
    </>
  );
}

export function mountCareerRoadmap(target: HTMLElement) {
  createRoot(target).render(<StrictMode><IslandBoundary label="Career roadmap"><CareerRoadmap /></IslandBoundary></StrictMode>);
}
