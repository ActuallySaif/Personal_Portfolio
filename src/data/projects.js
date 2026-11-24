import { supabase } from '../supabase'
import { CATEGORIES } from './categories'

// Supabase tables (see the schema): projects.category_Id -> categories.id, categories.catTitle.
// Missing thumbnails/videos/descriptions are filled with placeholders by toProject().

// How many fake projects to show when a category has none in Supabase yet.
const PLACEHOLDER_COUNT = 6

const normalise = (v) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

/** Which container a Supabase category title belongs to, e.g. "UI/UX Design" -> ui-ux. */
export function containerForTitle(catTitle) {
  const t = normalise(catTitle)
  return CATEGORIES.find((c) => c.match.some((word) => t.includes(word))) ?? null
}

/** A Supabase projects row in the shape the site uses, with gaps filled so nothing renders blank. */
export function toProject(row, index = 0) {
  return {
    id: row.id,
    title: row.title || `Untitled project ${String(index + 1).padStart(2, '0')}`,
    description: row.desc || '',
    thumbnail: row.thumbnail_Url || null, // null -> placeholder art
    video: row.showcase_Url || null, // null -> no showcase video yet
    categoryTitle: row.categories?.catTitle ?? null,
    placeholder: Boolean(row.placeholder),
  }
}

function placeholders(category) {
  return Array.from({ length: PLACEHOLDER_COUNT }, (_, i) =>
    toProject(
      { id: `placeholder-${category.slug}-${i + 1}`, title: `${category.label} ${String(i + 1).padStart(2, '0')}`, placeholder: true },
      i
    )
  )
}

/** Projects for one category container. Falls back to placeholders if there are none or Supabase is unreachable. */
export async function fetchCategoryProjects(category) {
  const { data: cats, error: catError } = await supabase.from('categories').select('id, catTitle')
  if (catError) {
    console.warn("[projects] Couldn't read categories from Supabase:", catError.message)
    return placeholders(category)
  }
  const ids = (cats ?? []).filter((c) => containerForTitle(c.catTitle)?.slug === category.slug).map((c) => c.id)
  if (!ids.length) {
    console.warn(`[projects] No Supabase category matches "${category.label}". Titles found:`, (cats ?? []).map((c) => c.catTitle))
    return placeholders(category)
  }

  const { data, error } = await supabase
    .from('projects')
    .select('*, categories(catTitle)')
    .in('category_Id', ids)
    .order('created_at', { ascending: true })
  if (error) {
    console.warn("[projects] Couldn't read projects from Supabase:", error.message)
    return placeholders(category)
  }
  return data?.length ? data.map(toProject) : placeholders(category)
}

/** One project for its details page (with its extra media and tools). */
export async function fetchProject(id) {
  if (String(id).startsWith('placeholder-')) return null
  const { data, error } = await supabase
    .from('projects')
    .select('*, categories(catTitle), project_media(url), project_tools(tools(name, tool_Icon))')
    .eq('id', id)
    .maybeSingle()
  if (error) console.warn('[projects]', error.message)
  if (!data) return null
  return {
    ...toProject(data),
    media: (data.project_media ?? []).map((m) => m.url).filter(Boolean),
    tools: (data.project_tools ?? []).map((t) => t.tools).filter(Boolean),
  }
}
