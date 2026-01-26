import axios, { AxiosResponse } from "axios";
import { AtlassianClient } from "./atlassian-client.js";
import {
  ConfluencePage,
  ConfluenceSpace,
  ConfluenceSearchResult,
} from "./types.js";

export class ConfluenceClient extends AtlassianClient {
  private get confluenceApiUrl(): string {
    return `${this.siteUrl}/wiki/api/v2`;
  }

  async getPage(
    pageId: string,
    contentFormat: "storage" | "atlas_doc_format" = "storage"
  ): Promise<ConfluencePage> {
    try {
      const response: AxiosResponse<ConfluencePage> = await axios.get(
        `${this.confluenceApiUrl}/pages/${pageId}?body-format=${contentFormat}`,
        {
          headers: this.getAuthHeaders(),
          timeout: 10000,
        }
      );

      return response.data;
    } catch (error) {
      const err = error as { response?: { status?: number } };

      if (err.response?.status === 404) {
        throw new Error(`Page not found: ${pageId}`);
      }
      if (err.response?.status === 401) {
        throw new Error(
          "Authentication failed. Please check ATLASSIAN_USER_EMAIL and ATLASSIAN_API_TOKEN."
        );
      }
      if (err.response?.status === 403) {
        throw new Error(
          `Access forbidden for page ${pageId}. User may not have permission.`
        );
      }

      const safeError = this.extractSafeError(error, `getPage(${pageId})`);
      console.error("Failed to get Confluence page", safeError);
      throw new Error(`Failed to get page: ${safeError.message}`);
    }
  }

