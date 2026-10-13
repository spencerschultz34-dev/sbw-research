import type { Transcript, SummarySection, ReportDoc, Slide } from './types'

// Hand-written sample content for the showcase event (Northwind Beverages Q3 2026).
// Fictional company and people.

export const NWB_Q3_TRANSCRIPT: Transcript = {
  speakers: [
    { name: 'Operator', role: '', isOperator: true },
    { name: 'Dana Whitfield', role: 'SVP of Investor Relations, Northwind Beverages' },
    { name: 'Marcus Oyelaran', role: 'Chairman and CEO, Northwind Beverages' },
    { name: 'Priya Castellanos', role: 'EVP and CFO, Northwind Beverages' },
    { name: 'Tom Harrigan', role: 'Analyst, Lexington Partners', isAnalyst: true },
    { name: 'Ingrid Solberg', role: 'Analyst, Fairmount Securities', isAnalyst: true },
  ],
  chapters: [
    { title: 'Intro and disclaimers', start: 0 },
    { title: 'Quarter overview', start: 95 },
    { title: 'North America snacks', start: 410 },
    { title: 'International performance', start: 690 },
    { title: 'Financial results and guidance', start: 980 },
    { title: 'Q&A', start: 1420 },
  ],
  qnaStart: 1420,
  paragraphs: [
    { id: 'p1', speaker: 0, start: 0, chapter: 0, text: "Good morning, and welcome to Northwind Beverages' 2026 third quarter earnings question-and-answer session. Your lines have been placed on listen-only until it's your turn to ask a question. Today's call is being recorded and will be archived on the company's investor website. It is now my pleasure to introduce Ms. Dana Whitfield, Senior Vice President of Investor Relations. Ms. Whitfield, you may begin." },
    { id: 'p2', speaker: 1, start: 19, chapter: 0, text: "Good morning, everyone, and thank you for joining. I hope everyone has had a chance this morning to review our press release and prepared remarks, both of which are available on our website. Before we begin, please take note of our cautionary statement. We may make forward-looking statements on today's call, including about our business plans, guidance and outlook. These statements reflect our view as of today, October 8th, 2026, and we are under no obligation to update them." },
    { id: 'p3', speaker: 1, start: 49, chapter: 0, text: "When discussing our results, we refer to non-GAAP measures, which exclude certain items from reported results. Please refer to our third quarter 2026 earnings release and Form 10-Q for definitions and reconciliations. Joining me today are Marcus Oyelaran, our Chairman and CEO, and Priya Castellanos, our CFO. With that, I'll turn it over to Marcus." },
    { id: 'p4', speaker: 2, start: 95, chapter: 1, text: "Thank you, Dana, and good morning. We delivered a solid third quarter. Organic revenue grew 3.1%, our fastest pace since the fourth quarter of 2023, and we saw organic volume growth across both global beverages and convenient foods. International strength more than offset continued pressure on margins in North America, which is exactly the resilience we built the portfolio to deliver." },
    { id: 'p5', speaker: 2, start: 180, chapter: 1, text: "Our international business grew organic revenue 7% with balanced contributions from price and volume. Emerging markets were again the standout, and we continue to gain share in salty snacks in most of our largest international markets. We are also seeing real traction from the portfolio transformation work, including smaller pack sizes, protein and fiber-forward products, and our zero-sugar beverage lineup." },
    { id: 'p6', speaker: 2, start: 410, chapter: 2, text: "In North America snacks, trends improved sequentially. Volume declines narrowed to roughly 1%, and we're encouraged by the response to our value-focused pack architecture at the lower price points. We still have more work to do on affordability and on execution in the convenience channel, and that remains a priority for the fourth quarter and into 2027." },
    { id: 'p7', speaker: 2, start: 690, chapter: 3, text: "Turning to international, Europe, Middle East and Africa posted mid-single-digit organic growth, and Latin America grew high single digits with strong performance in Mexico and Brazil. We continue to invest behind our power brands in these regions, and marketing as a percentage of sales was up about 40 basis points year over year." },
    { id: 'p8', speaker: 3, start: 980, chapter: 4, text: "Thanks, Marcus. Net revenue rose 5.6% to $25.27 billion. Reported operating profit increased 19% to $4.26 billion, and diluted EPS increased 17% to $2.23. On a core basis, operating profit grew 3% and core diluted EPS rose 2% to $2.34. Core operating margin was 16.9%, down 35 basis points, as inflation and higher marketing investment were partly offset by pricing and productivity." },
    { id: 'p9', speaker: 3, start: 1150, chapter: 4, text: "Turning to guidance, we now expect low-single-digit organic revenue growth for the full year, and we are reaffirming core constant-currency EPS growth of approximately 2%. We continue to expect to return about $8.4 billion to shareholders this year, comprised of $7.4 billion in dividends and $1.0 billion in share repurchases. Capital spending is expected to remain below 5% of net revenue." },
    { id: 'p10', speaker: 0, start: 1420, chapter: 5, text: 'Thank you. We will now begin the question-and-answer session. Our first question comes from Tom Harrigan with Lexington Partners. Your line is open.' },
    { id: 'p11', speaker: 4, start: 1432, chapter: 5, text: "Thanks, good morning. Marcus, can you talk about the cadence of the North America snacks recovery? You mentioned volume declines narrowed. How much of that is the pack architecture versus easier comparisons, and how should we think about the fourth quarter?" },
    { id: 'p12', speaker: 2, start: 1461, chapter: 5, text: "Good question, Tom. I'd say roughly two thirds of the improvement is from the actions we've taken on value and pack architecture, and about a third is the comparison. For the fourth quarter, we expect continued sequential improvement, but we're not calling a full recovery yet. Pricing power is still constrained at the low end, and we'll keep investing to protect household penetration." },
    { id: 'p13', speaker: 0, start: 1560, chapter: 5, text: 'Our next question comes from Ingrid Solberg with Fairmount Securities. Your line is open.' },
    { id: 'p14', speaker: 5, start: 1566, chapter: 5, text: "Hi, thanks. Priya, on margins, can you help us bridge the 35 basis point decline in core operating margin? And are you still comfortable with the productivity savings target of $1.5 billion for the year?" },
    { id: 'p15', speaker: 3, start: 1590, chapter: 5, text: "Sure, Ingrid. About half of the decline is the step-up in marketing, and the rest is commodity and labor inflation, mainly in North America. On productivity, yes, we're on track for $1.5 billion this year, and we've identified a pipeline that supports a similar level in 2027, largely from automation in manufacturing and our shared services model. Free cash flow per share remains a key focus." },
    { id: 'p16', speaker: 0, start: 1702, chapter: 5, text: 'Thank you. That concludes the question-and-answer session. You may now disconnect.' },
  ],
}

