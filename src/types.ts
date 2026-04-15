// Configuration
export interface AtlassianConfig {
  siteUrl: string;
  userEmail: string;
  apiToken: string;
  fieldMappingsPath?: string;
}

// Jira Types
export interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: {
    summary: string;
    description?: unknown; // ADF format or null
    status: { name: string; id: string };
    issuetype: { name: string; id: string };
    priority?: { name: string; id: string };
    assignee?: { displayName: string; accountId: string } | null;
    reporter?: { displayName: string; accountId: string };
    created: string;
    updated: string;
    [key: string]: unknown; // Custom fields
  };
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
  issueTypes?: JiraIssueType[];
}

export interface JiraIssueType {
  id: string;
  name: string;
  subtask: boolean;
  description?: string;
}

export interface JiraTransition {
  id: string;
  name: string;
  to: { name: string; id: string };
}

export interface JiraSearchResult {
  startAt: number;
  maxResults: number;
  total: number;
  issues: JiraIssue[];
}

export interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress?: string;
  active: boolean;
}

export interface JiraAttachment {
  id: string;
  filename: string;
  author: {
    accountId: string;
    displayName: string;
  };
  created: string;
  size: number;
  mimeType: string;
  content: string; // download URL
  self: string;
}

export interface JiraComment {
  id: string;
  body: unknown; // ADF format
  author: {
    accountId: string;
    displayName: string;
  };
  created: string;
  updated: string;
}

// Confluence Types
export interface ConfluencePage {
  id: string;
  title: string;
  spaceId: string;
  status: string;
  body?: {
    storage?: { value: string; representation: string };
    atlas_doc_format?: { value: string; representation: string };
  };
  version?: { number: number; message?: string };
  _links: { webui: string };
}

export interface ConfluenceSpace {
  id: string;
  key: string;
  name: string;
  type: string;
  status: string;
  _links?: { webui: string };
}

export interface ConfluenceSearchResult {
  results: ConfluencePage[];
  _links?: { next?: string };
}

// User info
export interface AtlassianUser {
  accountId: string;
  emailAddress: string;
  displayName: string;
  active: boolean;
  locale?: string;
}
