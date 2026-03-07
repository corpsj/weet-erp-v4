/**
 * Marketing module types for WEET ERP v4
 * Covers: Leads, Proposals, Content, Market Signals, Lead Actions, Daily Metrics, Settings
 */

// ============================================================================
// Data Models
// ============================================================================

export type MarketingLead = {
  id: string;
  platform: string;
  username: string;
  score: number;
  personaType: string | null;
  journeyStage: string;
  source: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export const JOURNEY_STAGE_LABELS: Record<string, string> = {
  awareness: "인지",
  interest: "관심",
  consideration: "고려",
  decision: "결정",
  conversion: "전환",
  retention: "유지",
};

export type MarketingProposal = {
  id: string;
  signalId: string | null;
  title: string;
  actionType: string | null;
  contentDraft: string | null;
  status: string;
  approvedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
};

export type ProposalRow = {
  id: string;
  signal_id: string | null;
  title: string;
  action_type: string | null;
  content_draft: string | null;
  status: string;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
};

export function mapProposal(proposal: ProposalRow): MarketingProposal {
  return {
    id: proposal.id,
    signalId: proposal.signal_id,
    title: proposal.title,
    actionType: proposal.action_type,
    contentDraft: proposal.content_draft,
    status: proposal.status,
    approvedAt: proposal.approved_at,
    rejectionReason: proposal.rejection_reason,
    createdAt: proposal.created_at,
  };
}

export type MarketingContent = {
  id: string;
  channel: string;
  title: string | null;
  body: string;
  status: string;
  engagementMetrics: Record<string, unknown>;
  personaTarget: string | null;
  createdAt: string;
  publishedAt: string | null;
  publishedBy: 'manual' | 'openclaw';
  openclawJobId?: string | null;
};

export type MarketSignal = {
  id: string;
  source: string;
  signalType: string | null;
  title: string | null;
  summary: string | null;
  urgency: string;
  sentiment: string | null;
  keywords: string[];
  url: string | null;
  collectedAt: string;
};

export type LeadAction = {
  id: string;
  leadId: string;
  actionType: string | null;
  details: Record<string, unknown>;
  performedAt: string;
};

export type DailyMetric = {
  id: string;
  date: string;
  leadsCollected: number;
  proposalsMade: number;
  proposalsApproved: number;
  contentsPublished: number;
  createdAt: string;
};

export type DailyMetricsResponse = {
  metrics: DailyMetric[];
  summary: {
    totalLeads: number;
    totalProposals: number;
    totalApproved: number;
    totalPublished: number;
  };
};

export type MarketingSetting = {
  key: string;
  value: unknown;
  updatedAt: string;
};

export type Competitor = {
  username: string;
  displayName: string;
  notes: string;
  isActive: boolean;
  addedAt: string;
};

export const SOURCE_LABELS: Record<string, string> = {
  competitor_comment: "경쟁사 댓글",
  naver_cafe_question: "카페 질문",
  high_intent_hashtag: "해시태그",
  competitor_liker: "경쟁사 좋아요",
  youtube_commenter: "유튜브 댓글",
  competitor_follower: "경쟁사 팔로워",
};

export const CONTENT_STATUS_LABELS: Record<string, string> = {
  draft: "초안",
  review: "검토 중",
  approved: "승인",
  published: "발행됨",
  archived: "보관",
};

export const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  pending: "대기중",
  approved: "승인됨",
  rejected: "거부됨",
};

// ============================================================================
// API Response Types
// ============================================================================

export type MarketingOverview = {
  totalLeads: number;
  pendingProposals: number;
  publishedContent: number;
  channelStats: Record<string, number>;
  trends: {
    leadsChange: number;
    proposalsChange: number;
    contentChange: number;
  };
  recentActivity: Array<{
    id: string;
    type: "lead_created" | "proposal_approved" | "proposal_rejected" | "content_published";
    title: string;
    createdAt: string;
  }>;
};

export type SystemStatus = {
  scheduler: { running: boolean; lastRun: string | null; nextRun: string | null };
  ollama: { connected: boolean; model: string };
  naverQuota: { used: number; limit: number; resetAt: string | null };
};

export type SystemStatusResponse = {
  data: SystemStatus;
};

export type OpenClawAgent = {
  id: string;
  model: string;
};

export type OpenClawStatus = {
  status: "online" | "offline";
  agents: OpenClawAgent[];
  skillsCount: number;
  lastChecked: string;
};

// ============================================================================
// Filter Types
// ============================================================================

export type LeadFilters = {
  scoreMin?: number;
  persona?: string;
  stage?: string;
};

export type ProposalFilters = {
  status?: string;
};

export type ContentFilters = {
  channel?: string;
};
