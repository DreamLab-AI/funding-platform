import ExcelJS from 'exceljs';
import {
  ApplicationListItem,
  MasterResultsResponse,
  ApplicationResult,
  ExportOptions,
  ExportResult,
} from '../types';
import { formatDate } from '../utils/helpers';

export class ExportService {
  /**
   * Export applications metadata to XLSX
   */
  static async exportApplicationsToXlsx(
    applications: ApplicationListItem[],
    callName: string
  ): Promise<ExportResult> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Funding Platform';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Applications');

    // Define columns
    worksheet.columns = [
      { header: 'Reference', key: 'reference_number', width: 20 },
      { header: 'Applicant Name', key: 'applicant_name', width: 30 },
      { header: 'Email', key: 'applicant_email', width: 30 },
      { header: 'Organisation', key: 'applicant_organisation', width: 30 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Files', key: 'file_count', width: 10 },
      { header: 'Confirmations', key: 'confirmation_count', width: 15 },
      { header: 'Assignments', key: 'assignment_count', width: 15 },
      { header: 'Completed Assessments', key: 'completed_assessments', width: 20 },
      { header: 'Submitted At', key: 'submitted_at', width: 20 },
      { header: 'Created At', key: 'created_at', width: 20 },
    ];

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1D4ED8' },
    };
    headerRow.font = { color: { argb: 'FFFFFFFF' }, bold: true };

    // Add data
    applications.forEach((app) => {
      worksheet.addRow({
        reference_number: app.reference_number,
        applicant_name: app.applicant_name,
        applicant_email: app.applicant_email,
        applicant_organisation: app.applicant_organisation || '',
        status: app.status,
        file_count: app.file_count,
        confirmation_count: app.confirmation_count,
        assignment_count: app.assignment_count,
        completed_assessments: app.completed_assessments,
        submitted_at: app.submitted_at
          ? formatDate(app.submitted_at, 'YYYY-MM-DD HH:mm')
          : '',
        created_at: formatDate(app.created_at, 'YYYY-MM-DD HH:mm'),
      });
    });

    // Auto-filter
    worksheet.autoFilter = {
      from: 'A1',
      to: `K${applications.length + 1}`,
    };

    const buffer = await workbook.xlsx.writeBuffer();

    return {
      filename: `${callName.replace(/[^a-z0-9]/gi, '_')}_applications_${formatDate(new Date(), 'YYYYMMDD')}.xlsx`,
      content_type:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from(buffer),
    };
  }

  /**
   * Export applications metadata to CSV
   */
  static async exportApplicationsToCsv(
    applications: ApplicationListItem[],
    callName: string
  ): Promise<ExportResult> {
    const headers = [
      'Reference',
      'Applicant Name',
      'Email',
      'Organisation',
      'Status',
      'Files',
      'Confirmations',
      'Assignments',
      'Completed Assessments',
      'Submitted At',
      'Created At',
    ];

    const rows = applications.map((app) => [
      app.reference_number,
      `"${app.applicant_name.replace(/"/g, '""')}"`,
      app.applicant_email,
      `"${(app.applicant_organisation || '').replace(/"/g, '""')}"`,
      app.status,
      app.file_count.toString(),
      app.confirmation_count.toString(),
      app.assignment_count.toString(),
      app.completed_assessments.toString(),
      app.submitted_at ? formatDate(app.submitted_at, 'YYYY-MM-DD HH:mm') : '',
      formatDate(app.created_at, 'YYYY-MM-DD HH:mm'),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    return {
      filename: `${callName.replace(/[^a-z0-9]/gi, '_')}_applications_${formatDate(new Date(), 'YYYYMMDD')}.csv`,
      content_type: 'text/csv',
      buffer: Buffer.from(csv, 'utf-8'),
    };
  }

  /**
   * Export master results to XLSX
   */
  static async exportMasterResultsToXlsx(
    results: MasterResultsResponse
  ): Promise<ExportResult> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Funding Platform';
    workbook.created = new Date();

    // Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 },
    ];

    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFFFF' } },
      fill: {
        type: 'pattern' as const,
        pattern: 'solid' as const,
        fgColor: { argb: 'FF1D4ED8' },
      },
    };

    summarySheet.getRow(1).font = headerStyle.font;
    summarySheet.getRow(1).fill = headerStyle.fill;

    summarySheet.addRows([
      { metric: 'Call Name', value: results.call_name },
      { metric: 'Total Applications', value: results.summary.total_applications },
      { metric: 'Fully Assessed', value: results.summary.fully_assessed },
      { metric: 'Partially Assessed', value: results.summary.partially_assessed },
      { metric: 'Not Assessed', value: results.summary.not_assessed },
      { metric: 'High Variance Applications', value: results.summary.high_variance_count },
    ]);

    // Results Sheet
    const resultsSheet = workbook.addWorksheet('Results');

    // Build dynamic columns based on criteria
    const criteriaNames =
      results.results.length > 0
        ? results.results[0].criterion_aggregates.map((c) => c.criterion_name)
        : [];

    const columns: Partial<ExcelJS.Column>[] = [
      { header: 'Reference', key: 'reference', width: 20 },
      { header: 'Applicant', key: 'applicant', width: 25 },
      { header: 'Organisation', key: 'organisation', width: 25 },
      { header: 'Assessments', key: 'assessments', width: 15 },
    ];

    // Add criterion columns
    criteriaNames.forEach((name) => {
      columns.push({
        header: `${name} (Avg)`,
        key: `criterion_${name}_avg`,
        width: 15,
      });
      columns.push({
        header: `${name} (Var)`,
        key: `criterion_${name}_var`,
        width: 12,
      });
    });

    columns.push(
      { header: 'Total Average', key: 'total_avg', width: 15 },
      { header: 'Weighted Average', key: 'weighted_avg', width: 15 },
      { header: 'Total Variance', key: 'variance', width: 15 },
      { header: 'High Variance', key: 'high_variance', width: 15 }
    );

    resultsSheet.columns = columns;

    // Style header
    resultsSheet.getRow(1).font = headerStyle.font;
    resultsSheet.getRow(1).fill = headerStyle.fill;

    // Add data
    results.results.forEach((result) => {
      const row: Record<string, unknown> = {
        reference: result.reference_number,
        applicant: result.applicant_name,
        organisation: result.applicant_organisation || '',
        assessments: `${result.assessments_completed}/${result.assessments_required}`,
      };

      result.criterion_aggregates.forEach((agg) => {
        row[`criterion_${agg.criterion_name}_avg`] = Math.round(agg.average * 100) / 100;
        row[`criterion_${agg.criterion_name}_var`] = Math.round(agg.variance * 100) / 100;
      });

      row.total_avg = Math.round(result.total_average * 100) / 100;
      row.weighted_avg =
        result.weighted_average !== undefined
          ? Math.round(result.weighted_average * 100) / 100
          : 'N/A';
      row.variance = Math.round(result.total_variance * 100) / 100;
      row.high_variance = result.high_variance_flag ? 'Yes' : 'No';

      resultsSheet.addRow(row);
    });

    // Add conditional formatting for high variance
    const highVarianceCol = columns.findIndex((c) => c.key === 'high_variance') + 1;
    for (let i = 2; i <= results.results.length + 1; i++) {
      const cell = resultsSheet.getCell(i, highVarianceCol);
      if (cell.value === 'Yes') {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFEE2E2' },
        };
        cell.font = { color: { argb: 'FFDC2626' } };
      }
    }

    // Detailed Assessments Sheet
    const detailSheet = workbook.addWorksheet('Assessor Details');
    const detailColumns: Partial<ExcelJS.Column>[] = [
      { header: 'Reference', key: 'reference', width: 20 },
      { header: 'Assessor', key: 'assessor', width: 25 },
    ];

    criteriaNames.forEach((name) => {
      detailColumns.push({
        header: `${name} Score`,
        key: `${name}_score`,
        width: 15,
      });
      detailColumns.push({
        header: `${name} Comment`,
        key: `${name}_comment`,
        width: 30,
      });
    });

    detailColumns.push(
      { header: 'Overall Score', key: 'overall', width: 15 },
      { header: 'Overall Comment', key: 'overall_comment', width: 40 }
    );

    detailSheet.columns = detailColumns;
    detailSheet.getRow(1).font = headerStyle.font;
    detailSheet.getRow(1).fill = headerStyle.fill;

    results.results.forEach((result) => {
      result.assessor_scores.forEach((assessor) => {
        const row: Record<string, unknown> = {
          reference: result.reference_number,
          assessor: assessor.assessor_name,
        };

        assessor.scores.forEach((score) => {
          const criterion = result.criterion_aggregates.find(
            (c) => c.criterion_id === score.criterion_id
          );
          if (criterion) {
            row[`${criterion.criterion_name}_score`] = score.score;
            row[`${criterion.criterion_name}_comment`] = score.comment || '';
          }
        });

        row.overall = assessor.overall_score;
        row.overall_comment = assessor.overall_comment || '';

        detailSheet.addRow(row);
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return {
      filename: `${results.call_name.replace(/[^a-z0-9]/gi, '_')}_master_results_${formatDate(new Date(), 'YYYYMMDD')}.xlsx`,
      content_type:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from(buffer),
    };
  }

  /**
   * Export data based on options
   */
  static async exportApplications(
    applications: ApplicationListItem[],
    callName: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    if (options.format === 'csv') {
      return this.exportApplicationsToCsv(applications, callName);
    }
    return this.exportApplicationsToXlsx(applications, callName);
  }
}

export default ExportService;
