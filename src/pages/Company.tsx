import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { companyById, companyStatus, ensureCompany } from '../data'
import { secAvailable } from '../sec'
import { useStore } from '../store'
import { Empty } from '../components/ui'
import { SecCompanyPage } from './SecCompany'

/** A company page: profile, results, earnings calls and filings, all from the live sources. */
export function CompanyPage() {
  const { id = '' } = useParams()
  const normalized = id.toLowerCase()
  useStore() // re-render when the company's details arrive
  useEffect(() => { void ensureCompany(normalized) }, [normalized])
  const c = companyById(normalized)
  if (!secAvailable) return <div className="page"><Empty>Company data loads on the hosted site (Vercel), not in this preview.</Empty></div>
  if (!c.cik) {
    const st = companyStatus(normalized)
    return <div className="page"><div className="page-head"><span className="page-title">{st === 'loading' || !st ? `Loading ${c.ticker}…` : `${c.ticker} isn't listed with the SEC`}</span></div></div>
  }
  return <SecCompanyPage key={normalized} cik={String(c.cik)} base={`/company/${normalized}`} companyId={normalized} />
}
