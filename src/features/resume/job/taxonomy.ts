/**
 * Curated skill dictionary used to recognize requirements in job descriptions.
 *
 * Each entry is [normalized term, aliases]. Matching is case-insensitive unless
 * the term is listed in CASE_SENSITIVE (short words such as "Go" or "R" that
 * are ordinary English otherwise). Longer phrases are matched first and consume
 * their text, so "AWS Identity and Access Management" maps to "AWS IAM" and is
 * not also counted as generic "Identity & Access Management".
 *
 * Categories are only shown when the job description actually contains one of
 * their terms; nothing here is added to a result by default.
 */
export type TaxonomyEntry = [term: string, aliases?: string[]];

export const TAXONOMY: Record<string, TaxonomyEntry[]> = {
  "Programming Languages": [
    ["Python"], ["JavaScript", ["JS", "ECMAScript"]], ["TypeScript"], ["Java"], ["C#", ["C sharp"]], ["C++", ["cpp"]], ["C"],
    ["Go", ["Golang"]], ["Rust"], ["Ruby"], ["PHP"], ["Swift"], ["Kotlin"], ["Scala"], ["R"], ["SQL", ["T-SQL", "PL/SQL"]],
    ["Bash", ["Bash scripting", "shell scripting", "shell scripts"]], ["PowerShell", ["PowerShell scripting"]], ["Perl"], ["MATLAB"],
    ["HTML", ["HTML5"]], ["CSS", ["CSS3"]], ["Dart"], ["Objective-C"],
  ],
  "Frameworks & Libraries": [
    ["React", ["React.js", "ReactJS"]], ["Angular", ["AngularJS"]], ["Vue", ["Vue.js", "VueJS"]], ["Next.js", ["NextJS"]], ["Node.js", ["NodeJS", "Node"]],
    ["Express", ["Express.js"]], ["Django"], ["Flask"], ["FastAPI"], ["Spring Boot", ["Spring"]], [".NET", ["ASP.NET", ".NET Core", "dotnet"]],
    ["Ruby on Rails", ["Rails"]], ["Laravel"], ["jQuery"], ["Tailwind CSS", ["Tailwind"]], ["Bootstrap"], ["TensorFlow"], ["PyTorch"],
    ["pandas"], ["NumPy"], ["scikit-learn", ["sklearn"]],
  ],
  "Cloud Platforms": [
    ["AWS IAM", ["AWS Identity and Access Management", "AWS Identity & Access Management", "Amazon IAM"]],
    ["Amazon EC2", ["EC2", "AWS EC2"]], ["Amazon S3", ["S3", "AWS S3"]], ["AWS Lambda", ["Lambda"]], ["AWS CloudFormation", ["CloudFormation"]],
    ["Amazon CloudWatch", ["CloudWatch"]], ["AWS", ["Amazon Web Services"]],
    ["Microsoft Entra ID", ["Azure Active Directory", "Azure AD", "Entra ID", "AAD"]], ["Azure", ["Microsoft Azure"]],
    ["Google Cloud", ["GCP", "Google Cloud Platform"]], ["Microsoft 365", ["Office 365", "O365", "M365"]], ["Google Workspace", ["G Suite"]],
  ],
  "Operating Systems": [
    ["Windows Server"], ["Windows", ["Windows 10", "Windows 11", "Windows OS", "Microsoft Windows"]], ["Linux"], ["Ubuntu"],
    ["Red Hat Enterprise Linux", ["RHEL", "Red Hat"]], ["CentOS"], ["macOS", ["Mac OS", "OS X"]], ["iOS"], ["Android"], ["Unix"],
  ],
  Networking: [
    ["TCP/IP", ["TCP", "TCP IP"]], ["DNS"], ["DHCP"], ["VLAN", ["VLANs"]], ["VPN", ["VPNs"]], ["LAN/WAN", ["LAN", "WAN"]], ["SD-WAN"],
    ["Routing and switching", ["routing", "switching", "routers", "switches"]], ["OSPF"], ["BGP"], ["Firewalls", ["firewall", "firewall configuration"]],
    ["Load balancing", ["load balancers"]], ["Wireless networking", ["Wi-Fi", "WiFi", "wireless"]], ["Cisco IOS", ["Cisco"]], ["Subnetting", ["subnets"]],
  ],
  Security: [
    ["SIEM", ["security information and event management"]], ["Splunk"], ["Incident response", ["incident handling"]],
    ["Vulnerability management", ["vulnerability scanning", "vulnerability assessment", "vulnerability assessments"]], ["Nessus"], ["Wireshark"],
    ["IDS/IPS", ["intrusion detection", "intrusion prevention", "IDS", "IPS"]], ["EDR", ["endpoint detection and response"]],
    ["Penetration testing", ["pen testing", "pentesting"]], ["Threat hunting"], ["NIST frameworks", ["NIST", "NIST CSF", "NIST 800-53"]],
    ["ISO 27001"], ["Zero Trust"], ["Identity & Access Management", ["identity and access management", "IAM"]], ["MFA", ["multi-factor authentication", "two-factor authentication", "2FA"]],
    ["SSO", ["single sign-on"]], ["Encryption"], ["Phishing analysis", ["phishing"]], ["Malware analysis", ["malware"]],
    ["CrowdStrike Falcon", ["CrowdStrike"]], ["SentinelOne"], ["Microsoft Defender", ["Defender for Endpoint"]], ["Microsoft Sentinel", ["Azure Sentinel"]], ["IBM QRadar", ["QRadar"]],
    ["Okta"], ["Palo Alto Networks", ["Palo Alto"]], ["Fortinet", ["FortiGate"]], ["Burp Suite"], ["Metasploit"], ["Nmap"], ["Kali Linux"], ["Qualys"], ["Tenable"], ["SOAR", ["security orchestration"]],
  ],
  Databases: [
    ["PostgreSQL", ["Postgres"]], ["MySQL"], ["Microsoft SQL Server", ["SQL Server", "MS SQL", "MSSQL"]], ["Oracle Database", ["Oracle"]], ["MongoDB"],
    ["Redis"], ["SQLite"], ["DynamoDB"], ["Snowflake"], ["Elasticsearch"],
  ],
  "DevOps & CI/CD": [
    ["Docker", ["containers", "containerization"]], ["Kubernetes", ["K8s"]], ["Terraform"], ["Ansible"], ["Jenkins"], ["GitHub Actions"], ["GitLab CI", ["GitLab CI/CD"]],
    ["CI/CD", ["continuous integration", "continuous delivery", "continuous deployment"]], ["Git", ["version control"]], ["Helm"], ["Prometheus"], ["Grafana"],
    ["Infrastructure as Code", ["IaC"]],
  ],
  "Data & Analytics": [
    ["Microsoft Excel", ["Excel", "spreadsheets"]], ["Tableau"], ["Power BI", ["PowerBI"]], ["Looker"], ["ETL", ["data pipelines"]], ["Data visualization", ["dashboards"]],
    ["Statistics", ["statistical analysis"]], ["Machine learning", ["ML"]], ["A/B testing"],
  ],
  "IT Support & Systems": [
    ["Active Directory", ["AD DS"]], ["Group Policy", ["GPO", "GPOs"]], ["ServiceNow"], ["Jira", ["JIRA"]], ["ITIL"], ["Help desk support", ["help desk", "helpdesk", "service desk"]],
    ["Ticketing systems", ["ticketing system", "ticketing"]], ["Troubleshooting", ["troubleshoot", "diagnose"]], ["Hardware support", ["hardware troubleshooting", "PC hardware"]],
    ["Microsoft Intune", ["Intune"]], ["SCCM", ["MECM", "Configuration Manager"]], ["Jamf"], ["VMware", ["vSphere", "ESXi"]], ["Hyper-V"], ["Virtualization"],
    ["Remote support", ["remote desktop", "remote assistance"]], ["Imaging and deployment", ["imaging", "device provisioning"]], ["Backup and recovery", ["backups", "disaster recovery"]],
  ],
  "Software Practices": [
    ["REST APIs", ["REST", "RESTful", "RESTful APIs", "APIs"]], ["GraphQL"], ["Microservices"], ["Unit testing", ["unit tests", "automated testing", "automated tests", "test automation"]],
    ["Test-driven development", ["TDD"]], ["Agile", ["Agile methodologies"]], ["Scrum"], ["Kanban"], ["SDLC", ["software development lifecycle"]], ["Code review", ["code reviews"]],
    ["Object-oriented programming", ["OOP"]], ["Data structures and algorithms", ["data structures", "algorithms"]],
  ],
  Certifications: [
    ["CompTIA A+", ["A+ certification", "A+"]], ["CompTIA Network+", ["Network+"]], ["CompTIA Security+", ["Security+", "Sec+"]], ["CompTIA CySA+", ["CySA+"]], ["CompTIA Linux+", ["Linux+"]],
    ["CCNA"], ["CCNP"], ["CISSP"], ["CISM"], ["CEH", ["Certified Ethical Hacker"]], ["GIAC certification", ["GSEC", "GCIH", "GIAC"]],
    ["AWS Certified Solutions Architect", ["AWS Solutions Architect"]], ["AWS Certified Cloud Practitioner", ["AWS Cloud Practitioner"]],
    ["Microsoft Azure Fundamentals", ["AZ-900"]], ["Microsoft Azure Administrator", ["AZ-104"]], ["PMP"], ["ITIL Foundation", ["ITIL v4 Foundation", "ITIL 4 Foundation"]],
    ["Certified Kubernetes Administrator", ["CKA"]],
  ],
  "Compliance & Domain": [
    ["HIPAA"], ["PCI DSS", ["PCI", "PCI-DSS"]], ["GDPR"], ["SOX", ["Sarbanes-Oxley"]], ["FERPA"], ["FedRAMP"], ["SOC 2", ["SOC2"]],
    ["Security clearance", ["secret clearance", "top secret clearance", "TS/SCI", "active clearance"]],
  ],
  "Professional Skills": [
    ["Communication", ["communication skills", "written and verbal communication", "verbal and written communication", "communicate clearly"]],
    ["Customer service", ["customer-facing", "customer support", "end-user support", "end user support"]], ["Teamwork", ["collaboration", "collaborate", "team player"]],
    ["Problem solving", ["problem-solving", "analytical skills", "critical thinking"]], ["Technical documentation", ["documentation", "document procedures", "knowledge base"]],
    ["Project management", ["manage projects"]], ["Time management", ["prioritize", "prioritization", "multitask", "multitasking"]], ["Leadership", ["lead a team", "leading teams"]],
    ["Attention to detail", ["detail-oriented", "detail oriented"]], ["Mentoring", ["mentor", "coaching"]], ["Stakeholder management", ["stakeholders"]],
  ],
};

