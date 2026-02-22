export interface EnvironmentContextOptions {
  location?: string;
  application?: string;
  timezone?: string;
}

export class EnvironmentContextService {
  buildContext(options?: EnvironmentContextOptions): string | null {
    const sections: string[] = [];

    sections.push(this.buildDateTime(options?.timezone));

    if (options?.location) {
      sections.push(`Location: ${options.location}`);
    }
    if (options?.application) {
      sections.push(`Application: ${options.application}`);
    }

    return sections.length > 0
      ? `## Environment\n\n${sections.join("\n")}`
      : null;
  }

  private buildDateTime(timezone?: string): string {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
      ...(timezone ? { timeZone: timezone } : {}),
    });
    return `Current date and time: ${formatter.format(now)}`;
  }
}
