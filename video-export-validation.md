# Lovdoku Browser Video Export Validation

The browser-side exporter is implemented on branch `feature/browser-2k-video-export` in `iqbalhubreal/sudoku-player`.

The exporter now provides 1:1, 9:16, and 16:9 choices. The generated frames contain only the cinematic background and Sudoku board; no Lovdoku title, puzzle number, board label, `Constraint Sudoku`, or full-screen text is drawn into the video.

The multi-grid test used puzzle V2325 with four grids. All tested formats use H.264 MP4 at 24 fps and retain the 12-second sequence: full-board overview for 2 seconds, each board for 2 seconds with smooth camera movement, then the full-board overview again for 2 seconds.

| Aspect ratio | Dimensions | Duration | Test file |
|---|---:|---:|---|
| 1:1 | 2560×2560 | 12 seconds | `lovdoku-V2325-2k-1x1.mp4` |
| 9:16 | 1440×2560 | 12 seconds | `lovdoku-V2325-2k-9x16.mp4` |
| 16:9 | 2560×1440 | 12 seconds | `lovdoku-V2325-2k-16x9.mp4` |

A single-grid puzzle continues to produce a static 2-second video in the selected aspect ratio.

The output is generated entirely in the browser with a canvas, WebCodecs `VideoEncoder`, and `mp4-muxer`. The fallback uses `MediaRecorder`; browsers that expose only WebM will download WebM instead of MP4. No production deployment was performed.
