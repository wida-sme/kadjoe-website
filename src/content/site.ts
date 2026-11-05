// Every fixed string of the public site. Sentences are Kadjoe's own (WordPress site and company
// profile), shortened; nothing here is invented.

export const site = {
  name: 'Kadjoe',
  legalName: 'PT Kadjoe Kreasi Indonesia',
  url: (process.env.SITE_URL || 'https://kadjoe.com').replace(/\/$/, ''),
  founded: '2017',
  tagline: 'The balance of subtle luxe and unmatched quality.',
  // The tagline as the hero sets it: roman lead, the two qualities in italic, "and" as a mono note.
  heroTitle: { lead: 'The Balance of', first: 'Subtle Luxe', second: 'Unmatched Quality' },
  description:
    'PT Kadjoe Kreasi Indonesia designs and builds interiors in Jakarta: residential, F&B and commercial projects, credited to the studios that designed them.',
  statement:
    'PT Kadjoe Kreasi Indonesia develops interior and construction environments for residential, F&B and commercial projects.',
  about: [
    'PT Kadjoe Kreasi Indonesia was established in 2017. We develop interior and construction environments, specialising in residential, F&B, retail and office projects.',
    'We believe in a thoughtful combination of structure, proportion, design and material, carried from the minds that conceive a space to the hands that build it.',
  ],
  services: [
    { name: 'Design', text: "A great design is a well balanced composition of the client's needs, good function and beauty." },
    { name: 'Interior build', text: 'Private and commercial interiors: residential, F&B, retail, office and banking.' },
    { name: 'Civil engineering', text: 'From civil works to architecture, including mechanical and electrical works.' },
  ],
  meta: {
    projects: 'Residential, F&B and commercial interiors built by Kadjoe in Jakarta and across Indonesia, each credited to the studio that designed it.',
    partners: 'The interior design and architecture studios whose drawings Kadjoe has built, with the projects completed together.',
    about: 'PT Kadjoe Kreasi Indonesia, established in 2017: design, interior build and civil engineering for residential, F&B and commercial spaces.',
    contact: 'Contact PT Kadjoe Kreasi Indonesia in Kalideres, Jakarta Barat: email, Instagram and directions to the office.',
  },
  nav: [
    { href: '/projects', label: 'Projects' },
    { href: '/partners', label: 'Design partners' },
    { href: '/about', label: 'About Us' },
    { href: '/contact', label: 'Contact' },
  ],
} as const;
