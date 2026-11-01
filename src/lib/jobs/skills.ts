/**
 * A local vocabulary for reading postings. It is deliberately small and
 * explicit: every entry is a technology a candidate can actually list in a
 * profile, with the spellings a posting is likely to use. No model call, no
 * hidden ranking — the same text always yields the same skills.
 */

export type SkillGroup = "language" | "frontend" | "backend" | "data" | "cloud" | "tool" | "practice";

export type SkillEntry = {
  /** Canonical name shown in the interface. */
  name: string;
  group: SkillGroup;
  /** Matched case-insensitively on word boundaries. */
  aliases: string[];
};

const entry = (name: string, group: SkillGroup, aliases: string[] = []): SkillEntry => ({
  name,
  group,
  aliases: [...new Set([name, ...aliases])],
});

export const SKILLS: SkillEntry[] = [
  // Languages
  entry("JavaScript", "language", ["js", "es6", "ecmascript"]),
  entry("TypeScript", "language", ["ts"]),
  entry("Python", "language"),
  entry("Java", "language"),
  entry("Go", "language", ["golang"]),
  entry("Rust", "language"),
  entry("C++", "language", ["cpp", "c plus plus"]),
  entry("C#", "language", ["csharp", ".net"]),
  entry("C", "language"),
  entry("Ruby", "language"),
  entry("PHP", "language"),
  entry("Scala", "language"),
  entry("Kotlin", "language"),
  entry("Swift", "language"),
  entry("Dart", "language"),
  entry("SQL", "language"),
  entry("R", "language"),
  entry("Bash", "language", ["shell scripting", "shell"]),
  entry("HTML", "frontend", ["html5"]),
  entry("CSS", "frontend", ["css3", "scss", "sass", "tailwind", "tailwindcss"]),

  // Frontend
  entry("React", "frontend", ["react.js", "reactjs"]),
  entry("Next.js", "frontend", ["nextjs", "next js"]),
  entry("Vue", "frontend", ["vue.js", "vuejs", "nuxt"]),
  entry("Angular", "frontend", ["angularjs"]),
  entry("Svelte", "frontend", ["sveltekit"]),
  entry("Redux", "frontend", ["zustand", "mobx"]),
  entry("Accessibility", "frontend", ["a11y", "wcag"]),
  entry("React Native", "frontend", ["react-native"]),
  entry("Flutter", "frontend"),

  // Backend
  entry("Node.js", "backend", ["nodejs", "node js", "node"]),
  entry("Express", "backend", ["express.js", "expressjs"]),
  entry("Django", "backend"),
  entry("Flask", "backend"),
  entry("FastAPI", "backend", ["fast api"]),
  entry("Spring Boot", "backend", ["spring", "springboot"]),
  entry("Rails", "backend", ["ruby on rails"]),
  entry("Laravel", "backend"),
  entry("GraphQL", "backend"),
  entry("REST", "backend", ["rest api", "restful", "rest apis"]),
  entry("gRPC", "backend", ["grpc"]),
  entry("WebSockets", "backend", ["websocket", "socket.io"]),
  entry("Microservices", "backend", ["micro-services", "service oriented"]),
  entry("Kafka", "backend", ["apache kafka", "event streaming"]),
  entry("RabbitMQ", "backend", ["amqp"]),
  entry("Redis", "backend"),
  entry("Elasticsearch", "backend", ["elastic search", "opensearch"]),

  // Data
  entry("PostgreSQL", "data", ["postgres", "psql"]),
  entry("MySQL", "data", ["mariadb"]),
  entry("MongoDB", "data", ["mongo"]),
  entry("SQLite", "data"),
  entry("Snowflake", "data"),
  entry("BigQuery", "data", ["big query"]),
  entry("Redshift", "data"),
  entry("dbt", "data"),
  entry("Airflow", "data", ["apache airflow"]),
  entry("Spark", "data", ["pyspark", "apache spark"]),
  entry("Hadoop", "data", ["hdfs", "hive"]),
  entry("Pandas", "data", ["numpy"]),
  entry("ETL", "data", ["elt", "data pipelines", "data pipeline"]),
  entry("Analytics", "data", ["data analysis", "product analytics"]),
  entry("Tableau", "data", ["power bi", "powerbi", "looker"]),
  entry("Machine Learning", "data", ["ml", "deep learning", "neural networks"]),
  entry("PyTorch", "data", ["torch"]),
  entry("TensorFlow", "data", ["tensorflow.js", "keras"]),
  entry("LLMs", "data", ["llm", "large language models", "generative ai", "genai", "rag"]),
  entry("NLP", "data", ["natural language processing"]),
  entry("Computer Vision", "data", ["opencv"]),
  entry("Recommender Systems", "data", ["recommendation systems", "recsys"]),

  // Cloud and platform
  entry("AWS", "cloud", ["amazon web services", "ec2", "s3", "lambda"]),
  entry("GCP", "cloud", ["google cloud", "google cloud platform"]),
  entry("Azure", "cloud", ["microsoft azure"]),
  entry("Docker", "cloud", ["containers", "containerization"]),
  entry("Kubernetes", "cloud", ["k8s", "eks", "gke"]),
  entry("Terraform", "cloud", ["infrastructure as code", "iac"]),
  entry("CI/CD", "cloud", ["ci cd", "continuous integration", "github actions", "jenkins", "gitlab ci"]),
  entry("Linux", "cloud", ["unix"]),
  entry("Nginx", "cloud"),

  // Tools and practice
  entry("Git", "tool", ["github", "gitlab", "version control"]),
  entry("Jira", "tool", ["confluence", "agile", "scrum", "kanban"]),
  entry("Figma", "tool", ["design systems", "sketch", "adobe xd"]),
  entry("Testing", "practice", ["unit tests", "unit testing", "jest", "pytest", "cypress", "playwright", "test automation"]),
  entry("System Design", "practice", ["distributed systems", "scalability", "architecture"]),
  entry("Observability", "practice", ["monitoring", "prometheus", "grafana", "datadog", "logging"]),
  entry("Security", "practice", ["appsec", "owasp", "authentication", "authorization"]),
  entry("Performance", "practice", ["optimization", "latency", "caching"]),
  entry("Product Sense", "practice", ["product thinking", "roadmap", "stakeholder"]),
  entry("Mentoring", "practice", ["mentorship", "code review", "code reviews"]),
];

