/**
 * Importe les résumés JSAN 2025 (11ᵉ édition) depuis WordPress :
 *   - CSV d'avis (métadonnées + e-mail auteur)
 *   - PDF/DOCX du dossier resume_attachments_all
 *
 * Effets :
 *   1. library_documents (catégorie actes, année 2025) — tout le lot
 *   2. abstracts + abstract_authors + abstract_files — avec claim_email
 *   3. Rattache immédiatement si un compte Auth existe déjà avec cet e-mail
 *
 * Usage (depuis jsan-webapp) :
 *   npm run import:legacy-abstracts
 *   npm run import:legacy-abstracts -- --execute
 *   npm run import:legacy-abstracts -- --execute --source "E:/clients/SNB/JSAN/resume"
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { extname, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env.local');
const EXECUTE = process.argv.includes('--execute');
const sourceArgIdx = process.argv.indexOf('--source');
const SOURCE_ROOT =
  sourceArgIdx >= 0 && process.argv[sourceArgIdx + 1]
    ? process.argv[sourceArgIdx + 1]
    : 'E:/clients/SNB/JSAN/resume';

const EDITION = 'JSAN 2025';
const LIBRARY_BUCKET = 'library-documents';
const ABSTRACT_BUCKET = 'abstract-files';

function loadEnvFile() {
  try {
    const envContent = readFileSync(envPath, 'utf8');
    return Object.fromEntries(
      envContent
        .split('\n')
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => {
          const idx = line.indexOf('=');
          if (idx === -1) return null;
          return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
        })
        .filter(Boolean)
    );
  } catch {
    return {};
  }
}

function parseCsv(content) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(field);
      field = '';
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
      continue;
    }

    field += char;
  }

  if (field.length || row.length) {
    row.push(field);
    if (row.some((cell) => cell.trim() !== '')) rows.push(row);
  }

  return rows;
}

function normalizeEmail(value) {
  return (value ?? '').trim().toLowerCase();
}

function sanitizeFileName(fileName) {
  return fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120);
}

function mapStatus(raw) {
  const s = (raw ?? '').trim().toLowerCase();
  if (s.startsWith('accept')) return 'Accepte';
  if (s.startsWith('rejet')) return 'Rejete';
  if (s.includes('cours') || s.includes('évaluation') || s.includes('evaluation')) return 'En_Evaluation';
  if (s.includes('attente')) return 'Soumis';
  return 'Soumis';
}

function splitDisplayName(raw) {
  const name = (raw ?? '').trim();
  if (!name) return { prenom: 'Auteur', nom: 'JSAN' };
  const parts = name.split(/\s+/);
  if (parts.length === 1) return { prenom: parts[0], nom: parts[0] };
  return { prenom: parts[0], nom: parts.slice(1).join(' ') };
}

function pickBestFile(files) {
  const pdfs = files.filter((f) => extname(f).toLowerCase() === '.pdf');
  if (pdfs.length) return pdfs.sort((a, b) => b.length - a.length)[0];
  const docs = files.filter((f) => ['.doc', '.docx'].includes(extname(f).toLowerCase()));
  if (docs.length) return docs[0];
  return files[0] ?? null;
}

function loadAbstractsFromCsv(root) {
  const csvName = readdirSync(root).find((f) => f.endsWith('.csv') && /tous/i.test(f))
    ?? readdirSync(root).find((f) => f.endsWith('.csv') && /accept/i.test(f));
  if (!csvName) throw new Error(`Aucun CSV trouvé dans ${root}`);

  const rows = parseCsv(readFileSync(resolve(root, csvName), 'utf8'));
  const header = rows[0] ?? [];
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  const required = ['ID du résumé', 'Titre du résumé', "E-mail de l'utilisateur"];
  for (const col of required) {
    if (idx[col] === undefined) throw new Error(`Colonne manquante dans ${csvName}: ${col}`);
  }

  /** @type {Map<string, any>} */
  const byId = new Map();
  for (const r of rows.slice(1)) {
    const id = String(r[idx['ID du résumé']] ?? '').trim();
    if (!id) continue;
    const status = r[idx['Status']] ?? '';
    const existing = byId.get(id);
    // Prefer Accepté over other statuses if multiple review rows
    if (existing && mapStatus(existing.status) === 'Accepte' && mapStatus(status) !== 'Accepte') {
      continue;
    }
    byId.set(id, {
      legacyId: Number(id),
      title: (r[idx['Titre du résumé']] ?? '').trim() || `Résumé JSAN ${id}`,
      theme: (r[idx['Thématique']] ?? '').trim() || null,
      email: normalizeEmail(r[idx["E-mail de l'utilisateur"]]),
      userName: (r[idx["Nom de l'utilisateur"]] ?? '').trim(),
      status,
      recommendation: (r[idx['Recommandation']] ?? '').trim() || null,
    });
  }

  return { csvName, abstracts: [...byId.values()] };
}

