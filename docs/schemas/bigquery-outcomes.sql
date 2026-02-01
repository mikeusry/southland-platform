-- =============================================================================
-- BigQuery Schema: CDP Outcome Tracking
-- =============================================================================
--
-- Tables for capturing customer outcomes from:
-- 1. Post-purchase surveys (Betty & Bill)
-- 2. Sales call logs (phone outcomes)
-- 3. Computed outcome metrics
--
-- Dataset: southland_cdp
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: outcome_surveys
-- Raw survey submissions from /survey/backyard and /survey/commercial
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `southland_cdp.outcome_surveys` (
  -- Survey identification
  submission_id STRING NOT NULL,
  survey_id STRING NOT NULL,          -- 'backyard-outcome-v1', 'commercial-outcome-v1'
  persona STRING NOT NULL,            -- 'backyard', 'commercial', 'lawn'

  -- Customer identification (for joining with orders)
  order_id STRING,
  email STRING,
  flow_id STRING,                     -- Klaviyo flow that triggered survey

  -- Timestamps
  submitted_at TIMESTAMP NOT NULL,
  received_at TIMESTAMP NOT NULL,

  -- Source tracking
  page_url STRING,
  referrer STRING,
  user_agent STRING,
  ip_country STRING,

  -- Survey responses (stored as JSON for flexibility)
  responses JSON NOT NULL,

  -- Computed scores (extracted from responses for easy querying)
  nps_score INT64,                    -- 1-10 NPS rating
  overall_health_rating INT64,        -- Betty: 1-5 health rating
  fcr_change STRING,                  -- Bill: FCR improvement level
  mortality_change STRING,            -- Bill: Mortality reduction level
  problem_solved STRING,              -- Whether product solved their problem
  will_reorder STRING,                -- Likelihood to reorder

  -- Quantitative outcomes (when provided)
  fcr_before FLOAT64,
  fcr_after FLOAT64,
  mortality_before FLOAT64,
  mortality_after FLOAT64,

  -- Testimonial/case study
  testimonial_text STRING,
  can_contact BOOL,
  contact_phone STRING,

  -- Metadata
  _meta JSON
)
PARTITION BY DATE(submitted_at)
CLUSTER BY persona, survey_id;


-- -----------------------------------------------------------------------------
-- Table: sales_outcome_logs
-- Manual logs from sales team about phone call outcomes (Bill's 34% phone revenue)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `southland_cdp.sales_outcome_logs` (
  -- Log identification
  log_id STRING NOT NULL,

  -- Customer identification
  customer_name STRING,
  customer_email STRING,
  customer_phone STRING,
  company_name STRING,

  -- Sales context
  sales_rep STRING NOT NULL,
  call_date DATE NOT NULL,
  call_type STRING,                   -- 'inbound', 'outbound', 'follow_up'

  -- Outcome data
  outcome_type STRING NOT NULL,       -- 'fcr_improvement', 'mortality_reduction', 'reorder', 'referral', 'testimonial'
  outcome_details STRING,

  -- Quantitative outcomes
  fcr_improvement_pct FLOAT64,
  mortality_reduction_pct FLOAT64,
  order_value FLOAT64,

  -- Customer profile
  operation_type STRING,              -- 'broiler_contract', 'layer', etc.
  house_count INT64,
  bird_capacity STRING,
  integrator STRING,

  -- Products discussed
  products_mentioned ARRAY<STRING>,

  -- Follow-up
  follow_up_needed BOOL,
  follow_up_notes STRING,

  -- Timestamps
  logged_at TIMESTAMP NOT NULL,

  -- Metadata
  _meta JSON
)
PARTITION BY call_date
CLUSTER BY outcome_type, sales_rep;


-- -----------------------------------------------------------------------------
-- Table: computed_outcomes
-- Aggregated outcome metrics per customer, updated periodically
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `southland_cdp.computed_outcomes` (
  -- Customer identification
  customer_id STRING NOT NULL,        -- Shopify customer ID or email hash
  email STRING,

  -- Persona classification
  primary_persona STRING,             -- Most likely persona based on behavior
  persona_confidence FLOAT64,         -- 0-1 confidence score

  -- Outcome scores (computed from surveys + sales logs)
  outcome_score FLOAT64,              -- 0-100 composite score
  nps_score INT64,                    -- Latest NPS
  satisfaction_score FLOAT64,         -- Average satisfaction

  -- Specific outcomes
  has_fcr_improvement BOOL,
  fcr_improvement_pct FLOAT64,
  has_mortality_reduction BOOL,
  mortality_reduction_pct FLOAT64,
  problem_solved BOOL,

  -- Engagement
  survey_count INT64,
  last_survey_date DATE,
  testimonial_given BOOL,
  can_be_case_study BOOL,

  -- Lifetime value signals
  total_orders INT64,
  total_revenue FLOAT64,
  average_order_value FLOAT64,
  days_since_last_order INT64,
  predicted_ltv FLOAT64,

  -- Timestamps
  first_purchase_date DATE,
  last_purchase_date DATE,
  computed_at TIMESTAMP NOT NULL,

  -- Source data versions
  surveys_version INT64,
  sales_logs_version INT64
)
CLUSTER BY primary_persona, outcome_score;


