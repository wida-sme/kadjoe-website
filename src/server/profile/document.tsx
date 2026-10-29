/* eslint-disable jsx-a11y/alt-text -- react-pdf <Image> has no alt; the PDF is not an HTML document */
// The company profile as a PDF: A4 landscape, the website's paper, graphite and hairlines, the same
// two typefaces. Every page is laid out on one grid: 28 pt margins, a title strip at the foot.
import path from 'node:path';
import { Document, Font, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

const DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), 'src/server/profile');
Font.register({
  family: 'Switzer',
  fonts: [
    { src: path.join(DIR, 'fonts/Switzer-300.ttf'), fontWeight: 300 },
    { src: path.join(DIR, 'fonts/Switzer-400.ttf'), fontWeight: 400 },
    { src: path.join(DIR, 'fonts/Switzer-500.ttf'), fontWeight: 500 },
  ],
});
Font.register({
  family: 'Plex',
  fonts: [
    { src: path.join(DIR, 'fonts/IBMPlexMono-Regular.ttf'), fontWeight: 400 },
    { src: path.join(DIR, 'fonts/IBMPlexMono-Medium.ttf'), fontWeight: 500 },
  ],
});
Font.registerHyphenationCallback((word) => [word]); // never hyphenate names

const W = 841.89, H = 595.28, M = 28;
const C = { paper: '#f4f4f2', ink: '#1c1b1a', muted: '#6a6762', line: '#d6d5d2', sheet: '#1c1b1a', onSheet: '#ededea', onSheetMuted: '#a09c96', sheetLine: '#3a3836' };

const s = StyleSheet.create({
  page: { backgroundColor: C.paper, color: C.ink, fontFamily: 'Switzer', fontWeight: 400, fontSize: 9.5, position: 'relative' },
  dark: { backgroundColor: C.sheet, color: C.onSheet },
  label: { fontFamily: 'Plex', fontSize: 6, letterSpacing: 0.6, textTransform: 'uppercase', color: C.muted },
  foot: { position: 'absolute', left: M, right: M, bottom: 16, flexDirection: 'row', justifyContent: 'space-between' },
  footText: { fontFamily: 'Plex', fontSize: 6, letterSpacing: 0.6, textTransform: 'uppercase', color: C.muted },
  display: { fontWeight: 300, fontSize: 34, letterSpacing: -0.9, lineHeight: 1 },
});

export type PdfPhoto = { file: string; focalX: number; focalY: number; width: number; height: number };
export type PdfProject = {
  name: string; category: string; typeLabel: string | null; location: string | null; year: string | null; service: string | null;
  design: string | null; photography: string | null; photos: PdfPhoto[];
};
export type PdfGroup = { label: string; projects: PdfProject[] };
export type PdfModel = {
  title: string;
  scope: string;
  year: string;
  cover: PdfPhoto | null;
  about: { paragraphs: string[]; photo: PdfPhoto | null } | null;
  services: { name: string; text: string }[] | null;
  groups: PdfGroup[];
  clients: string[] | null;
  contact: { addressLines: string[]; email: string; instagram: string; phone: string; website: string } | null;
  legalName: string;
};

const pad = (n: number) => String(n).padStart(2, '0');
const pos = (p: PdfPhoto) => `${Math.round(p.focalX * 100)}% ${Math.round(p.focalY * 100)}%`;

function Photo({ p, w, h, style }: { p: PdfPhoto; w: number; h: number; style?: object }) {
  return (
    <View style={{ width: w, height: h, overflow: 'hidden', backgroundColor: '#dcdbd7', ...style }}>
      <Image src={p.file} style={{ width: w, height: h, objectFit: 'cover', objectPosition: pos(p) }} />
    </View>
  );
}

function Foot({ n, legal, dark }: { n: number; legal: string; dark?: boolean }) {
  const color = dark ? C.onSheetMuted : C.muted;
  return (
    <View style={s.foot} fixed>
      <Text style={[s.footText, { color }]}>{legal}</Text>
      <Text style={[s.footText, { color }]}>{pad(n)}</Text>
    </View>
  );
}

