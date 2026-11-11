/** Sample résumés with known structure, used by unit and end-to-end tests. Fictional people. */

export const CLASSIC_RESUME = `Jordan Rivera
IT Support Specialist
Austin, TX | jordan.rivera@example.com | (512) 555-0142 | linkedin.com/in/jordanrivera | github.com/jrivera

PROFESSIONAL SUMMARY
IT support specialist with three years of help desk and systems administration experience in mid-size organizations. Comfortable with Windows Server, Active Directory, and networking fundamentals.

TECHNICAL SKILLS
Operating Systems: Windows 10/11, Windows Server 2019, Ubuntu Linux
Networking: TCP/IP, DNS, DHCP, VLANs
Tools: ServiceNow, Active Directory, PowerShell, Python (pandas, requests)
Cloud: AWS (EC2, S3, IAM), Azure AD, powershell

EXPERIENCE
IT Support Specialist — Lone Star Health Services, Austin, TX\tJan 2022 – Present
• Resolved an average of 35 tickets per week across hardware, software, and account access issues.
• Automated new-hire account provisioning with PowerShell, reducing setup time from two hours to
  twenty minutes.
• Documented 40 knowledge base articles used by the service desk.

Help Desk Technician | Capital Tech Solutions | Round Rock, TX | Jun 2020 - Dec 2021
• Supported 300 users through phone, email, and walk-up requests.
• Imaged and deployed 120 laptops during an office migration.

PROJECTS
Home Lab Network | pfSense, VLANs, Raspberry Pi | github.com/jrivera/homelab
• Segmented a home network into three VLANs with firewall rules between them.
• Monitored traffic with Grafana dashboards.

EDUCATION
Austin Community College
Associate of Applied Science in Network Administration\tMay 2020

CERTIFICATIONS
CompTIA A+ — CompTIA, 2020
CompTIA Network+ (CompTIA) Mar 2021

AWARDS
Employee of the Quarter, Lone Star Health Services, 2023
`;

/** Same person exported by a word processor that kept no blank lines and used hyphen bullets. */
export const COMPACT_RESUME = `Avery Chen
avery.chen@example.com · 555-201-3344 · Seattle, WA
Summary
Software developer focused on accessible web applications.
Skills
JavaScript, TypeScript, React, Node.js, SQL, javascript
Work Experience
Software Developer at Northwind Labs
Mar 2021 - Present
- Built an accessible React component library used by four product teams.
- Led migration from REST polling to WebSockets, cutting update latency by
half.
Junior Developer
Jan 2020 - Feb 2021
- Fixed 150 production bugs.
Education
University of Washington
B.S. in Computer Science, 2019
GPA: 3.6/4.0
Volunteer Experience
- Taught weekly coding classes at a public library.
`;

/** Text that lost all line breaks during PDF extraction. */
export const COLLAPSED_RESUME =
  "Sam Patel sam.patel@example.com 555-777-1212 SUMMARY Data analyst with experience in SQL and dashboards. " +
  "SKILLS SQL, Python, Tableau, Excel EXPERIENCE Data Analyst — Contoso Retail Group Feb 2021 – Present " +
  "• Built weekly sales dashboards in Tableau for 12 regional managers. • Wrote SQL queries against a 2 TB warehouse. " +
  "EDUCATION Ohio State University Bachelor of Science in Statistics May 2020 " +
  "Additional filler text to exceed the collapsed threshold and look like a real extracted page from a PDF document.";

/** No recognizable headings at all. */
export const UNSTRUCTURED_RESUME = `Riley Morgan
I have worked in retail for five years and want to move into IT support.
I set up the point of sale network at my store.
`;

export const SAMPLE_JOB_TITLE = "IT Support Specialist";
