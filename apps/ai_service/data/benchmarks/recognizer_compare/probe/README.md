Put probe images here.

Recommended layout:
- `probe/person_a/test_01.jpg`
- `probe/person_b/test_01.jpg`

The first folder under `probe/` is treated as the expected identity label.

If a probe identity does not exist in `gallery/`, the sample is treated as an
open-set "unknown person" case. Use this to measure false accepts for
realtime attendance.
