import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, ShadingType, WidthType,
  convertInchesToTwip,
} from "docx";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "assets");

// ─── Colour palette ──────────────────────────────────────────────────────────
const NAVY   = "0D2B6E";
const GREEN  = "1A4A2E";
const LIGHT_NAVY = "EEF3FF";
const LIGHT_GREEN = "F0F8F3";
const GREY_TEXT  = "5A6A8A";
const BORDER_CLR = "D0D8EE";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** A simple shaded heading paragraph */
function sectionHeading(text, color) {
  return new Paragraph({
    spacing: { before: 280, after: 120 },
    shading: { type: ShadingType.SOLID, color, fill: color },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: "FFFFFF" },
    },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        size: 20,
        color: "FFFFFF",
        font: "Calibri",
      }),
    ],
    indent: { left: convertInchesToTwip(0.1), right: convertInchesToTwip(0.1) },
  });
}

/** A bold sub-label above a field */
function fieldLabel(text, required = null) {
  const children = [
    new TextRun({ text, bold: true, size: 22, font: "Calibri", color: "1A1A2E" }),
  ];
  if (required === true) {
    children.push(new TextRun({ text: "  REQUIRED", bold: true, size: 16, color: "C0392B", font: "Calibri" }));
  } else if (required === false) {
    children.push(new TextRun({ text: "  OPTIONAL", bold: true, size: 16, color: "2E7D32", font: "Calibri" }));
  }
  return new Paragraph({
    spacing: { before: 200, after: 40 },
    children,
  });
}

/** A helper note below a label */
function noteText(text) {
  return new Paragraph({
    spacing: { before: 0, after: 60 },
    children: [new TextRun({ text, italics: true, size: 18, color: GREY_TEXT, font: "Calibri" })],
  });
}

/** A blank write-in line */
function blankLine(label = "") {
  return new Paragraph({
    spacing: { before: 60, after: 180 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "AAAAAA" } },
    children: [
      new TextRun({ text: label ? `${label}: ` : "", size: 20, color: "999999", font: "Calibri" }),
      new TextRun({ text: "\t\t\t\t\t\t\t\t\t\t", size: 20, font: "Calibri" }),
    ],
  });
}

/** A tall blank write-in area (multiple lines) */
function blankArea(lines = 3) {
  const paras = [];
  for (let i = 0; i < lines; i++) {
    paras.push(new Paragraph({
      spacing: { before: 0, after: 120 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" } },
      children: [new TextRun({ text: " ", size: 20, font: "Calibri" })],
    }));
  }
  return paras;
}

/** A checkbox row */
function checkItem(title, note = "") {
  const rows = [
    new Paragraph({
      spacing: { before: 120, after: note ? 30 : 120 },
      children: [
        new TextRun({ text: "☐  ", size: 22, font: "Calibri", color: "4A5A8A" }),
        new TextRun({ text: title, bold: true, size: 22, font: "Calibri" }),
      ],
    }),
  ];
  if (note) {
    rows.push(new Paragraph({
      spacing: { before: 0, after: 120 },
      indent: { left: convertInchesToTwip(0.35) },
      children: [new TextRun({ text: note, italics: true, size: 18, color: GREY_TEXT, font: "Calibri" })],
    }));
  }
  return rows;
}

/** Plain body text */
function body(text, options = {}) {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    children: [new TextRun({ text, size: 20, font: "Calibri", ...options })],
  });
}

