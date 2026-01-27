#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { JiraClient } from "./jira-client.js";
import { ConfluenceClient } from "./confluence-client.js";
import { safeJsonStringify, MAX_RESPONSE_TOKENS } from "./content-utils.js";

// Get configuration from environment variables
const config = {
  siteUrl: process.env.ATLASSIAN_SITE_URL || "",
  userEmail: process.env.ATLASSIAN_USER_EMAIL || "",
  apiToken: process.env.ATLASSIAN_API_TOKEN || "",
  fieldMappingsPath: process.env.ATLASSIAN_FIELD_MAPPINGS_PATH,
};

// Validate configuration
if (!config.siteUrl) {
  console.error("Error: ATLASSIAN_SITE_URL environment variable is required");
  process.exit(1);
}

if (!config.userEmail || !config.apiToken) {
  console.error(
    "Warning: ATLASSIAN_USER_EMAIL and ATLASSIAN_API_TOKEN not set. Authentication may fail."
  );
}

// Initialize clients
const jiraClient = new JiraClient(config);
const confluenceClient = new ConfluenceClient(config);

// Create MCP server
const server = new Server(
  {
    name: "atlassian",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
const tools = [
  // Utility tools
  {
    name: "atlassian_health_check",
    description: "Test Atlassian connectivity and authentication",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "atlassian_get_user_info",
    description: "Get information about the currently authenticated user",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },

  // Jira tools
  {
    name: "atlassian_get_jira_issue",
    description:
      "Get a Jira issue by key (e.g., PROJ-123) or numeric ID. Returns full issue details including fields. Use offset/maxTokens for large issues.",
    inputSchema: {
      type: "object" as const,
      properties: {
        issueKey: {
          type: "string",
          description: "Issue key (e.g., PROJ-123) or numeric ID",
        },
        fields: {
          type: "array",
          items: { type: "string" },
          description: "Optional: specific fields to retrieve",
        },
        offset: {
          type: "number",
          description:
            "Character offset for pagination (use nextOffset from truncated response). Default: 0",
        },
        maxTokens: {
          type: "number",
          description: `Maximum tokens to return. Default: ${MAX_RESPONSE_TOKENS}`,
        },
      },
      required: ["issueKey"],
    },
  },
  {
    name: "atlassian_create_jira_issue",
    description:
      "Create a new Jira issue. Supports custom fields using friendly names (e.g., 'sprint') if configured in field-mappings.json.",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectKey: {
          type: "string",
          description: "Project key (e.g., PROJ)",
        },
        issueType: {
          type: "string",
          description: "Issue type name (e.g., Story, Bug, Task)",
        },
        summary: {
          type: "string",
          description: "Issue summary/title",
        },
        description: {
          type: "string",
          description: "Issue description (optional)",
        },
        fields: {
          type: "object",
          description:
            "Optional: additional fields as key-value pairs. Use friendly names (e.g., 'sprint') or actual field IDs (e.g., 'customfield_10560')",
        },
      },
      required: ["projectKey", "issueType", "summary"],
    },
  },
  {
    name: "atlassian_edit_jira_issue",
    description:
      "Update fields on an existing Jira issue. Supports custom fields using friendly names if configured in field-mappings.json.",
    inputSchema: {
      type: "object" as const,
      properties: {
        issueKey: {
          type: "string",
          description: "Issue key (e.g., PROJ-123)",
        },
        fields: {
          type: "object",
          description:
            "Fields to update as key-value pairs. Use friendly names (e.g., 'sprint') or actual field IDs (e.g., 'customfield_10560')",
        },
      },
      required: ["issueKey", "fields"],
    },
  },
  {
    name: "atlassian_search_jira_issues",
    description:
      "Search for Jira issues using JQL (Jira Query Language). Returns matching issues with specified fields. Use offset/maxTokens for large result sets.",
    inputSchema: {
      type: "object" as const,
      properties: {
        jql: {
          type: "string",
          description:
            "JQL query string (e.g., 'project = PROJ AND status = Open')",
        },
        maxResults: {
          type: "number",
          description: "Maximum number of results to return (default: 50)",
        },
        fields: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional: specific fields to retrieve (default: summary, status, assignee, created, updated)",
        },
        offset: {
          type: "number",
          description:
            "Character offset for pagination (use nextOffset from truncated response). Default: 0",
        },
        maxTokens: {
          type: "number",
          description: `Maximum tokens to return. Default: ${MAX_RESPONSE_TOKENS}`,
        },
      },
      required: ["jql"],
    },
  },
  {
    name: "atlassian_add_jira_comment",
    description: "Add a comment to a Jira issue",
    inputSchema: {
      type: "object" as const,
      properties: {
        issueKey: {
          type: "string",
          description: "Issue key (e.g., PROJ-123)",
        },
        body: {
          type: "string",
          description: "Comment text",
        },
      },
      required: ["issueKey", "body"],
    },
  },
  {
    name: "atlassian_transition_jira_issue",
    description:
      "Transition a Jira issue to a new status (e.g., move from 'To Do' to 'In Progress'). Use atlassian_get_jira_transitions first to see available transitions.",
    inputSchema: {
      type: "object" as const,
      properties: {
        issueKey: {
          type: "string",
          description: "Issue key (e.g., PROJ-123)",
        },
        transitionId: {
          type: "string",
          description:
            "Transition ID (get this from atlassian_get_jira_transitions)",
        },
      },
      required: ["issueKey", "transitionId"],
    },
  },
  {
    name: "atlassian_get_jira_transitions",
    description:
      "Get available workflow transitions for a Jira issue. Use this to find the transition ID before calling atlassian_transition_jira_issue.",
    inputSchema: {
      type: "object" as const,
      properties: {
        issueKey: {
          type: "string",
          description: "Issue key (e.g., PROJ-123)",
        },
      },
      required: ["issueKey"],
    },
  },
  {
    name: "atlassian_get_jira_projects",
    description:
      "List Jira projects accessible to the authenticated user. Optionally filter by search string.",
    inputSchema: {
      type: "object" as const,
      properties: {
        searchString: {
          type: "string",
          description: "Optional: filter projects by name or key",
        },
        maxResults: {
          type: "number",
          description: "Maximum number of results (default: 50)",
        },
      },
      required: [],
    },
  },
  {
    name: "atlassian_get_project_issue_types",
    description:
      "Get available issue types for a specific Jira project. Use this to see what issue types (Story, Bug, Task, etc.) are available before creating an issue.",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectKey: {
          type: "string",
          description: "Project key (e.g., PROJ)",
        },
      },
      required: ["projectKey"],
    },
  },
  {
    name: "atlassian_lookup_jira_user",
    description:
      "Find Jira users by display name or email address. Returns matching users with their account IDs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search query (name or email)",
        },
      },
      required: ["query"],
    },
  },

  // Confluence tools
  {
    name: "atlassian_get_confluence_page",
    description:
      "Get a Confluence page by its numeric ID. Returns page content in the specified format. Use offset/limit for large pages.",
    inputSchema: {
      type: "object" as const,
      properties: {
        pageId: {
          type: "string",
          description: "Numeric page ID",
        },
        contentFormat: {
          type: "string",
          enum: ["storage", "atlas_doc_format"],
          description:
            "Content format: 'storage' (HTML) or 'atlas_doc_format' (ADF). Default: storage",
        },
        offset: {
          type: "number",
          description:
            "Character offset for pagination (use nextOffset from truncated response). Default: 0",
        },
        maxTokens: {
          type: "number",
          description: `Maximum tokens to return. Default: ${MAX_RESPONSE_TOKENS}`,
        },
      },
      required: ["pageId"],
    },
  },
  {
    name: "atlassian_search_confluence_cql",
    description:
      "Search Confluence pages using CQL (Confluence Query Language). CQL is similar to JQL but for Confluence. Use offset/maxTokens for large result sets.",
    inputSchema: {
      type: "object" as const,
      properties: {
        cql: {
          type: "string",
          description:
            "CQL query string (e.g., 'title ~ \"meeting\" AND type = page')",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (default: 25)",
        },
        offset: {
          type: "number",
          description:
            "Character offset for pagination (use nextOffset from truncated response). Default: 0",
        },
        maxTokens: {
          type: "number",
          description: `Maximum tokens to return. Default: ${MAX_RESPONSE_TOKENS}`,
        },
      },
      required: ["cql"],
    },
  },
  {
    name: "atlassian_get_confluence_spaces",
    description:
      "List Confluence spaces. Optionally filter by space keys or type.",
    inputSchema: {
      type: "object" as const,
      properties: {
        keys: {
          type: "array",
          items: { type: "string" },
          description: "Optional: filter by specific space keys",
        },
        type: {
          type: "string",
          description: "Optional: filter by space type (e.g., 'global')",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (default: 25)",
        },
      },
      required: [],
    },
  },
  {
    name: "atlassian_get_space_pages",
    description:
      "Get pages within a specific Confluence space. Optionally filter by title.",
    inputSchema: {
      type: "object" as const,
      properties: {
        spaceId: {
          type: "string",
          description: "Numeric space ID",
        },
        title: {
          type: "string",
          description: "Optional: filter by page title",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (default: 25)",
        },
      },
      required: ["spaceId"],
    },
  },
  {
    name: "atlassian_create_confluence_page",
    description:
      "Create a new Confluence page. Body should be in Confluence storage format (HTML-like).",
    inputSchema: {
      type: "object" as const,
      properties: {
        spaceId: {
          type: "string",
          description: "Numeric space ID where the page will be created",
        },
        title: {
          type: "string",
          description: "Page title",
        },
        body: {
          type: "string",
          description: "Page content in Confluence storage format (HTML)",
        },
        parentId: {
          type: "string",
          description: "Optional: numeric ID of parent page (for nested pages)",
        },
      },
      required: ["spaceId", "title", "body"],
    },
  },
  {
    name: "atlassian_update_confluence_page",
    description:
      "Update an existing Confluence page. Body should be in Confluence storage format (HTML-like).",
    inputSchema: {
      type: "object" as const,
      properties: {
        pageId: {
          type: "string",
          description: "Numeric page ID",
        },
        title: {
          type: "string",
          description: "Optional: new page title (keeps existing if not provided)",
        },
        body: {
          type: "string",
          description: "Page content in Confluence storage format (HTML)",
        },
      },
      required: ["pageId", "body"],
    },
  },
  {
    name: "atlassian_get_page_children",
    description: "Get child pages of a specific Confluence page.",
    inputSchema: {
      type: "object" as const,
      properties: {
        pageId: {
          type: "string",
          description: "Numeric page ID",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (default: 25)",
        },
      },
      required: ["pageId"],
    },
  },
];

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // Utility tools
      case "atlassian_health_check": {
        const result = await jiraClient.healthCheck();
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "atlassian_get_user_info": {
        const result = await jiraClient.getUserInfo();
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      // Jira tools
      case "atlassian_get_jira_issue": {
        const { issueKey, fields, offset, maxTokens } = args as {
          issueKey: string;
          fields?: string[];
          offset?: number;
          maxTokens?: number;
        };
        if (!issueKey) {
          throw new Error("issueKey is required");
        }
        const result = await jiraClient.getIssue(issueKey, fields);
        return {
          content: [{ type: "text", text: safeJsonStringify(result, offset || 0, maxTokens || MAX_RESPONSE_TOKENS) }],
        };
      }

      case "atlassian_create_jira_issue": {
        const { projectKey, issueType, summary, description, fields } = args as {
          projectKey: string;
          issueType: string;
          summary: string;
          description?: string;
          fields?: Record<string, unknown>;
        };
        if (!projectKey || !issueType || !summary) {
          throw new Error("projectKey, issueType, and summary are required");
        }
        const result = await jiraClient.createIssue(
          projectKey,
          issueType,
          summary,
          description,
          fields
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "atlassian_edit_jira_issue": {
        const { issueKey, fields } = args as {
          issueKey: string;
          fields: Record<string, unknown>;
        };
        if (!issueKey || !fields) {
          throw new Error("issueKey and fields are required");
        }
        await jiraClient.updateIssue(issueKey, fields);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: true, issueKey }, null, 2),
            },
          ],
        };
      }

      case "atlassian_search_jira_issues": {
        const { jql, maxResults, fields, offset, maxTokens } = args as {
          jql: string;
          maxResults?: number;
          fields?: string[];
          offset?: number;
          maxTokens?: number;
        };
        if (!jql) {
          throw new Error("jql is required");
        }
        const result = await jiraClient.searchIssues(jql, maxResults, fields);
        return {
          content: [{ type: "text", text: safeJsonStringify(result, offset || 0, maxTokens || MAX_RESPONSE_TOKENS) }],
        };
      }

      case "atlassian_add_jira_comment": {
        const { issueKey, body } = args as {
          issueKey: string;
          body: string;
        };
        if (!issueKey || !body) {
          throw new Error("issueKey and body are required");
        }
        await jiraClient.addComment(issueKey, body);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: true, issueKey }, null, 2),
            },
          ],
        };
      }

      case "atlassian_transition_jira_issue": {
        const { issueKey, transitionId } = args as {
          issueKey: string;
          transitionId: string;
        };
        if (!issueKey || !transitionId) {
          throw new Error("issueKey and transitionId are required");
        }
        await jiraClient.transitionIssue(issueKey, transitionId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { success: true, issueKey, transitionId },
                null,
                2
              ),
            },
          ],
        };
      }

      case "atlassian_get_jira_transitions": {
        const { issueKey } = args as { issueKey: string };
        if (!issueKey) {
          throw new Error("issueKey is required");
        }
        const result = await jiraClient.getTransitions(issueKey);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "atlassian_get_jira_projects": {
        const { searchString, maxResults } = args as {
          searchString?: string;
          maxResults?: number;
        };
        const result = await jiraClient.getProjects(searchString, maxResults);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "atlassian_get_project_issue_types": {
        const { projectKey } = args as { projectKey: string };
        if (!projectKey) {
          throw new Error("projectKey is required");
        }
        const result = await jiraClient.getProjectIssueTypes(projectKey);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "atlassian_lookup_jira_user": {
        const { query } = args as { query: string };
        if (!query) {
          throw new Error("query is required");
        }
        const result = await jiraClient.findUsers(query);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      // Confluence tools
      case "atlassian_get_confluence_page": {
        const { pageId, contentFormat, offset, maxTokens } = args as {
          pageId: string;
          contentFormat?: "storage" | "atlas_doc_format";
          offset?: number;
          maxTokens?: number;
        };
        if (!pageId) {
          throw new Error("pageId is required");
        }
        const result = await confluenceClient.getPage(pageId, contentFormat);
        return {
          content: [{ type: "text", text: safeJsonStringify(result, offset || 0, maxTokens || MAX_RESPONSE_TOKENS) }],
        };
      }

      case "atlassian_search_confluence_cql": {
        const { cql, limit, offset, maxTokens } = args as {
          cql: string;
          limit?: number;
          offset?: number;
          maxTokens?: number;
        };
        if (!cql) {
          throw new Error("cql is required");
        }
        const result = await confluenceClient.searchCQL(cql, limit);
        return {
          content: [{ type: "text", text: safeJsonStringify(result, offset || 0, maxTokens || MAX_RESPONSE_TOKENS) }],
        };
      }

      case "atlassian_get_confluence_spaces": {
        const { keys, type, limit } = args as {
          keys?: string[];
          type?: string;
          limit?: number;
        };
        const result = await confluenceClient.getSpaces(keys, type, limit);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "atlassian_get_space_pages": {
        const { spaceId, title, limit } = args as {
          spaceId: string;
          title?: string;
          limit?: number;
        };
        if (!spaceId) {
          throw new Error("spaceId is required");
        }
        const result = await confluenceClient.getSpacePages(
          spaceId,
          title,
          limit
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "atlassian_create_confluence_page": {
        const { spaceId, title, body, parentId } = args as {
          spaceId: string;
          title: string;
          body: string;
          parentId?: string;
        };
        if (!spaceId || !title || !body) {
          throw new Error("spaceId, title, and body are required");
        }
        const result = await confluenceClient.createPage(
          spaceId,
          title,
          body,
          parentId
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "atlassian_update_confluence_page": {
        const { pageId, title, body } = args as {
          pageId: string;
          title?: string;
          body: string;
        };
        if (!pageId || !body) {
          throw new Error("pageId and body are required");
        }
        const result = await confluenceClient.updatePage(pageId, title, body);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "atlassian_get_page_children": {
        const { pageId, limit } = args as {
          pageId: string;
          limit?: number;
        };
        if (!pageId) {
          throw new Error("pageId is required");
        }
        const result = await confluenceClient.getPageChildren(pageId, limit);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Atlassian MCP server running");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
