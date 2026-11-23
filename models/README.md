# 3D models

Put the raw Blender export here as `models/scene.glb` (gitignored, it's large), then run:

```
npm run optimize:model
```

That writes the web version to `public/models/scene/` (a .gltf with a .bin and WebP textures):

1. `scripts/prepare-model.mjs` fixes the export: greyscale bump images that Blender passes as
   normal maps become real normal maps, and empty light nodes (e.g. `InteriorLight`) keep their
   transforms in the scene extras. It warns if the camera or animations are missing.
2. gltf-transform compresses meshes (meshopt) and textures (WebP q92 colour / q90 data;
   the rubber hose textures are capped at 1K).

## Blender export settings (File > Export > glTF 2.0)

- Format: glTF Binary (.glb)
- Include: Cameras on
- Transform: +Y Up on
- Mesh: Apply Modifiers on
- Animation: on, "Always Sample Animations" on, full frame range
- Compression: off (the script handles it)

Save or pack baked images before exporting (File > External Data > Pack Resources), otherwise
they export blank. Only Principled BSDF + image textures carry over; bake procedural nodes.

## How the site uses it

`src/Components/Scene/BlenderScene.jsx` renders through the Blender camera and maps scroll to
Blender frames per page section (`SCROLL_KEYFRAMES`). Lighting (sun, HDRI, interior light and
interior darkness) is rebuilt in code; tweakables are at the top of that file.