-- -----------------------------------------------------------------------------
-- Views for common queries
-- -----------------------------------------------------------------------------

-- Betty outcomes summary
CREATE OR REPLACE VIEW `southland_cdp.v_betty_outcomes` AS
SELECT
  DATE(submitted_at) as survey_date,
  COUNT(*) as surveys_completed,
  AVG(nps_score) as avg_nps,
  AVG(overall_health_rating) as avg_health_rating,
  COUNTIF(problem_solved IN ('yes_completely', 'yes_improved')) / COUNT(*) as problem_solved_rate,
  COUNTIF(will_reorder IN ('definitely', 'probably')) / COUNT(*) as reorder_intent_rate
FROM `southland_cdp.outcome_surveys`
WHERE persona = 'backyard'
GROUP BY DATE(submitted_at);


-- Bill outcomes summary
CREATE OR REPLACE VIEW `southland_cdp.v_bill_outcomes` AS
SELECT
  DATE(submitted_at) as survey_date,
  COUNT(*) as surveys_completed,
  AVG(nps_score) as avg_nps,
  COUNTIF(fcr_change IN ('significant_improvement', 'moderate_improvement')) / COUNT(*) as fcr_improved_rate,
  COUNTIF(mortality_change IN ('significant_reduction', 'moderate_reduction')) / COUNT(*) as mortality_reduced_rate,
  AVG(SAFE_CAST(JSON_VALUE(responses, '$.roi_assessment') AS STRING)) as roi_assessment_mode,
  COUNTIF(will_reorder = 'definitely') / COUNT(*) as definite_reorder_rate
FROM `southland_cdp.outcome_surveys`
WHERE persona = 'commercial'
GROUP BY DATE(submitted_at);


-- Phone outcome summary (Bill's blind spot)
CREATE OR REPLACE VIEW `southland_cdp.v_phone_outcomes` AS
SELECT
  call_date,
  sales_rep,
  COUNT(*) as calls_logged,
  COUNTIF(outcome_type = 'fcr_improvement') as fcr_improvements,
  COUNTIF(outcome_type = 'mortality_reduction') as mortality_reductions,
  COUNTIF(outcome_type = 'reorder') as reorders,
  COUNTIF(outcome_type = 'referral') as referrals,
  SUM(order_value) as total_order_value
FROM `southland_cdp.sales_outcome_logs`
GROUP BY call_date, sales_rep;


-- Proof points dashboard query
CREATE OR REPLACE VIEW `southland_cdp.v_proof_points` AS
SELECT
  persona,
  COUNT(DISTINCT COALESCE(email, order_id)) as unique_customers,
  AVG(nps_score) as avg_nps,
  COUNTIF(nps_score >= 9) as promoters,
  COUNTIF(nps_score <= 6) as detractors,
  (COUNTIF(nps_score >= 9) - COUNTIF(nps_score <= 6)) / COUNT(*) * 100 as net_promoter_score,
  COUNTIF(testimonial_text IS NOT NULL AND testimonial_text != '') as testimonials_collected,
  COUNTIF(can_contact = TRUE) as available_for_case_study
FROM `southland_cdp.outcome_surveys`
GROUP BY persona;


-- =============================================================================
-- Indexes and optimization notes
-- =============================================================================
--
-- Partitioning:
-- - outcome_surveys: Partitioned by submitted_at for time-based queries
-- - sales_outcome_logs: Partitioned by call_date for daily reporting
--
-- Clustering:
-- - outcome_surveys: Clustered by persona, survey_id for filtered queries
-- - sales_outcome_logs: Clustered by outcome_type, sales_rep for rep dashboards
-- - computed_outcomes: Clustered by persona, outcome_score for segmentation
--
-- Cost optimization:
-- - Use streaming inserts for real-time survey submissions
-- - Batch load sales_outcome_logs daily
-- - Run computed_outcomes refresh as scheduled query (daily or weekly)
-- =============================================================================
