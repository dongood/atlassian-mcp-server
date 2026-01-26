import axios, { AxiosResponse } from "axios";
import { AtlassianConfig, AtlassianUser } from "./types.js";
import { FieldMapper } from "./field-mapping.js";

export class AtlassianClient {
  protected siteUrl: string;
  protected userEmail: string;
  protected apiToken: string;
  protected fieldMapper: FieldMapper;

  constructor(config: AtlassianConfig) {
    this.siteUrl = config.siteUrl.replace(/\/$/, ""); // Remove trailing slash
    this.userEmail = config.userEmail;
    this.apiToken = config.apiToken;
    this.fieldMapper = new FieldMapper(config.fieldMappingsPath);
  }

  protected getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json",
    };

    if (this.userEmail && this.apiToken) {
      const auth = Buffer.from(`${this.userEmail}:${this.apiToken}`).toString(
        "base64"
      );
      headers["Authorization"] = `Basic ${auth}`;
    }

    return headers;
  }

  protected extractSafeError(
    error: unknown,
    context: string = ""
  ): Record<string, unknown> {
    const err = error as {
      response?: { status?: number; statusText?: string };
      message?: string;
      code?: string;
      config?: { url?: string; method?: string };
    };

    return {
      context,
      status: err.response?.status,
      statusText: err.response?.statusText,
      message: err.message,
      code: err.code,
      url: err.config?.url,
      method: err.config?.method?.toUpperCase(),
      timestamp: new Date().toISOString(),
    };
  }

  async healthCheck(): Promise<{ healthy: boolean; message: string; user?: string }> {
    try {
      if (!this.siteUrl) {
        return { healthy: false, message: "No Atlassian site URL configured" };
      }

      const response = await axios.get(
        `${this.siteUrl}/rest/api/3/myself`,
        {
          headers: this.getAuthHeaders(),
          timeout: 5000,
        }
      );

      if (response.status === 200) {
        const user = response.data.displayName || this.userEmail;
        return {
          healthy: true,
          message: "Atlassian is reachable and authenticated",
          user
        };
      }

      return {
        healthy: false,
        message: `Unexpected status: ${response.status}`,
      };
    } catch (error) {
      const safeError = this.extractSafeError(error, "healthCheck");
      console.error("Atlassian health check failed", safeError);
      return {
        healthy: false,
        message: `Health check failed: ${safeError.message}`,
      };
    }
  }

  async getUserInfo(): Promise<AtlassianUser> {
    try {
      const response: AxiosResponse<AtlassianUser> = await axios.get(
        `${this.siteUrl}/rest/api/3/myself`,
        {
          headers: this.getAuthHeaders(),
          timeout: 5000,
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
      if (err.response?.status === 403) {
        throw new Error("Access forbidden. User may not have permission.");
      }

      const safeError = this.extractSafeError(error, "getUserInfo");
      console.error("Failed to get user info", safeError);
      throw new Error(`Failed to get user info: ${safeError.message}`);
    }
  }
}
