export type IssueCategory =
  | 'pothole'
  | 'broken_streetlight'
  | 'garbage_dump'
  | 'water_leakage'
  | 'drainage_overflow'
  | 'damaged_road'
  | 'encroachment'
  | 'fallen_tree'
  | 'other';

export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical';

export type IssueStatus =
  | 'reported'
  | 'verified'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'reopened';

export type LocationSensitivity =
  | 'standard'
  | 'near_school'
  | 'near_hospital'
  | 'major_intersection'
  | 'public_transit';

export type UserRole =
  | 'citizen'
  | 'moderator'
  | 'field_officer'
  | 'department_admin'
  | 'super_admin';

export interface Comment {
  id: string;
  authorName: string;
  isOfficial: boolean;
  message: string;
  createdAt: string;
}

export interface TimelineEntry {
  id: string;
  actorName: string;
  oldStatus?: string;
  newStatus: string;
  notes: string;
  evidenceUrl?: string;
  createdAt: string;
}

export interface Issue {
  id: string;
  ticketNumber: string;
  reporterId: string;
  reporterName: string;
  reporterKarma: number;
  title: string;
  description: string;
  category: IssueCategory;
  severity: IssueSeverity;
  status: IssueStatus;
  latitude: number;
  longitude: number;
  address: string;
  wardNumber: number;
  locationSensitivity: LocationSensitivity;
  photoUrl: string;
  resolutionPhotoUrl?: string;
  isAnonymous: boolean;
  priorityScore: number;
  upvotesCount: number;
  affectedCount: number;
  userHasUpvoted?: boolean;
  assignedDept: string;
  assignedOfficerName?: string;
  slaHours: number;
  slaDeadline: string;
  resolvedAt?: string;
  resolutionRating?: number;
  resolutionFeedback?: string;
  createdAt: string;
  updatedAt: string;
  comments: Comment[];
  timeline: TimelineEntry[];
}

export interface DuplicateIssueMatch {
  id: string;
  ticketNumber: string;
  title: string;
  category: IssueCategory;
  distanceMeters: number;
  status: IssueStatus;
  upvotesCount: number;
  photoUrl: string;
}

export interface OfflineQueuedReport {
  localId: string;
  title: string;
  description: string;
  category: IssueCategory;
  severity: IssueSeverity;
  latitude: number;
  longitude: number;
  address: string;
  wardNumber: number;
  locationSensitivity: LocationSensitivity;
  photoUrl: string;
  isAnonymous: boolean;
  reporterName: string;
  queuedAt: string;
}

export interface TransparencyStats {
  total: number;
  resolved: number;
  inProgress: number;
  reported: number;
  slaBreached: number;
  resolutionRate: number;
  avgResolutionHours: number;
  categoryCounts: Record<string, number>;
  wardCounts: Record<number, number>;
  topReporters: Array<{
    name: string;
    karma: number;
    verifiedReports: number;
    badge: string;
  }>;
}
