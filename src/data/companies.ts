import type { Company } from './types'

// All companies, people and figures in this app are fictional sample data.
export const COMPANIES: Company[] = [
  {
    id: 'nwb', name: 'Northwind Beverages', ticker: 'NWB', country: 'US', industry: 'Soft Drinks and Non-alcoholic Beverages',
    marketCap: '168B USD', color: '#1F6FB2', monogram: 'N', hasEstimates: true,
    segments: [
      { title: 'Revenue', subtitle: 'by Business area', items: [
        { name: 'Northwind Beverages North America', pct: 31 }, { name: 'Northwind Snacks North America', pct: 29 },
        { name: 'Europe, Middle East and Africa', pct: 19 }, { name: 'Latin America', pct: 11 }, { name: 'Other', pct: 10 } ] },
      { title: 'Segment operating profit', subtitle: 'by Business area', items: [
        { name: 'Northwind Snacks North America', pct: 44 }, { name: 'Europe, Middle East and Africa', pct: 16 },
        { name: 'Latin America', pct: 15 }, { name: 'International Beverages', pct: 14 }, { name: 'Other', pct: 11 } ] },
      { title: 'Revenue', subtitle: 'by Geography', items: [
        { name: 'United States', pct: 55 }, { name: 'All other countries', pct: 20 }, { name: 'Mexico', pct: 8 },
        { name: 'United Kingdom', pct: 5 }, { name: 'Other', pct: 12 } ] },
    ],
  },
  {
    id: 'hbw', name: 'Harbor Wholesale', ticker: 'HBW', country: 'US', industry: 'Consumer Staples Merchandise Retail',
    marketCap: '402B USD', color: '#D23B3B', monogram: 'H', hasEstimates: false,
    segments: [
      { title: 'Revenue', subtitle: 'by Business area', items: [
        { name: 'Foods and sundries', pct: 40 }, { name: 'Non-foods', pct: 25 }, { name: 'Fresh foods', pct: 14 },
        { name: 'Warehouse ancillary', pct: 19 }, { name: 'Other', pct: 2 } ] },
      { title: 'Revenue', subtitle: 'by Geography', items: [
        { name: 'United States', pct: 73 }, { name: 'Canada', pct: 14 }, { name: 'Other international', pct: 13 } ] },
    ],
  },
  {
    id: 'mrdb', name: 'Meridian Bancorp', ticker: 'MRDB', country: 'US', industry: 'Diversified Banks',
    marketCap: '236B USD', color: '#B8892B', monogram: 'M', hasEstimates: true,
    segments: [
      { title: 'Revenue', subtitle: 'by Business area', items: [
        { name: 'Consumer Banking', pct: 38 }, { name: 'Commercial Banking', pct: 22 }, { name: 'Corporate & Investment Banking', pct: 21 },
        { name: 'Wealth & Investment Management', pct: 16 }, { name: 'Other', pct: 3 } ] },
    ],
  },
  {
    id: 'clde', name: 'Caldera Energy', ticker: 'CLDE', country: 'US', industry: 'Integrated Oil and Gas',
    marketCap: '318B USD', color: '#C2561D', monogram: 'C', hasEstimates: true,
    segments: [
      { title: 'Revenue', subtitle: 'by Business area', items: [
        { name: 'Downstream', pct: 61 }, { name: 'Upstream', pct: 34 }, { name: 'Other', pct: 5 } ] },
    ],
  },
  {
    id: 'hlxt', name: 'Helix Therapeutics', ticker: 'HLXT', country: 'US', industry: 'Biotechnology',
    marketCap: '84B USD', color: '#6A4BC4', monogram: 'Hx', hasEstimates: true,
    segments: [
      { title: 'Revenue', subtitle: 'by Product', items: [
        { name: 'Ostravia', pct: 52 }, { name: 'Lumarin', pct: 21 }, { name: 'Collaboration revenue', pct: 18 }, { name: 'Other', pct: 9 } ] },
    ],
  },
  {
    id: 'strc', name: 'Stratus Cloud', ticker: 'STRC', country: 'US', industry: 'Application Software',
    marketCap: '211B USD', color: '#1C9B8E', monogram: 'S', hasEstimates: true,
    segments: [
      { title: 'Revenue', subtitle: 'by Business area', items: [
        { name: 'Subscription', pct: 93 }, { name: 'Professional services', pct: 7 } ] },
      { title: 'Revenue', subtitle: 'by Geography', items: [
        { name: 'Americas', pct: 66 }, { name: 'Europe', pct: 23 }, { name: 'Asia Pacific', pct: 11 } ] },
    ],
  },
  {
    id: 'aurs', name: 'Aurora Semiconductor', ticker: 'AURS', country: 'US', industry: 'Semiconductors',
    marketCap: '1.21T USD', color: '#C93C6B', monogram: 'A', hasEstimates: true,
    segments: [
      { title: 'Revenue', subtitle: 'by Business area', items: [
        { name: 'Data center', pct: 58 }, { name: 'Infrastructure software', pct: 27 }, { name: 'Broadband', pct: 9 }, { name: 'Other', pct: 6 } ] },
    ],
  },
  {
    id: 'pncr', name: 'Pinecrest Rail', ticker: 'PNCR', country: 'CA', industry: 'Rail Transportation',
    marketCap: '96B CAD', color: '#2E7D4F', monogram: 'P', hasEstimates: true,
    segments: [
      { title: 'Revenue', subtitle: 'by Business area', items: [
        { name: 'Bulk', pct: 34 }, { name: 'Merchandise', pct: 38 }, { name: 'Intermodal', pct: 24 }, { name: 'Other', pct: 4 } ] },
    ],
  },
  {
    id: 'tslp', name: 'Tessel Payments', ticker: 'TSLP', country: 'US', industry: 'Transaction and Payment Processing',
    marketCap: '58B USD', color: '#3E5BD8', monogram: 'T', hasEstimates: true,
    segments: [
      { title: 'Revenue', subtitle: 'by Business area', items: [
        { name: 'Merchant solutions', pct: 64 }, { name: 'Issuer services', pct: 29 }, { name: 'Other', pct: 7 } ] },
    ],
  },
  {
    id: 'virc', name: 'Vireo Consumer', ticker: 'VIRC', country: 'US', industry: 'Household Products',
    marketCap: '377B USD', color: '#2A63C9', monogram: 'V', hasEstimates: true,
    segments: [
      { title: 'Revenue', subtitle: 'by Business area', items: [
        { name: 'Fabric & Home Care', pct: 36 }, { name: 'Baby, Feminine & Family Care', pct: 24 }, { name: 'Beauty', pct: 18 },
        { name: 'Health Care', pct: 12 }, { name: 'Grooming', pct: 10 } ] },
    ],
  },
  {
    id: 'solf', name: 'Solano Foods', ticker: 'SOLF', country: 'GB', industry: 'Food Retail',
    marketCap: '24B GBP', color: '#0E8AC4', monogram: 'So', hasEstimates: true,
    segments: [
      { title: 'Revenue', subtitle: 'by Geography', items: [
        { name: 'United Kingdom', pct: 82 }, { name: 'Ireland', pct: 9 }, { name: 'Central Europe', pct: 9 } ] },
    ],
  },
  {
    id: 'kstl', name: 'Kestrel Aerospace', ticker: 'KSTL', country: 'US', industry: 'Aerospace and Defense',
    marketCap: '247B USD', color: '#4A5568', monogram: 'K', hasEstimates: true,
    segments: [
      { title: 'Revenue', subtitle: 'by Business area', items: [
        { name: 'Commercial engines', pct: 71 }, { name: 'Defense & propulsion', pct: 29 } ] },
    ],
  },
  {
    id: 'ardi', name: 'Ardent Insurance', ticker: 'ARDI', country: 'US', industry: 'Life and Health Insurance',
    marketCap: '55B USD', color: '#0B86A8', monogram: 'Ar', hasEstimates: true,
    segments: [
      { title: 'Revenue', subtitle: 'by Geography', items: [
        { name: 'Japan', pct: 54 }, { name: 'United States', pct: 44 }, { name: 'Other', pct: 2 } ] },
    ],
  },
  {
    id: 'brwu', name: 'Brightwater Utilities', ticker: 'BRWU', country: 'CA', industry: 'Gas Utilities',
    marketCap: '112B CAD', color: '#E0A21B', monogram: 'B', hasEstimates: true,
    segments: [
      { title: 'Revenue', subtitle: 'by Business area', items: [
        { name: 'Liquids pipelines', pct: 46 }, { name: 'Gas transmission', pct: 26 }, { name: 'Gas distribution', pct: 22 }, { name: 'Renewables', pct: 6 } ] },
    ],
  },
  {
    id: 'qnt', name: 'Quill & Notch Asset Mgmt', ticker: 'QNAM', country: 'US', industry: 'Asset Management and Custody Banks',
    marketCap: '17B USD', color: '#222831', monogram: 'Q', hasEstimates: true,
    segments: [
      { title: 'Revenue', subtitle: 'by Business area', items: [
        { name: 'Investment management fees', pct: 81 }, { name: 'Sales & distribution', pct: 12 }, { name: 'Other', pct: 7 } ] },
    ],
  },
  {
    id: 'orbt', name: 'Orbital Launch Systems', ticker: 'ORBL', country: 'US', industry: 'Aerospace and Defense',
    marketCap: '41B USD', color: '#111827', monogram: 'O', hasEstimates: true,
    segments: [
      { title: 'Revenue', subtitle: 'by Business area', items: [
        { name: 'Launch services', pct: 48 }, { name: 'Satellite connectivity', pct: 41 }, { name: 'Other', pct: 11 } ] },
    ],
  },
]

export const companyById = (id: string) => COMPANIES.find((c) => c.id === id)!

export const FLAGS: Record<Company['country'], string> = {
  US: '🇺🇸', CA: '🇨🇦', GB: '🇬🇧', SE: '🇸🇪', DE: '🇩🇪',
}
