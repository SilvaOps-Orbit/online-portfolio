import type { CareerRoadmapConfig, RoadmapCalendar, RoadmapItem } from "./portfolio-types";

export function parseRoadmapDate(value?: string): Date | null {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const parsed = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateKey(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function studyDays(calendar: RoadmapCalendar, course: RoadmapItem): number[] {
  const values = Array.isArray(course.studyDays) ? course.studyDays : calendar.studyDays;
  const days = (Array.isArray(values) ? values : [1, 2, 3, 4, 5]).filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);
  return days.length ? days : [1, 2, 3, 4, 5];
}

function inRange(date: Date, range: { start?: string; end?: string }): boolean {
  const start = parseRoadmapDate(range.start);
  const end = parseRoadmapDate(range.end);
  return Boolean(start && end && date >= start && date <= end);
}

function isBlockedDate(date: Date, course: RoadmapItem, calendar: RoadmapCalendar): boolean {
  if (course.useStudyCalendar === false) return false;
  const days = studyDays(calendar, course);
  if ((course.skipWeekends ?? calendar.skipWeekends ?? false) && !days.includes(date.getDay())) return true;

  const holidays = [...(calendar.publicHolidays || []), ...(course.publicHolidays || [])];
  if (course.usePublicHolidays !== false && holidays.some((entry) => (typeof entry === "string" ? entry : entry.date) === dateKey(date))) {
    if (course.countWeekendPublicHolidays || days.includes(date.getDay())) return true;
  }

  const terms = (calendar.schoolTerms || [])
    .map((term) => ({ start: parseRoadmapDate(term.start), end: parseRoadmapDate(term.end) }))
    .filter((term): term is { start: Date; end: Date } => Boolean(term.start && term.end))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  if (course.useSchoolTerms !== false && terms.length) {
    const windowStart = new Date(terms[0].start.getFullYear(), 0, 1);
    const windowEnd = terms[terms.length - 1].end;
    if (date >= windowStart && date <= windowEnd && !terms.some((term) => date >= term.start && date <= term.end)) return true;
  }

  const ranges = [...(calendar.blockedDateRanges || []), ...(course.blockedDateRanges || [])];
  if (ranges.some((range) => inRange(date, range))) return true;
  const blocked = [...(calendar.blockedDates || []), ...(course.blockedDates || [])];
  return blocked.some((entry) => (typeof entry === "string" ? entry : entry.date) === dateKey(date));
}

export function estimateCourseEndDate(course: RoadmapItem, calendar: RoadmapCalendar): Date | null {
  const explicit = parseRoadmapDate(course.endDate);
  if (explicit) return explicit;
  const start = parseRoadmapDate(course.startDate);
  const duration = Number(course.durationDays || 0) || Math.max(Number(course.durationHours || 0) / 8, 0);
  if (!start || !duration) return null;
  const end = new Date(start);
  let remaining = Math.ceil(duration);
  let safety = 0;
  while (remaining > 0 && safety < remaining + 2500) {
    end.setDate(end.getDate() + 1);
    if (!isBlockedDate(end, course, calendar)) remaining -= 1;
    safety += 1;
  }
  return end;
}

export function formatRoadmapDate(value?: string | Date | null, fallback = "TBC"): string {
  const date = value instanceof Date ? value : parseRoadmapDate(value || undefined);
  return date ? date.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : fallback;
}

export function normalizeStatus(value?: string): string {
  return String(value || "incomplete").toLowerCase().trim().replace(/[_\s]+/g, "-");
}

export function statusProgress(value?: string): number {
  const status = normalizeStatus(value);
  if (["complete", "completed", "certified", "uploaded"].includes(status)) return 100;
  if (["in-progress", "current", "active"].includes(status)) return 45;
  if (["ready", "booked", "scheduled"].includes(status)) return 20;
  if (["applied", "application-submitted"].includes(status)) return 1;
  return 0;
}

export function itemProgress(item: RoadmapItem): number {
  if (item.certificateImageUrl || item.certificateUrl || item.completedDate) return 100;
  return statusProgress(item.status);
}

export function courseProgress(course: RoadmapItem, calendar: RoadmapCalendar): number {
  const status = itemProgress(course);
  if (status >= 100) return 100;
  const start = parseRoadmapDate(course.startDate);
  const end = estimateCourseEndDate(course, calendar);
  if (!start || !end || end <= start) return status;
  const now = new Date();
  const dateValue = now >= end ? 100 : now <= start ? 0 : ((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100;
  return Math.max(status, dateValue);
}

export function milestoneProgress(item: RoadmapItem, courses: Map<string, RoadmapItem>, calendar: RoadmapCalendar): number {
  const values: number[] = [];
  (item.courseIds || []).forEach((id) => {
    const course = courses.get(id);
    if (course) values.push(courseProgress(course, calendar));
  });
  (item.checklist || []).forEach((entry) => values.push(itemProgress(entry)));
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : statusProgress(item.status);
}

export function statusLabel(item: RoadmapItem): string {
  if (item.certificateImageUrl || item.certificateUrl) return "evidence uploaded";
  const status = normalizeStatus(item.status);
  if (["complete", "completed", "certified", "uploaded"].includes(status)) return item.evidenceLabel?.toLowerCase() || "complete";
  if (["in-progress", "current", "active"].includes(status)) return "in progress";
  if (["ready", "booked", "scheduled"].includes(status)) return status.replace(/-/g, " ");
  if (["applied", "application-submitted"].includes(status)) return "applied";
  return "incomplete";
}

export function statusClass(item: RoadmapItem): string {
  const status = normalizeStatus(item.status);
  if (["applied", "application-submitted"].includes(status)) return "is-applied";
  const progress = itemProgress(item);
  if (progress >= 100) return "is-complete";
  if (progress > 0) return "is-active";
  return "is-incomplete";
}

export function roadmapStageKind(item: RoadmapItem, index: number): string {
  const title = String(item.title || "").toLowerCase();
  if (item.optional) return "is-optional";
  if (title.includes("qualification")) return "is-qualification";
  if (title.includes("health") || title.includes("fitness")) return "is-readiness";
  if (title.includes("apply") || title.includes("home")) return "is-application";
  if (title.includes("training") || index >= 3) return "is-training";
  return "is-general";
}

export function estimatedCompletion(roadmap: CareerRoadmapConfig): string {
  if (roadmap.targetDate) return formatRoadmapDate(roadmap.targetDate);
  const dates = (roadmap.courses || [])
    .map((course) => estimateCourseEndDate(course, roadmap.studyCalendar || {}))
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => b.getTime() - a.getTime());
  return dates[0] ? formatRoadmapDate(dates[0]) : "Add course dates";
}
