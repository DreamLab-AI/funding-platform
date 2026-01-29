// =============================================================================
// AI Features - Export All Feature Modules
// =============================================================================

export {
  summarizeApplication,
  generateBriefSummary,
  extractThemes,
  comparativeAnalysis,
} from './summarize';

export {
  generateScoringSuggestions,
  suggestCriterionScore,
  analyzeScoreConsistency,
  suggestFeedback,
} from './scoring-assist';

export {
  detectScoringAnomalies,
  detectApplicationAnomalies,
} from './anomaly';

export {
  findSimilarApplications,
  indexApplication,
  removeFromIndex,
  batchIndexApplications,
  getIndexStats,
  clearIndex,
} from './similarity';
