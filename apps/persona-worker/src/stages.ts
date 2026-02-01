/**
 * Journey Stage Detection
 *
 * Detects visitor's journey stage based on behavioral signals.
 * Uses rule-based logic with signal pattern matching.
 *
 * Stages (from CDP Playbook):
 * 1. unaware - Not looking for solutions yet
 * 2. aware - Recognizes they have a problem
 * 3. receptive - Open to learning about solutions
 * 4. zmot - Zero Moment of Truth (actively researching)
 * 5. objections - Has concerns/questions
 * 6. test_prep - Preparing to try
 * 7. challenge - Using product, facing initial challenges
 * 8. success - Seeing results
 * 9. commitment - Repeat customer
 * 10. evangelist - Actively recommending
 */

import type { Signal, JourneyStage, VisitorData } from './types';

// Stage detection rules
interface StageRule {
  stage: JourneyStage;
  priority: number;
  check: (visitor: VisitorData) => boolean;
}

// Stage detection rules (higher priority = checked first)
const STAGE_RULES: StageRule[] = [
  // Evangelist: Multiple purchases + engagement after success
  {
    stage: 'evangelist',
    priority: 100,
    check: (v) => {
      const purchases = countSignalType(v.signals, 'purchase');
      const hasReview = v.signals.some((s) =>
        s.type === 'content_engagement' && s.metadata?.engagement_type === 'review'
      );
      return purchases >= 3 && hasReview;
    },
  },

  // Commitment: Repeat purchases (2+)
  {
    stage: 'commitment',
    priority: 90,
    check: (v) => countSignalType(v.signals, 'purchase') >= 2,
  },

  // Success: Has purchased and returned to site
  {
    stage: 'success',
    priority: 80,
    check: (v) => {
      const hasPurchase = countSignalType(v.signals, 'purchase') >= 1;
      const hasReturnVisit = countSignalType(v.signals, 'return_visit') >= 1;
      return hasPurchase && hasReturnVisit;
    },
  },

  // Challenge: Just purchased, first time
  {
    stage: 'challenge',
    priority: 70,
    check: (v) => countSignalType(v.signals, 'purchase') === 1,
  },

  // Test prep: Added to cart but not purchased
  {
    stage: 'test_prep',
    priority: 60,
    check: (v) => {
      const hasCart = countSignalType(v.signals, 'add_to_cart') >= 1;
      const noPurchase = countSignalType(v.signals, 'purchase') === 0;
      return hasCart && noPurchase;
    },
  },

  // Objections: Viewed FAQ, contact, returns, or comparison content
  {
    stage: 'objections',
    priority: 50,
    check: (v) => {
      const objectionPages = ['/faq', '/contact', '/returns', '/guarantee', '/compare', '/vs'];
      return v.signals.some((s) =>
        s.type === 'page_view' && objectionPages.some((p) => s.value.includes(p))
      );
    },
  },

  // ZMOT: Multiple product views or search + product view
  {
    stage: 'zmot',
    priority: 40,
    check: (v) => {
      const productViews = countSignalType(v.signals, 'product_view');
      const hasSearch = countSignalType(v.signals, 'search_query') >= 1;
      return productViews >= 2 || (hasSearch && productViews >= 1);
    },
  },

  // Receptive: Engaged with educational content
  {
    stage: 'receptive',
    priority: 30,
    check: (v) => {
      const contentEngagement = countSignalType(v.signals, 'content_engagement');
      const blogViews = v.signals.filter((s) =>
        s.type === 'page_view' && (s.value.includes('/blog') || s.value.includes('/podcast'))
      ).length;
      return contentEngagement >= 1 || blogViews >= 2;
    },
  },

  // Aware: Single product view or collection view
  {
    stage: 'aware',
    priority: 20,
    check: (v) => {
      const productViews = countSignalType(v.signals, 'product_view');
      const collectionViews = countSignalType(v.signals, 'collection_view');
      return productViews >= 1 || collectionViews >= 1;
    },
  },

  // Unaware: Just landing page or minimal engagement
  {
    stage: 'unaware',
    priority: 10,
    check: () => true, // Default fallback
  },
];

