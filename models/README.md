# 3D models

`models/scene.glb` is the raw export from Blender. The site loads the compressed copy at
`public/models/scene.glb`. After replacing the raw file, run:

```
npm run optimize:model
```

This compresses meshes with meshopt and textures to WebP (drei's `useGLTF` decodes both).

Raw .glb files here are gitignored (GitHub rejects files over 100 MB); only the optimized
copy in public/models is committed.

## Blender export settings (File > Export > glTF 2.0)

- Format: glTF Binary (.glb)
- Include: Cameras on (plus Punctual Lights if wanted)
- Transform: +Y Up on
- Mesh: Apply Modifiers on
- Animation: on, "Always Sample Animations" on, "Use Current Frame Range" on
- Compression: off (the optimize script handles it)

Bake the camera first (Object > Animation > Bake Action, Visual Keying + Clear Constraints)
if it follows a path or uses Track To. Only Principled BSDF + image textures carry over;
bake procedural textures to images.

## How the site uses it

`src/Components/Scene/BlenderScene.jsx` renders through the first camera in the file and
scrubs every animation clip by page scroll: top of page = first frame, bottom = last frame.
All clips share one timeline, so door and container animations keyed in the same Blender
timeline will play in sync with the camera.
