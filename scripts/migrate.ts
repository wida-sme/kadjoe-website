// Creates data/site.db (or KADJOE_SITE_DATA_DIR/site.db) and applies every migration in drizzle/.
import { openDatabase } from '../src/server/db/client';
import { DB_FILE } from '../src/server/paths';

const { sqlite } = openDatabase();
const n = sqlite.prepare("select count(*) n from sqlite_master where type='table'").get() as { n: number };
console.log(`migrated ${DB_FILE} (${n.n} tables)`);
sqlite.close();
