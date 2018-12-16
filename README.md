# Autotool

Module for tera proxy.

## Main features
- Activates gathering tools automatically depending on which type of node is closest to you.
- Best tools detected automatically from inventory

### Additional features
- Hide quest and non-gathering nodes to unclutter your radar (configurable, default: disabled)
- Show helper beams on gathering nodes, if you're really blind or don't want to use the radar (configurable, default: disabled)

## Usage
- Your best tools in inventory are detected automatically
- All commands start with `autotool` and are sent in `/8`(Proxy) channel
- Hide/show unrelated nodes:
  - `hide`/`show`/`hideother`/`showall`/`unclutter`
  - Example:
    - `/8 autotool hide`
- Toggle helper beams:
  - `helper`
- Print your detected tools and config:
  - `info`