/** Short or ambiguous terms that must match with exact capitalization. */
export const CASE_SENSITIVE = new Set(["Go", "R", "C", "Node", "Swift", "Rails", "Spring", "Lambda", "Oracle", "AD DS", "ML", "S3", "EC2", "IAM", "AAD", "A+", "IDS", "IPS", "LAN", "WAN", "TCP", "PCI", "REST", "APIs", "JS", "Excel", "Cisco", "Red Hat", "imaging"]);

/** Terms that are too generic to count on their own unless the line clearly talks about skills. */
export const WEAK_ALIASES = new Set(["routing", "switching", "routers", "switches", "wireless", "containers", "dashboards", "spreadsheets", "imaging", "mentor", "coaching", "prioritize", "collaborate", "stakeholders", "documentation", "diagnose", "troubleshoot", "APIs", "algorithms", "backups"]);

const escapeRe = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/** Word-boundary-aware regex for a term or alias (handles C++, C#, .NET, Node.js, single letters). */
export function termRegex(alias: string, flags = "g"): RegExp {
  const single = alias.length === 1;
  const tail = single ? "(?![\\w+#\\-/'’]|\\.\\w)" : "(?![A-Za-z0-9+#])";
  const caseFlags = CASE_SENSITIVE.has(alias) ? flags.replace("i", "") : flags.includes("i") ? flags : `${flags}i`;
  return new RegExp(`(?<![A-Za-z0-9+#.\\-/])${escapeRe(alias).replace(/ /g, "[\\s-]+")}${tail}`, caseFlags);
}

const ALIAS_INDEX = new Map<string, { category: string; aliases: string[] }>();
for (const [category, entries] of Object.entries(TAXONOMY)) for (const [term, aliases = []] of entries) ALIAS_INDEX.set(term.toLowerCase(), { category, aliases: [term, ...aliases] });

/** All known spellings of a normalized term (the term itself when unknown). */
export function aliasesFor(term: string): string[] {
  return ALIAS_INDEX.get(term.toLowerCase())?.aliases ?? [term];
}

export function taxonomyCategory(term: string): string | undefined {
  return ALIAS_INDEX.get(term.toLowerCase())?.category;
}