function indexAttachmentFiles(attachmentsDir) {
  /** @type {Map<string, string[]>} */
  const byLegacyId = new Map();
  if (!existsSync(attachmentsDir)) return byLegacyId;

  for (const name of readdirSync(attachmentsDir)) {
    if (name.startsWith('~$')) continue;
    const m = name.match(/^ID_(\d+)_(\d+)_/i);
    if (!m) continue;
    const legacyId = m[1]; // first number = ID résumé WordPress
    const list = byLegacyId.get(legacyId) ?? [];
    list.push(name);
    byLegacyId.set(legacyId, list);
  }
  return byLegacyId;
}

async function listAuthEmailMap(admin) {
  /** @type {Map<string, string>} */
  const map = new Map();
  let page = 1;
  while (page <= 50) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const u of data.users ?? []) {
      const email = normalizeEmail(u.email);
      if (email) map.set(email, u.id);
    }
    if ((data.users ?? []).length < 200) break;
    page += 1;
  }
  return map;
}

async function uploadFile(admin, bucket, storagePath, absolutePath, contentType) {
  const buffer = readFileSync(absolutePath);
  const { error } = await admin.storage.from(bucket).upload(storagePath, buffer, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`${bucket}/${storagePath}: ${error.message}`);
  return storagePath;
}

function mimeFor(fileName) {
  const ext = extname(fileName).toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.doc') return 'application/msword';
  if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return 'application/octet-stream';
}

