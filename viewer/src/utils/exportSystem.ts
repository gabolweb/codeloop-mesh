import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { merge } from 'lodash-es';
import { useAppStore } from '@/store/useAppStore';

const getMergedIdentities = async () => {
  const overrides = useAppStore.getState().nodeDataOverrides;
  
  // Fetch all canonical JSONs dynamically
  const glob = import.meta.glob('../../../canonical/identities/*.json');
  const result: any[] = [];
  
  for (const path in glob) {
    const slug = path.split('/').pop()?.replace('.json', '');
    if (!slug) continue;
    const mod = await glob[path]() as any;
    
    // Deep clone the original JSON to prevent mutations
    const baseJson = JSON.parse(JSON.stringify(mod.default || mod));
    
    // Apply Entity root overrides
    if (overrides[slug]) {
      merge(baseJson, overrides[slug]);
    }
    
    // Apply Websites overrides
    if (baseJson.websites && Array.isArray(baseJson.websites)) {
      baseJson.websites.forEach((web: any, wIdx: number) => {
        const webId = `${slug}-web-${wIdx}`;
        if (overrides[webId]) merge(web, overrides[webId]);
        
        // Reconstruct page ID mapping
        if (web.pages && Array.isArray(web.pages)) {
           const pagesId = `${webId}-pages`;
           web.pages.forEach((pageRefId: string, pIdx: number) => {
              const actualPage = baseJson.pages?.find((p: any) => p.id === pageRefId);
              if (actualPage) {
                const pId = `${pagesId}-${pIdx}`;
                if (overrides[pId]) merge(actualPage, overrides[pId]);
                
                if (actualPage.sections && Array.isArray(actualPage.sections)) {
                  actualPage.sections.forEach((sec: any, sIdx: number) => {
                    const sId = `${pId}-sec-${sIdx}`;
                    if (overrides[sId]) merge(sec, overrides[sId]);
                  });
                }
              }
           });
        }
      });
    }
    
    result.push(baseJson);
  }
  
  return result;
};

export const generateZipExport = async () => {
  const identities = await getMergedIdentities();
  const zip = new JSZip();
  
  identities.forEach(id => {
    zip.file(`${id.digital_identity?.slug || 'unknown'}.json`, JSON.stringify(id, null, 2));
  });
  
  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, 'codeloop-identities-export.zip');
};

export const generateSqlExport = async (flavor: 'mysql' | 'postgres') => {
  const identities = await getMergedIdentities();
  let sql = `-- CodeLoop Export (${flavor.toUpperCase()})\n-- Generated at ${new Date().toISOString()}\n\n`;
  
  // Table Creations
  const idType = flavor === 'postgres' ? 'VARCHAR(255) PRIMARY KEY' : 'VARCHAR(255) PRIMARY KEY';
  const textType = flavor === 'postgres' ? 'TEXT' : 'LONGTEXT';
  const jsonType = flavor === 'postgres' ? 'JSONB' : 'JSON';

  sql += `
CREATE TABLE IF NOT EXISTS identities (
  id ${idType},
  slug VARCHAR(255),
  name VARCHAR(255),
  description ${textType},
  brand_voice ${jsonType},
  design_system ${jsonType}
);\n
CREATE TABLE IF NOT EXISTS websites (
  id ${idType},
  identity_id VARCHAR(255),
  domain VARCHAR(255),
  status VARCHAR(100),
  global_config ${jsonType}
);\n
CREATE TABLE IF NOT EXISTS pages (
  id ${idType},
  website_id VARCHAR(255),
  path VARCHAR(255),
  slug VARCHAR(255),
  title VARCHAR(255),
  seo ${jsonType}
);\n
CREATE TABLE IF NOT EXISTS sections (
  id ${idType},
  page_id VARCHAR(255),
  section_key VARCHAR(255),
  component VARCHAR(255),
  content ${jsonType},
  design ${jsonType}
);\n\n`;

  // Insertions
  const escapeString = (str: string) => str ? `'${str.replace(/'/g, "''")}'` : 'NULL';
  const escapeJson = (obj: any) => obj ? `'${JSON.stringify(obj).replace(/'/g, "''")}'` : 'NULL';

  identities.forEach(entity => {
    const eid = entity.digital_identity?.id || `id-${entity.digital_identity?.slug}`;
    sql += `INSERT INTO identities (id, slug, name, description, brand_voice, design_system) VALUES (${escapeString(eid)}, ${escapeString(entity.digital_identity?.slug)}, ${escapeString(entity.digital_identity?.name)}, ${escapeString(entity.digital_identity?.description)}, ${escapeJson(entity.brand_voice)}, ${escapeJson(entity.design_system)});\n`;

    if (entity.websites) {
      entity.websites.forEach((web: any) => {
        sql += `INSERT INTO websites (id, identity_id, domain, status, global_config) VALUES (${escapeString(web.id)}, ${escapeString(eid)}, ${escapeString(web.domain)}, ${escapeString(web.status)}, ${escapeJson(web.global_config)});\n`;
      });
    }

    if (entity.pages) {
      entity.pages.forEach((page: any) => {
        sql += `INSERT INTO pages (id, website_id, path, slug, title, seo) VALUES (${escapeString(page.id)}, ${escapeString(page.website_id)}, ${escapeString(page.path)}, ${escapeString(page.slug)}, ${escapeString(page.title)}, ${escapeJson(page.seo)});\n`;
        
        if (page.sections) {
          page.sections.forEach((sec: any) => {
            sql += `INSERT INTO sections (id, page_id, section_key, component, content, design) VALUES (${escapeString(sec.id)}, ${escapeString(page.id)}, ${escapeString(sec.section_key)}, ${escapeString(sec.component)}, ${escapeJson(sec.content)}, ${escapeJson(sec.design)});\n`;
          });
        }
      });
    }
  });

  const blob = new Blob([sql], { type: 'text/plain;charset=utf-8' });
  saveAs(blob, `codeloop-${flavor}-export.sql`);
};

export const syncToNotion = async () => {
  const identities = await getMergedIdentities();
  
  // This will send the merged payload to the local Notion Sync Server
  try {
    const response = await fetch('http://localhost:4000/api/sync-notion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identities })
    });
    
    if (!response.ok) throw new Error('Failed to sync with Notion server');
    
    const data = await response.json();
    alert(`Notion Sync Complete! Created/Updated ${data.syncedCount} entities.`);
  } catch (err: any) {
    console.error(err);
    alert('Error connecting to Notion Sync Server. Make sure you are running `node scripts/notion-sync-server.js`. Error: ' + err.message);
  }
};
