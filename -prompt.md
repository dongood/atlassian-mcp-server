The official Atlassian MCP server has been connected to Claude Code, but it has a very short authentication window.

Create a custom "atlassian" MCP server that accesses the Atlassian provided API using an API token created at the following URL:https://id.atlassian.com/manage-profile/security/api-tokens

The custom MCP server will expose the same tools as the official server.

When creating the MCP server follow the same pattern as used by /Users/dongood/SourceCode/Repos/\_dongood/jenkins-mcp-server

Also create a mapping JSON file that will map human readable field names to the actual field name used in Jira.

For example: the actual field name customfield_10560 contains the sprint name. If the MCP server user asks for "sprint" use "customfield_10560" when quering the Atlassian API.

Example of a functioning API endpoint: https://avetta.atlassian.net/rest/api/3/issue/BI-9956

Make sure the project's README.md includes instructions for creating the API token, configuring the MCP server for both Claude Code and Claude Desktop, and how to map the custom fields.
