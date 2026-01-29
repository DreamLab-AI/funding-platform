import { FundingCallModel } from '../models/fundingCall.model';
import { ApplicationModel } from '../models/application.model';
import { AssessmentModel } from '../models/assessment.model';
import {
  FundingCall,
  Application,
  Assessment,
  Criterion,
  CriterionScore,
  ApplicationResult,
  AssessorScore,
  CriterionAggregate,
  MasterResultsResponse,
  CallProgress,
  AssessorProgress,
  AssignmentStatus,
} from '../types';
import {
  calculateAverage,
  calculateVariance,
  calculateWeightedAverage,
  calculateStdDev,
} from '../utils/helpers';
import { query } from '../config/database';

export class ScoringService {
  /**
   * Calculate aggregated results for a single application
   */
  static async calculateApplicationResult(
    application: Application,
    call: FundingCall
  ): Promise<ApplicationResult> {
    // Get all submitted assessments with assessor info
    const assessmentsWithInfo = await AssessmentModel.getWithAssessorInfo(
      application.application_id
    );

    // Build assessor scores
    const assessorScores: AssessorScore[] = assessmentsWithInfo.map((assessment) => ({
      assessor_id: assessment.assessor_id,
      assessor_name: assessment.assessor_name,
      scores: assessment.scores,
      overall_score: assessment.overall_score,
      overall_comment: assessment.overall_comment || undefined,
      submitted_at: assessment.submitted_at,
    }));

    // Calculate criterion aggregates
    const criterionAggregates: CriterionAggregate[] = call.criteria.map((criterion) => {
      const scores: number[] = [];

      for (const assessment of assessmentsWithInfo) {
        const score = assessment.scores.find(
          (s) => s.criterion_id === criterion.criterion_id
        );
        if (score) {
          scores.push(score.score);
        }
      }

      const average = calculateAverage(scores);
      const variance = calculateVariance(scores);
      const highVarianceThreshold = call.variance_threshold || 20;

      return {
        criterion_id: criterion.criterion_id,
        criterion_name: criterion.name,
        max_points: criterion.max_points,
        weight: criterion.weight,
        scores,
        average,
        min: scores.length > 0 ? Math.min(...scores) : 0,
        max: scores.length > 0 ? Math.max(...scores) : 0,
        variance,
        high_variance:
          scores.length >= 2 &&
          (variance / Math.pow(criterion.max_points, 2)) * 100 > highVarianceThreshold,
      };
    });

    // Calculate total average
    const allScores = assessorScores.map((a) => a.overall_score);
    const totalAverage = calculateAverage(allScores);

    // Calculate weighted average if weights are defined
    let weightedAverage: number | undefined;
    const hasWeights = call.criteria.some((c) => c.weight !== undefined && c.weight > 0);

    if (hasWeights) {
      const weightedScoresByAssessor = assessmentsWithInfo.map((assessment) => {
        const values: number[] = [];
        const weights: number[] = [];

        for (const criterion of call.criteria) {
          const score = assessment.scores.find(
            (s) => s.criterion_id === criterion.criterion_id
          );
          if (score) {
            values.push(score.score);
            weights.push(criterion.weight || 1);
          }
        }

        return calculateWeightedAverage(values, weights);
      });

      weightedAverage = calculateAverage(weightedScoresByAssessor);
    }

    // Calculate total variance
    const totalVariance = calculateVariance(allScores);
    const highVarianceFlag = criterionAggregates.some((c) => c.high_variance);

    return {
      application_id: application.application_id,
      reference_number: application.reference_number,
      applicant_name: application.applicant_name,
      applicant_organisation: application.applicant_organisation,
      assessor_scores: assessorScores,
      criterion_aggregates: criterionAggregates,
      total_average: totalAverage,
      weighted_average: weightedAverage,
      total_variance: totalVariance,
      high_variance_flag: highVarianceFlag,
      assessments_completed: assessmentsWithInfo.length,
      assessments_required: call.required_assessors_per_application,
    };
  }

