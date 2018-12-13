# Autotool

Module for tera proxy.

## Main features
- Activates gathering tools automatically depending on which type of node is closest to you.
- Easily configurable with item links.

### Additional features
- Hide quest and non-gathering nodes to unclutter your radar (configurable, default: disabled)
- Show helper beams on gathering nodes, if you're really blind or don't want to use the radar (configurable, default: disabled)

## Usage
- All commands start with `autotool` and are sent in `/8`(Proxy) channel
- Configure your tools:
  - `<tool> <item link>`
  - Examples:
    - `/8 autotool pick <item link>`
    - `/8 autotool sickle <item link>`
    - `/8 autotool extractor <item link>`
- Disable a tool:
  - `<tool>` `disable`/`disabled`/`none`/`off`
  - Example:
    - `/8 autotool pick none`
- Hide/show unrelated nodes:
  - `hide`/`show`/`hideother`/`showall`/`unclutter`
  - Example:
    - `/8 autotool hide`
- Toggle helper beams:
  - `helper`
- Print your current config:
  - `info`