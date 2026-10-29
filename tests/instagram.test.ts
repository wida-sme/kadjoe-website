import { describe, expect, it } from 'vitest';
import { categoryFromType, parseCaption, samePlace } from '@/server/instagram/caption';
import { decide, type Candidate } from '@/server/instagram/sync';

// The two real M House captions the old scraper merged into one project.
const BSD = `Client : M House
Type : Residential
Location : The Icon - Cluster Cosmo, BSD
Service : Build 
Designed by: @se.designstudio 
Photography : @harisabghi 
Status : Complete

#kadjoekreasiindonesia
#interiordesignjakarta #contractorjakarta`;

const GREENLAKE = `Client : M House
Type : Residential
Location : Greenlake City
Service : Build
Status : Completed
Design : @beta.design.studio 
Photography : @leowardistudio 

#kadjoekreasiindonesia`;

describe('parseCaption', () => {
  it('reads Kadjoe project captions', () => {
    const p = parseCaption(BSD);
    expect(p.name).toBe('M House');
    expect(p.type).toBe('Residential');
    expect(p.location).toBe('The Icon - Cluster Cosmo, BSD');
    expect(p.service).toBe('Build');
    expect(p.designers).toEqual([{ handle: 'se.designstudio', name: null }]);
    expect(p.photographers).toEqual([{ handle: 'harisabghi', name: null }]);
    expect(p.inHouse).toBe(false);
  });

  it('marks in-house design and plain-text credits', () => {
    const p = parseCaption('Project: Epiz Waffle\nType: F&B\nDesign & Build: @kadjoe_id\nPhoto by Ernest Theofilus\nPhotography: Ernest Theofilus');
    expect(p.inHouse).toBe(true);
    expect(p.designers).toEqual([]);
    expect(p.photographers).toEqual([{ handle: null, name: 'Ernest Theofilus' }]);
  });

  it('ignores posts without the form', () => {
    expect(parseCaption('Selamat Hari Raya Idul Fitri! #kadjoe').name).toBeNull();
    expect(parseCaption(null).name).toBeNull();
  });
});

describe('categoryFromType', () => {
  it('regroups Retail, Office and Wellness into Commercial', () => {
    expect(categoryFromType('Store/Retail')).toEqual({ category: 'commercial', typeLabel: 'Retail' });
    expect(categoryFromType('Office')).toEqual({ category: 'commercial', typeLabel: 'Office' });
    expect(categoryFromType('Dental Clinic')).toEqual({ category: 'commercial', typeLabel: 'Wellness' });
    expect(categoryFromType('F&B')?.category).toBe('fnb');
    expect(categoryFromType('Residential')?.category).toBe('residential');
    expect(categoryFromType('Something else')).toBeNull();
  });
});

describe('samePlace', () => {
  it('compares locations by their words', () => {
    expect(samePlace('Greenlake City', 'Green Lake City Cluster West Europe')).toBe(true);
    expect(samePlace('Pondok Indah', 'Pantai Indah Kapuk')).toBe(false);
    expect(samePlace('Plaza Senayan', 'Plaza Indonesia')).toBe(false);
    expect(samePlace('Greenlake City', 'Greenlake City, Jakarta Barat')).toBe(true);
    expect(samePlace('The Icon, Cluster Cosmo, BSD', 'Greenlake City')).toBe(false);
    expect(samePlace(null, 'BSD')).toBeNull();
  });
});

describe('decide', () => {
  const post = { timestamp: '2026-11-01T03:00:00+0000', hasImages: true };
  const ctx = (projects: Candidate[]) => ({ importSince: '2026-06-15T00:00:00.000Z', projects });
  const bsd: Candidate = { id: 'bsd', name: 'M House', location: 'The Icon, Cluster Cosmo, BSD', designerHandles: ['se.designstudio'] };

  it('creates a second project when the same name is in another place', () => {
    expect(decide(parseCaption(GREENLAKE), post, ctx([bsd]))).toEqual({ action: 'create' });
  });

  it('adds a later post of the same project to it', () => {
    expect(decide(parseCaption(BSD), post, ctx([bsd]))).toEqual({ action: 'append', projectId: 'bsd' });
  });

  it('waits for a person when the match is unsure', () => {
    const noPlace = parseCaption('Client : M House\nType : Residential');
    expect(decide(noPlace, post, ctx([bsd])).action).toBe('pending');
  });

  it('skips non-project posts and holds older or unfinished ones', () => {
    expect(decide(parseCaption('Happy new year'), post, ctx([])).action).toBe('skip');
    expect(decide(parseCaption(BSD), { ...post, timestamp: '2021-10-08T07:45:17+0000' }, ctx([])).action).toBe('pending');
    expect(decide(parseCaption(`${BSD}\nStatus : On going`.replace('Status : Complete\n', '')), post, ctx([])).action).toBe('pending');
    expect(decide(parseCaption(BSD), { ...post, hasImages: false }, ctx([])).action).toBe('pending');
  });
});