/** Highlighted info box using a 1-cell table */
function infoBox(text, bgColor = LIGHT_NAVY) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    margins: { top: 80, bottom: 80 },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.SOLID, color: bgColor, fill: bgColor },
            margins: { top: 120, bottom: 120, left: 200, right: 200 },
            borders: {
              top:    { style: BorderStyle.SINGLE, size: 6, color: BORDER_CLR },
              bottom: { style: BorderStyle.SINGLE, size: 6, color: BORDER_CLR },
              left:   { style: BorderStyle.THICK,  size: 18, color: NAVY },
              right:  { style: BorderStyle.SINGLE, size: 6, color: BORDER_CLR },
            },
            children: [
              new Paragraph({
                children: [new TextRun({ text, size: 20, font: "Calibri", color: "1A2A4E" })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function spacer(before = 160) {
  return new Paragraph({ spacing: { before, after: 0 }, children: [new TextRun("")] });
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT 1: IPELRA Staff Checklist
// ─────────────────────────────────────────────────────────────────────────────

function buildStaffChecklist() {
  return new Document({
    creator: "IPELRA Passport App",
    title: "IPELRA Staff Checklist — Conference Passport App",
    description: "Internal checklist for IPELRA staff to prepare for the Conference Passport app launch.",
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22 },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top:    convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left:   convertInchesToTwip(1.1),
              right:  convertInchesToTwip(1.1),
            },
          },
        },
        children: [
          // ── Title block ───────────────────────────────────────────────────
          new Paragraph({
            spacing: { before: 0, after: 60 },
            children: [
              new TextRun({ text: "CONFIDENTIAL — IPELRA INTERNAL", bold: true, size: 18, color: "8A96A8", font: "Calibri" }),
            ],
          }),
          new Paragraph({
            spacing: { before: 0, after: 120 },
            children: [
              new TextRun({ text: "Conference Passport App", bold: true, size: 36, color: NAVY, font: "Calibri" }),
            ],
          }),
          new Paragraph({
            spacing: { before: 0, after: 60 },
            children: [
              new TextRun({ text: "IPELRA Staff Checklist", bold: true, size: 28, color: "333333", font: "Calibri" }),
            ],
          }),
          new Paragraph({
            spacing: { before: 0, after: 40 },
            children: [
              new TextRun({ text: "IPELRA Annual Conference 2026  ·  Eagle Ridge Resort, Galena, IL", size: 20, color: GREY_TEXT, font: "Calibri" }),
            ],
          }),
          spacer(60),

          // ── Intro box ─────────────────────────────────────────────────────
          infoBox(
            "How to use this checklist: These are the things only IPELRA can provide or decide. A separate sheet goes to sponsors. " +
            "Once all items below are checked off and sponsor info is collected, we handle the rest — no technical work required from your end.",
            LIGHT_NAVY
          ),
          spacer(200),

          // ── Key Milestones ────────────────────────────────────────────────
          sectionHeading("Key Milestones", NAVY),
          spacer(80),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                tableHeader: true,
                children: ["Target", "Target", "Go-Live", "Lock"].map(h =>
                  new TableCell({
                    shading: { type: ShadingType.SOLID, color: "E4EAF8", fill: "E4EAF8" },
                    margins: { top: 80, bottom: 80, left: 160, right: 160 },
                    children: [new Paragraph({
                      children: [new TextRun({ text: h, bold: true, size: 18, font: "Calibri", color: NAVY })],
                    })],
                  })
                ),
              }),
              new TableRow({
                children: [
                  ["Late Aug 2026", "All sponsor info collected & staff checklist complete"],
                  ["Early Sept 2026", "App configured & in final testing"],
                  ["Oct 5, 2026", "Passport app opens for attendees"],
                  ["Oct 7, 2026", "Passport closes — prize drawing"],
                ].map(([date, desc]) =>
                  new TableCell({
                    margins: { top: 100, bottom: 100, left: 160, right: 160 },
                    children: [
                      new Paragraph({ children: [new TextRun({ text: date, bold: true, size: 20, font: "Calibri" })] }),
                      new Paragraph({ children: [new TextRun({ text: desc, size: 18, color: GREY_TEXT, font: "Calibri" })] }),
                    ],
                  })
                ),
              }),
            ],
          }),
          spacer(240),

          // ── Section 1 ─────────────────────────────────────────────────────
          sectionHeading("1 · Branding & Logos", NAVY),
          ...checkItem(
            "Official IPELRA logo file  [REQUIRED]",
            "PNG or SVG file, transparent background preferred. Used in the app and in every email sent to attendees. " +
            "A transparent background ensures it looks correct on all screen colors. A screenshot from the website may work " +
            "but can appear blurry on high-resolution phone screens — the actual file from your designer is best."
          ),
          spacer(200),

          // ── Section 2 ─────────────────────────────────────────────────────
          sectionHeading("2 · People & Access", NAVY),
          ...checkItem(
            "Admin email addresses  [REQUIRED]",
            "The email address(es) for each person who needs access to the admin portal (dashboard, attendee list, export, etc.). " +
            "These people receive a login link by email — no password needed. Typically 2–4 people."
          ),
          spacer(200),

          // ── Section 3 ─────────────────────────────────────────────────────
          sectionHeading("3 · Sponsor Information", NAVY),
          ...checkItem(
            "Final sponsor list with tiers  [REQUIRED]",
            "A complete list of all participating exhibitors and whether each is Gold or Platinum tier. " +
            "This determines point values (Gold = 100 pts, Platinum = 150 pts)."
          ),
          ...checkItem(
            "Completed sponsor info sheets returned  [REQUIRED]",
            "Each sponsor fills out their info sheet and returns it to you. Forward everything to us at once. " +
            "See the companion document: Sponsor Information Sheet."
          ),
          spacer(200),

          // ── Section 4 ─────────────────────────────────────────────────────
          sectionHeading("4 · Conference Details to Confirm", NAVY),
          ...checkItem(
            "Prize station location at Eagle Ridge  [CONFIRM]",
            "The app currently directs completers to \"the Prize Station near the conference registration desk.\" " +
            "Please confirm this is accurate — if the prize station will be somewhere else, let us know before launch."
          ),
          ...checkItem(
            "Passport open/close dates and times  [CONFIRM]",
            "Currently set to open October 5, 2026 and lock October 7, 2026. If either date or time needs to change, let us know."
          ),
          ...checkItem(
            "Prize & drawing process  [CONFIRM]",
            "The app tracks every attendee who completes the passport. We can export a CSV of completers for a prize drawing. " +
            "Confirm what the prize is and how you plan to run the drawing so the app wording matches."
          ),
          ...checkItem(
            "Review the Help & FAQ page  [CONFIRM]",
            "The app has a built-in help section that answers common attendee questions. " +
            "We'll share the draft text — please read through it and flag anything that doesn't match how you plan to run the event."
          ),
          spacer(200),

          // ── Section 5 ─────────────────────────────────────────────────────
          sectionHeading("5 · During the Conference — Staff Duties", NAVY),
          ...checkItem(
            "Print QR codes for each sponsor booth",
            "We will generate a QR code card for each sponsor. Print one per booth and place it on the table. " +
            "Sponsors don't need to do anything technical — attendees scan to open that sponsor's page in the app."
          ),
          ...checkItem(
            "Activate the passport in the admin portal on opening day",
            "The passport starts in \"off\" mode. On the morning of October 5, log into the admin portal and flip the passport to Live."
          ),
          ...checkItem(
            "Monitor the admin dashboard during the conference",
            "The dashboard shows real-time check-ins, completions, and flagged activity. Typically no action needed — just a good way to see how engagement is going."
          ),
          ...checkItem(
            "Help attendees who didn't receive their login email",
            "Direct them to the login page to request a new link. Links expire in 15 minutes — if they waited too long, they just request another one. No password, no account to reset."
          ),
          spacer(200),

          // ── Section 6 ─────────────────────────────────────────────────────
          sectionHeading("6 · After the Conference", NAVY),
          ...checkItem(
            "Export completed attendees list for prize drawing",
            "In the admin portal, use the Export page to download a CSV of all attendees who completed the passport."
          ),
          ...checkItem(
            "Run Conference Reset to archive data  [OPTIONAL]",
            "The admin portal includes a Reset function that archives all attendee and check-in data from this year. " +
            "Not urgent — do it when you're ready to clean up for next year."
          ),
          spacer(320),

          // ── Footer note ───────────────────────────────────────────────────
          new Paragraph({
            alignment: AlignmentType.CENTER,
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" } },
            spacing: { before: 200, after: 0 },
            children: [
              new TextRun({ text: "IPELRA Annual Conference 2026  ·  Eagle Ridge Resort, Galena, IL  ·  Confidential — Staff Use Only", size: 16, color: "9A9A9A", font: "Calibri" }),
            ],
          }),
        ],
      },
    ],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT 2: Sponsor Information Sheet
