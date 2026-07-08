export type WorkItemId = string & { readonly __brand: "WorkItemId" };
export type ProjectId = string & { readonly __brand: "ProjectId" };
export type CadenceId = string & { readonly __brand: "CadenceId" };
export type WorkItemTypeId = string & { readonly __brand: "WorkItemTypeId" };
export type WorkflowStateId = string & { readonly __brand: "WorkflowStateId" };
export type PersonId = string & { readonly __brand: "PersonId" };

export const workItemId = (s: string): WorkItemId => s as WorkItemId;
export const projectId = (s: string): ProjectId => s as ProjectId;
export const cadenceId = (s: string): CadenceId => s as CadenceId;
export const workItemTypeId = (s: string): WorkItemTypeId => s as WorkItemTypeId;
export const workflowStateId = (s: string): WorkflowStateId => s as WorkflowStateId;
export const personId = (s: string): PersonId => s as PersonId;