  /**
   * Get master results for a funding call
   */
  static async getMasterResults(call_id: string): Promise<MasterResultsResponse> {
    const call = await FundingCallModel.findById(call_id);
    if (!call) {
      throw new Error('Funding call not found');
    }

    // Get all submitted applications
    const { applications } = await ApplicationModel.listByCall(call_id, {
      status: 'submitted' as any,
      limit: 10000,
    });

    // Calculate results for each application
    const results: ApplicationResult[] = [];

    for (const appSummary of applications) {
      const application = await ApplicationModel.findById(appSummary.application_id);
      if (application) {
        const result = await this.calculateApplicationResult(application, call);
        results.push(result);
      }
    }

    // Calculate summary statistics
    const fullyAssessed = results.filter(
      (r) => r.assessments_completed >= r.assessments_required
    ).length;
    const partiallyAssessed = results.filter(
      (r) => r.assessments_completed > 0 && r.assessments_completed < r.assessments_required
    ).length;
    const notAssessed = results.filter((r) => r.assessments_completed === 0).length;
    const highVarianceCount = results.filter((r) => r.high_variance_flag).length;

    return {
      call_id,
      call_name: call.name,
      results,
      summary: {
        total_applications: results.length,
        fully_assessed: fullyAssessed,
        partially_assessed: partiallyAssessed,
        not_assessed: notAssessed,
        high_variance_count: highVarianceCount,
      },
    };
  }

  /**
   * Get progress statistics for a funding call
   */
  static async getCallProgress(call_id: string): Promise<CallProgress> {
    const call = await FundingCallModel.findById(call_id);
    if (!call) {
      throw new Error('Funding call not found');
    }

    // Get application counts
    const appCountResult = await query<{ count: string }>(
      "SELECT COUNT(*) FROM applications WHERE call_id = $1 AND status = 'submitted'",
      [call_id]
    );
    const totalApplications = parseInt(appCountResult.rows[0].count, 10);

    // Get assignment counts
    const assignmentCountResult = await query<{ count: string }>(
      `SELECT COUNT(*) FROM assignments asn
       JOIN applications a ON asn.application_id = a.application_id
       WHERE a.call_id = $1`,
      [call_id]
    );
    const totalAssignments = parseInt(assignmentCountResult.rows[0].count, 10);

    // Get completed assessment counts
    const completedResult = await query<{ count: string }>(
      `SELECT COUNT(*) FROM assessments ass
       JOIN assignments asn ON ass.assignment_id = asn.assignment_id
       JOIN applications a ON asn.application_id = a.application_id
       WHERE a.call_id = $1 AND ass.status = 'submitted'`,
      [call_id]
    );
    const completedAssessments = parseInt(completedResult.rows[0].count, 10);

    // Get assessor progress
    const assessorProgressResult = await query<{
      assessor_id: string;
      first_name: string;
      last_name: string;
      email: string;
      assigned_count: string;
      completed_count: string;
      last_activity: Date | null;
    }>(
      `SELECT
        u.user_id as assessor_id,
        u.first_name,
        u.last_name,
        u.email,
        COUNT(asn.assignment_id) as assigned_count,
        COUNT(CASE WHEN ass.status = 'submitted' THEN 1 END) as completed_count,
        MAX(ass.submitted_at) as last_activity
       FROM assessor_pool ap
       JOIN users u ON ap.user_id = u.user_id
       LEFT JOIN assignments asn ON asn.assessor_id = u.user_id
         AND asn.application_id IN (SELECT application_id FROM applications WHERE call_id = $1)
       LEFT JOIN assessments ass ON ass.assignment_id = asn.assignment_id
       WHERE ap.call_id = $1 AND ap.is_active = true
       GROUP BY u.user_id, u.first_name, u.last_name, u.email
       ORDER BY u.last_name, u.first_name`,
      [call_id]
    );

    const assessorProgress: AssessorProgress[] = assessorProgressResult.rows.map((row) => ({
      assessor_id: row.assessor_id,
      assessor_name: `${row.first_name} ${row.last_name}`,
      assessor_email: row.email,
      assigned_count: parseInt(row.assigned_count, 10),
      completed_count: parseInt(row.completed_count, 10),
      outstanding_count:
        parseInt(row.assigned_count, 10) - parseInt(row.completed_count, 10),
      last_activity: row.last_activity || undefined,
    }));

    const completionPercentage =
      totalAssignments > 0
        ? Math.round((completedAssessments / totalAssignments) * 100)
        : 0;

    return {
      call_id,
      call_name: call.name,
      status: call.status,
      total_applications: totalApplications,
      total_assignments: totalAssignments,
      completed_assessments: completedAssessments,
      outstanding_assessments: totalAssignments - completedAssessments,
      completion_percentage: completionPercentage,
      assessor_progress: assessorProgress,
    };
  }