function Cell({ label, value, width, big, last }: { label: string; value: string; width: number | string; big?: boolean; last?: boolean }) {
  return (
    <View style={{ width, paddingTop: 8, paddingBottom: 9, paddingRight: 10, paddingLeft: big ? 0 : 10, borderRightWidth: last ? 0 : 0.6, borderRightColor: C.line, borderRightStyle: 'solid' }}>
      {big ? (
        <>
          <Text style={{ fontWeight: 300, fontSize: 19, letterSpacing: -0.4, lineHeight: 1.05 }}>{value}</Text>
          {label ? <Text style={{ marginTop: 4, fontSize: 8.5, color: C.muted }}>{label}</Text> : null}
        </>
      ) : (
        <>
          <Text style={s.label}>{label}</Text>
          <Text style={{ marginTop: 5, fontSize: 8.5, lineHeight: 1.3 }}>{value}</Text>
        </>
      )}
    </View>
  );
}

function ProjectPage({ p, n, legal }: { p: PdfProject; n: number; legal: string }) {
  const top = M, areaH = 440, areaW = W - 2 * M, gap = 5;
  const photos = p.photos.slice(0, 3);
  let frames: React.ReactNode;
  if (photos.length >= 3) {
    const mainW = Math.round(areaW * 0.6);
    const sideW = areaW - mainW - gap, sideH = (areaH - gap) / 2;
    frames = (
      <View style={{ flexDirection: 'row', gap }}>
        <Photo p={photos[0]} w={mainW} h={areaH} />
        <View style={{ gap }}>
          <Photo p={photos[1]} w={sideW} h={sideH} />
          <Photo p={photos[2]} w={sideW} h={sideH} />
        </View>
      </View>
    );
  } else if (photos.length === 2) {
    frames = <View style={{ flexDirection: 'row', gap }}><Photo p={photos[0]} w={(areaW - gap) / 2} h={areaH} /><Photo p={photos[1]} w={(areaW - gap) / 2} h={areaH} /></View>;
  } else if (photos.length === 1) {
    frames = <Photo p={photos[0]} w={areaW} h={areaH} />;
  } else {
    frames = <View style={{ width: areaW, height: areaH, backgroundColor: '#dcdbd7' }} />;
  }
  const type = p.typeLabel && p.typeLabel !== p.category ? `${p.category}, ${p.typeLabel}` : p.category;
  const cells: [string, string][] = [['Type', type], ['Year', p.year ?? ''], ['Service', p.service ?? ''], ['Design', p.design ?? ''], ['Photography', p.photography ?? '']];
  const shown = cells.filter(([, v]) => v);
  const rest = areaW - 230;
  return (
    <Page size="A4" orientation="landscape" style={s.page}>
      <View style={{ position: 'absolute', top, left: M }}>{frames}</View>
      <View style={{ position: 'absolute', left: M, right: M, top: top + areaH + 12, flexDirection: 'row', borderTopWidth: 0.6, borderTopColor: C.ink, borderBottomWidth: 0.6, borderBottomColor: C.line }}>
        <Cell big label={p.location ?? ''} value={p.name} width={230} />
        {shown.map(([label, value], i) => <Cell key={label} label={label} value={value} width={rest / shown.length} last={i === shown.length - 1} />)}
      </View>
      <Foot n={n} legal={legal} />
    </Page>
  );
}

function Divider({ label, count, index, n, legal }: { label: string; count: number; index: string; n: number; legal: string }) {
  return (
    <Page size="A4" orientation="landscape" style={[s.page, s.dark]}>
      <View style={{ position: 'absolute', left: M, right: M, top: 230 }}>
        <Text style={{ fontFamily: 'Plex', fontSize: 20, letterSpacing: 9, textTransform: 'uppercase' }}>{label}</Text>
        <Text style={{ fontFamily: 'Plex', fontSize: 7, letterSpacing: 0.8, textTransform: 'uppercase', color: C.onSheetMuted, marginTop: 14 }}>{count} project{count === 1 ? '' : 's'}</Text>
      </View>
      <Text style={{ position: 'absolute', left: M - 6, bottom: 44, fontWeight: 300, fontSize: 150, letterSpacing: -6, color: C.sheetLine, lineHeight: 1 }}>{index}</Text>
      <View style={{ position: 'absolute', left: M, right: M, bottom: 30, borderTopWidth: 0.6, borderTopColor: C.onSheetMuted, height: 3, borderBottomWidth: 0.6, borderBottomColor: C.onSheetMuted }} />
      <Foot n={n} legal={legal} dark />
    </Page>
  );
}

