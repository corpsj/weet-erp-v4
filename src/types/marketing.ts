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

export type MarketingSetting = {
  key: string;
  value: string | null;
  updatedAt: string;
};

// ============================================================================
// API Response Types
// ============================================================================

export type MarketingOverview = {
  totalLeads: number;
  pendingProposals: number;
  publishedContent: number;
  channelStats: Record<string, number>;
};

export type SystemStatus = {
  scheduler: string;
  ollama: string;
  naverQuota: number;
};

export type SystemStatusResponse = {
  data: SystemStatus;
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
