export interface WorkflowStep {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startedAt: number;
  completedAt?: number;
  metadata?: Record<string, any>;
}

export interface WorkflowSession {
  sessionId: string;
  model: string;
  steps: WorkflowStep[];
  currentStepIndex: number;
  createdAt: number;
  updatedAt: number;
}

export class WorkflowHandler {
  private sessions: Map<string, WorkflowSession> = new Map();

  public getOrCreateSession(sessionId: string, model: string): WorkflowSession {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = {
        sessionId,
        model,
        steps: [],
        currentStepIndex: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.sessions.set(sessionId, session);
    }
    return session;
  }

  public recordStep(
    sessionId: string,
    stepName: string,
    status: WorkflowStep['status'],
    metadata?: Record<string, any>
  ): WorkflowStep {
    const session = this.getOrCreateSession(sessionId, 'auto');
    const step: WorkflowStep = {
      id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: stepName,
      status,
      startedAt: Date.now(),
      metadata,
    };
    session.steps.push(step);
    session.updatedAt = Date.now();
    return step;
  }

  public getSession(sessionId: string): WorkflowSession | undefined {
    return this.sessions.get(sessionId);
  }

  public clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}

export const workflowHandler = new WorkflowHandler();