// ─────────────────────────────────────────────────────────────────────────────

function buildSponsorSheet() {
  return new Document({
    creator: "IPELRA Passport App",
    title: "Sponsor Information Sheet — IPELRA Conference Passport App",
    description: "Fill out and return to IPELRA by September 1, 2026.",
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22 },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top:    convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left:   convertInchesToTwip(1.1),
              right:  convertInchesToTwip(1.1),
            },
          },
        },
        children: [
          // ── Title block ───────────────────────────────────────────────────
          new Paragraph({
            spacing: { before: 0, after: 60 },
            children: [
              new TextRun({ text: "FOR SPONSOR / EXHIBITOR USE", bold: true, size: 18, color: "8A96A8", font: "Calibri" }),
            ],
          }),
          new Paragraph({
            spacing: { before: 0, after: 120 },
            children: [
              new TextRun({ text: "Conference Passport App", bold: true, size: 36, color: GREEN, font: "Calibri" }),
            ],
          }),
          new Paragraph({
            spacing: { before: 0, after: 60 },
            children: [
              new TextRun({ text: "Sponsor Information Sheet", bold: true, size: 28, color: "333333", font: "Calibri" }),
            ],
          }),
          new Paragraph({
            spacing: { before: 0, after: 40 },
            children: [
              new TextRun({ text: "IPELRA Annual Conference 2026  ·  Eagle Ridge Resort, Galena, IL", size: 20, color: GREY_TEXT, font: "Calibri" }),
            ],
          }),
          spacer(60),

          // ── Intro box ─────────────────────────────────────────────────────
          infoBox(
            "Deadline: Please return this sheet to IPELRA no later than September 1, 2026. " +
            "Late submissions may not be included in the passport at launch.\n\n" +
            "Fill out all required fields below and email your answers — along with your logo file — to your IPELRA contact.",
            LIGHT_GREEN
          ),
          spacer(200),

          // ── Section 1 ─────────────────────────────────────────────────────
          sectionHeading("1 · Company Information", GREEN),
          spacer(80),

          fieldLabel("Company Name", true),
          noteText("Exactly as you want it displayed in the app and on your exhibit card."),
          blankLine(),
          spacer(80),

          fieldLabel("One-Sentence Tagline", true),
          noteText("A single sentence that tells attendees what your company does. Shown on your exhibit card in the app."),
          noteText("Example: \"Smart software for modern municipal HR and labor relations.\""),
          blankLine(),
          spacer(80),

          fieldLabel("Company Website", false),
          noteText("Displayed as a link on your exhibit card so attendees can learn more. Include https://"),
          blankLine(),
          spacer(80),

          fieldLabel("Company Logo", true),
          noteText("Attach your logo file to the email when you return this sheet."),
          noteText("Best format: PNG or SVG with a transparent background. Minimum width: 400px."),
          noteText("A logo on a white background will also work if that's all you have."),
          blankLine("Logo file name / notes"),
          spacer(200),

          // ── Section 2 ─────────────────────────────────────────────────────
          sectionHeading("2 · Sponsorship Tier", GREEN),
          spacer(80),

          body("Check one box below:", { bold: true, size: 22 }),
          spacer(60),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.SOLID, color: "FFFBEC", fill: "FFFBEC" },
                    margins: { top: 140, bottom: 140, left: 200, right: 200 },
                    children: [
                      new Paragraph({ children: [new TextRun({ text: "☐  Gold", bold: true, size: 26, font: "Calibri", color: "B8860B" })] }),
                      new Paragraph({ spacing: { before: 60 }, children: [new TextRun({ text: "Attendees earn 100 points for visiting your booth.", size: 18, font: "Calibri", color: "5A4A10" })] }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.SOLID, color: "EEF0F8", fill: "EEF0F8" },
                    margins: { top: 140, bottom: 140, left: 200, right: 200 },
                    children: [
                      new Paragraph({ children: [new TextRun({ text: "☐  Platinum", bold: true, size: 26, font: "Calibri", color: "3A4A6A" })] }),
                      new Paragraph({ spacing: { before: 60 }, children: [new TextRun({ text: "Attendees earn 150 points for visiting your booth.", size: 18, font: "Calibri", color: "3A3A6A" })] }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          spacer(200),

          // ── Section 3 ─────────────────────────────────────────────────────
          sectionHeading("3 · Your Passport Question & Answer", GREEN),
          spacer(80),

          infoBox(
            "How this works: Attendees visit your booth, have a brief conversation with your team, and then answer your question " +
            "in the app to earn points. The app accepts minor spelling mistakes automatically, so attendees don't need to type perfectly.",
            LIGHT_GREEN
          ),
          spacer(160),

          fieldLabel("Your Question", true),
          noteText("The question attendees will see in the app after visiting your booth. It should be answerable after a 1–2 minute conversation with your team."),
          noteText("Good example: \"What type of software does [Company] specialize in?\""),
          noteText("Also good: \"What is the name of [Company]'s flagship product?\""),
          noteText("Avoid: trivia, trick questions, or anything with multiple possible correct answers."),
          spacer(80),
          ...blankArea(3),
          spacer(140),

          fieldLabel("Correct Answer Keyword(s)", true),
          noteText(
            "The key word or phrase in the correct answer. The app uses this to check answers — it accepts minor misspellings automatically. " +
            "After 3 failed attempts, the app shows a partial hint (first letter of each word only)."
          ),
          noteText("Example question: \"What type of software does CityTech specialize in?\""),
          noteText("Example keyword: permitting software   (app would accept: \"Permitting Software\", \"permitng software\", etc.)"),
          spacer(80),
          blankLine("Answer keyword(s)"),
          spacer(320),

          // ── Return instructions ───────────────────────────────────────────
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    shading: { type: ShadingType.SOLID, color: "F4F6F9", fill: "F4F6F9" },
                    margins: { top: 160, bottom: 160, left: 240, right: 240 },
                    children: [
                      new Paragraph({ children: [new TextRun({ text: "How to Return This Sheet", bold: true, size: 22, font: "Calibri" })] }),
                      new Paragraph({ spacing: { before: 80 }, children: [new TextRun({
                        text: "Email your completed answers and logo file to your IPELRA contact by September 1, 2026. " +
                              "If you have questions about the question/answer section, reach out — we're happy to help.",
                        size: 20, font: "Calibri", color: "5A6A8A"
                      })] }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          spacer(200),

          new Paragraph({
            alignment: AlignmentType.CENTER,
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" } },
            spacing: { before: 200, after: 0 },
            children: [
              new TextRun({ text: "IPELRA Annual Conference 2026  ·  Eagle Ridge Resort, Galena, IL  ·  Return to IPELRA by Sept 1, 2026", size: 16, color: "9A9A9A", font: "Calibri" }),
            ],
          }),
        ],
      },
    ],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Generate both files
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Generating Word documents...");

  const staffDoc = buildStaffChecklist();
  const staffBuffer = await Packer.toBuffer(staffDoc);
  const staffPath = join(outDir, "IPELRA-Staff-Checklist.docx");
  writeFileSync(staffPath, staffBuffer);
  console.log(`✓ Created: ${staffPath}`);

  const sponsorDoc = buildSponsorSheet();
  const sponsorBuffer = await Packer.toBuffer(sponsorDoc);
  const sponsorPath = join(outDir, "Sponsor-Information-Sheet.docx");
  writeFileSync(sponsorPath, sponsorBuffer);
  console.log(`✓ Created: ${sponsorPath}`);
}

main().catch(err => { console.error(err); process.exit(1); });
