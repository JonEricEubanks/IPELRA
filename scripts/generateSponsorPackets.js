import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const projectDir = resolve(scriptDir, '..');
const assetsDir = join(projectDir, 'assets');
const appUrl = process.env.APP_URL;

if (!appUrl) {
  console.error('Set APP_URL to the live passport app URL before exporting sponsor packets.');
  process.exit(1);
}

function findEdge() {
  const candidates = [
    process.env.EDGE_PATH,
    process.env['PROGRAMFILES(X86)'] && join(process.env['PROGRAMFILES(X86)'], 'Microsoft/Edge/Application/msedge.exe'),
    process.env.PROGRAMFILES && join(process.env.PROGRAMFILES, 'Microsoft/Edge/Application/msedge.exe'),
  ].filter(Boolean);
  return candidates.find(existsSync);
}

function getStyle(html, sourceName) {
  const match = html.match(/<style>([\s\S]*?)<\/style>/i);
  if (!match) throw new Error(`No inline stylesheet found in ${sourceName}.`);
  return match[1];
}

function getSections(html, className) {
  const escapedClass = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`<section class="${escapedClass}(?:\\s[^"]*)?">[\\s\\S]*?<\\/section>`, 'gi');
  return [...html.matchAll(pattern)].map(([section]) => section);
}

function decodeEntities(value) {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, code) => {
    if (code[0] === '#') {
      const number = code[1].toLowerCase() === 'x'
        ? Number.parseInt(code.slice(2), 16)
        : Number.parseInt(code.slice(1), 10);
      return String.fromCodePoint(number);
    }
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[code.toLowerCase()];
  });
}

function getHeading(section) {
  const match = section.match(/<h1>([\s\S]*?)<\/h1>/i);
  return match ? decodeEntities(match[1].replace(/<[^>]*>/g, '')).trim() : '';
}

function normalizeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getSponsorText(section, className) {
  const match = section.match(new RegExp(`<p class="${className}">([\\s\\S]*?)<\\/p>`, 'i'));
  if (!match) throw new Error(`Answer card is missing its ${className} field.`);
  return decodeEntities(match[1].replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}

function safeFileName(name) {
  return name.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '');
}

function wrapHtml(style, section) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${style}</style></head><body>${section}</body></html>`;
}

function printPdf(edgePath, htmlPath, pdfPath) {
  const result = spawnSync(edgePath, [
    '--headless',
    '--disable-gpu',
    '--no-pdf-header-footer',
    `--print-to-pdf=${pdfPath}`,
    pathToFileURL(htmlPath).href,
  ], { stdio: 'ignore', timeout: 60_000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Edge PDF export failed for ${htmlPath} (exit ${result.status}).`);
  if (!existsSync(pdfPath) || statSync(pdfPath).size < 1000) {
    throw new Error(`Edge did not produce a valid PDF for ${htmlPath}.`);
  }
}

