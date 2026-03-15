#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function readSchemaModels(schemaPath) {
  if (!fs.existsSync(schemaPath)) return [];
  const txt = fs.readFileSync(schemaPath, 'utf8');
  const re = /model\s+(\w+)/g;
  const models = [];
  let m;
  while ((m = re.exec(txt)) !== null) models.push(m[1]);
  return models;
}

function normalize(s) {
  return String(s || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function findBestModel(models, targetKeywords) {
  const normTargets = targetKeywords.map(normalize);
  const normModels = models.map((m) => ({ orig: m, norm: normalize(m) }));

  const mapping = {};
  for (const t of normTargets) {
    // exact match
    const exact = normModels.find((x) => x.norm === t);
    if (exact) { mapping[t] = exact.orig; continue; }
    // contains
    const contains = normModels.find((x) => x.norm.includes(t) || t.includes(x.norm));
    if (contains) { mapping[t] = contains.orig; continue; }
    // fallback: first model that starts with same letter
    const starts = normModels.find((x) => x.norm.startsWith(t.slice(0,3)));
    if (starts) { mapping[t] = starts.orig; continue; }
    mapping[t] = null;
  }
  return mapping;
}

async function run() {
  try {
    const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
    const models = readSchemaModels(schemaPath);
    if (!models.length) {
      console.warn('No models found in prisma/schema.prisma');
    }

    const targets = [
      'customer',
      'employee',
      'vehicle',
      'jobcard',
      'servicedescription',
      'sparepartsbill',
      'employeeEarning',
    ];

    const mapping = findBestModel(models, targets);

    // prepare delegate name (prisma delegate uses lowercased first char)
    const delegateName = (modelName) => {
      if (!modelName) return null;
      return modelName[0].toLowerCase() + modelName.slice(1);
    };

    const safeCount = async (delegate) => {
      if (!delegate) return null;
      const del = prisma[delegate];
      if (!del || typeof del.count !== 'function') return null;
      try {
        return await del.count();
      } catch (e) {
        return null;
      }
    };

    const results = {};
    for (const t of targets) {
      const mapped = mapping[normalize(t)];
      const del = mapped ? delegateName(mapped) : null;
      results[t] = await safeCount(del);
    }

    console.log('Detected model mapping (target -> model):');
    for (const t of targets) {
      const mapped = mapping[normalize(t)];
      console.log(`- ${t} -> ${mapped || '(not found)'}`);
    }

    console.log('\nRow counts (null means table/model not found):');
    console.table(results);
  } catch (err) {
    console.error('Error running counts:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
