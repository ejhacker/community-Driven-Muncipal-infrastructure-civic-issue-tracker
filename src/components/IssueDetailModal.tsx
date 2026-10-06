import React, { useState } from 'react';
import {
  X,
  MapPin,
  Clock,
  ThumbsUp,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  Share2,
  Shield,
  Star,
  RefreshCw,
  Building2,
  Camera,
  ChevronRight,
} from 'lucide-react';
import { Issue, UserRole } from '../types';
import { translations, Language } from '../utils/translations';
import confetti from 'canvas-confetti';

interface IssueDetailModalProps {
  issue: Issue | null;
  isOpen: boolean;
  onClose: () => void;
  onIssueUpdated: () => void;
  currentRole: UserRole;
  lang: Language;
}

export const IssueDetailModal: React.FC<IssueDetailModalProps> = ({
  issue,
  isOpen,
  onClose,
  onIssueUpdated,
  currentRole,
  lang,
}) => {
  const t = translations[lang];

  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [rating, setRating] = useState<number>(5);
  const [reopenFeedback, setReopenFeedback] = useState('');
  const [showReopenInput, setShowReopenInput] = useState(false);

  // Officer Triage Form State
  const [officerNextStatus, setOfficerNextStatus] = useState<string>('in_progress');
  const [officerNotes, setOfficerNotes] = useState('');
  const [resolutionPhoto, setResolutionPhoto] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen || !issue) return null;

  const isStaff =
    currentRole === 'field_officer' ||
    currentRole === 'department_admin' ||
    currentRole === 'super_admin' ||
    currentRole === 'moderator';

  // SLA calculation
  const slaDeadline = new Date(issue.slaDeadline).getTime();
  const now = Date.now();
  const isBreached = issue.status !== 'resolved' && slaDeadline < now;
  const hoursRemaining = Math.max(0, Math.round((slaDeadline - now) / (3600 * 1000)));

  // Upvote / Affected Handler
  const handleUpvote = async (isAffected: boolean) => {
    try {
      const res = await fetch(`/api/issues/${issue.id}/upvote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAffected }),
      });
      if (res.ok) {
        confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 } });
        onIssueUpdated();
      }
    } catch (err) {
      console.error('Failed to upvote:', err);
    }
  };

  // Add Comment Handler
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setIsSubmittingComment(true);
    try {
      const res = await fetch(`/api/issues/${issue.id}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorName: isStaff ? `${currentRole.toUpperCase()} Officer` : 'Citizen Contributor',
          isOfficial: isStaff,
          message: commentText.trim(),
        }),
      });

      if (res.ok) {
        setCommentText('');
        onIssueUpdated();
      }
    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Officer Status Update Handler
  const handleOfficerStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingStatus(true);

    try {
      const res = await fetch(`/api/issues/${issue.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newStatus: officerNextStatus,
          officerName: `${currentRole.replace('_', ' ').toUpperCase()} Officer`,
          notes: officerNotes || `Status updated to ${officerNextStatus}`,
          resolutionPhotoUrl: resolutionPhoto || undefined,
        }),
      });

      if (res.ok) {
        confetti({ particleCount: 60, spread: 70 });
        setOfficerNotes('');
        setResolutionPhoto('');
        onIssueUpdated();
      }
    } catch (err) {
      console.error('Status update failed:', err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Citizen Rating or Reopen
  const handleRateOrReopen = async (reopen: boolean) => {
    try {
      const res = await fetch(`/api/issues/${issue.id}/rate-resolution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          feedback: reopen ? reopenFeedback : 'Resolution verified by community.',
          reopen,
          citizenName: 'Community Inspector',
        }),
      });

      if (res.ok) {
        setShowReopenInput(false);
        onIssueUpdated();
      }
    } catch (err) {
      console.error('Rate/reopen failed:', err);
    }
  };

  // Copy shareable link
  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.origin + '?ticket=' + issue.ticketNumber);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold bg-teal-600/80 text-white px-2 py-0.5 rounded">
              {issue.ticketNumber}
            </span>
            <span className="text-xs text-slate-300">Ward {issue.wardNumber}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors text-xs flex items-center gap-1"
              title="Share public issue link"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">{copiedLink ? 'Copied!' : 'Share'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Photos: Before & After Split if Resolved */}
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
                  <Camera className="w-3.5 h-3.5 text-slate-400" />
                  ORIGINAL REPORT PHOTO (BEFORE)
                </div>
                <img
                  src={issue.photoUrl}
                  alt="Original civic defect"
                  className="w-full h-44 object-cover rounded-xl shadow-xs border border-slate-200"
                />
              </div>

              {issue.resolutionPhotoUrl ? (
                <div>
                  <div className="text-[11px] font-bold text-emerald-700 mb-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    MUNICIPAL RESOLUTION PROOF (AFTER)
                  </div>
                  <img
                    src={issue.resolutionPhotoUrl}
                    alt="Resolution proof"
                    className="w-full h-44 object-cover rounded-xl shadow-xs border-2 border-emerald-500"
                  />
                </div>
              ) : (
                <div className="hidden sm:flex flex-col items-center justify-center h-44 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-slate-400 p-4 text-center">
                  <Clock className="w-6 h-6 text-slate-300 mb-1" />
                  <span className="text-xs font-medium">Work in Progress</span>
                  <span className="text-[10px]">Field crew before/after proof will appear here upon completion</span>
                </div>
              )}
            </div>
          </div>

          {/* Status & SLA Badges */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Status:</span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                issue.status === 'resolved'
                  ? 'bg-emerald-100 text-emerald-800'
                  : issue.status === 'in_progress'
                  ? 'bg-blue-100 text-blue-800'
                  : issue.status === 'assigned'
                  ? 'bg-purple-100 text-purple-800'
                  : issue.status === 'reopened'
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {issue.status.replace('_', ' ')}
              </span>
              <span className="text-xs font-semibold text-slate-500">Severity:</span>
              <span className="text-xs font-bold capitalize text-slate-800">{issue.severity}</span>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <Clock className={`w-4 h-4 ${isBreached ? 'text-rose-600' : 'text-slate-500'}`} />
              {issue.status === 'resolved' ? (
                <span className="text-emerald-700 font-bold">Closed within SLA</span>
              ) : isBreached ? (
                <span className="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded">
                  ⚠️ SLA Breached (Target: {issue.slaHours}h)
                </span>
              ) : (
                <span className="text-slate-700 font-medium">
                  {hoursRemaining}h remaining on SLA
                </span>
              )}
            </div>
          </div>

          {/* Main Title & Description */}
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">{issue.title}</h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">{issue.description}</p>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-2">
              <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span>{issue.address}</span>
            </div>
          </div>

          {/* Priority Score Breakdown Card */}
          <div className="p-3 bg-teal-50/70 border border-teal-200/80 rounded-xl flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-teal-950 flex items-center gap-1.5">
                <span>Calculated Priority Score: {issue.priorityScore}</span>
                <span className="text-[10px] bg-teal-200 text-teal-900 px-1.5 py-0.2 rounded font-semibold">
                  Triage Algorithm
                </span>
              </div>
              <div className="text-[11px] text-teal-800 mt-0.5">
                f({issue.upvotesCount} upvotes, {issue.severity} hazard, {issue.locationSensitivity.replace('_', ' ')} zone)
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-semibold text-slate-700">Assigned Department:</div>
              <div className="text-xs font-bold text-slate-900 flex items-center justify-end gap-1">
                <Building2 className="w-3.5 h-3.5 text-teal-700" />
                {issue.assignedDept}
              </div>
            </div>
          </div>

          {/* Community Validation & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              onClick={() => handleUpvote(false)}
              className={`flex-1 min-w-[130px] py-2 px-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 transition-all ${
                issue.userHasUpvoted
                  ? 'bg-teal-700 text-white border-teal-700 shadow-sm'
                  : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300'
              }`}
            >
              <ThumbsUp className="w-4 h-4" />
              <span>{t.upvote} ({issue.upvotesCount})</span>
            </button>

            <button
              onClick={() => handleUpvote(true)}
              className="flex-1 min-w-[150px] py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold rounded-xl border border-amber-200 flex items-center justify-center gap-1.5 transition-all"
            >
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>{t.affectedToo} ({issue.affectedCount})</span>
            </button>
          </div>

          {/* Resolution Rating / Reopen (if resolved) */}
          {issue.status === 'resolved' && (
            <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span>Citizen Resolution Transparency & Feedback</span>
                </div>
                {issue.resolutionRating && (
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-200/80 px-2 py-0.5 rounded">
                    ★ {issue.resolutionRating} / 5 Stars
                  </span>
                )}
              </div>

              {issue.resolutionFeedback && (
                <p className="text-xs text-emerald-900 italic bg-white/70 p-2 rounded border border-emerald-100">
                  "{issue.resolutionFeedback}"
                </p>
              )}

              {!showReopenInput ? (
                <div className="flex items-center gap-3 pt-1">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setRating(s);
                          handleRateOrReopen(false);
                        }}
                        className={`text-base hover:scale-125 transition-transform ${
                          s <= (issue.resolutionRating || rating)
                            ? 'text-amber-500 fill-amber-500'
                            : 'text-slate-300'
                        }`}
                      >
                        ★
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setShowReopenInput(true)}
                    className="ml-auto text-xs font-bold text-rose-700 hover:text-rose-900 underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {t.reopenIssue}
                  </button>
                </div>
              ) : (
                <div className="space-y-2 pt-2 border-t border-emerald-200">
                  <textarea
                    rows={2}
                    placeholder="Describe why this issue is not fixed (e.g. crater only half-filled)..."
                    value={reopenFeedback}
                    onChange={(e) => setReopenFeedback(e.target.value)}
                    className="w-full p-2 text-xs border border-rose-300 rounded-lg bg-white"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setShowReopenInput(false)}
                      className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleRateOrReopen(true)}
                      className="px-3 py-1 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-lg"
                    >
                      Confirm Reopen Ticket
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Field Officer & Admin Municipal Triage Panel */}
          {isStaff && (
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-purple-900">
                <Shield className="w-4 h-4 text-purple-700" />
                <span>Municipal Authority Dispatch Panel ({currentRole.replace('_', ' ')})</span>
              </div>

              <form onSubmit={handleOfficerStatusSubmit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-purple-800 mb-1">
                      Transition Status
                    </label>
                    <select
                      value={officerNextStatus}
                      onChange={(e) => setOfficerNextStatus(e.target.value)}
                      className="w-full p-2 text-xs border border-purple-300 rounded-lg bg-white font-medium"
                    >
                      <option value="verified">Verified (Confirm On-Ground)</option>
                      <option value="assigned">Assigned (Issue Work Order)</option>
                      <option value="in_progress">In Progress (Crews Deployed)</option>
                      <option value="resolved">Resolved (Upload Completion Proof)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-purple-800 mb-1">
                      Resolution Photo URL (Optional)
                    </label>
                    <input
                      type="url"
                      placeholder="https://... after photo"
                      value={resolutionPhoto}
                      onChange={(e) => setResolutionPhoto(e.target.value)}
                      className="w-full p-2 text-xs border border-purple-300 rounded-lg bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-purple-800 mb-1">
                    Public Transparency Note / Work Order Remarks
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Work crew dispatched; hot-mix asphalt patching completed."
                    value={officerNotes}
                    onChange={(e) => setOfficerNotes(e.target.value)}
                    className="w-full p-2 text-xs border border-purple-300 rounded-lg bg-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isUpdatingStatus}
                  className="w-full py-2 bg-purple-800 hover:bg-purple-900 text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5"
                >
                  {isUpdatingStatus ? 'Applying Triage...' : 'Execute Municipal Status Update'}
                </button>
              </form>
            </div>
          )}

          {/* Audit Timeline */}
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5">
              Public Transparency Audit Log
            </h3>
            <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {issue.timeline.map((entry) => (
                <div key={entry.id} className="relative pl-7 text-xs">
                  <div className="absolute left-1.5 top-1 w-3.5 h-3.5 rounded-full bg-teal-600 border-2 border-white shadow-xs" />
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 capitalize">
                      {entry.newStatus.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(entry.createdAt).toLocaleDateString()} {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-[11px] text-teal-800 font-medium">{entry.actorName}</div>
                  <div className="text-slate-600 mt-0.5">{entry.notes}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Community Comments Section */}
          <div className="pt-2 border-t border-slate-200">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-teal-600" />
              Community Discussion ({issue.comments.length})
            </h3>

            <div className="space-y-2.5 max-h-48 overflow-y-auto mb-3">
              {issue.comments.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No community comments yet. Be the first to add details.</p>
              ) : (
                issue.comments.map((comment) => (
                  <div
                    key={comment.id}
                    className={`p-2.5 rounded-xl text-xs ${
                      comment.isOfficial
                        ? 'bg-teal-50 border border-teal-200 text-teal-950'
                        : 'bg-slate-50 border border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold flex items-center gap-1">
                        {comment.authorName}
                        {comment.isOfficial && (
                          <span className="text-[10px] bg-teal-700 text-white font-semibold px-1.5 py-0.2 rounded">
                            Official
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-slate-700 leading-relaxed">{comment.message}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAddComment} className="flex gap-2">
              <input
                type="text"
                placeholder="Add note, photo landmark, or follow-up..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-teal-500 bg-white"
              />
              <button
                type="submit"
                disabled={isSubmittingComment || !commentText.trim()}
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl disabled:opacity-50 transition-all shrink-0"
              >
                Comment
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
