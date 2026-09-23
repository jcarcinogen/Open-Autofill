# Icon proposal — separate from the installed extension

**Recommendation:** the refresh is worth considering. Deep branded green (`#215a25`) and warm ivory (`#f3ece3`) fit the store artwork better than the bright Material-green tile. A solid pencil, open form outline and single sparkle preserve the recognizable idea while removing cap seams, facets and the second tiny sparkle. No gradients, bevels or extra accent hue.

- `icon.svg`: canonical 128×128 vector, exactly 96×96 artwork centered at (16,16).
- `icon128.png`: transparent RGBA store icon; measured nontransparent bounds (16,16)–(112,112). Resampling fringes outside that footprint were cleared.
- `icon32.png`, `icon48.png`: optically enlarged toolbar sizes with one-pixel outer padding, derived from the main mark.
- `toolbar16.svg`, `icon16.png`: dedicated optical small-size variant. Thicker pencil, simpler form and **no sparkle at 16px**. A straight downscale was visually too ambiguous; this version reads as an edit/form mark, trading away the sparkle detail rather than pretending it survives.
- `preview.png`: actual 128/48/32/16 sizes on dark and light backgrounds.
- `render.html`: transparent Chrome render source for the main mark.

All PNGs use real alpha and transparent corner pixels. Tiny alpha ringing below 8/255 was cleared from the 16px output. Review at native size, not only an enlarged preview.

The proposal was visually reviewed at 16/32/48 and 128. The form/pencil family remains; the full sparkle concept is reserved for 32px and above. Approved and promoted into production `icons/` and the four v2 screenshots for v1.7.7. This directory retains the design sources and review board.