export const NWB_Q3_SUMMARY: SummarySection[] = [
  {
    heading: 'Executive summary',
    bullets: [
      { text: 'Q3 net revenue rose 5.6% to $25.27B; organic revenue growth accelerated to 3.1%, its fastest pace since Q4 2023, with organic volume growth across global beverages and convenient foods.', cites: [{ n: 1, tab: 'report', ref: 'nwb-q3-er:0' }, { n: 2, tab: 'transcript', ref: 'p4' }] },
      { text: 'International strength offset North American pressure; North American snack trends improved sequentially, while affordability and execution remained a priority.', cites: [{ n: 3, tab: 'transcript', ref: 'p6' }, { n: 4, tab: 'transcript', ref: 'p5' }] },
    ],
  },
  {
    heading: 'Financial highlights',
    bullets: [
      { text: 'Reported operating profit rose 19% to $4.26B and diluted EPS increased 17% to $2.23; core operating profit grew 3% and core diluted EPS rose 2% to $2.34.', cites: [{ n: 5, tab: 'transcript', ref: 'p8' }, { n: 6, tab: 'report', ref: 'nwb-q3-er:1' }] },
      { text: 'Core operating margin was 16.9%, down 35 bps on inflation and higher marketing investment, partly offset by pricing and productivity.', cites: [{ n: 7, tab: 'transcript', ref: 'p15' }] },
    ],
  },
  {
    heading: 'Management commentary',
    bullets: [
      { text: 'Management attributes about two thirds of the North America snacks improvement to value and pack-architecture actions, but is not yet calling a full recovery.', cites: [{ n: 8, tab: 'transcript', ref: 'p12' }] },
      { text: 'Productivity savings of $1.5B remain on track for 2026, with a pipeline to support a similar level in 2027.', cites: [{ n: 9, tab: 'transcript', ref: 'p15' }] },
    ],
  },
  {
    heading: 'Capital allocation and strategy',
    bullets: [
      { text: 'Full-year guidance updated to low-single-digit organic revenue growth; core constant-currency EPS growth of about 2% reaffirmed.', cites: [{ n: 10, tab: 'transcript', ref: 'p9' }, { n: 11, tab: 'report', ref: 'nwb-q3-er:0' }] },
      { text: 'Expects to return about $8.4B to shareholders in 2026 ($7.4B dividends, $1.0B buybacks); capital spending to stay below 5% of net revenue.', cites: [{ n: 12, tab: 'slides', ref: 'capex' }] },
    ],
  },
]

