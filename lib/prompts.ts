import type { Agent, Brand, FormatInsights, ContentFormat } from './types'

// ─── Template vars ────────────────────────────────────────────────────────────

export type TemplateVars = {
  brand_name?: string; brand_prompt?: string; brandbook?: string
  segment?: string; platform?: string; platforms?: string; period?: string
  num_days?: string; day?: string; topic?: string; hook?: string
  content_type?: string; format?: string; visual_direction?: string
  strategy_json?: string; tone_voice?: string; energy?: string
  formality?: string; extra_rules?: string; content_priorities?: string
  format_insights?: string; keywords?: string
}

export function resolveTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = vars[key as keyof TemplateVars]
    return val !== undefined ? val : `{{${key}}}`
  })
}

// ─── Format insights block ────────────────────────────────────────────────────

function formatInsightsBlock(fi: FormatInsights | null | undefined): string {
  if (!fi) return '(Sin métricas disponibles — elegí formatos basándote en el tipo de contenido y la plataforma)'

  const stats = Object.entries(fi.format_stats ?? {})
    .map(([fmt, s]) => s ? `  ${fmt}: ${s.count} posts, ER promedio ${s.avg_er}%, avg likes ${s.avg_likes}${s.avg_views ? `, avg vistas ${s.avg_views}` : ''}` : '')
    .filter(Boolean)
    .join('\n')

  return `MÉTRICAS REALES DE LA CUENTA (@${fi.instagram_handle}, ${fi.source}):
  Seguidores: ${fi.followers_count.toLocaleString()}
  Mejor formato por engagement: ${fi.best_format.toUpperCase()} ★
  Stats por formato:\n${stats}
  Mejores horarios: ${fi.best_posting_hours.map(h => `${h}:00`).join(', ')}
  Top hashtags: ${fi.top_hashtags.slice(0, 8).join(' ')}
  (Fuente: ${fi.source === 'apify' ? 'datos reales de Apify' : 'datos ingresados manualmente'})`
}

// ─── Base Estratega Prompt ────────────────────────────────────────────────────

export const BASE_ESTRATEGA_PROMPT = `Sos el estratega de contenido de la marca "{{brand_name}}".

═══ INFORMACIÓN DE LA MARCA ═══
{{brand_prompt}}

═══ BRANDBOOK ═══
{{brandbook}}

═══ MÉTRICAS DE LA CUENTA ═══
{{format_insights}}

═══ TU TAREA ═══
Crear un plan de contenido de {{num_days}} días para {{period}}.
Redes sociales: {{platforms}} — SOLO estas redes.

REGLAS ESTRICTAS:
- Elegí el FORMATO de cada pieza (reel/story/carousel/post/video/live) basándote en las métricas reales de la cuenta
- Si el reel tiene mejor ER, priorizá reels. Justificá con los números reales
- Incluí keywords específicas para cada post (para caption, overlay de texto y SEO)
- Si el formato es reel, story o video, incluí un script_outline con las escenas
- Variá content_type: informativo, producto, comunidad, educativo, tendencia
- No repitas el mismo formato + content_type consecutivamente
- Cada tema debe ser justificable con información real de la marca

Respondé SOLO con JSON válido:
{
  "pillars": ["pilar 1", "pilar 2"],
  "strategy_rationale": "lógica del plan citando las métricas",
  "posts": [
    {
      "day": 1,
      "platform": "instagram",
      "format": "reel|story|carousel|post|video|live",
      "format_rationale": "por qué este formato (citá ER o estadística real si la hay)",
      "content_type": "informativo|producto|comunidad|educativo|tendencia",
      "topic": "tema específico y accionable",
      "keywords": ["keyword1", "keyword2", "keyword3"],
      "hook_suggestion": "primera oración que engancha",
      "source_reference": "qué dato de la marca justifica este tema",
      "visual_direction": "qué se muestra en la imagen o video",
      "script_outline": {
        "duration_sec": 30,
        "scenes": [
          { "order": 1, "duration_sec": 5, "visual": "qué se ve", "text_overlay": "texto en pantalla" },
          { "order": 2, "duration_sec": 15, "visual": "qué se ve", "text_overlay": "texto" },
          { "order": 3, "duration_sec": 10, "visual": "qué se ve", "text_overlay": "CTA final" }
        ],
        "music_mood": "sugerencia de mood musical"
      }
    }
  ]
}`

// ─── Base Copy Prompt ─────────────────────────────────────────────────────────

