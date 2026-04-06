import type {
  Brand, Agent, Post, CompetitorAnalysis, MetricsReport,
  ContentStrategy, StrategySession, SocialAccount, Campaign, FormatInsights,
} from './types'

function get<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch { return fallback }
}
function set<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  try { sessionStorage.setItem(key, JSON.stringify(value)) } catch { /* quota */ }
}

// ─── Selected Brand (global context) ─────────────────────────────────────────

export const getSelectedBrandId = (): string => {
  if (typeof window === 'undefined') return ''
  return sessionStorage.getItem('autocm_selected_brand') ?? ''
}
export const setSelectedBrandId = (id: string): void => {
  if (typeof window === 'undefined') return
  sessionStorage.setItem('autocm_selected_brand', id)
}

// ─── Brands ──────────────────────────────────────────────────────────────────

const BK = 'autocm_brands'
export const getBrands   = (): Brand[] => get<Brand[]>(BK, [])
export const upsertBrand = (b: Brand): void => {
  const all = getBrands()
  set(BK, all.find(x => x.id === b.id) ? all.map(x => x.id === b.id ? b : x) : [...all, b])
}
export const deleteBrand = (id: string): void => {
  set(BK, getBrands().filter(b => b.id !== id))
  set(AK, getAgents().filter(a => a.brand_id !== id))
}

// ─── Agents ──────────────────────────────────────────────────────────────────

const AK = 'autocm_agents'
export const getAgents            = (): Agent[] => get<Agent[]>(AK, [])
export const getBrandAgents       = (bid: string) => getAgents().filter(a => a.brand_id === bid)
export const getBrandAgentsByRole = (bid: string, role: Agent['role']) =>
  getAgents().filter(a => a.brand_id === bid && a.role === role)
export const upsertAgent = (a: Agent): void => {
  const all = getAgents()
  set(AK, all.find(x => x.id === a.id) ? all.map(x => x.id === a.id ? a : x) : [...all, a])
}
export const deleteAgent = (id: string): void => set(AK, getAgents().filter(a => a.id !== id))

// ─── Format Insights cache (per brand) ───────────────────────────────────────

export const getFormatInsights = (brand_id: string): FormatInsights | null =>
  get<FormatInsights | null>(`autocm_format_insights_${brand_id}`, null)
export const saveFormatInsights = (fi: FormatInsights): void =>
  set(`autocm_format_insights_${fi.brand_id}`, fi)

// ─── Posts ───────────────────────────────────────────────────────────────────

const PK = 'autocm_posts'
export const getPosts   = (): Post[] => get<Post[]>(PK, [])
export const addPost    = (p: Post): void => set(PK, [p, ...getPosts()])
export const upsertPost = (p: Post): void => {
  const all = getPosts()
  set(PK, all.find(x => x.id === p.id) ? all.map(x => x.id === p.id ? p : x) : [p, ...all])
}

// ─── Strategy session ─────────────────────────────────────────────────────────

const SK = 'autocm_strategy_session'
export const getStrategySession   = (): StrategySession | null => get<StrategySession | null>(SK, null)
export const saveStrategySession  = (s: StrategySession): void => set(SK, s)
export const clearStrategySession = (): void => {
  if (typeof window !== 'undefined') sessionStorage.removeItem(SK)
}

// ─── Campaigns ───────────────────────────────────────────────────────────────

const CK = 'autocm_campaigns'
export const getCampaigns   = (): Campaign[] => get<Campaign[]>(CK, [])
export const upsertCampaign = (c: Campaign): void => {
  const all = getCampaigns()
  set(CK, all.find(x => x.id === c.id) ? all.map(x => x.id === c.id ? c : x) : [c, ...all])
}
export const deleteCampaign = (id: string): void => set(CK, getCampaigns().filter(c => c.id !== id))

// ─── Social accounts ──────────────────────────────────────────────────────────

const SAK = 'autocm_social_accounts'
export const getSocialAccounts      = (): SocialAccount[] => get<SocialAccount[]>(SAK, [])
export const getBrandSocialAccounts = (bid: string) => getSocialAccounts().filter(a => a.brand_id === bid)
export const upsertSocialAccount    = (a: SocialAccount): void => {
  const all = getSocialAccounts()
  set(SAK, all.find(x => x.id === a.id) ? all.map(x => x.id === a.id ? a : x) : [...all, a])
}
export const deleteSocialAccount = (id: string): void =>
  set(SAK, getSocialAccounts().filter(a => a.id !== id))

// ─── Competitor analyses ──────────────────────────────────────────────────────

const COMP_K = 'autocm_comp_analyses'
export const getCompetitorAnalyses = (): CompetitorAnalysis[] => get<CompetitorAnalysis[]>(COMP_K, [])
export const addCompetitorAnalysis = (a: CompetitorAnalysis): void =>
  set(COMP_K, [a, ...getCompetitorAnalyses()])

// ─── Metrics (CSV) ───────────────────────────────────────────────────────────

const MK = 'autocm_metrics'
export const getMetricsReports = (): MetricsReport[] => get<MetricsReport[]>(MK, [])
export const addMetricsReport  = (r: MetricsReport): void => set(MK, [r, ...getMetricsReports()])

// ─── Content strategies ───────────────────────────────────────────────────────

const STRAT_K = 'autocm_strategies'
export const getStrategies = (): ContentStrategy[] => get<ContentStrategy[]>(STRAT_K, [])
export const addStrategy   = (s: ContentStrategy): void => set(STRAT_K, [s, ...getStrategies()])