const er = (q: string, rev: string, org: string, eps: string): ReportDoc => ({
  id: 'nwb-q3-er', kind: 'Earnings release', form: '8-K', title: 'Earnings release',
  pages: [
    { blocks: [
      { t: 'h', text: `Northwind Beverages Reports ${q} Results` },
      { t: 'h', text: 'Third-Quarter and Year-to-Date Results' },
      { t: 'ul', items: [`Net revenue increased ${rev} and 6.7%, respectively`, `Organic revenue increased ${org} and 2.7%, respectively`, `Earnings per share (EPS) increased 17% and 47%, respectively`, 'Core EPS increased 2% and 5%, respectively', `Core constant currency EPS increased ${eps} and 2%, respectively`] },
      { t: 'h', text: 'Guidance' },
      { t: 'ul', items: ['Company updates fiscal 2026 financial guidance'] },
      { t: 'p', text: 'RYE BROOK, N.Y. — October 8, 2026 — Northwind Beverages, Inc. today reported results for the third quarter 2026.' },
      { t: 'p', text: '"Our third-quarter results featured strong net revenue growth, an acceleration in organic revenue growth with organic volume growth across both global beverages and convenient foods," said Chairman and CEO Marcus Oyelaran. "The results reflect the scale and resilience of the international business and an improved presence in underpenetrated channels."' },
    ] },
    { blocks: [
      { t: 'h', text: 'Summary Third-Quarter 2026 Performance' },
      { t: 'table', rows: [['', 'Reported', 'Organic', 'Core EPS'], ['Northwind Snacks North America', '(1)%', '(1)%', ''], ['Northwind Beverages North America', '2%', '2%', ''], ['Latin America', '9%', '8%', ''], ['Europe, Middle East and Africa', '6%', '5%', ''], ['International Beverages', '7%', '7%', ''], ['Total', '5.6%', '3.1%', '$2.34']] },
      { t: 'p', text: 'Reported operating profit rose 19% to $4.260 billion, and diluted EPS increased 17% to $2.23. Core operating profit grew 3%, and core diluted EPS rose 2% to $2.34.' },
      { t: 'p', text: 'Third-quarter operating margin was 16.9%, up 195 basis points; core operating margin was 16.9%, down 35 basis points, reflecting inflation and higher marketing investment, partially offset by pricing and productivity.' },
    ] },
    { blocks: [
      { t: 'h', text: '2026 Guidance and Outlook' },
      { t: 'p', text: 'The company now expects a low-single-digit increase in organic revenue and approximately 2% growth in core constant currency EPS for fiscal 2026.' },
      { t: 'p', text: 'The company continues to expect total cash returns to shareholders of approximately $8.4 billion in 2026, comprised of dividends of $7.4 billion and share repurchases of $1.0 billion.' },
      { t: 'h', text: 'Conference Call' },
      { t: 'p', text: 'At 8:15 a.m. Eastern time today, the company will host a question-and-answer session with investors and financial analysts.' },
    ] },
  ],
})