export function ProfileDocument({ m }: { m: PdfModel }) {
  // Page numbers are known in advance: every section is a fixed number of pages.
  let n = 1;
  const contents: { no: string; title: string; page: number }[] = [];
  let sectionNo = 0;
  n += 1; // contents page
  const aboutPage = m.about ? ++n : 0;
  if (m.about) contents.push({ no: pad(++sectionNo), title: 'About Us', page: aboutPage });
  const servicesPage = m.services ? ++n : 0;
  if (m.services) contents.push({ no: pad(++sectionNo), title: 'Services', page: servicesPage });
  const groupPages = m.groups.map((g) => {
    const divider = ++n;
    const pages = g.projects.map(() => ++n);
    contents.push({ no: pad(++sectionNo), title: `Projects: ${g.label}`, page: divider });
    return { divider, pages, no: pad(sectionNo) };
  });
  const clientsPage = m.clients?.length ? ++n : 0;
  if (clientsPage) contents.push({ no: pad(++sectionNo), title: 'Clients', page: clientsPage });
  const contactPage = m.contact ? ++n : 0;
  if (contactPage) contents.push({ no: pad(++sectionNo), title: 'Contact', page: contactPage });

  const coverW = 528;
  return (
    <Document title={`${m.legalName}: ${m.title}`} author={m.legalName} subject={m.scope} creator="Kadjoe website" producer="Kadjoe website">
      {/* Cover */}
      <Page size="A4" orientation="landscape" style={[s.page, s.dark]}>
        {m.cover ? <View style={{ position: 'absolute', left: 0, top: 0 }}><Photo p={m.cover} w={coverW} h={H} /></View> : null}
        <View style={{ position: 'absolute', left: coverW, top: 0, width: W - coverW, height: H, padding: 32, justifyContent: 'space-between' }}>
          <Image src={path.join(DIR, 'kadjoe-shield-light.png')} style={{ width: 30, height: 30 * (261 / 198) }} />
          <View>
            <Text style={{ fontFamily: 'Plex', fontSize: 7, letterSpacing: 2.4, textTransform: 'uppercase', color: C.onSheetMuted }}>{m.legalName}</Text>
            <Text style={{ fontWeight: 300, fontSize: 40, letterSpacing: -1.2, lineHeight: 1, marginTop: 18 }}>{m.title}</Text>
            <Text style={{ fontSize: 11, lineHeight: 1.35, color: C.onSheet, marginTop: 12, maxWidth: 230 }}>{m.scope}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.6, borderTopColor: C.onSheetMuted, paddingTop: 8 }}>
            <Text style={{ fontFamily: 'Plex', fontSize: 6.5, letterSpacing: 0.6, textTransform: 'uppercase', color: C.onSheetMuted }}>Design and build, Jakarta</Text>
            <Text style={{ fontFamily: 'Plex', fontSize: 6.5, letterSpacing: 0.6, color: C.onSheetMuted }}>{m.year}</Text>
          </View>
        </View>
      </Page>

      {/* Contents */}
      <Page size="A4" orientation="landscape" style={s.page}>
        <Text style={[s.display, { position: 'absolute', left: M, top: 60 }]}>Contents</Text>
        <View style={{ position: 'absolute', left: 380, right: M, top: 66, borderTopWidth: 0.6, borderTopColor: C.ink }}>
          {contents.map((c) => (
            <View key={c.no} style={{ flexDirection: 'row', alignItems: 'baseline', paddingVertical: 11, borderBottomWidth: 0.6, borderBottomColor: C.line }}>
              <Text style={{ fontFamily: 'Plex', fontSize: 7, color: C.muted, width: 36 }}>{c.no}</Text>
              <Text style={{ fontSize: 13, flexGrow: 1 }}>{c.title}</Text>
              <Text style={{ fontFamily: 'Plex', fontSize: 7, color: C.muted }}>{pad(c.page)}</Text>
            </View>
          ))}
        </View>
        <Foot n={2} legal={m.legalName} />
      </Page>

      {m.about ? (
        <Page size="A4" orientation="landscape" style={s.page}>
          <View style={{ position: 'absolute', left: M, top: 60, width: 330 }}>
            <Text style={s.display}>About Us</Text>
            {m.about.paragraphs.map((t, i) => (
              <Text key={i} style={{ marginTop: i ? 12 : 30, fontSize: i ? 11 : 13, lineHeight: 1.45, color: i ? C.muted : C.ink, fontWeight: i ? 400 : 300 }}>{t}</Text>
            ))}
          </View>
          {m.about.photo ? <View style={{ position: 'absolute', left: 400, top: M }}><Photo p={m.about.photo} w={W - 400 - M} h={H - 2 * M - 22} /></View> : null}
          <Foot n={aboutPage} legal={m.legalName} />
        </Page>
      ) : null}

      {m.services ? (
        <Page size="A4" orientation="landscape" style={s.page}>
          <Text style={[s.display, { position: 'absolute', left: M, top: 60 }]}>Services</Text>
          <View style={{ position: 'absolute', left: M, right: M, top: 300, flexDirection: 'row', borderTopWidth: 0.6, borderTopColor: C.ink }}>
            {m.services.map((x, i) => (
              <View key={x.name} style={{ width: (W - 2 * M) / m.services!.length, paddingTop: 14, paddingRight: 22, paddingLeft: i ? 14 : 0, borderLeftWidth: i ? 0.6 : 0, borderLeftColor: C.line, minHeight: 150 }}>
                <Text style={{ fontSize: 15, letterSpacing: -0.2 }}>{x.name}</Text>
                <Text style={{ marginTop: 12, fontSize: 9.5, lineHeight: 1.5, color: C.muted }}>{x.text}</Text>
              </View>
            ))}
          </View>
          <Foot n={servicesPage} legal={m.legalName} />
        </Page>
      ) : null}

      {m.groups.map((g, gi) => [
        <Divider key={`d${gi}`} label={g.label} count={g.projects.length} index={groupPages[gi].no} n={groupPages[gi].divider} legal={m.legalName} />,
        ...g.projects.map((p, pi) => <ProjectPage key={`p${gi}-${pi}`} p={p} n={groupPages[gi].pages[pi]} legal={m.legalName} />),
      ])}

      {clientsPage ? (
        <Page size="A4" orientation="landscape" style={s.page}>
          <Text style={[s.display, { position: 'absolute', left: M, top: 60 }]}>Clients</Text>
          <View style={{ position: 'absolute', left: M, right: M, top: 150, flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 0.6, borderTopColor: C.ink }}>
            {m.clients!.map((c) => (
              <View key={c} style={{ width: (W - 2 * M) / 4, paddingVertical: 9, paddingRight: 12, borderBottomWidth: 0.6, borderBottomColor: C.line }}>
                <Text style={{ fontSize: 11 }}>{c}</Text>
              </View>
            ))}
          </View>
          <Foot n={clientsPage} legal={m.legalName} />
        </Page>
      ) : null}

      {m.contact ? (
        <Page size="A4" orientation="landscape" style={[s.page, s.dark]}>
          <Image src={path.join(DIR, 'kadjoe-shield-light.png')} style={{ position: 'absolute', left: M, top: 32, width: 30, height: 30 * (261 / 198) }} />
          <View style={{ position: 'absolute', left: M, top: 200 }}>
            <Text style={{ fontWeight: 300, fontSize: 40, letterSpacing: -1.2 }}>Contact</Text>
          </View>
          <View style={{ position: 'absolute', left: M, right: M, top: 330, flexDirection: 'row', borderTopWidth: 0.6, borderTopColor: C.onSheetMuted }}>
            {[
              ['Office', m.contact.addressLines.join('\n')],
              ['Email', m.contact.email],
              ['Instagram', `@${m.contact.instagram}`],
              ...(m.contact.phone ? [['Phone', m.contact.phone]] : []),
              ['Website', m.contact.website.replace(/^https?:\/\//, '')],
            ].map(([label, value], i) => (
              <View key={label} style={{ flexGrow: i ? 1 : 2, flexBasis: 0, paddingTop: 12, paddingRight: 14, paddingLeft: i ? 14 : 0, borderLeftWidth: i ? 0.6 : 0, borderLeftColor: C.sheetLine }}>
                <Text style={[s.label, { color: C.onSheetMuted }]}>{label}</Text>
                <Text style={{ marginTop: 8, fontSize: 10.5, lineHeight: 1.45 }}>{value}</Text>
              </View>
            ))}
          </View>
          <Foot n={contactPage} legal={m.legalName} dark />
        </Page>
      ) : null}
    </Document>
  );
}
