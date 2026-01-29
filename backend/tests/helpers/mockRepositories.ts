/**
 * Mock Repository Factory
 * Creates mock repositories for unit testing
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Create a mock repository with standard CRUD operations
 */
export function createMockRepository<T extends { id?: string }>() {
  const store = new Map<string, T>();

  return {
    store,

    create: jest.fn(async (data: Partial<T>): Promise<T> => {
      const id = uuidv4();
      const entity = { ...data, id } as T;
      store.set(id, entity);
      return entity;
    }),

    findById: jest.fn(async (id: string): Promise<T | null> => {
      return store.get(id) || null;
    }),

    findOne: jest.fn(async (criteria: Partial<T>): Promise<T | null> => {
      for (const entity of store.values()) {
        const matches = Object.entries(criteria).every(
          ([key, value]) => (entity as any)[key] === value
        );
        if (matches) return entity;
      }
      return null;
    }),

    findAll: jest.fn(async (): Promise<T[]> => {
      return Array.from(store.values());
    }),

    findMany: jest.fn(async (criteria: Partial<T>): Promise<T[]> => {
      return Array.from(store.values()).filter(entity =>
        Object.entries(criteria).every(
          ([key, value]) => (entity as any)[key] === value
        )
      );
    }),

    update: jest.fn(async (id: string, data: Partial<T>): Promise<T | null> => {
      const existing = store.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...data };
      store.set(id, updated);
      return updated;
    }),

    delete: jest.fn(async (id: string): Promise<boolean> => {
      return store.delete(id);
    }),

    count: jest.fn(async (criteria?: Partial<T>): Promise<number> => {
      if (!criteria) return store.size;
      return Array.from(store.values()).filter(entity =>
        Object.entries(criteria).every(
          ([key, value]) => (entity as any)[key] === value
        )
      ).length;
    }),

    clear: () => {
      store.clear();
    },

    seed: (entities: T[]) => {
      entities.forEach(entity => {
        const id = (entity as any).id || uuidv4();
        store.set(id, { ...entity, id } as T);
      });
    },
  };
}

/**
 * Create mock FundingCall repository
 */
export function createMockFundingCallRepository() {
  const baseRepo = createMockRepository<any>();
  return {
    ...baseRepo,
    findOpenCalls: jest.fn(async () => {
      const now = new Date();
      return Array.from(baseRepo.store.values()).filter(
        call => call.status === 'open' && new Date(call.closeAt) > now
      );
    }),
    findByStatus: jest.fn(async (status: string) => {
      return Array.from(baseRepo.store.values()).filter(
        call => call.status === status
      );
    }),
  };
}

/**
 * Create mock Application repository
 */
export function createMockApplicationRepository() {
  const baseRepo = createMockRepository<any>();
  return {
    ...baseRepo,
    findByCallId: jest.fn(async (callId: string) => {
      return Array.from(baseRepo.store.values()).filter(
        app => app.callId === callId
      );
    }),
    findByApplicantEmail: jest.fn(async (email: string) => {
      return Array.from(baseRepo.store.values()).filter(
        app => app.applicantEmail === email
      );
    }),
    countByCallId: jest.fn(async (callId: string) => {
      return Array.from(baseRepo.store.values()).filter(
        app => app.callId === callId
      ).length;
    }),
  };
}

/**
 * Create mock Assignment repository
 */
export function createMockAssignmentRepository() {
  const baseRepo = createMockRepository<any>();
  return {
    ...baseRepo,
    findByAssessorId: jest.fn(async (assessorId: string) => {
      return Array.from(baseRepo.store.values()).filter(
        assignment => assignment.assessorId === assessorId
      );
    }),
    findByApplicationId: jest.fn(async (applicationId: string) => {
      return Array.from(baseRepo.store.values()).filter(
        assignment => assignment.applicationId === applicationId
      );
    }),
    findByCallId: jest.fn(async (callId: string) => {
      return Array.from(baseRepo.store.values()).filter(
        assignment => assignment.callId === callId
      );
    }),
  };
}

/**
 * Create mock Assessment repository
 */
export function createMockAssessmentRepository() {
  const baseRepo = createMockRepository<any>();
  return {
    ...baseRepo,
    findByAssignmentId: jest.fn(async (assignmentId: string) => {
      return Array.from(baseRepo.store.values()).find(
        assessment => assessment.assignmentId === assignmentId
      ) || null;
    }),
    findByApplicationId: jest.fn(async (applicationId: string) => {
      return Array.from(baseRepo.store.values()).filter(
        assessment => assessment.applicationId === applicationId
      );
    }),
    findCompletedByApplicationId: jest.fn(async (applicationId: string) => {
      return Array.from(baseRepo.store.values()).filter(
        assessment => assessment.applicationId === applicationId && assessment.status === 'submitted'
      );
    }),
  };
}

/**
 * Create mock Assessor repository
 */
export function createMockAssessorRepository() {
  const baseRepo = createMockRepository<any>();
  return {
    ...baseRepo,
    findByEmail: jest.fn(async (email: string) => {
      return Array.from(baseRepo.store.values()).find(
        assessor => assessor.email === email
      ) || null;
    }),
    findByCallId: jest.fn(async (callId: string) => {
      return Array.from(baseRepo.store.values()).filter(
        assessor => assessor.callIds?.includes(callId)
      );
    }),
  };
}

/**
 * Create mock AuditLog repository
 */
export function createMockAuditLogRepository() {
  const baseRepo = createMockRepository<any>();
  return {
    ...baseRepo,
    log: jest.fn(async (entry: any) => {
      const id = uuidv4();
      const logEntry = {
        ...entry,
        id,
        timestamp: new Date().toISOString(),
      };
      baseRepo.store.set(id, logEntry);
      return logEntry;
    }),
    findByTargetId: jest.fn(async (targetId: string) => {
      return Array.from(baseRepo.store.values()).filter(
        log => log.targetId === targetId
      );
    }),
    findByActorId: jest.fn(async (actorId: string) => {
      return Array.from(baseRepo.store.values()).filter(
        log => log.actorId === actorId
      );
    }),
  };
}