async function main() {
  const env = { ...process.env, ...loadEnvFile() };
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants (.env.local)');
  }

  const attachmentsDir = resolve(SOURCE_ROOT, 'resume_attachments_all');
  const { csvName, abstracts } = loadAbstractsFromCsv(SOURCE_ROOT);
  const filesByLegacy = indexAttachmentFiles(attachmentsDir);

  console.log(`Source : ${SOURCE_ROOT}`);
  console.log(`CSV    : ${csvName} → ${abstracts.length} résumés uniques`);
  console.log(`Fichiers indexés (par ID résumé) : ${filesByLegacy.size}`);
  console.log(EXECUTE ? 'Mode EXECUTE' : 'Mode DRY-RUN (ajoutez --execute pour écrire)');

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const emailToUserId = EXECUTE ? await listAuthEmailMap(admin) : new Map();
  if (EXECUTE) console.log(`Comptes Auth chargés : ${emailToUserId.size}`);

  let createdAbstracts = 0;
  let updatedAbstracts = 0;
  let createdLibrary = 0;
  let claimed = 0;
  let withFiles = 0;
  let errors = 0;

  for (const row of abstracts) {
    const legacyKey = String(row.legacyId);
    const fileName = pickBestFile(filesByLegacy.get(legacyKey) ?? []);
    const fileAbs = fileName ? resolve(attachmentsDir, fileName) : null;
    const hasFile = Boolean(fileAbs && existsSync(fileAbs));
    if (hasFile) withFiles += 1;

    const statut = mapStatus(row.status);
    const { prenom, nom } = splitDisplayName(row.userName);
    const authorId = row.email ? emailToUserId.get(row.email) ?? null : null;

    console.log(
      `• #${row.legacyId} ${statut.padEnd(14)} ${row.email || '(sans email)'} | ${hasFile ? fileName : 'SANS FICHIER'} | ${authorId ? 'CLAIM' : 'pending'}`
    );

    if (!EXECUTE) continue;

    try {
      let libraryDocId = null;

      if (hasFile) {
        const safeName = sanitizeFileName(fileName);
        const libPath = `jsan-2025/legacy-${row.legacyId}/${safeName}`;
        await uploadFile(admin, LIBRARY_BUCKET, libPath, fileAbs, mimeFor(fileName));

        const { data: existingLib } = await admin
          .from('library_documents')
          .select('id')
          .eq('legacy_abstract_id', row.legacyId)
          .maybeSingle();

        if (existingLib?.id) {
          libraryDocId = existingLib.id;
          await admin
            .from('library_documents')
            .update({
              titre: row.title.slice(0, 255),
              auteurs: row.userName || row.email || null,
              categorie: 'actes',
              annee: 2025,
              description: `Résumé ${EDITION}${row.theme ? ` — ${row.theme}` : ''}`,
              file_path: libPath,
              file_name: fileName,
              file_type: extname(fileName).replace('.', '').toLowerCase(),
              is_active: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingLib.id);
        } else {
          const { data: libInserted, error: libErr } = await admin
            .from('library_documents')
            .insert({
              titre: row.title.slice(0, 255),
              auteurs: row.userName || row.email || null,
              categorie: 'actes',
              annee: 2025,
              description: `Résumé ${EDITION}${row.theme ? ` — ${row.theme}` : ''}`,
              file_path: libPath,
              file_name: fileName,
              file_type: extname(fileName).replace('.', '').toLowerCase(),
              is_active: true,
              is_featured: statut === 'Accepte',
              ordre: row.legacyId,
              legacy_abstract_id: row.legacyId,
            })
            .select('id')
            .single();
          if (libErr) throw libErr;
          libraryDocId = libInserted.id;
          createdLibrary += 1;
        }
      }

      const { data: existingAbs } = await admin
        .from('abstracts')
        .select('id, author_id')
        .eq('legacy_id', row.legacyId)
        .maybeSingle();

      const payload = {
        titre: row.title.slice(0, 500),
        thematique: row.theme,
        type_presentation_global: row.recommendation,
        statut,
        claim_email: row.email || null,
        edition: EDITION,
        library_document_id: libraryDocId,
        updated_at: new Date().toISOString(),
        ...(authorId
          ? { author_id: authorId, claimed_at: new Date().toISOString() }
          : existingAbs?.author_id
            ? {}
            : { author_id: null }),
      };

      let abstractId = existingAbs?.id ?? null;

      if (existingAbs?.id) {
        const { error } = await admin.from('abstracts').update(payload).eq('id', existingAbs.id);
        if (error) throw error;
        updatedAbstracts += 1;
        if (authorId && !existingAbs.author_id) claimed += 1;
      } else {
        const { data: inserted, error } = await admin
          .from('abstracts')
          .insert({
            ...payload,
            legacy_id: row.legacyId,
            author_id: authorId,
            contenu_texte: null,
            mots_cles: null,
            claimed_at: authorId ? new Date().toISOString() : null,
          })
          .select('id')
          .single();
        if (error) throw error;
        abstractId = inserted.id;
        createdAbstracts += 1;
        if (authorId) claimed += 1;
      }

      // abstract_authors (replace simple primary author row)
      await admin.from('abstract_authors').delete().eq('abstract_id', abstractId);
      await admin.from('abstract_authors').insert({
        abstract_id: abstractId,
        prenom,
        nom,
        email: row.email || `legacy-${row.legacyId}@jsan.local`,
        affiliation: EDITION,
        est_orateur: true,
        ordre_affichage: 0,
      });

      if (hasFile && abstractId) {
        const ownerSegment = authorId ?? 'legacy';
        const safeName = sanitizeFileName(fileName);
        const absPath = `${ownerSegment}/${abstractId}/${safeName}`;
        await uploadFile(admin, ABSTRACT_BUCKET, absPath, fileAbs, mimeFor(fileName));

        await admin.from('abstract_files').delete().eq('abstract_id', abstractId);
        const sizeMb = Math.round((statSync(fileAbs).size / (1024 * 1024)) * 100) / 100;
        await admin.from('abstract_files').insert({
          abstract_id: abstractId,
          file_url: absPath,
          file_name: fileName,
          file_type: extname(fileName).replace('.', '').toLowerCase(),
          file_size_mb: sizeMb,
          type_document: 'Resume_Principal',
        });
      }
    } catch (err) {
      errors += 1;
      console.error(`  ✗ #${row.legacyId}:`, err instanceof Error ? err.message : err);
    }
  }

  // Orphan attachments (file present but no CSV row) → library only
  const csvIds = new Set(abstracts.map((a) => String(a.legacyId)));
  for (const [legacyId, names] of filesByLegacy.entries()) {
    if (csvIds.has(legacyId)) continue;
    const fileName = pickBestFile(names);
    if (!fileName) continue;
    console.log(`• orphan file #${legacyId} → biblio seule | ${fileName}`);
    if (!EXECUTE) continue;
    try {
      const fileAbs = resolve(attachmentsDir, fileName);
      const safeName = sanitizeFileName(fileName);
      const libPath = `jsan-2025/legacy-${legacyId}/${safeName}`;
      await uploadFile(admin, LIBRARY_BUCKET, libPath, fileAbs, mimeFor(fileName));
      const title = fileName.replace(/^ID_\d+_\d+_/, '').replace(/\.(pdf|docx?)$/i, '').slice(0, 255) || `Document JSAN ${legacyId}`;
      const { data: existingLib } = await admin
        .from('library_documents')
        .select('id')
        .eq('legacy_abstract_id', Number(legacyId))
        .maybeSingle();
      if (existingLib?.id) {
        await admin
          .from('library_documents')
          .update({
            titre: title,
            file_path: libPath,
            file_name: fileName,
            categorie: 'actes',
            annee: 2025,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingLib.id);
      } else {
        await admin.from('library_documents').insert({
          titre: title,
          auteurs: null,
          categorie: 'actes',
          annee: 2025,
          description: `Fichier ${EDITION} (hors CSV avis)`,
          file_path: libPath,
          file_name: fileName,
          file_type: extname(fileName).replace('.', '').toLowerCase(),
          is_active: true,
          is_featured: false,
          ordre: Number(legacyId),
          legacy_abstract_id: Number(legacyId),
        });
        createdLibrary += 1;
      }
    } catch (err) {
      errors += 1;
      console.error(`  ✗ orphan #${legacyId}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log('\n--- Résumé ---');
  console.log(`Résumés CSV        : ${abstracts.length}`);
  console.log(`Avec fichier       : ${withFiles}`);
  console.log(`Abstracts créés    : ${createdAbstracts}`);
  console.log(`Abstracts maj      : ${updatedAbstracts}`);
  console.log(`Biblio créés       : ${createdLibrary}`);
  console.log(`Rattachés (claim)  : ${claimed}`);
  console.log(`Erreurs            : ${errors}`);
  if (!EXECUTE) console.log('\nRelancez avec --execute après la migration 034.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