  async searchCQL(cql: string, limit: number = 25): Promise<ConfluenceSearchResult> {
    try {
      const params = new URLSearchParams();
      params.append("cql", cql);
      params.append("limit", limit.toString());

      const response: AxiosResponse<ConfluenceSearchResult> = await axios.get(
        `${this.confluenceApiUrl}/pages?${params}`,
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
          `Invalid CQL query: ${JSON.stringify(err.response.data)}`
        );
      }
      if (err.response?.status === 401) {
        throw new Error(
          "Authentication failed. Please check ATLASSIAN_USER_EMAIL and ATLASSIAN_API_TOKEN."
        );
      }

      const safeError = this.extractSafeError(error, `searchCQL(${cql})`);
      console.error("Failed to search Confluence with CQL", safeError);
      throw new Error(`Failed to search: ${safeError.message}`);
    }
  }

  async getSpaces(
    keys?: string[],
    type?: string,
    limit: number = 25
  ): Promise<ConfluenceSpace[]> {
    try {
      const params = new URLSearchParams();
      params.append("limit", limit.toString());
      if (keys && keys.length > 0) {
        params.append("keys", keys.join(","));
      }
      if (type) {
        params.append("type", type);
      }

      const response: AxiosResponse<{ results: ConfluenceSpace[] }> =
        await axios.get(`${this.confluenceApiUrl}/spaces?${params}`, {
          headers: this.getAuthHeaders(),
          timeout: 10000,
        });

      return response.data.results;
    } catch (error) {
      const err = error as { response?: { status?: number } };

      if (err.response?.status === 401) {
        throw new Error(
          "Authentication failed. Please check ATLASSIAN_USER_EMAIL and ATLASSIAN_API_TOKEN."
        );
      }

      const safeError = this.extractSafeError(error, "getSpaces");
      console.error("Failed to get Confluence spaces", safeError);
      throw new Error(`Failed to get spaces: ${safeError.message}`);
    }
  }

  async getSpacePages(
    spaceId: string,
    title?: string,
    limit: number = 25
  ): Promise<ConfluencePage[]> {
    try {
      const params = new URLSearchParams();
      params.append("limit", limit.toString());
      if (title) {
        params.append("title", title);
      }

      const response: AxiosResponse<{ results: ConfluencePage[] }> =
        await axios.get(
          `${this.confluenceApiUrl}/spaces/${spaceId}/pages?${params}`,
          {
            headers: this.getAuthHeaders(),
            timeout: 10000,
          }
        );

      return response.data.results;
    } catch (error) {
      const err = error as { response?: { status?: number } };

      if (err.response?.status === 404) {
        throw new Error(`Space not found: ${spaceId}`);
      }
      if (err.response?.status === 401) {
        throw new Error(
          "Authentication failed. Please check ATLASSIAN_USER_EMAIL and ATLASSIAN_API_TOKEN."
        );
      }
      if (err.response?.status === 403) {
        throw new Error(
          `Access forbidden for space ${spaceId}. User may not have permission.`
        );
      }

      const safeError = this.extractSafeError(
        error,
        `getSpacePages(${spaceId})`
      );
      console.error("Failed to get pages in Confluence space", safeError);
      throw new Error(`Failed to get space pages: ${safeError.message}`);
    }
  }

  async createPage(
    spaceId: string,
    title: string,
    body: string,
    parentId?: string
  ): Promise<ConfluencePage> {
    try {
      const payload: {
        spaceId: string;
        status: string;
        title: string;
        parentId?: string;
        body: {
          representation: string;
          value: string;
        };
      } = {
        spaceId,
        status: "current",
        title,
        body: {
          representation: "storage",
          value: body,
        },
      };

      if (parentId) {
        payload.parentId = parentId;
      }

      const response: AxiosResponse<ConfluencePage> = await axios.post(
        `${this.confluenceApiUrl}/pages`,
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
          `Access forbidden for space ${spaceId}. User may not have permission.`
        );
      }

      const safeError = this.extractSafeError(
        error,
        `createPage(${spaceId}, ${title})`
      );
      console.error("Failed to create Confluence page", safeError);
      throw new Error(`Failed to create page: ${safeError.message}`);
    }
  }

  async updatePage(
    pageId: string,
    title: string | undefined,
    body: string
  ): Promise<ConfluencePage> {
    try {
      // First get the current page to get the version number
      const currentPage = await this.getPage(pageId);

      const payload: {
        id: string;
        status: string;
        title: string;
        body: {
          representation: string;
          value: string;
        };
        version: {
          number: number;
          message?: string;
        };
      } = {
        id: pageId,
        status: "current",
        title: title || currentPage.title,
        body: {
          representation: "storage",
          value: body,
        },
        version: {
          number: (currentPage.version?.number || 0) + 1,
        },
      };

      const response: AxiosResponse<ConfluencePage> = await axios.put(
        `${this.confluenceApiUrl}/pages/${pageId}`,
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
      if (err.response?.status === 404) {
        throw new Error(`Page not found: ${pageId}`);
      }
      if (err.response?.status === 401) {
        throw new Error(
          "Authentication failed. Please check ATLASSIAN_USER_EMAIL and ATLASSIAN_API_TOKEN."
        );
      }
      if (err.response?.status === 403) {
        throw new Error(
          `Access forbidden for page ${pageId}. User may not have permission.`
        );
      }
      if (err.response?.status === 409) {
        throw new Error(
          `Conflict: The page has been modified. Please refresh and try again.`
        );
      }

      const safeError = this.extractSafeError(
        error,
        `updatePage(${pageId})`
      );
      console.error("Failed to update Confluence page", safeError);
      throw new Error(`Failed to update page: ${safeError.message}`);
    }
  }

  async getPageChildren(
    pageId: string,
    limit: number = 25
  ): Promise<ConfluencePage[]> {
    try {
      const params = new URLSearchParams();
      params.append("limit", limit.toString());

      const response: AxiosResponse<{ results: ConfluencePage[] }> =
        await axios.get(
          `${this.confluenceApiUrl}/pages/${pageId}/children?${params}`,
          {
            headers: this.getAuthHeaders(),
            timeout: 10000,
          }
        );

      return response.data.results;
    } catch (error) {
      const err = error as { response?: { status?: number } };

      if (err.response?.status === 404) {
        throw new Error(`Page not found: ${pageId}`);
      }
      if (err.response?.status === 401) {
        throw new Error(
          "Authentication failed. Please check ATLASSIAN_USER_EMAIL and ATLASSIAN_API_TOKEN."
        );
      }
      if (err.response?.status === 403) {
        throw new Error(
          `Access forbidden for page ${pageId}. User may not have permission.`
        );
      }

      const safeError = this.extractSafeError(
        error,
        `getPageChildren(${pageId})`
      );
      console.error("Failed to get Confluence page children", safeError);
      throw new Error(`Failed to get page children: ${safeError.message}`);
    }
  }
}
