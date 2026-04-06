#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const WORKFLOW_FILE = path.resolve(process.cwd(), '.github/workflows/quality-gates.yml');
const DOC_FILE = path.resolve(process.cwd(), 'docs/release-branch-protection-v1.md');

function extractWorkflowJobIds(content) {
  const lines = String(content || '').split(/\r?\n/);
  const ids = [];
  let inJobs = false;

  for (const line of lines) {
    if (!inJobs && /^jobs:\s*$/.test(line)) {
      inJobs = true;
      continue;
    }
    if (!inJobs) continue;
    if (/^[^ \t]/.test(line) && line.trim() !== '') break;

    const match = line.match(/^ {2}([a-zA-Z0-9_-]+):\s*$/);
    if (match) ids.push(match[1]);
  }
  return ids;
}

function extractDocRequiredChecks(content) {
  const text = String(content || '');
  const anchor = '建议设为 required checks：';
  const sectionStart = text.indexOf(anchor);
  if (sectionStart < 0) return [];
  const fromAnchor = text.slice(sectionStart + anchor.length);
  const endAnchors = ['可选增强：', '## 5.'];
  let sectionEnd = fromAnchor.length;
  for (const endAnchor of endAnchors) {
    const idx = fromAnchor.indexOf(endAnchor);
    if (idx >= 0) sectionEnd = Math.min(sectionEnd, idx);
  }
  const section = fromAnchor.slice(0, sectionEnd);
  const checks = [];
  const regex = /`([a-zA-Z0-9_-]+)`/g;
  for (const match of section.matchAll(regex)) {
    checks.push(match[1]);
  }
  return checks;
}

function unique(list) {
  return [...new Set(list)];
}

function diff(source, target) {
  const targetSet = new Set(target);
  return source.filter((x) => !targetSet.has(x));
}

function run() {
  if (!fs.existsSync(WORKFLOW_FILE)) {
    console.error(`[required-checks-sync] workflow not found: ${WORKFLOW_FILE}`);
    process.exit(1);
  }
  if (!fs.existsSync(DOC_FILE)) {
    console.error(`[required-checks-sync] doc not found: ${DOC_FILE}`);
    process.exit(1);
  }

  const workflowContent = fs.readFileSync(WORKFLOW_FILE, 'utf8');
  const docContent = fs.readFileSync(DOC_FILE, 'utf8');

  const workflowJobIds = unique(extractWorkflowJobIds(workflowContent));
  const docRequiredChecks = unique(extractDocRequiredChecks(docContent));

  const missingInWorkflow = diff(docRequiredChecks, workflowJobIds);
  const undocumentedWorkflowJobs = diff(workflowJobIds, docRequiredChecks);
  const ok = missingInWorkflow.length === 0 && undocumentedWorkflowJobs.length === 0;

  const payload = {
    ok,
    workflowFile: path.relative(process.cwd(), WORKFLOW_FILE),
    docFile: path.relative(process.cwd(), DOC_FILE),
    workflowJobIds,
    docRequiredChecks,
    missingInWorkflow,
    undocumentedWorkflowJobs,
  };

  console.log(JSON.stringify(payload, null, 2));
  process.exit(ok ? 0 : 1);
}

run();
