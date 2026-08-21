# Lovdoku Browser Video Export Validation

The browser-side exporter is implemented on branch `feature/browser-2k-video-export` in `iqbalhubreal/sudoku-player`.

The exporter now keeps the ratio selector hidden on the board. Clicking `Export 2K Video` opens a compact dialog with `1:1`, `9:16`, and `16:9` choices plus `Create Video`; generation starts only after that confirmation.

The generated video contains no Lovdoku title, puzzle number, `Constraint Sudoku`, `Full screen`, board labels, or other overlay text. It contains only the cinematic background and Sudoku board animation.

The revised timeline begins with an empty grid. Over the first 2 seconds, the puzzle’s givens and current entries appear rapidly in a deterministic pseudo-random order. The fully populated overview then holds for 1 second. The multi-grid camera sequence follows: full overview for 2 seconds, each grid for 2 seconds with smooth camera movement, and the full overview again for 2 seconds.

For the tested V2325 four-grid puzzle, the resulting duration is 15 seconds: 2 seconds reveal + 1 second pause + 12 seconds of grid views.

| Aspect ratio | Dimensions | Codec | Duration |
|---|---:|---|---:|
| 1:1 | 2560×2560 | H.264 MP4 | 15 seconds |
| 9:16 | 1440×2560 | H.264 MP4 | 15 seconds |
| 16:9 | 2560×1440 | H.264 MP4 | 15 seconds |

A single-grid puzzle uses the same 2-second reveal and 1-second pause, followed by its 2-second static overview, for a 5-second export.

The output is generated entirely in the browser with a canvas, WebCodecs `VideoEncoder`, and `mp4-muxer`. The fallback uses `MediaRecorder`; browsers that expose only WebM will download WebM instead of MP4. No production deployment was performed.
