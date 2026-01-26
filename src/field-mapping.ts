import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

export class FieldMapper {
  private mappings: Record<string, string> = {};

  constructor(mappingsPath?: string) {
    // Determine the path to the mappings file
    const defaultPath = resolve(process.cwd(), "config", "field-mappings.json");
    const configPath = mappingsPath || defaultPath;

    // Load mappings if file exists
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, "utf-8");
        this.mappings = JSON.parse(content);
        console.error(`Loaded field mappings from ${configPath}`);
      } catch (error) {
        console.error(`Warning: Failed to load field mappings from ${configPath}:`, error);
        // Continue with empty mappings
      }
    } else {
      console.error(`No field mappings file found at ${configPath} - using pass-through mode`);
    }
  }

  /**
   * Resolve a field name to its actual Jira field ID
   * If the field is mapped, returns the mapped value
   * If not mapped, returns the original value (allows using actual field IDs)
   *
   * Examples:
   * - resolveField("sprint") -> "customfield_10560" (if mapped)
   * - resolveField("customfield_10560") -> "customfield_10560" (pass-through)
   * - resolveField("summary") -> "summary" (standard field)
   */
  resolveField(fieldName: string): string {
    return this.mappings[fieldName] || fieldName;
  }

  /**
   * Resolve all keys in a fields object
   * Returns a new object with resolved field names
   */
  resolveFields(fields: Record<string, unknown>): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      const resolvedKey = this.resolveField(key);
      resolved[resolvedKey] = value;
    }
    return resolved;
  }

  /**
   * Get all configured mappings (for debugging/documentation)
   */
  getMappings(): Record<string, string> {
    return { ...this.mappings };
  }
}
