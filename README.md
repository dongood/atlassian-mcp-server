# Atlassian MCP Server

A Model Context Protocol (MCP) server for Atlassian Jira and Confluence integration using API token authentication.

## Features

- **Long-lived Authentication**: Uses API tokens instead of OAuth for persistent access
- **Jira Integration**: Create, update, search, and manage Jira issues
- **Confluence Integration**: Read, create, and update Confluence pages
- **Custom Field Mapping**: Use friendly names (e.g., "sprint") instead of cryptic field IDs (e.g., "customfield_10560")
- **TypeScript**: Fully typed for better development experience
- **MCP Compatible**: Works with Claude Code CLI and Claude Desktop

## Prerequisites

- Node.js 20.x or later
- An Atlassian Cloud account (e.g., yoursite.atlassian.net)
- An Atlassian API token

## Installation

1. Clone or download this repository:
```bash
cd /Users/dongood/SourceCode/Repos/_dongood/atlassian-mcp-server
```

2. Install dependencies:
```bash
npm install
```

3. Build the TypeScript code:
```bash
npm run build
```

## Creating an Atlassian API Token

1. Visit https://id.atlassian.com/manage-profile/security/api-tokens
2. Click **Create API token**
3. Give it a descriptive name (e.g., "MCP Server")
4. Copy the token (you won't be able to see it again)
5. Store it securely

## Configuration

### Environment Variables

The server requires these environment variables:

- `ATLASSIAN_SITE_URL`: Your Atlassian site URL (e.g., `https://avetta.atlassian.net`)
- `ATLASSIAN_USER_EMAIL`: Your email address associated with your Atlassian account
- `ATLASSIAN_API_TOKEN`: The API token you created above
- `ATLASSIAN_FIELD_MAPPINGS_PATH` (optional): Path to custom field mappings JSON file

### For Claude Code CLI

**Global Configuration** (recommended): Edit `~/.claude.json` and add the server under the `mcpServers` key. This makes the server available in all projects without per-project approval prompts:

```json
{
  "mcpServers": {
    "atlassian": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/atlassian-mcp-server/build/index.js"],
      "env": {
        "ATLASSIAN_SITE_URL": "https://yoursite.atlassian.net",
        "ATLASSIAN_USER_EMAIL": "your.email@example.com",
        "ATLASSIAN_API_TOKEN": "YOUR_API_TOKEN_HERE"
      }
    }
  }
}
```

**Project-specific Configuration**: Create `.mcp.json` in your project root. Note that servers defined in `.mcp.json` files require per-project approval when Claude Code starts:

```json
{
  "mcpServers": {
    "atlassian": {
      "command": "node",
      "args": ["/path/to/atlassian-mcp-server/build/index.js"],
      "env": {
        "ATLASSIAN_SITE_URL": "https://yoursite.atlassian.net",
        "ATLASSIAN_USER_EMAIL": "your.email@example.com",
        "ATLASSIAN_API_TOKEN": "YOUR_API_TOKEN_HERE"
      }
    }
  }
}
```

**Important**: Replace the placeholders with your actual values.

### For Claude Desktop

Edit the Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add this configuration:

```json
{
  "mcpServers": {
    "atlassian": {
      "command": "node",
      "args": ["/Users/dongood/SourceCode/Repos/_dongood/atlassian-mcp-server/build/index.js"],
      "env": {
        "ATLASSIAN_SITE_URL": "https://avetta.atlassian.net",
        "ATLASSIAN_USER_EMAIL": "your.email@example.com",
        "ATLASSIAN_API_TOKEN": "YOUR_API_TOKEN_HERE"
      }
    }
  }
}
```

## Custom Field Mapping

Jira custom fields have cryptic IDs like `customfield_10560`. This server allows you to map them to friendly names.

### Configuring Field Mappings

1. Edit `config/field-mappings.json`:

```json
{
  "sprint": "customfield_10560",
  "story_points": "customfield_10016",
  "epic_link": "customfield_10014",
  "team": "customfield_10100"
}
```

2. The server will automatically load this file from the `config/` directory
3. You can now use `"sprint"` instead of `"customfield_10560"` in MCP tool calls

### Finding Custom Field IDs

To find the actual field ID for a custom field:

1. **Via Jira UI**:
   - Go to Jira Settings → Issues → Custom fields
   - Find your field and note its ID

2. **Via API**:
   - Get any issue that has the field populated
   - Look at the raw JSON response - custom fields appear as `customfield_XXXXX`

3. **Example using the MCP server**:
   ```
   Use atlassian_get_jira_issue with issueKey "PROJ-123"
   Look in the fields object for customfield_* entries
   ```

### Using Field Mappings

When creating or editing issues, you can use either:
- Friendly names: `{ "sprint": "Sprint 42" }`
- Actual field IDs: `{ "customfield_10560": "Sprint 42" }`

Both formats work - the server handles the translation.

## Available Tools

### Utility Tools
- `atlassian_health_check` - Test connectivity and authentication
- `atlassian_get_user_info` - Get current user information

### Jira Tools
- `atlassian_get_jira_issue` - Get issue by key or ID
- `atlassian_create_jira_issue` - Create a new issue
- `atlassian_edit_jira_issue` - Update issue fields
- `atlassian_search_jira_issues` - Search using JQL
- `atlassian_add_jira_comment` - Add a comment to an issue
- `atlassian_transition_jira_issue` - Change issue status
- `atlassian_get_jira_transitions` - Get available transitions
- `atlassian_get_jira_projects` - List projects
- `atlassian_get_project_issue_types` - Get issue types for a project
- `atlassian_lookup_jira_user` - Find users by name/email

### Confluence Tools
- `atlassian_get_confluence_page` - Get page by ID
- `atlassian_search_confluence_cql` - Search using CQL
- `atlassian_get_confluence_spaces` - List spaces
- `atlassian_get_space_pages` - Get pages in a space
- `atlassian_create_confluence_page` - Create a new page
- `atlassian_update_confluence_page` - Update an existing page
- `atlassian_get_page_children` - Get child pages

## Testing

You can test the server using the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node build/index.js
```

Set environment variables before running:
```bash
export ATLASSIAN_SITE_URL="https://avetta.atlassian.net"
export ATLASSIAN_USER_EMAIL="your.email@example.com"
export ATLASSIAN_API_TOKEN="your-api-token"
npx @modelcontextprotocol/inspector node build/index.js
```

## Example Usage

Once configured in Claude Code or Claude Desktop, you can interact with Jira and Confluence naturally:

**Jira Examples**:
- "Get details for issue BI-9956"
- "Create a new bug in project PROJ with summary 'Login page is broken'"
- "Search for all open bugs assigned to me"
- "Add a comment to PROJ-123 saying 'Fixed in latest build'"
- "Move PROJ-456 to In Progress"

**Confluence Examples**:
- "Get the content of Confluence page 123456789"
- "Search Confluence for pages about 'architecture'"
- "List all pages in the ENG space"
- "Create a new page in space 12345 titled 'Sprint Retrospective'"

## Development

### Build
```bash
npm run build
```

### Run
```bash
npm start
```

### Development mode (build + run)
```bash
npm run dev
```

## API Documentation

- **Jira REST API v3**: https://developer.atlassian.com/cloud/jira/platform/rest/v3/
- **Confluence REST API v2**: https://developer.atlassian.com/cloud/confluence/rest/v2/

## Troubleshooting

### Authentication Errors

If you get 401 errors:
1. Verify your email and API token are correct
2. Make sure the API token hasn't expired
3. Check that your user has access to the Jira/Confluence site

### Permission Errors

If you get 403 errors:
1. Verify you have permission to access the project/space
2. Check that your user has the required permissions (e.g., Create Issues, Edit Pages)

### Field Not Found Errors

If custom fields aren't working:
1. Verify the field ID in your `field-mappings.json` is correct
2. Make sure the field exists in the project/issue type
3. Check that the field is not hidden or restricted

## License

MIT
