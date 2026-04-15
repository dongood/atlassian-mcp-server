import axios, { AxiosResponse } from "axios";
import FormData from "form-data";
import * as fs from "fs";
import * as path from "path";
import { AtlassianClient } from "./atlassian-client.js";
import {
  JiraAttachment,
  JiraIssue,
  JiraProject,
  JiraSearchResult,
  JiraTransition,
  JiraUser,
  JiraIssueType,
} from "./types.js";

export class JiraClient extends AtlassianClient {
  private get jiraApiUrl(): string {
    return `${this.siteUrl}/rest/api/3`;
  }

  async getIssue(issueKey: string, fields?: string[]): Promise<JiraIssue> {
    try {
      const fieldsParam = fields ? `?fields=${fields.join(",")}` : "";
      const response: AxiosResponse<JiraIssue> = await axios.get(
        `${this.jiraApiUrl}/issue/${encodeURIComponent(issueKey)}${fieldsParam}`,
        {
          headers: this.getAuthHeaders(),
          timeout: 10000,
        }
      );

      return response.data;
    } catch (error) {
      const err = error as { response?: { status?: number } };

      if (err.response?.status === 404) {
        throw new Error(`Issue not found: ${issueKey}`);
      }
      if (err.response?.status === 401) {
        throw new Error(
          "Authentication failed. Please check ATLASSIAN_USER_EMAIL and ATLASSIAN_API_TOKEN."
        );
      }
      if (err.response?.status === 403) {
        throw new Error(
          `Access forbidden for issue ${issueKey}. User may not have permission.`
        );
      }

      const safeError = this.extractSafeError(error, `getIssue(${issueKey})`);
      console.error("Failed to get Jira issue", safeError);
      throw new Error(`Failed to get issue: ${safeError.message}`);
    }
  }