  /**
   * Calculate individual assessor's scores for an application
   */
  static calculateAssessorTotal(
    scores: CriterionScore[],
    criteria: Criterion[]
  ): { total: number; weighted: number | undefined } {
    const total = scores.reduce((sum, s) => sum + s.score, 0);

    const hasWeights = criteria.some((c) => c.weight !== undefined && c.weight > 0);
    let weighted: number | undefined;

    if (hasWeights) {
      const values: number[] = [];
      const weights: number[] = [];

      for (const criterion of criteria) {
        const score = scores.find((s) => s.criterion_id === criterion.criterion_id);
        if (score) {
          values.push(score.score);
          weights.push(criterion.weight || 1);
        }
      }

      weighted = calculateWeightedAverage(values, weights);
    }

    return { total, weighted };
  }

  /**
   * Validate that scores are within valid ranges
   */
  static validateScores(
    scores: CriterionScore[],
    criteria: Criterion[]
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check all criteria have scores
    for (const criterion of criteria) {
      const score = scores.find((s) => s.criterion_id === criterion.criterion_id);

      if (!score) {
        errors.push(`Missing score for criterion: ${criterion.name}`);
        continue;
      }

      if (score.score < 0) {
        errors.push(`Score for ${criterion.name} cannot be negative`);
      }

      if (score.score > criterion.max_points) {
        errors.push(
          `Score for ${criterion.name} exceeds maximum (${criterion.max_points})`
        );
      }

      if (criterion.comments_required && !score.comment?.trim()) {
        errors.push(`Comment required for criterion: ${criterion.name}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get assessors with outstanding assessments
   */
  static async getAssessorsWithOutstanding(call_id: string): Promise<AssessorProgress[]> {
    const progress = await this.getCallProgress(call_id);
    return progress.assessor_progress.filter((a) => a.outstanding_count > 0);
  }

  /**
   * Rank applications by score
   */
  static rankResults(
    results: ApplicationResult[],
    sortBy: 'total' | 'weighted' = 'total'
  ): ApplicationResult[] {
    return [...results].sort((a, b) => {
      const aScore =
        sortBy === 'weighted' && a.weighted_average !== undefined
          ? a.weighted_average
          : a.total_average;
      const bScore =
        sortBy === 'weighted' && b.weighted_average !== undefined
          ? b.weighted_average
          : b.total_average;

      return bScore - aScore; // Descending order
    });
  }
}

// Proxy object that delegates to static methods
export const scoringService = {
  calculateApplicationResult: ScoringService.calculateApplicationResult,
  getMasterResults: ScoringService.getMasterResults,
  getCallProgress: ScoringService.getCallProgress,
  calculateAssessorTotal: ScoringService.calculateAssessorTotal,
  calculateTotal: ScoringService.calculateAssessorTotal, // Alias
  calculateBreakdown: ScoringService.calculateAssessorTotal, // Alias
  validateScores: ScoringService.validateScores,
  getAssessorsWithOutstanding: ScoringService.getAssessorsWithOutstanding,
  rankResults: ScoringService.rankResults,
};

export default ScoringService;