export const BASE_COPY_PROMPT = `Sos el agente de copy de la marca "{{brand_name}}" para el segmento: {{segment}}.

═══ INFORMACIÓN DE LA MARCA ═══
{{brand_prompt}}

═══ BRANDBOOK ═══
{{brandbook}}

═══ PERFIL DEL AGENTE ═══
Tono: {{tone_voice}} | Energía: {{energy}} | Formalidad: {{formality}}
Prioridades: {{content_priorities}}
Reglas adicionales: {{extra_rules}}

═══ TU TAREA ═══
Crear 3 versiones DISTINTAS de copy para:

Día: {{day}} | Plataforma: {{platform}} | Formato: {{format}}
Tema: {{topic}}
Keywords a incluir: {{keywords}}
Hook del estratega: {{hook}}
Dirección visual: {{visual_direction}}

REGLAS POR FORMATO:
- reel/story/video → copy MÁS CORTO (hook + CTA) + generar guión completo con escenas, voiceover y text overlays
- carousel → copy por slide (intro + 3-5 slides + cierre)
- post → copy completo con desarrollo
- story → copy ultra-corto (máx 3 líneas) + sticker/CTA sugerido

Las 3 versiones DEBEN diferir en ángulo (emocional / educativo / urgencia / humor / etc.)
Cada una respeta TODO el brandbook sin excepción.
Incluí las keywords en el copy o hashtags de forma natural.
ANTI-ALUCINACIÓN: no inventés datos que no estén en la marca.

Respondé SOLO con JSON:
{
  "copies": [
    {
      "index": 1,
      "angle": "nombre del ángulo",
      "copy": "el copy completo adaptado al formato",
      "hashtags": ["#tag1", "#tag2"],
      "keywords": ["keyword usada"],
      "rationale": "por qué este ángulo conecta con el segmento",
      "script": {
        "total_duration_sec": 30,
        "music_mood": "energético / relajado / inspiracional",
        "voiceover_full": "guión completo de voz en off o narración",
        "scenes": [
          {
            "order": 1,
            "duration_sec": 5,
            "visual": "qué se ve exactamente en pantalla",
            "text_overlay": "texto que aparece sobre el video",
            "voiceover": "lo que se dice en esta escena",
            "cta": "acción que se pide (solo en última escena)"
          }
        ]
      }
    }
  ]
}`

// ─── Base Supervisor Prompt ───────────────────────────────────────────────────

export const BASE_SUPERVISOR_PROMPT = `Sos el supervisor de contenido de la marca "{{brand_name}}".

═══ INFORMACIÓN DE LA MARCA ═══
{{brand_prompt}}

═══ BRANDBOOK ═══
{{brandbook}}

═══ MÉTRICAS DE LA CUENTA ═══
{{format_insights}}

═══ ESTRATEGIA A EVALUAR ═══
{{strategy_json}}

═══ TU TAREA ═══
Evaluá la estrategia de {{num_days}} días para {{period}}.

CRITERIOS:
- Coherencia del plan como un todo
- ¿Los formatos elegidos coinciden con las métricas reales de la cuenta?
- Alineación con el brandbook y la información de la marca
- Diversidad de formatos, temas y ángulos
- Calidad de los guiones (si los hay)
- Propone calendarización específica con horarios basados en las métricas

Respondé SOLO con JSON:
{
  "overall_score": 0,
  "brand_alignment": 0,
  "format_score": 0,
  "strengths": ["fortaleza específica"],
  "weaknesses": ["debilidad con sugerencia concreta de mejora"],
  "post_feedback": [
    { "day": 1, "topic": "tema", "format": "reel", "passed": true, "comment": null }
  ],
  "calendar_suggestion": [
    { "day": 1, "platform": "instagram", "recommended_time": "18:00", "reasoning": "mejor hora según métricas" }
  ],
  "improvements": ["mejora accionable ahora mismo"],
  "approved": false
}`

// ─── Template engine ──────────────────────────────────────────────────────────

export function buildBaseVars(brand: Brand, agent: Agent): TemplateVars {
  return {
    brand_name:        brand.name,
    brand_prompt:      brand.brand_prompt || '(sin prompt de marca configurado)',
    brandbook:         JSON.stringify(brand.brandbook_rules, null, 2),
    segment:           agent.segment,
    tone_voice:        agent.tone_voice,
    energy:            agent.energy,
    formality:         agent.formality,
    extra_rules:       agent.extra_rules.join(' | ') || 'ninguna',
    content_priorities: agent.content_priorities.join(', ') || 'generales',
  }
}

export function resolveAgentPrompt(agent: Agent, brand: Brand, extra: TemplateVars = {}): string {
  const base = buildBaseVars(brand, agent)
  return resolveTemplate(agent.custom_system_prompt, { ...base, ...extra })
}

// ─── Format insights helper for prompts ──────────────────────────────────────

export function getFormatInsightsText(fi: FormatInsights | null | undefined): string {
  return formatInsightsBlock(fi)
}

// ─── Legacy prompts (for single image generation) ─────────────────────────────

function agentBlock(agent: Agent | null | undefined): string {
  if (!agent) return ''
  return `\nAGENTE ACTIVO: "${agent.name}" → segmento: ${agent.segment}\nTono: ${agent.tone_voice} | ${agent.energy} | ${agent.formality}\nReglas extra: ${agent.extra_rules.join(' | ') || 'ninguna'}`
}

export function creatorSystem(brandName: string, platform: string, agent?: Agent | null) {
  return `Sos un copywriter experto de agencia. Creás el copy de un posteo de ${platform} para "${brandName}".${agent ? ` Agente activo: "${agent.name}" — audiencia: ${agent.segment}.` : ''}
Respetá todas las reglas del brandbook. Anti-alucinación: no inventés datos.
Respondé SOLO con JSON válido.`
}