export const NWB_Q3_REPORTS: ReportDoc[] = [
  er('Third-Quarter 2026', '5.6%', '3.1%', '1.5%'),
  {
    id: 'nwb-q3-10q', kind: 'Quarterly report', form: '10-Q', title: 'Quarterly report',
    pages: [
      { blocks: [
        { t: 'h', text: 'FORM 10-Q' },
        { t: 'p', text: 'Quarterly report pursuant to Section 13 or 15(d) of the Securities Exchange Act of 1934 for the quarterly period ended September 5, 2026.' },
        { t: 'h', text: 'Item 2. Management\'s Discussion and Analysis' },
        { t: 'p', text: 'Our business is affected by macroeconomic conditions including inflation and consumer affordability, particularly in North America, where lower-income households continued to trade down to value pack sizes.' },
      ] },
      { blocks: [
        { t: 'h', text: 'Risk factors' },
        { t: 'p', text: 'Changes in tariff policy, commodity costs, and foreign exchange rates could adversely affect our results. Our productivity program depends on the successful deployment of automation in manufacturing.' },
        { t: 'h', text: 'Liquidity and capital resources' },
        { t: 'p', text: 'Net cash provided by operating activities was $6.1 billion year to date. We repurchased $0.8 billion of common stock and paid dividends of $5.5 billion year to date.' },
      ] },
    ],
  },
  {
    id: 'nwb-q3-pr', kind: 'Prepared remarks', title: 'Prepared remarks',
    pages: [
      { blocks: [
        { t: 'h', text: 'Third Quarter 2026 Prepared Management Remarks' },
        { t: 'p', text: 'We are pleased with the acceleration in organic revenue growth this quarter. Our international business continues to perform well, and North America snack trends improved sequentially.' },
        { t: 'p', text: 'We remain focused on three priorities: improving affordability and value, accelerating innovation in better-for-you products, and driving productivity to fund growth.' },
      ] },
    ],
  },
]

export const nwbSlides = (variant: 0 | 1 | 2): Slide[] => {
  const growth = [2.1, 1.7, 3.1][variant]
  return [
    { key: 'cover', title: `Q${variant + 1} 2026 Earnings`, category: 'Cover', kind: 'cover', subtitle: 'Investor presentation' },
    { key: 'runway', title: 'Our categories provide a long runway for growth', category: 'Market overview', kind: 'kpis',
      kpis: [{ label: 'Global convenient food TAM', value: '$620B' }, { label: 'Global beverage TAM', value: '$1.1T' }, { label: 'Northwind share', value: `${(12 + variant * 0.2).toFixed(1)}%` }, { label: 'Est. category growth', value: '+4–5%' }] },
    { key: 'organic', title: 'Organic revenue growth by quarter', category: 'Financial results', kind: 'bars',
      bars: [{ label: 'Q3 25', value: 1.3 }, { label: 'Q4 25', value: 2.4 }, { label: 'Q1 26', value: 2.1 }, { label: 'Q2 26', value: 1.7 }, { label: 'Q3 26', value: 3.1 }].slice(0, 3 + variant) },
    { key: 'capex', title: 'Moderating capital spend while balancing business needs', category: 'Capital allocation', kind: 'bars',
      subtitle: 'Gross capital spending, % of net revenue',
      bars: [{ label: '2019–24 avg', value: 6 }, { label: '2025', value: 5.4 }, { label: '2026E', value: [5, 4.9, 4.8][variant] }] },
    { key: 'priorities', title: 'Hungry and thirsty for growth', category: 'Product & solutions', kind: 'text',
      bullets: ['Value pack architecture at lower price points', 'Protein and fiber-forward snacks', 'Zero-sugar beverage lineup expansion', `Organic growth this quarter: ${growth}%`] },
  ]
}
