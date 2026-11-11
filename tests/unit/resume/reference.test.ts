import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { parseResumeText, resumeToPlainText } from "../../../src/features/resume/parse/parseResume";
import { pdfItemsToLines } from "../../../src/features/resume/parse/extract";
import { defaultSettings } from "../../../src/features/resume/model/defaults";
import { layoutResume } from "../../../src/features/resume/layout/engine";
import { loadMeasurer } from "../../../src/features/resume/layout/measurer";
import { optimizeLayout } from "../../../src/features/resume/layout/fitting";
import { exportPdf } from "../../../src/features/resume/document/exportPdf";
import { exportDocx } from "../../../src/features/resume/document/exportDocx";
import type { Resume, TemplateId } from "../../../src/features/resume/model/types";

/**
 * Uses the user's supplied reference résumé. It is personal data, so it is NOT stored in the repo:
 * set REFERENCE_RESUME_PDF to its path. The test is skipped when the file is unavailable.
 */
const path = process.env.REFERENCE_RESUME_PDF;
const available = Boolean(path && fs.existsSync(path));
const OUT = process.env.REFERENCE_OUT_DIR;

describe.skipIf(!available)("reference résumé", () => {
  it("imports, reconstructs sections, preserves content and exports one page", async () => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(path!)), useSystemFonts: true }).promise;
    expect(doc.numPages).toBe(1);
    const page = await doc.getPage(1);
    const content = await page.getTextContent();
    const items = (content.items as Array<{ str: string; transform: number[]; width: number }>).filter((item) => item.str.trim()).map((item) => ({ str: item.str, x: item.transform[4], y: item.transform[5], width: item.width, size: Math.abs(item.transform[0]) }));
    const lines = pdfItemsToLines(items);
    const { resume, issues } = parseResumeText(lines.join("\n"));
    if (OUT) fs.writeFileSync(`${OUT}/parsed.json`, JSON.stringify({ resume, issues, lines }, null, 2));

    expect(resume.contact.name).toBe("Eskinder Kassahun");
    expect(resume.skills.length).toBe(5);
    expect(resume.experience.length).toBe(3);
    expect(resume.projects.length).toBe(1);
    expect(resume.education.length).toBe(2);
    expect(resume.certifications.length).toBeGreaterThanOrEqual(6);

    // Every distinct word of the source survives into the structured résumé.
    const norm = (text: string) => new Set(text.toLowerCase().replace(/[^a-z0-9+#./]+/g, " ").split(" ").filter((w) => w.length > 2));
    const source = norm(lines.join(" "));
    const kept = norm(resumeToPlainText(resume));
    const headingWords = new Set(["professional", "experience", "projects", "education", "certifications"]); // section titles are structure, not content
    const lost = [...source].filter((word) => !kept.has(word) && !headingWords.has(word));
    if (OUT) fs.writeFileSync(`${OUT}/lost-words.txt`, lost.join("\n"));
    expect(lost).toEqual([]);

    const measure = await loadMeasurer();
    const report: Record<string, unknown> = {};
    for (const template of ["classic", "technical", "modern"] as TemplateId[]) {
      const settings = defaultSettings(template);
      const layout = layoutResume(resume, settings, measure);
      const optimized = optimizeLayout(resume, settings, measure);
      report[template] = { fit: layout.fit.label, fill: layout.fit.fillRatio.toFixed(3), optimized: optimized.fit.label, adjustments: optimized.adjustments.map((a) => a.label) };
      const final = layout.fit.fitsOnePage ? settings : optimized.settings;
      if (OUT && layoutResume(resume, final, measure).fit.fitsOnePage) {
        const pdf = await exportPdf(resume, final);
        fs.writeFileSync(`${OUT}/export-${template}.pdf`, Buffer.from(pdf.bytes));
        const docx = exportDocx(resume, final);
        fs.writeFileSync(`${OUT}/export-${template}.docx`, Buffer.from(docx));
      }
    }
    if (OUT) fs.writeFileSync(`${OUT}/fit-report.json`, JSON.stringify(report, null, 2));
    expect((report.classic as { optimized: string }).optimized).toBe("Page Fit: 1 of 1");
  });

  it("recreates the reference résumé following the one-page ATS template in both PDF and DOCX", async () => {
    const measure = await loadMeasurer();
    const recreated: Resume = {
      contact: {
        name: "Eskinder Kassahun",
        headline: "Data Center Technician | Linux & Server Infrastructure | Network Troubleshooting",
        location: "Atlanta, GA",
        phone: "762-217-4447",
        email: "eskinderkassahun25@gmail.com",
        linkedin: "linkedin.com/in/eskinder-kassahun",
        github: "",
        website: "",
        other: [],
      },
      targetRole: "Data Center Technician",
      summary: "",
      skills: [
        {
          id: "sk-hw",
          name: "Hardware & Infrastructure",
          skills: [
            "Hardware troubleshooting",
            "component replacement",
            "memory/storage upgrades",
            "RAID",
            "rack installation",
            "equipment staging",
            "fiber/copper cabling",
            "physical connectivity",
            "post-change verification",
          ],
        },
        {
          id: "sk-os",
          name: "Operating Systems & Tools",
          skills: [
            "Linux command line",
            "Ubuntu Server",
            "Debian/Proxmox VE",
            "Windows Server",
            "Active Directory",
            "OS installation",
            "SSH",
            "processes, services, permissions, logs & storage troubleshooting",
            "Docker",
            "TrueNAS",
          ],
        },
        {
          id: "sk-net",
          name: "Networking & Security",
          skills: [
            "TCP/IP",
            "DNS",
            "DHCP",
            "IP addressing",
            "VLANs",
            "switching/routing fundamentals",
            "network design fundamentals",
            "Layer 1/2 troubleshooting",
            "virtual bridges",
            "gateways",
            "Tailscale",
            "VPN remote access",
          ],
        },
        {
          id: "sk-cloud",
          name: "Cloud & Automation",
          skills: [
            "AWS cloud infrastructure (EC2, S3, IAM, VPC, Lambda, CloudFront, Bedrock)",
            "Python",
            "Bash",
            "PowerShell",
            "Git/GitHub",
            "React",
          ],
        },
        {
          id: "sk-ops",
          name: "Operations & Support",
          skills: [
            "Ticket documentation",
            "incident escalation",
            "change management",
            "SLA fundamentals",
            "equipment tracking",
            "process improvement",
            "task prioritization",
            "effective communication",
            "PPE & safety procedures",
          ],
        },
      ],
      experience: [
        {
          id: "exp-1",
          employer: "Amazon",
          location: "Stone Mountain, GA",
          title: "Fulfillment Associate / IT Support",
          startDate: "Nov 2020",
          endDate: "Present",
          current: true,
          bullets: [
            "Provide first-line support for Windows workstations, HP devices, Zebra scanners, industrial label printers, and operational applications; troubleshoot hardware, printing, and network connectivity issues.",
            "Perform approved fixes, escalate complex incidents to IT teams, and document production impact, troubleshooting actions, resolutions, and equipment replacements through a ticketing system.",
            "Identify recurring hardware and operational issues, recommend process improvements, follow change-management procedures, and mentor 15+ associates on equipment use, troubleshooting, and safety.",
          ],
        },
        {
          id: "exp-2",
          employer: "Amazon Web Services (AWS) / YUPRO",
          location: "Butts County, GA",
          title: "Data Center Infrastructure Pre-Apprentice",
          startDate: "Mar 2026",
          endDate: "Jun 2026",
          current: false,
          bullets: [
            "Completed 120+ hours of paid hands-on training in data center hardware, rack installation, fiber/copper cabling, infrastructure deployment, and server maintenance.",
            "Staged, connected, powered, and maintained rack-level equipment using technical diagrams, written SOPs, safe equipment handling, and critical-environment safety procedures.",
            "Applied OSI Layers 1–4, TCP/IP, switching, IP addressing, and routing concepts to physical layer connectivity and data center infrastructure troubleshooting.",
          ],
        },
        {
          id: "exp-3",
          employer: "Per Scholas / AWS re/Start",
          location: "Remote",
          title: "Cloud & IT Support Trainee",
          startDate: "Aug 2025",
          endDate: "Oct 2025",
          current: false,
          bullets: [
            "Completed intensive hands-on labs in Linux administration, Windows/Active Directory support, networking, security, Python scripting, system troubleshooting, and AWS cloud services.",
            "Configured EC2, S3, IAM, VPC subnets, route tables, security groups, network ACLs, and monitoring tools; practiced subnetting, DNS, DHCP, and Linux permissions, processes, services, and logs.",
          ],
        },
      ],
      projects: [
        {
          id: "proj-1",
          name: "Enterprise Infrastructure & Server Administration Home Lab",
          role: "",
          technologies: ["Proxmox VE", "Ubuntu Server", "Windows Server", "TrueNAS", "Docker", "Tailscale"],
          startDate: "",
          endDate: "",
          description: "",
          githubUrl: "",
          liveUrl: "",
          bullets: [
            "Administered Linux, Windows Server, storage, and application VMs in Proxmox VE; configured CPU, memory, virtual disks, UEFI boot, and virtual network interfaces.",
            "Deployed a Windows Server Active Directory domain-controller lab and Ubuntu Server VM hosting a FastAPI web service; configured virtual bridges, static IPs, gateways, and SSH, verifying end-to-end connectivity.",
            "Managed NVMe-backed virtual storage and a 7.3 TB storage pool; monitored capacity, health, and system resources using Linux command-line utilities and Proxmox management tools.",
          ],
        },
      ],
      education: [
        {
          id: "edu-1",
          institution: "Southern New Hampshire University",
          location: "Manchester, NH",
          degree: "Bachelor of Science in Computer Science",
          field: "",
          startDate: "",
          endDate: "Jul 2025",
          gpa: "",
          details: [],
        },
        {
          id: "edu-2",
          institution: "Per Scholas",
          location: "Remote",
          degree: "Cloud & IT Support Training",
          field: "",
          startDate: "Aug 2025",
          endDate: "Oct 2025",
          gpa: "",
          details: [],
        },
      ],
      certifications: [
        { id: "c-1", name: "CompTIA Security+", issuer: "", date: "", credentialId: "" },
        { id: "c-2", name: "AWS Certified Cloud Practitioner", issuer: "", date: "", credentialId: "" },
        { id: "c-3", name: "AWS Certified Solutions Architect – Associate", issuer: "", date: "", credentialId: "" },
        { id: "c-4", name: "OSHA 10-Hour General Industry Safety Training", issuer: "", date: "", credentialId: "" },
        { id: "c-5", name: "Six Sigma Yellow Belt", issuer: "", date: "", credentialId: "" },
        { id: "c-6", name: "CompTIA Network+ (In Progress)", issuer: "", date: "", credentialId: "" },
      ],
      awards: [],
      publications: [],
      custom: [],
    };

    const baseSettings = {
      ...defaultSettings("classic"),
      fontSize: 10.5,
      margin: 0.55,
      lineSpacing: 1.16,
      sectionSpacing: 6,
      bulletIndent: 14,
    };
    const layout = layoutResume(recreated, baseSettings, measure);
    expect(layout.fit.fitsOnePage).toBe(true);
    expect(layout.fit.label).toBe("Page Fit: 1 of 1");
    expect(layout.pages).toHaveLength(1);

    const pdf = await exportPdf(recreated, baseSettings);
    const docx = exportDocx(recreated, baseSettings);

    if (OUT) {
      fs.writeFileSync(`${OUT}/Eskinder_Kassahun_Resume.pdf`, Buffer.from(pdf.bytes));
      fs.writeFileSync(`${OUT}/Eskinder_Kassahun_Resume.docx`, Buffer.from(docx));
    }

    // Verify exported PDF is 1 page and text-selectable
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf.bytes), useSystemFonts: true }).promise;
    expect(doc.numPages).toBe(1);
    const page1 = await doc.getPage(1);
    const tc = await page1.getTextContent();
    const fullText = (tc.items as Array<{ str: string }>).map((i) => i.str).join(" ");
    expect(fullText).toContain("Eskinder Kassahun");
    expect(fullText).toContain("Data Center Technician | Linux & Server Infrastructure | Network Troubleshooting");
    expect(fullText).toContain("Hardware & Infrastructure:");
    expect(fullText).toContain("Operating Systems & Tools:");
    expect(fullText).toContain("Networking & Security:");
    expect(fullText).toContain("Cloud & Automation:");
    expect(fullText).toContain("Operations & Support:");
    expect(fullText).toContain("Amazon — Stone Mountain, GA");
    expect(fullText).toContain("Southern New Hampshire University — Manchester, NH");
    expect(fullText).toContain("CompTIA Network+ (In Progress)");
  });
});
