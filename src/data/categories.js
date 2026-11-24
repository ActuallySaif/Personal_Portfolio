// The three shipping containers in the Blender scene, one per project category.
//   node:     object name in Blender (and in the exported glTF)
//   outFrame: Blender frame at which that container has finished sliding out (see the keyframe map)
//   slug:     used in the page address, e.g. /category/ui-ux
//   match:    words looked for in Supabase categories.catTitle to link a row to this container
//             (lowercase, letters and digits only; the first category that matches wins)
export const CATEGORIES = [
  { slug: '3d-design', label: '3D Designs', node: '3DDesignContainer', outFrame: 144, match: ['3d'] },
  { slug: 'frontend', label: 'Frontend Dev', node: 'FrontendContainer', outFrame: 120, match: ['frontend', 'front', 'dev', 'web', 'code'] },
  { slug: 'ui-ux', label: 'UI Designs', node: 'UIUXContainer', outFrame: 132, match: ['uiux', 'ui', 'ux', 'design'] },
]

export const categoryBySlug = (slug) => CATEGORIES.find((c) => c.slug === slug)
