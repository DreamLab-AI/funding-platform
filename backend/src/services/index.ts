export { ScoringService } from './scoring.service';
export { EmailService } from './email.service';
export { FileService } from './file.service';
export { ExportService } from './export.service';

// AI Service exports
export { AIService, getAIService, resetAIService } from '../ai/ai.service';

// AI Feature function exports (named exports of individual feature functions)
export {
  summarizeApplication,
  generateBriefSummary,
  extractThemes,
  comparativeAnalysis,
  generateScoringSuggestions,
  suggestCriterionScore,
  analyzeScoreConsistency,
  suggestFeedback,
  detectScoringAnomalies,
  detectApplicationAnomalies,
  findSimilarApplications,
  indexApplication,
  removeFromIndex,
  batchIndexApplications,
  getIndexStats,
  clearIndex,
} from '../ai/features';
