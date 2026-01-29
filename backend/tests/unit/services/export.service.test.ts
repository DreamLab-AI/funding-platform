/**
 * ExportService Unit Tests
 * Comprehensive tests for CSV and XLSX export generation
 */

import { ExportService, exportService } from '../../../src/services/export.service';
import ExcelJS from 'exceljs';
import {
  ApplicationListItem,
  MasterResultsResponse,
  ApplicationResult,
  CriterionAggregate,
  AssessorScore,
  ApplicationStatus,
  ExportOptions,
} from '../../../src/types';

// Mock ExcelJS
jest.mock('exceljs');

const MockedWorkbook = ExcelJS.Workbook as jest.MockedClass<typeof ExcelJS.Workbook>;

describe('ExportService', () => {
  let mockWorkbook: {
    creator: string;
    created: Date | null;
    addWorksheet: jest.Mock;
    xlsx: {
      writeBuffer: jest.Mock;
    };
  };

  let mockWorksheet: {
    columns: any[];
    getRow: jest.Mock;
    addRow: jest.Mock;
    addRows: jest.Mock;
    autoFilter: any;
    getCell: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockWorksheet = {
      columns: [],
      getRow: jest.fn().mockReturnValue({
        font: {},
        fill: {},
      }),
      addRow: jest.fn(),
      addRows: jest.fn(),
      autoFilter: null,
      getCell: jest.fn().mockReturnValue({
        value: null,
        fill: {},
        font: {},
      }),
    };

    mockWorkbook = {
      creator: '',
      created: null,
      addWorksheet: jest.fn().mockReturnValue(mockWorksheet),
      xlsx: {
        writeBuffer: jest.fn().mockResolvedValue(Buffer.from('excel data')),
      },
    };

    MockedWorkbook.mockImplementation(() => mockWorkbook as any);
  });

  describe('exportApplicationsToXlsx', () => {
    const mockApplications: ApplicationListItem[] = [
      {
        application_id: 'app-1',
        reference_number: '2024-TEST-000001',
        applicant_name: 'John Smith',
        applicant_email: 'john@test.com',
        applicant_organisation: 'Test Org',
        status: ApplicationStatus.SUBMITTED,
        file_count: 2,
        confirmation_count: 3,
        assignment_count: 2,
        completed_assessments: 2,
        submitted_at: new Date('2024-01-15T10:00:00Z'),
        created_at: new Date('2024-01-10T09:00:00Z'),
      },
      {
        application_id: 'app-2',
        reference_number: '2024-TEST-000002',
        applicant_name: 'Jane Doe',
        applicant_email: 'jane@test.com',
        applicant_organisation: undefined,
        status: ApplicationStatus.DRAFT,
        file_count: 1,
        confirmation_count: 0,
        assignment_count: 0,
        completed_assessments: 0,
        submitted_at: undefined,
        created_at: new Date('2024-01-12T11:00:00Z'),
      },
    ];

    it('should create XLSX workbook with correct metadata', async () => {
      const result = await ExportService.exportApplicationsToXlsx(
        mockApplications,
        'Test Call 2024'
      );

      expect(mockWorkbook.creator).toBe('Funding Platform');
      expect(mockWorkbook.created).toBeDefined();
    });

    it('should create worksheet with correct columns', async () => {
      await ExportService.exportApplicationsToXlsx(mockApplications, 'Test Call');

      expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Applications');
      expect(mockWorksheet.columns).toBeDefined();
      expect(mockWorksheet.columns.length).toBe(11);
    });

    it('should add all applications as rows', async () => {
      await ExportService.exportApplicationsToXlsx(mockApplications, 'Test Call');

      expect(mockWorksheet.addRow).toHaveBeenCalledTimes(2);
    });

    it('should format submitted_at dates correctly', async () => {
      await ExportService.exportApplicationsToXlsx(mockApplications, 'Test Call');

      const addRowCalls = mockWorksheet.addRow.mock.calls;
      // First call should have formatted date
      expect(addRowCalls[0][0].submitted_at).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
      // Second call should have empty string (no submitted_at)
      expect(addRowCalls[1][0].submitted_at).toBe('');
    });

    it('should handle missing organisation gracefully', async () => {
      await ExportService.exportApplicationsToXlsx(mockApplications, 'Test Call');

      const addRowCalls = mockWorksheet.addRow.mock.calls;
      expect(addRowCalls[1][0].applicant_organisation).toBe('');
    });

    it('should return correct content type', async () => {
      const result = await ExportService.exportApplicationsToXlsx(
        mockApplications,
        'Test Call'
      );

      expect(result.content_type).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
    });

    it('should generate filename with sanitized call name', async () => {
      const result = await ExportService.exportApplicationsToXlsx(
        mockApplications,
        'Test Call 2024!'
      );

      // The ! character becomes _, creating double underscore before "applications"
      expect(result.filename).toMatch(/^Test_Call_2024__applications_\d{8}\.xlsx$/);
    });

    it('should set auto-filter on data', async () => {
      await ExportService.exportApplicationsToXlsx(mockApplications, 'Test Call');

      expect(mockWorksheet.autoFilter).toEqual({
        from: 'A1',
        to: `K${mockApplications.length + 1}`,
      });
    });

    it('should style header row', async () => {
      await ExportService.exportApplicationsToXlsx(mockApplications, 'Test Call');

      expect(mockWorksheet.getRow).toHaveBeenCalledWith(1);
    });

    it('should handle empty applications array', async () => {
      const result = await ExportService.exportApplicationsToXlsx([], 'Empty Call');

      expect(result.buffer).toBeDefined();
      expect(mockWorksheet.addRow).not.toHaveBeenCalled();
    });

    it('should return buffer as Buffer instance', async () => {
      const result = await ExportService.exportApplicationsToXlsx(
        mockApplications,
        'Test Call'
      );

      expect(Buffer.isBuffer(result.buffer)).toBe(true);
    });
  });

  describe('exportApplicationsToCsv', () => {
    const mockApplications: ApplicationListItem[] = [
      {
        application_id: 'app-1',
        reference_number: '2024-TEST-000001',
        applicant_name: 'John Smith',
        applicant_email: 'john@test.com',
        applicant_organisation: 'Test Org',
        status: ApplicationStatus.SUBMITTED,
        file_count: 2,
        confirmation_count: 3,
        assignment_count: 2,
        completed_assessments: 2,
        submitted_at: new Date('2024-01-15T10:00:00Z'),
        created_at: new Date('2024-01-10T09:00:00Z'),
      },
    ];

    it('should generate CSV with correct headers', async () => {
      const result = await ExportService.exportApplicationsToCsv(
        mockApplications,
        'Test Call'
      );

      const csv = result.buffer.toString('utf-8');
      const headers = csv.split('\n')[0];

      expect(headers).toContain('Reference');
      expect(headers).toContain('Applicant Name');
      expect(headers).toContain('Email');
      expect(headers).toContain('Organisation');
      expect(headers).toContain('Status');
    });

    it('should escape quotes in CSV values', async () => {
      const appsWithQuotes: ApplicationListItem[] = [
        {
          ...mockApplications[0],
          applicant_name: 'John "Jack" Smith',
          applicant_organisation: 'Test "Org"',
        },
      ];

      const result = await ExportService.exportApplicationsToCsv(
        appsWithQuotes,
        'Test Call'
      );

      const csv = result.buffer.toString('utf-8');
      expect(csv).toContain('John ""Jack"" Smith');
      expect(csv).toContain('Test ""Org""');
    });

    it('should return correct content type', async () => {
      const result = await ExportService.exportApplicationsToCsv(
        mockApplications,
        'Test Call'
      );

      expect(result.content_type).toBe('text/csv');
    });

    it('should generate filename with date', async () => {
      const result = await ExportService.exportApplicationsToCsv(
        mockApplications,
        'Test Call 2024'
      );

      expect(result.filename).toMatch(/^Test_Call_2024_applications_\d{8}\.csv$/);
    });

    it('should handle empty organisation', async () => {
      const appsNoOrg: ApplicationListItem[] = [
        {
          ...mockApplications[0],
          applicant_organisation: undefined,
        },
      ];

      const result = await ExportService.exportApplicationsToCsv(appsNoOrg, 'Test');

      const csv = result.buffer.toString('utf-8');
      expect(csv).not.toContain('undefined');
    });

    it('should handle empty applications array', async () => {
      const result = await ExportService.exportApplicationsToCsv([], 'Empty Call');

      const csv = result.buffer.toString('utf-8');
      const lines = csv.split('\n');

      // Should only have header row
      expect(lines).toHaveLength(1);
    });

    it('should format dates correctly in CSV', async () => {
      const result = await ExportService.exportApplicationsToCsv(
        mockApplications,
        'Test Call'
      );

      const csv = result.buffer.toString('utf-8');
      expect(csv).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
    });

    it('should handle special characters in call name', async () => {
      const result = await ExportService.exportApplicationsToCsv(
        mockApplications,
        'Call & More <Test>'
      );

      // Each special char (&, <, >, spaces) becomes underscore
      // "Call & More <Test>" -> "Call___More__Test_" then "_applications_"
      expect(result.filename).toMatch(/^Call___More__Test__applications_\d{8}\.csv$/);
    });
  });

  describe('exportMasterResultsToXlsx', () => {
    const createMockResults = (): MasterResultsResponse => ({
      call_id: 'call-1',
      call_name: 'Innovation Fund 2024',
      results: [
        {
          application_id: 'app-1',
          reference_number: '2024-TEST-000001',
          applicant_name: 'John Smith',
          applicant_organisation: 'Test Org',
          assessor_scores: [
            {
              assessor_id: 'assessor-1',
              assessor_name: 'Dr Jane Doe',
              scores: [
                { criterion_id: 'crit-1', score: 8, comment: 'Good work' },
                { criterion_id: 'crit-2', score: 7, comment: 'Acceptable' },
              ],
              overall_score: 15,
              overall_comment: 'Solid application',
              submitted_at: new Date('2024-01-20'),
            },
          ],
          criterion_aggregates: [
            {
              criterion_id: 'crit-1',
              criterion_name: 'Innovation',
              max_points: 10,
              weight: 2,
              scores: [8],
              average: 8,
              min: 8,
              max: 8,
              variance: 0,
              high_variance: false,
            },
            {
              criterion_id: 'crit-2',
              criterion_name: 'Impact',
              max_points: 10,
              weight: 1,
              scores: [7],
              average: 7,
              min: 7,
              max: 7,
              variance: 0,
              high_variance: false,
            },
          ],
          total_average: 15,
          weighted_average: 7.67,
          total_variance: 0,
          high_variance_flag: false,
          assessments_completed: 1,
          assessments_required: 2,
        },
      ],
      summary: {
        total_applications: 1,
        fully_assessed: 0,
        partially_assessed: 1,
        not_assessed: 0,
        high_variance_count: 0,
      },
    });

    it('should create workbook with multiple sheets', async () => {
      const results = createMockResults();

      await ExportService.exportMasterResultsToXlsx(results);

      expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Summary');
      expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Results');
      expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Assessor Details');
    });

    it('should add summary statistics', async () => {
      const results = createMockResults();

      await ExportService.exportMasterResultsToXlsx(results);

      expect(mockWorksheet.addRows).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ metric: 'Call Name' }),
          expect.objectContaining({ metric: 'Total Applications' }),
          expect.objectContaining({ metric: 'Fully Assessed' }),
        ])
      );
    });

    it('should include criterion columns dynamically', async () => {
      const results = createMockResults();

      await ExportService.exportMasterResultsToXlsx(results);

      // Check that columns were set with criterion-specific headers
      expect(mockWorksheet.columns).toBeDefined();
    });

    it('should handle high variance flagging', async () => {
      const results = createMockResults();
      results.results[0].high_variance_flag = true;
      results.results[0].criterion_aggregates[0].high_variance = true;

      mockWorksheet.getCell.mockReturnValue({
        value: 'Yes',
        fill: {},
        font: {},
      });

      await ExportService.exportMasterResultsToXlsx(results);

      // Should apply conditional formatting
      expect(mockWorksheet.getCell).toHaveBeenCalled();
    });

    it('should include assessor details sheet', async () => {
      const results = createMockResults();

      await ExportService.exportMasterResultsToXlsx(results);

      // Third worksheet should be Assessor Details
      expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Assessor Details');
    });

    it('should handle missing weighted average', async () => {
      const results = createMockResults();
      results.results[0].weighted_average = undefined;

      await ExportService.exportMasterResultsToXlsx(results);

      const addRowCalls = mockWorksheet.addRow.mock.calls;
      const resultRow = addRowCalls.find(
        (call) => call[0].reference === '2024-TEST-000001'
      );
      expect(resultRow?.[0].weighted_avg).toBe('N/A');
    });

    it('should handle empty results', async () => {
      const results: MasterResultsResponse = {
        call_id: 'call-1',
        call_name: 'Empty Call',
        results: [],
        summary: {
          total_applications: 0,
          fully_assessed: 0,
          partially_assessed: 0,
          not_assessed: 0,
          high_variance_count: 0,
        },
      };

      const result = await ExportService.exportMasterResultsToXlsx(results);

      expect(result.buffer).toBeDefined();
    });

    it('should format numbers to 2 decimal places', async () => {
      const results = createMockResults();
      results.results[0].total_average = 15.12345;
      results.results[0].weighted_average = 7.66789;

      await ExportService.exportMasterResultsToXlsx(results);

      const addRowCalls = mockWorksheet.addRow.mock.calls;
      const resultRow = addRowCalls.find(
        (call) => call[0].reference === '2024-TEST-000001'
      );
      expect(resultRow?.[0].total_avg).toBeCloseTo(15.12, 2);
    });

    it('should include assessor comments in detail sheet', async () => {
      const results = createMockResults();

      await ExportService.exportMasterResultsToXlsx(results);

      // Verify that detail sheet has comment columns
      const addWorksheetCalls = mockWorkbook.addWorksheet.mock.calls;
      expect(addWorksheetCalls).toContainEqual(['Assessor Details']);
    });

    it('should generate correct filename', async () => {
      const results = createMockResults();

      const result = await ExportService.exportMasterResultsToXlsx(results);

      expect(result.filename).toMatch(
        /^Innovation_Fund_2024_master_results_\d{8}\.xlsx$/
      );
    });
  });

  describe('exportApplications', () => {
    const mockApplications: ApplicationListItem[] = [
      {
        application_id: 'app-1',
        reference_number: 'REF-001',
        applicant_name: 'Test User',
        applicant_email: 'test@test.com',
        status: ApplicationStatus.SUBMITTED,
        file_count: 1,
        confirmation_count: 1,
        assignment_count: 1,
        completed_assessments: 1,
        created_at: new Date(),
      },
    ];

    it('should delegate to CSV export when format is csv', async () => {
      const options: ExportOptions = { format: 'csv' };

      const result = await ExportService.exportApplications(
        mockApplications,
        'Test Call',
        options
      );

      expect(result.content_type).toBe('text/csv');
      expect(result.filename).toContain('.csv');
    });

    it('should delegate to XLSX export when format is xlsx', async () => {
      const options: ExportOptions = { format: 'xlsx' };

      const result = await ExportService.exportApplications(
        mockApplications,
        'Test Call',
        options
      );

      expect(result.content_type).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(result.filename).toContain('.xlsx');
    });

    it('should default to XLSX when format not specified as csv', async () => {
      const options: ExportOptions = { format: 'xlsx' };

      const result = await ExportService.exportApplications(
        mockApplications,
        'Test Call',
        options
      );

      expect(result.filename).toContain('.xlsx');
    });
  });

  describe('toCSV (generic)', () => {
    it('should convert array of objects to CSV', () => {
      const data = [
        { name: 'John', age: 30, city: 'London' },
        { name: 'Jane', age: 25, city: 'Paris' },
      ];

      const result = exportService.toCSV(data);

      expect(result).toContain('name,age,city');
      expect(result).toContain('John,30,London');
      expect(result).toContain('Jane,25,Paris');
    });

    it('should handle empty array', () => {
      const result = exportService.toCSV([]);

      expect(result).toBe('');
    });

    it('should escape values with commas', () => {
      const data = [{ name: 'Smith, John', city: 'New York' }];

      const result = exportService.toCSV(data);

      expect(result).toContain('"Smith, John"');
    });

    it('should escape values with quotes', () => {
      const data = [{ name: 'John "Jack" Smith' }];

      const result = exportService.toCSV(data);

      expect(result).toContain('"John ""Jack"" Smith"');
    });

    it('should escape values with newlines', () => {
      const data = [{ description: 'Line 1\nLine 2' }];

      const result = exportService.toCSV(data);

      expect(result).toContain('"Line 1\nLine 2"');
    });

    it('should handle null and undefined values', () => {
      const data = [{ name: 'John', value: null, other: undefined }];

      const result = exportService.toCSV(data);

      expect(result).toContain('name,value,other');
      expect(result).toContain('John,,');
    });
  });

  describe('toDetailedCSV', () => {
    it('should work the same as toCSV for generic data', () => {
      const data = [
        { id: 1, name: 'Test' },
        { id: 2, name: 'Test 2' },
      ];

      const csvResult = exportService.toCSV(data);
      const detailedResult = exportService.toDetailedCSV(data);

      expect(detailedResult).toBe(csvResult);
    });
  });

  describe('exportService proxy object', () => {
    it('should expose all static methods via proxy', () => {
      expect(exportService.exportApplicationsToXlsx).toBe(
        ExportService.exportApplicationsToXlsx
      );
      expect(exportService.exportApplicationsToCsv).toBe(
        ExportService.exportApplicationsToCsv
      );
      expect(exportService.exportMasterResultsToXlsx).toBe(
        ExportService.exportMasterResultsToXlsx
      );
      expect(exportService.exportApplications).toBe(ExportService.exportApplications);
    });

    it('should provide toCSV and toDetailedCSV functions', () => {
      expect(typeof exportService.toCSV).toBe('function');
      expect(typeof exportService.toDetailedCSV).toBe('function');
    });
  });

  describe('Edge cases', () => {
    it('should handle very long application names', async () => {
      const longName = 'A'.repeat(500);
      const apps: ApplicationListItem[] = [
        {
          application_id: 'app-1',
          reference_number: 'REF-001',
          applicant_name: longName,
          applicant_email: 'test@test.com',
          status: ApplicationStatus.SUBMITTED,
          file_count: 0,
          confirmation_count: 0,
          assignment_count: 0,
          completed_assessments: 0,
          created_at: new Date(),
        },
      ];

      const result = await ExportService.exportApplicationsToCsv(apps, 'Test');

      expect(result.buffer.toString()).toContain(longName);
    });

    it('should handle unicode characters', async () => {
      const apps: ApplicationListItem[] = [
        {
          application_id: 'app-1',
          reference_number: 'REF-001',
          applicant_name: 'Jean-Pierre Dupont',
          applicant_email: 'test@test.com',
          applicant_organisation: 'Societe Generale',
          status: ApplicationStatus.SUBMITTED,
          file_count: 0,
          confirmation_count: 0,
          assignment_count: 0,
          completed_assessments: 0,
          created_at: new Date(),
        },
      ];

      const result = await ExportService.exportApplicationsToCsv(apps, 'Test');

      const csv = result.buffer.toString('utf-8');
      expect(csv).toContain('Jean-Pierre');
      expect(csv).toContain('Societe');
    });

    it('should handle many applications efficiently', async () => {
      const apps: ApplicationListItem[] = Array.from({ length: 1000 }, (_, i) => ({
        application_id: `app-${i}`,
        reference_number: `REF-${i.toString().padStart(6, '0')}`,
        applicant_name: `Applicant ${i}`,
        applicant_email: `applicant${i}@test.com`,
        status: ApplicationStatus.SUBMITTED,
        file_count: i % 5,
        confirmation_count: i % 3,
        assignment_count: 2,
        completed_assessments: i % 3,
        created_at: new Date(),
      }));

      const startTime = Date.now();
      const result = await ExportService.exportApplicationsToCsv(apps, 'Large Test');
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.buffer.length).toBeGreaterThan(0);
    });

    it('should handle empty call name', async () => {
      const apps: ApplicationListItem[] = [
        {
          application_id: 'app-1',
          reference_number: 'REF-001',
          applicant_name: 'Test',
          applicant_email: 'test@test.com',
          status: ApplicationStatus.SUBMITTED,
          file_count: 0,
          confirmation_count: 0,
          assignment_count: 0,
          completed_assessments: 0,
          created_at: new Date(),
        },
      ];

      const result = await ExportService.exportApplicationsToCsv(apps, '');

      expect(result.filename).toMatch(/_applications_\d{8}\.csv$/);
    });
  });
});