/**
 * Count signals of a specific type
 */
function countSignalType(signals: Signal[], type: Signal['type']): number {
  return signals.filter((s) => s.type === type).length;
}

/**
 * Detect journey stage from visitor signals
 */
export function detectJourneyStage(visitor: VisitorData): JourneyStage {
  // Sort rules by priority (highest first)
  const sortedRules = [...STAGE_RULES].sort((a, b) => b.priority - a.priority);

  for (const rule of sortedRules) {
    if (rule.check(visitor)) {
      return rule.stage;
    }
  }

  return 'unaware';
}

/**
 * Calculate stage confidence
 */
export function calculateStageConfidence(
  visitor: VisitorData,
  stage: JourneyStage
): number {
  const signalCount = visitor.signals.length;

  // Base confidence on signal count
  let confidence = Math.min(signalCount / 10, 0.5);

  // Add confidence for stronger stage indicators
  switch (stage) {
    case 'evangelist':
    case 'commitment':
    case 'success':
    case 'challenge':
      confidence += 0.4; // Purchase is strong signal
      break;
    case 'test_prep':
      confidence += 0.3; // Cart is good signal
      break;
    case 'zmot':
    case 'objections':
      confidence += 0.2;
      break;
    default:
      confidence += 0.1;
  }

  return Math.min(confidence, 1);
}

/**
 * Update stage history if stage changed
 */
export function updateStageHistory(
  visitor: VisitorData,
  newStage: JourneyStage
): VisitorData['stage_history'] {
  const history = visitor.stage_history || [];

  // Only add if different from last stage
  if (history.length === 0 || history[history.length - 1].stage !== newStage) {
    history.push({
      stage: newStage,
      entered_at: new Date().toISOString(),
    });
  }

  // Keep last 10 transitions
  return history.slice(-10);
}

/**
 * Get stage display name for UI
 */
export function getStageDisplayName(stage: JourneyStage): string {
  const names: Record<JourneyStage, string> = {
    unaware: 'New Visitor',
    aware: 'Problem Aware',
    receptive: 'Learning',
    zmot: 'Researching',
    objections: 'Has Questions',
    test_prep: 'Ready to Try',
    challenge: 'New Customer',
    success: 'Seeing Results',
    commitment: 'Loyal Customer',
    evangelist: 'Advocate',
  };
  return names[stage];
}

/**
 * Get suggested content for stage
 */
export function getStagedContentSuggestion(stage: JourneyStage): {
  primaryCta: string;
  contentFocus: string;
} {
  const suggestions: Record<JourneyStage, { primaryCta: string; contentFocus: string }> = {
    unaware: {
      primaryCta: 'Learn More',
      contentFocus: 'Problem education, blog content',
    },
    aware: {
      primaryCta: 'Explore Solutions',
      contentFocus: 'Solution overview, product categories',
    },
    receptive: {
      primaryCta: 'See How It Works',
      contentFocus: 'Educational content, how-to guides',
    },
    zmot: {
      primaryCta: 'Compare Options',
      contentFocus: 'Product comparison, case studies',
    },
    objections: {
      primaryCta: 'Get Answers',
      contentFocus: 'FAQ, guarantees, testimonials',
    },
    test_prep: {
      primaryCta: 'Start Your Trial',
      contentFocus: 'Starter bundles, first-time offers',
    },
    challenge: {
      primaryCta: 'Get Support',
      contentFocus: 'Usage guides, support resources',
    },
    success: {
      primaryCta: 'Reorder',
      contentFocus: 'Reorder prompts, complementary products',
    },
    commitment: {
      primaryCta: 'Save with Subscriptions',
      contentFocus: 'Subscription options, bulk deals',
    },
    evangelist: {
      primaryCta: 'Refer a Friend',
      contentFocus: 'Referral program, review requests',
    },
  };

  return suggestions[stage];
}
