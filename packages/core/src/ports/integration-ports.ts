/**
 * The six segregated integration ports (ISP). Read side only for now.
 * Typed ingestion envelopes arrive with @pma/contracts in a later phase;
 * until then reads return unknown[] so adapters can be stubbed.
 */
export interface WorkTrackerPort { readonly capability: "work_tracker"; fetchWorkItems(connectionId: string): Promise<unknown[]>; }
export interface SourceControlPort { readonly capability: "source_control"; fetchPullRequests(connectionId: string): Promise<unknown[]>; }
export interface CICDPort { readonly capability: "cicd"; fetchDeployments(connectionId: string): Promise<unknown[]>; }
export interface KnowledgeBasePort { readonly capability: "knowledge_base"; listPublishTargets(connectionId: string): Promise<unknown[]>; }
export interface IdentityDirectoryPort { readonly capability: "identity"; fetchPeople(connectionId: string): Promise<unknown[]>; }
export interface CommunicationPort { readonly capability: "communication"; fetchMessages(connectionId: string): Promise<unknown[]>; }