function escapePowerShell(value) {
  return value.replace(/'/g, "''");
}

function zipPdfs(pdfDir, zipPath) {
  const command = `Compress-Archive -Path '${escapePowerShell(join(pdfDir, '*.pdf'))}' -DestinationPath '${escapePowerShell(zipPath)}' -CompressionLevel Optimal -Force`;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
    stdio: 'inherit',
    timeout: 60_000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Could not create packet ZIP (exit ${result.status}).`);
  if (!existsSync(zipPath) || statSync(zipPath).size === 0) throw new Error('Packet ZIP was not created.');
}

function run() {
  const edgePath = findEdge();
  if (!edgePath) throw new Error('Microsoft Edge was not found. Set EDGE_PATH to msedge.exe.');

  const qrGenerator = join(scriptDir, 'generateQrCodes.js');
  const qrRun = spawnSync(process.execPath, [qrGenerator], {
    cwd: scriptDir,
    env: process.env,
    stdio: 'inherit',
  });
  if (qrRun.error) throw qrRun.error;
  if (qrRun.status !== 0) throw new Error(`QR sheet generation failed (exit ${qrRun.status}).`);

  const qrHtml = readFileSync(join(assetsDir, 'qr-sheets.html'), 'utf8');
  const answerHtml = readFileSync(join(projectDir, 'demo-answer-key.html'), 'utf8');
  const qrStyle = getStyle(qrHtml, 'qr-sheets.html');
  const answerStyle = getStyle(answerHtml, 'demo-answer-key.html');
  const qrSections = getSections(qrHtml, 'sheet')
    .map(section => ({ section, name: getHeading(section) }))
    .filter(({ name }) => name && name !== 'Activate Your Passport');
  const answerSections = getSections(answerHtml, 'answer-card');
  if (answerSections.length === 0) throw new Error('No sponsor answer cards were found.');

  const logoPath = join(assetsDir, 'LogoText.png');
  if (!existsSync(logoPath)) throw new Error(`IPELRA logo was not found at ${logoPath}.`);
  const logoData = `data:image/png;base64,${readFileSync(logoPath).toString('base64')}`;

  const matched = answerSections.map(section => {
    const name = getHeading(section);
    if (!name) throw new Error('Found an answer card without a sponsor heading.');
    const normalized = normalizeName(name);
    const candidates = qrSections.filter(({ name: qrName }) => {
      const qrNormalized = normalizeName(qrName);
      return qrNormalized === normalized || qrNormalized.includes(normalized) || normalized.includes(qrNormalized);
    });
    if (candidates.length !== 1) {
      throw new Error(`Expected one QR sheet for "${name}", found ${candidates.length}.`);
    }
    if (/class="sheet inactive"|INACTIVE/i.test(candidates[0].section)) {
      throw new Error(`Refusing to export an inactive sponsor QR for "${name}".`);
    }
    return { name, qrSection: candidates[0].section, answerSection: section };
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = join(assetsDir, `sponsor-packets-${timestamp}`);
  const stagingDir = join(outputDir, '.staging');
  const pdfDir = join(outputDir, 'pdfs');
  mkdirSync(stagingDir, { recursive: true });
  mkdirSync(pdfDir);

  let pdfCount = 0;
  try {
    for (const sponsor of matched) {
      const fileBase = safeFileName(sponsor.name);
      const qrFile = `${fileBase}-QR`;
      const answerFile = `${fileBase}-Answer`;
      const qrHtmlPath = join(stagingDir, `${qrFile}.html`);
      const answerHtmlPath = join(stagingDir, `${answerFile}.html`);
      const qrPdfPath = join(pdfDir, `${qrFile}.pdf`);
      const answerPdfPath = join(pdfDir, `${answerFile}.pdf`);

      writeFileSync(qrHtmlPath, wrapHtml(qrStyle, sponsor.qrSection), 'utf8');
      writeFileSync(answerHtmlPath, wrapHtml(
        answerStyle,
        sponsor.answerSection.replace(/src="assets\/LogoText\.png"/gi, `src="${logoData}"`),
      ), 'utf8');
      printPdf(edgePath, qrHtmlPath, qrPdfPath);
      printPdf(edgePath, answerHtmlPath, answerPdfPath);
      pdfCount += 2;
      console.log(`  Created QR and answer PDFs for ${sponsor.name}`);
    }
  } finally {
    rmSync(stagingDir, { recursive: true, force: true });
  }

  const zipPath = join(outputDir, 'sponsor-packets.zip');
  zipPdfs(pdfDir, zipPath);
  console.log(`\nCreated ${pdfCount} PDF(s) for ${matched.length} sponsor(s).`);
  console.log(`Individual PDFs: ${pdfDir}`);
  console.log(`ZIP: ${zipPath}`);
}

try {
  run();
} catch (error) {
  console.error(`\nSponsor packet export failed: ${error.message}`);
  process.exitCode = 1;
}