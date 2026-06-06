import express from 'express';
import cors from 'cors';
import { Client } from '@notionhq/client';
import fs from 'fs';
import path from 'path';

// Usage: NOTION_TOKEN=secret_xxx NOTION_DB_ID=yyy node scripts/notion-sync-server.js

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const PORT = 4000;
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_DB_ID = process.env.NOTION_DB_ID;

const notion = NOTION_TOKEN ? new Client({ auth: NOTION_TOKEN }) : null;

app.post('/api/sync-notion', async (req, res) => {
  if (!notion || !NOTION_DB_ID) {
    console.warn("Notion Sync called, but NOTION_TOKEN or NOTION_DB_ID is missing.");
    console.log("Payload received:", req.body.identities.length, "identities.");
    
    // Fallback to saving a backup JSON locally
    fs.writeFileSync(
       path.resolve('notion-sync-backup.json'), 
       JSON.stringify(req.body.identities, null, 2)
    );
    
    return res.status(200).json({ 
       message: "Notion credentials not provided. Saved backup locally.", 
       syncedCount: req.body.identities.length 
    });
  }

  try {
    const { identities } = req.body;
    
    for (const entity of identities) {
      const slug = entity.digital_identity?.slug || "Unknown Entity";
      const desc = entity.digital_identity?.description || "";
      
      console.log(`Syncing ${slug} to Notion...`);
      
      // Basic implementation for Notion Page creation
      await notion.pages.create({
        parent: { database_id: NOTION_DB_ID },
        properties: {
          Name: { title: [{ text: { content: slug } }] },
          Status: { select: { name: 'Synced' } }
        },
        children: [
          {
             object: 'block',
             type: 'paragraph',
             paragraph: {
               rich_text: [{ type: 'text', text: { content: desc } }]
             }
          },
          {
             object: 'block',
             type: 'code',
             code: {
               language: 'json',
               rich_text: [{ type: 'text', text: { content: JSON.stringify(entity, null, 2).slice(0, 2000) } }]
             }
          }
        ]
      });
    }

    res.json({ success: true, syncedCount: identities.length });
  } catch (error) {
    console.error("Notion Sync Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Notion Sync Server running on http://localhost:${PORT}`);
  console.log(`Provide NOTION_TOKEN and NOTION_DB_ID as environment variables to enable true API sync.`);
});