export function creatorPrompt(
  brandbookJson: string, platform: string,
  context: { news: { title: string; source: string }[]; rss: { feed_name: string; title: string }[]; competitor_ads: { page_name: string; body_text: string }[] },
  agent?: Agent | null,
  brandPrompt?: string
) {
  const brandBlock  = brandPrompt ? `\nINFO MARCA:\n${brandPrompt.slice(0, 600)}\n` : ''
  const newsBlock   = context.news.length > 0 ? `\nNOTICIAS:\n${context.news.slice(0, 3).map(n => `- [${n.source}] ${n.title}`).join('\n')}` : ''
  const adsBlock    = context.competitor_ads.length > 0 ? `\nCOMPETIDORES:\n${context.competitor_ads.slice(0, 2).map(a => `- ${a.page_name}: "${a.body_text?.slice(0, 80)}"`).join('\n')}` : ''
  return `BRANDBOOK:\n${brandbookJson}\n${brandBlock}${agentBlock(agent)}\n${newsBlock}${adsBlock}

Analizá la imagen y generá 1 copy para ${platform}. Respondé SOLO:
{ "generated_copy": "...", "hashtags": ["#tag"], "visual_description": "...", "rationale": "..." }`
}

export function supervisorSystem() {
  return 'Sos un auditor de contenido. Verificás si el copy cumple el brandbook. No generás contenido. Respondé SOLO con JSON.'
}

export function supervisorPrompt(brandbookJson: string, copy: string, hashtags: string[], agent?: Agent | null) {
  const agentSection = agent ? `\nAGENTE: segmento "${agent.segment}", tono ${agent.tone_voice}\n` : ''
  return `BRANDBOOK:\n${brandbookJson}\n${agentSection}\nCOPY:\n"""\n${copy}\nHashtags: ${hashtags.join(' ')}\n"""\n\nRespondé SOLO:\n{ "score": 0, "overall_approved": false, "clause_validations": [], "critical_violations": 0, "suggested_fix": null }`
}

export function regeneratePrompt(originalCopy: string, instruction: string, brandbookJson: string, platform: string, agent?: Agent | null) {
  return `BRANDBOOK:\n${brandbookJson}\n${agentBlock(agent)}\nCOPY ORIGINAL:\n"""\n${originalCopy}\n"""\nINSTRUCCIÓN: "${instruction}"\n\nReescribí el copy. Respondé SOLO:\n{ "generated_copy": "...", "hashtags": [], "rationale": "..." }`
}

// ─── Competitor analysis prompts ──────────────────────────────────────────────

export function competitorAnalysisSystem() {
  return 'Sos un analista de inteligencia competitiva. Analizás EXCLUSIVAMENTE los datos reales que se te proveen. REGLA ABSOLUTA: no inventés nada. Respondé SOLO con JSON.'
}

export function competitorAnalysisPrompt(
  competitorName: string,
  brandName: string,
  realData: {
    meta_ads:       { body_text?: string }[]
    youtube_videos: { title: string; view_count: string }[]
    news:           { title: string }[]
    rss:            { title: string }[]
  }
) {
  const adsBlock  = realData.meta_ads.length > 0
    ? `AVISOS META (${realData.meta_ads.length}):\n` + realData.meta_ads.map(a => `- "${a.body_text?.slice(0, 150)}"`).join('\n')
    : 'META: sin avisos.'
  const ytBlock   = realData.youtube_videos.length > 0
    ? `\nYOUTUBE:\n` + realData.youtube_videos.map(v => `- "${v.title}" | ${v.view_count} vistas`).join('\n')
    : ''
  const newsBlock = realData.news.length > 0
    ? `\nNOTICIAS:\n` + realData.news.map(n => `- "${n.title}"`).join('\n')
    : ''

  return `Analizá a "${competitorName}" para la marca "${brandName}".\n${adsBlock}${ytBlock}${newsBlock}\n\nRespondé SOLO con JSON:\n{ "active_ads_count": 0, "main_messages": [], "content_themes": [], "posting_cadence": "...", "differentiation_opportunities": [], "topics_to_avoid": [], "recommended_angles": [], "confidence": "low", "data_sources_used": [], "disclaimer": "..." }`
}

// ─── Metrics (CSV) prompts ─────────────────────────────────────────────────────

export function metricsSystem() {
  return 'Sos un analista de performance de marketing digital. Solo analizás los datos que se te dan. No inventés benchmarks ni comparaciones externas. Respondé SOLO con JSON.'
}

export function metricsPrompt(parsedCsvData: string, platform: string, brandName: string) {
  return `DATOS DE ${platform.toUpperCase()} para "${brandName}":\n${parsedCsvData}\n\nRespondé SOLO con JSON:\n{ "best_performing_posts": [], "worst_performing_posts": [], "avg_engagement_rate": null, "best_day_of_week": "...", "best_time_of_day": "...", "top_content_themes": [], "recommendations": [], "data_quality": "minimal", "columns_found": [] }`
}
