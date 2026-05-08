export type Project = {
  tag: string;
  title: string;
  description: string;
  meta: string;
};

export const projects: Project[] = [
  {
    tag: 'SDK · TypeScript',
    title: 'Contentstack Platform SDK',
    description:
      'A unified TypeScript monorepo consolidating CMA, OAuth, webhooks, image transforms, and AI content generation into one coherent surface.',
    meta: 'Active · @timbenniks/contentstack-platform-sdk',
  },
  {
    tag: 'MCP · Agent skills',
    title: 'Contentstack MCP Hub',
    description:
      'Agent skills with RBAC integration, letting product managers contribute skill ideas across the full Contentstack product suite.',
    meta: 'Active · Internal + open contributions',
  },
  {
    tag: 'Experiment',
    title: 'DoorBell DevRel',
    description:
      'AI-generated devrel videos at scale with minimal code. A test for what adaptive content looks like when production cost approaches zero.',
    meta: 'Live · doorbell-devrel.timbenniks.dev',
  },
  {
    tag: 'Workgroup',
    title: 'MACH Alliance Enterprise AI Agents',
    description:
      'Co-chairing the workgroup defining how composable architecture and AI agents get adopted in the enterprise.',
    meta: 'Ongoing · MACH Tech Council',
  },
];
