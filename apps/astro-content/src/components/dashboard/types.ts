/**
 * CDP Dashboard TypeScript Types
 */

export type TimeRange = '7d' | '30d' | '90d';

export interface TunnelMetrics {
  id: string;
  label: string;
  views: number;
  conversions: number;
  conversionRate: number;
  revenue: number;
  avgOrderValue: number;
  trend: number;
}

export interface ABTestVariant {
  variant: string;
  visitors: number;
  conversions: number;
  conversionRate: number;
  revenue: number;
  lift?: number;
}

export interface ABTestResult {
  testId: string;
  status: 'running' | 'completed' | 'stopped';
  startDate: string;
  endDate?: string;
  sampleSize: number;
  control: ABTestVariant;
  treatment: ABTestVariant;
  confidence: number;
  winner: 'control' | 'treatment' | null;
}

export interface PersonaDistributionItem {
  persona: string;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

export interface JourneyStageItem {
  stage: string;
  label: string;
  count: number;
  percentage: number;
}

export interface CDPMetrics {
  lastUpdated: string;
  range: TimeRange;
  tunnels: {
    betty: TunnelMetrics;
    bill: TunnelMetrics;
    taylor: TunnelMetrics;
  };
  abTests: {
    tunnelVsGeneric: ABTestResult;
  };
  personaDistribution: PersonaDistributionItem[];
  journeyFunnel: JourneyStageItem[];
}

export interface CDPEvent {
  id: string;
  timestamp: string;
  type: string;
  persona: string | null;
  stage: string | null;
  properties: Record<string, unknown>;
}

export interface SearchQuery {
  query: string;
  count: number;
  avgResults: number;
  zeroResultRate: number;
}