  async createIssue(
    projectKey: string,
    issueType: string,
    summary: string,
    description?: string,
    fields?: Record<string, unknown>
  ): Promise<JiraIssue> {
    try {
      // Resolve custom field names in the fields object
      const resolvedFields = fields ? this.fieldMapper.resolveFields(fields) : {};

      const payload = {
        fields: {
          project: { key: projectKey },
          issuetype: { name: issueType },
          summary,
          ...(description && {
            description: {
              type: "doc",
              version: 1,
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: description }],
                },
              ],
            },
          }),
          ...resolvedFields,
        },
      };

      const response: AxiosResponse<JiraIssue> = await axios.post(
        `${this.jiraApiUrl}/issue`,
        payload,
        {
          headers: this.getAuthHeaders(),
          timeout: 15000,
        }
      );

      return response.data;
    } catch (error) {
      const err = error as { response?: { status?: number; data?: unknown } };

      if (err.response?.status === 400) {
        throw new Error(
          `Invalid request: ${JSON.stringify(err.response.data)}`
        );
      }
      if (err.response?.status === 401) {
        throw new Error(
          "Authentication failed. Please check ATLASSIAN_USER_EMAIL and ATLASSIAN_API_TOKEN."
        );
      }
      if (err.response?.status === 403) {
        throw new Error(
          `Access forbidden for project ${projectKey}. User may not have permission.`
        );
      }

      const safeError = this.extractSafeError(
        error,
        `createIssue(${projectKey}, ${issueType})`
      );
      console.error("Failed to create Jira issue", safeError);
      throw new Error(`Failed to create issue: ${safeError.message}`);
    }
  }

  async updateIssue(
    issueKey: string,
    fields: Record<string, unknown>
  ): Promise<void> {
    try {
      // Resolve custom field names
      const resolvedFields = this.fieldMapper.resolveFields(fields);

      const payload = { fields: resolvedFields };

      await axios.put(
        `${this.jiraApiUrl}/issue/${encodeURIComponent(issueKey)}`,
        payload,
        {
          headers: this.getAuthHeaders(),
          timeout: 10000,
        }
      );
    } catch (error) {
      const err = error as { response?: { status?: number; data?: unknown } };

      if (err.response?.status === 400) {
        throw new Error(
          `Invalid request: ${JSON.stringify(err.response.data)}`
        );
      }
      if (err.response?.status === 404) {
        throw new Error(`Issue not found: ${issueKey}`);
      }
      if (err.response?.status === 401) {
        throw new Error(
          "Authentication failed. Please check ATLASSIAN_USER_EMAIL and ATLASSIAN_API_TOKEN."
        );
      }
      if (err.response?.status === 403) {
        throw new Error(
          `Access forbidden for issue ${issueKey}. User may not have permission.`
        );
      }

      const safeError = this.extractSafeError(
        error,
        `updateIssue(${issueKey})`
      );
      console.error("Failed to update Jira issue", safeError);
      throw new Error(`Failed to update issue: ${safeError.message}`);
    }
  }

  async searchIssues(
    jql: string,
    maxResults: number = 50,
    fields?: string[]
  ): Promise<JiraSearchResult> {
    try {
      const payload = {
        jql,
        maxResults,
        fields: fields || ["summary", "status", "assignee", "created", "updated"],
      };

      const response: AxiosResponse<JiraSearchResult> = await axios.post(
        `${this.jiraApiUrl}/search`,
        payload,
        {
          headers: this.getAuthHeaders(),
          timeout: 30000,
        }
      );

      return response.data;
    } catch (error) {
      const err = error as { response?: { status?: number; data?: unknown } };

      if (err.response?.status === 400) {
        throw new Error(
          `Invalid JQL query: ${JSON.stringify(err.response.data)}`
        );
      }
      if (err.response?.status === 401) {
        throw new Error(
          "Authentication failed. Please check ATLASSIAN_USER_EMAIL and ATLASSIAN_API_TOKEN."
        );
      }

      const safeError = this.extractSafeError(error, `searchIssues(${jql})`);
      console.error("Failed to search Jira issues", safeError);
      throw new Error(`Failed to search issues: ${safeError.message}`);
    }
  }

  async addComment(issueKey: string, body: string): Promise<void> {
    try {
      const payload = {
        body: {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: body }],
            },
          ],
        },
      };

      await axios.post(
        `${this.jiraApiUrl}/issue/${encodeURIComponent(issueKey)}/comment`,
        payload,
        {
          headers: this.getAuthHeaders(),
          timeout: 10000,
        }
      );
    } catch (error) {
      const err = error as { response?: { status?: number } };

      if (err.response?.status === 404) {
        throw new Error(`Issue not found: ${issueKey}`);
      }
      if (err.response?.status === 401) {
        throw new Error(
          "Authentication failed. Please check ATLASSIAN_USER_EMAIL and ATLASSIAN_API_TOKEN."
        );
      }
      if (err.response?.status === 403) {
        throw new Error(
          `Access forbidden for issue ${issueKey}. User may not have permission.`
        );
      }

      const safeError = this.extractSafeError(
        error,
        `addComment(${issueKey})`
      );
      console.error("Failed to add comment to Jira issue", safeError);
      throw new Error(`Failed to add comment: ${safeError.message}`);
    }
  }

  async getTransitions(issueKey: string): Promise<JiraTransition[]> {
    try {
      const response: AxiosResponse<{ transitions: JiraTransition[] }> =
        await axios.get(
          `${this.jiraApiUrl}/issue/${encodeURIComponent(issueKey)}/transitions`,
          {
            headers: this.getAuthHeaders(),
            timeout: 10000,
          }
        );

      return response.data.transitions;
    } catch (error) {
      const err = error as { response?: { status?: number } };

      if (err.response?.status === 404) {
        throw new Error(`Issue not found: ${issueKey}`);
      }
      if (err.response?.status === 401) {
        throw new Error(
          "Authentication failed. Please check ATLASSIAN_USER_EMAIL and ATLASSIAN_API_TOKEN."
        );
      }
      if (err.response?.status === 403) {
        throw new Error(
          `Access forbidden for issue ${issueKey}. User may not have permission.`
        );
      }

      const safeError = this.extractSafeError(
        error,
        `getTransitions(${issueKey})`
      );
      console.error("Failed to get transitions for Jira issue", safeError);
      throw new Error(`Failed to get transitions: ${safeError.message}`);
    }
  }

  async transitionIssue(
    issueKey: string,
    transitionId: string
  ): Promise<void> {
    try {
      const payload = {
        transition: { id: transitionId },
      };

      await axios.post(
        `${this.jiraApiUrl}/issue/${encodeURIComponent(issueKey)}/transitions`,
        payload,
        {
          headers: this.getAuthHeaders(),
          timeout: 10000,
        }
      );
    } catch (error) {
      const err = error as { response?: { status?: number; data?: unknown } };

      if (err.response?.status === 400) {
        throw new Error(
          `Invalid transition: ${JSON.stringify(err.response.data)}`
        );
      }
      if (err.response?.status === 404) {
        throw new Error(`Issue not found: ${issueKey}`);
      }
      if (err.response?.status === 401) {
        throw new Error(
          "Authentication failed. Please check ATLASSIAN_USER_EMAIL and ATLASSIAN_API_TOKEN."
        );
      }
      if (err.response?.status === 403) {
        throw new Error(
          `Access forbidden for issue ${issueKey}. User may not have permission.`
        );
      }

      const safeError = this.extractSafeError(
        error,
        `transitionIssue(${issueKey}, ${transitionId})`
      );
      console.error("Failed to transition Jira issue", safeError);
      throw new Error(`Failed to transition issue: ${safeError.message}`);
    }
  }

  async getProjects(
    searchString?: string,
    maxResults: number = 50
  ): Promise<JiraProject[]> {
    try {
      const params = new URLSearchParams();
      params.append("maxResults", maxResults.toString());
      if (searchString) {
        params.append("query", searchString);
      }

      const response: AxiosResponse<{ values: JiraProject[] }> =
        await axios.get(`${this.jiraApiUrl}/project/search?${params}`, {
          headers: this.getAuthHeaders(),
          timeout: 10000,
        });

      return response.data.values;
    } catch (error) {
      const err = error as { response?: { status?: number } };

      if (err.response?.status === 401) {
        throw new Error(
          "Authentication failed. Please check ATLASSIAN_USER_EMAIL and ATLASSIAN_API_TOKEN."
        );
      }

      const safeError = this.extractSafeError(error, "getProjects");
      console.error("Failed to get Jira projects", safeError);
      throw new Error(`Failed to get projects: ${safeError.message}`);
    }
  }

  async getProjectIssueTypes(projectKey: string): Promise<JiraIssueType[]> {
    try {
      const response: AxiosResponse<{ issueTypes: JiraIssueType[] }> =
        await axios.get(
          `${this.jiraApiUrl}/project/${encodeURIComponent(projectKey)}`,
          {
            headers: this.getAuthHeaders(),
            timeout: 10000,
          }
        );

      return response.data.issueTypes;
    } catch (error) {
      const err = error as { response?: { status?: number } };

      if (err.response?.status === 404) {
        throw new Error(`Project not found: ${projectKey}`);
      }
      if (err.response?.status === 401) {
        throw new Error(
          "Authentication failed. Please check ATLASSIAN_USER_EMAIL and ATLASSIAN_API_TOKEN."
        );
      }
      if (err.response?.status === 403) {
        throw new Error(
          `Access forbidden for project ${projectKey}. User may not have permission.`
        );
      }

      const safeError = this.extractSafeError(
        error,
        `getProjectIssueTypes(${projectKey})`
      );
      console.error("Failed to get project issue types", safeError);
      throw new Error(`Failed to get issue types: ${safeError.message}`);
    }
  }

  async addAttachment(
    issueKey: string,
    filePath: string
  ): Promise<JiraAttachment[]> {
    try {
      const absolutePath = path.resolve(filePath);

      if (!fs.existsSync(absolutePath)) {
        throw new Error(`File not found: ${absolutePath}`);
      }

      const stat = fs.statSync(absolutePath);
      if (!stat.isFile()) {
        throw new Error(`Path is not a file: ${absolutePath}`);
      }

      const form = new FormData();
      form.append("file", fs.createReadStream(absolutePath));

      const headers = this.getAuthHeaders();
      // Jira requires this header for attachment uploads (CSRF protection bypass)
      headers["X-Atlassian-Token"] = "no-check";
      // Remove Content-Type so axios/form-data sets the correct multipart boundary
      delete headers["Content-Type"];

      const response: AxiosResponse<JiraAttachment[]> = await axios.post(
        `${this.jiraApiUrl}/issue/${encodeURIComponent(issueKey)}/attachments`,
        form,
        {
          headers: {
            ...headers,
            ...form.getHeaders(),
          },
          timeout: 60000, // 60s for large files
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }
      );

      return response.data;
    } catch (error) {
      const err = error as { response?: { status?: number; data?: unknown } };

      if (err.response?.status === 404) {
        throw new Error(`Issue not found: ${issueKey}`);
      }
      if (err.response?.status === 401) {
        throw new Error(
          "Authentication failed. Please check ATLASSIAN_USER_EMAIL and ATLASSIAN_API_TOKEN."
        );
      }
      if (err.response?.status === 403) {
        throw new Error(
          `Access forbidden for issue ${issueKey}. Attachments may be disabled or user lacks permission.`
        );
      }
      if (err.response?.status === 413) {
        throw new Error(
          "File too large. Check your Jira instance's attachment size limit."
        );
      }

      const safeError = this.extractSafeError(
        error,
        `addAttachment(${issueKey}, ${filePath})`
      );
      console.error("Failed to add attachment to Jira issue", safeError);
      throw new Error(`Failed to add attachment: ${safeError.message}`);
    }
  }

  async getAttachments(issueKey: string): Promise<JiraAttachment[]> {
    try {
      const response: AxiosResponse<JiraIssue> = await axios.get(
        `${this.jiraApiUrl}/issue/${encodeURIComponent(issueKey)}?fields=attachment`,
        {
          headers: this.getAuthHeaders(),
          timeout: 10000,
        }
      );

      return (response.data.fields.attachment as JiraAttachment[]) || [];
    } catch (error) {
      const err = error as { response?: { status?: number } };

      if (err.response?.status === 404) {
        throw new Error(`Issue not found: ${issueKey}`);
      }
      if (err.response?.status === 401) {
        throw new Error(
          "Authentication failed. Please check ATLASSIAN_USER_EMAIL and ATLASSIAN_API_TOKEN."
        );
      }
      if (err.response?.status === 403) {
        throw new Error(
          `Access forbidden for issue ${issueKey}. User may not have permission.`
        );
      }

      const safeError = this.extractSafeError(
        error,
        `getAttachments(${issueKey})`
      );
      console.error("Failed to get attachments for Jira issue", safeError);
      throw new Error(`Failed to get attachments: ${safeError.message}`);
    }
  }

  async deleteAttachment(attachmentId: string): Promise<void> {
    try {
      await axios.delete(
        `${this.jiraApiUrl}/attachment/${encodeURIComponent(attachmentId)}`,
        {
          headers: this.getAuthHeaders(),
          timeout: 10000,
        }
      );
    } catch (error) {
      const err = error as { response?: { status?: number } };

      if (err.response?.status === 404) {
        throw new Error(`Attachment not found: ${attachmentId}`);
      }
      if (err.response?.status === 401) {
        throw new Error(
          "Authentication failed. Please check ATLASSIAN_USER_EMAIL and ATLASSIAN_API_TOKEN."
        );
      }
      if (err.response?.status === 403) {
        throw new Error(
          `Access forbidden. User may not have permission to delete attachment ${attachmentId}.`
        );
      }

      const safeError = this.extractSafeError(
        error,
        `deleteAttachment(${attachmentId})`
      );
      console.error("Failed to delete attachment", safeError);
      throw new Error(`Failed to delete attachment: ${safeError.message}`);
    }
  }

  async findUsers(query: string): Promise<JiraUser[]> {
    try {
      const response: AxiosResponse<JiraUser[]> = await axios.get(
        `${this.jiraApiUrl}/user/search?query=${encodeURIComponent(query)}`,
        {
          headers: this.getAuthHeaders(),
          timeout: 10000,
        }
      );

      return response.data;
    } catch (error) {
      const err = error as { response?: { status?: number } };

      if (err.response?.status === 401) {
        throw new Error(
          "Authentication failed. Please check ATLASSIAN_USER_EMAIL and ATLASSIAN_API_TOKEN."
        );
      }

      const safeError = this.extractSafeError(error, `findUsers(${query})`);
      console.error("Failed to find Jira users", safeError);
      throw new Error(`Failed to find users: ${safeError.message}`);
    }
  }
}