const BY_ALIAS = new Map<string, SkillEntry>();
for (const skill of SKILLS) {
  for (const alias of skill.aliases) BY_ALIAS.set(alias.toLowerCase(), skill);
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Word-boundary pattern that also works for "c++" and "next.js". */
const patternCache = new Map<string, RegExp>();
function aliasPattern(alias: string): RegExp {
  const cached = patternCache.get(alias);
  if (cached) return cached;
  const pattern = new RegExp(`(^|[^a-z0-9+#.])${escape(alias)}([^a-z0-9+#.]|$)`, "i");
  patternCache.set(alias, pattern);
  return pattern;
}

export function normalizeSkill(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+#. ]/g, " ").replace(/\s+/g, " ").trim();
}

/** Canonical skill names found in a block of text, most specific first. */
export function extractSkills(text: string, limit = 24): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const found = new Map<string, number>();

  for (const skill of SKILLS) {
    let hits = 0;
    for (const alias of skill.aliases) {
      if (!lower.includes(alias)) continue;
      const matches = lower.match(new RegExp(aliasPattern(alias).source, "gi"));
      hits += matches?.length ?? 1;
    }
    // "C" and "R" are too easy to hit by accident; require a technical context.
    if ((skill.name === "C" || skill.name === "R") && !/\b(language|programming|c c\+\+|python|sql)\b/i.test(text)) {
      continue;
    }
    if (hits > 0) found.set(skill.name, hits);
  }

  return [...found.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([name]) => name);
}

/** Map a candidate's free-text skill list onto canonical names, keeping unknowns. */
export function canonicalizeSkills(values: string[]): { canonical: string[]; extra: string[] } {
  const canonical = new Set<string>();
  const extra = new Set<string>();

  for (const raw of values) {
    const normalized = normalizeSkill(raw);
    if (!normalized) continue;

    const direct = BY_ALIAS.get(normalized);
    if (direct) {
      canonical.add(direct.name);
      continue;
    }

    // "Python, SQL" style values arrive already split; a phrase may still hold one skill.
    const inside = extractSkills(raw, 4);
    if (inside.length > 0) {
      inside.forEach((name) => canonical.add(name));
      continue;
    }

    if (normalized.length >= 2 && normalized.length <= 40) extra.add(normalized);
  }

  return { canonical: [...canonical], extra: [...extra] };
}
