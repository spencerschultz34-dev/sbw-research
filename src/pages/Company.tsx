import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { companyById, companyStatus, ensureCompany } from '../data'
import { secAvailable } from '../sec'
import { useStore } from '../store'
import { Empty } from '../components/ui'
import { SecCompanyPage } from './SecCompany'
import { CompanyProfileFallback } from './CompanyProfile'
import { idFor } from '../data/companies'

/** A company page: profile, results, earnings calls and filings, all from the live sources. */
export function CompanyPage() {
  const { id = '' } = useParams()
  const normalized = idFor(id)
  useStore() // re-render when the company's details arrive
  useEffect(() => { void ensureCompany(normalized) }, [normalized])
  const c = companyById(normalized)
  if (!secAvailable || !c.cik) return <CompanyProfileFallback id={normalized} />
  return <SecCompanyPage key={normalized} cik={String(c.cik)} base={`/company/${normalized}`} companyId={normalized} />
}
