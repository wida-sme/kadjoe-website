// The WordPress backup is optional for the legacy import: without it the static site's own images
// are used, with it the largest original of each upload is picked.
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { indexListing, openWpZip } from '@/server/legacy/wp-zip';

// Shape of `unzip -l` output.
const LISTING = `Archive:  well-known.zip
  Length      Date    Time    Name
---------  ---------- -----   ----
        0  2024-02-10 10:00   wp-content/uploads/2024/02/
   812345  2024-02-10 10:00   wp-content/uploads/2024/02/Bagus.jpg
  2412345  2024-02-10 10:00   wp-content/uploads/2024/02/Bagus-scaled.jpg
    12345  2024-02-10 10:00   wp-content/uploads/2024/02/Bagus-150x150.jpg
   501234  2023-11-03 09:12   wp-content/uploads/2023/11/manzo-bar.png
     4096  2023-11-03 09:12   wp-content/themes/kadjoe/screenshot.png
---------                     -------
  3742065                     6 files
`;

describe('legacy import: WordPress backup', () => {
  it('is skipped when there is no file at the given path', () => {
    expect(openWpZip(path.join(import.meta.dirname, 'no-such-backup.zip'))).toBeNull();
  });

  it('picks the largest original of an upload, -scaled included', () => {
    const find = indexListing(LISTING);
    expect(find('202402', 'Bagus')).toBe('wp-content/uploads/2024/02/Bagus-scaled.jpg');
  });

  it('finds an upload WordPress filed under another month', () => {
    const find = indexListing(LISTING);
    expect(find('202402', 'manzo-bar')).toBe('wp-content/uploads/2023/11/manzo-bar.png');
  });

  it('returns null for an upload the backup does not have', () => {
    const find = indexListing(LISTING);
    expect(find('202402', 'bagus-2')).toBeNull();
    expect(find('202402', 'screenshot')).toBeNull();
  });
});
